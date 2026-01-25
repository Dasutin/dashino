import 'dotenv/config';
import cors from 'cors';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import fs from 'fs';
import archiver from 'archiver';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fork, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const projectRoot = process.cwd();
const logDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function logFilenameFor(date = new Date()) {
  const d = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logDir, `server-${d}.log`);
}

let logStream = fs.createWriteStream(logFilenameFor(), { flags: 'a' });
const fsPromises = fs.promises;
const cacheDisabled = Boolean(process.env.CACHE_DISABLE && /^(1|true|yes)$/i.test(process.env.CACHE_DISABLE));

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4040;
const jsonLimit = process.env.JSON_BODY_LIMIT || '256kb';

type LogLevel = 'info' | 'warn' | 'error';
function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()} ${message}`;
  const line = !meta || Object.keys(meta).length === 0 ? base : `${base} ${JSON.stringify(meta)}`;
  (console as any)[level](line);
  try {
    logStream.write(`${line}\n`);
  } catch {
    // best-effort; don't crash on log write errors
  }
}

async function compressFile(file: string) {
  const gz = `${file}.gz`;
  try {
    await pipeline(fs.createReadStream(file), createGzip(), fs.createWriteStream(gz));
    await fsPromises.unlink(file).catch(() => {});
  } catch {
    // best-effort; ignore compression errors
  }
}

async function pruneLogs(retentionDays = 3) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  try {
    const files = await fsPromises.readdir(logDir);
    await Promise.all(
      files.map(async f => {
        if (!f.startsWith('server-')) return;
        const full = path.join(logDir, f);
        try {
          const stat = await fsPromises.stat(full);
          if (stat.mtimeMs < cutoff) {
            await fsPromises.unlink(full).catch(() => {});
          }
        } catch {
          // ignore stat/delete errors
        }
      })
    );
  } catch {
    // ignore prune errors
  }
}

async function rotateIfNeeded() {
  const target = logFilenameFor();
  const currentPath = (logStream as any).path as string | undefined;
  if (currentPath === target) return;

  try {
    logStream.end();
  } catch {
    // ignore
  }

  if (currentPath && currentPath.endsWith('.log')) {
    compressFile(currentPath).catch(() => {});
  }

  logStream = fs.createWriteStream(target, { flags: 'a' });
  pruneLogs().catch(() => {});
}

// Initial rotation/prune on startup and periodic check hourly
rotateIfNeeded();
setInterval(rotateIfNeeded, 60 * 60 * 1000).unref();

type StreamMessage = {
  widgetId?: string;
  type?: string;
  data?: unknown;
  at?: string;
};

type WidgetPlacement = {
  id: string;
  type: string;
  title?: string;
  position?: { w?: number; h?: number; x?: number; y?: number };
};

type Dashboard = {
  slug: string;
  name: string;
  description?: string;
  maxColumns: number;
  gutter?: number;
  widgets: WidgetPlacement[];
};

type Playlist = {
  slug: string;
  name: string;
  rotationSeconds: number;
  dashboards: string[];
};

app.use(cors());
app.use(express.json({ limit: jsonLimit }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('info', 'req', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start
    });
  });
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve project root so it works in both tsx (src) and built (dist) executions.
const dashboardsDir = path.join(projectRoot, 'dashboards');
const widgetsDir = path.join(projectRoot, 'widgets');
const jobsDir = path.join(projectRoot, 'jobs');
const themesDir = path.join(projectRoot, 'themes');
const assetsDir = path.join(projectRoot, 'assets');
const playlistsDir = path.join(projectRoot, 'playlists');

const slugifyValue = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

if (!fs.existsSync(playlistsDir)) {
  fs.mkdirSync(playlistsDir, { recursive: true });
}
// Serve built client assets (dist/web) when running the compiled server.
// __dirname resolves to dist/server at runtime, so the client build sits at ../web
// (avoid double "dist/dist" when resolving the path).
const webBuildDir = path.resolve(__dirname, '../web');

app.use(express.static(webBuildDir));
const noStore = {
  etag: false,
  lastModified: false,
  cacheControl: true,
  maxAge: 0,
  setHeaders: (res: Response) => res.set('Cache-Control', 'no-store')
} as const;
app.use('/assets', express.static(assetsDir, noStore));

let dashboardsCache: Dashboard[] = [];
let dashboardsDirty = true;

let playlistsCache: Playlist[] = [];
let playlistsDirty = true;

function watchDirRecursive(dir: string, onChange: () => void) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.watch(dir, { recursive: true }, () => onChange());
  } catch (err) {
    log('warn', 'watch setup failed', { dir, error: `${err}` });
  }
}

async function loadDashboards(): Promise<Dashboard[]> {
  if (!dashboardsDirty && !cacheDisabled) return dashboardsCache;
  if (!fs.existsSync(dashboardsDir)) {
    log('warn', 'dashboards dir missing', { dir: dashboardsDir });
    dashboardsCache = [];
    dashboardsDirty = false;
    return dashboardsCache;
  }

  const files = (await fsPromises.readdir(dashboardsDir)).filter(f => f.endsWith('.json'));
  const loaded: Dashboard[] = [];
  for (const file of files) {
    try {
      const raw = await fsPromises.readFile(path.join(dashboardsDir, file), 'utf-8');
      loaded.push(JSON.parse(raw) as Dashboard);
    } catch (err) {
      log('warn', 'failed to load dashboard', { file, error: `${err}` });
    }
  }
  dashboardsCache = loaded;
  dashboardsDirty = false;
  return dashboardsCache;
}

async function loadPlaylists(): Promise<Playlist[]> {
  if (!playlistsDirty && !cacheDisabled) return playlistsCache;
  if (!fs.existsSync(playlistsDir)) {
    log('warn', 'playlists dir missing', { dir: playlistsDir });
    playlistsCache = [];
    playlistsDirty = false;
    return playlistsCache;
  }

  const files = (await fsPromises.readdir(playlistsDir)).filter(f => f.endsWith('.json'));
  const loaded: Playlist[] = [];
  for (const file of files) {
    try {
      const raw = await fsPromises.readFile(path.join(playlistsDir, file), 'utf-8');
      const json = JSON.parse(raw) as Playlist;
      if (!json.slug || !json.name || !Array.isArray(json.dashboards)) {
        throw new Error('invalid playlist');
      }
      loaded.push(json);
    } catch (err) {
      log('warn', 'failed to load playlist', { file, error: `${err}` });
    }
  }
  playlistsCache = loaded;
  playlistsDirty = false;
  return playlistsCache;
}

type CachedFile = { content: string; mtimeMs: number };
const widgetCache = new Map<string, CachedFile>();
let widgetsDirty = false;

const themeCache = new Map<string, CachedFile>();
let themesDirty = false;

type Client = {
  id: number;
  res: Response;
};

const cache = new Map<string, StreamMessage>();

let clients: Client[] = [];
let eventId = 0;

function sendEvent(res: Response, data: StreamMessage, event?: string) {
  const lines = [
    `id: ${eventId++}`,
    event ? `event: ${event}` : null,
    `data: ${JSON.stringify(data)}`
  ]
    .filter(Boolean)
    .join('\n');

  // Each event must end with a blank line so the browser dispatches it.
  res.write(`${lines}\n\n`);

  // Flush immediately if available to reduce buffering on some proxies.
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }
}

function broadcast(message: StreamMessage, event?: string) {
  cacheMessage(message);
  clients.forEach(client => sendEvent(client.res, message, event));
}

function cacheMessage(message: StreamMessage) {
  const key = message.widgetId || message.type;
  if (!key) return;
  if (message.data === undefined) return;
  cache.set(key, message);
}

function sendCache(res: Response) {
  cache.forEach(msg => {
    sendEvent(res, msg);
  });
}

type WebhookTarget = {
  source: string;
  secretEnv: string;
  widgetId?: string;
  type?: string;
};

function isValidSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

function prettyWriteJson(filePath: string, data: unknown) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  return fsPromises.writeFile(filePath, content, 'utf-8');
}

function prettyWriteDashboard(filePath: string, dashboard: Dashboard) {
  const { widgets, ...rest } = dashboard;
  const base = JSON.stringify({ ...rest, widgets: [] }, null, 2);
  const widgetsBlock = widgets
    .map(w => `    ${JSON.stringify(w)}`)
    .join(',\n');
  const content = base.replace(
    /"widgets": \[\]/,
    widgetsBlock.length > 0 ? `"widgets": [\n${widgetsBlock}\n  ]` : '"widgets": []'
  );
  return fsPromises.writeFile(filePath, `${content}\n`, 'utf-8');
}

const webhookTargets = buildWebhookTargets();
const webhookSecretHeader = 'x-webhook-secret';

function normalizeEnvKey(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

function buildWebhookTargets(): Map<string, WebhookTarget> {
  const targets = new Map<string, WebhookTarget>();
  const list = (process.env.WEBHOOK_SOURCES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const source of list) {
    const normalized = source.toLowerCase();
    const envKey = normalizeEnvKey(source);
    targets.set(normalized, {
      source: normalized,
      secretEnv: `WEBHOOK_SECRET_${envKey}`,
      widgetId: process.env[`WEBHOOK_${envKey}_WIDGET_ID`],
      type: process.env[`WEBHOOK_${envKey}_TYPE`] || normalized
    });
  }

  return targets;
}

function safeCompareSecret(a: string, b: string) {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

app.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // keep the socket alive explicitly
  req.socket.setKeepAlive(true, 10000);

  // initial ready event plus comment to ensure proxies flush
  res.write(': connected\n\n');
  // use default event type so onmessage fires immediately
  sendEvent(res, { type: 'ready', data: { status: 'connected' } });
  sendCache(res);

  const clientId = Date.now();
  const client = { id: clientId, res };
  clients.push(client);
  log('info', 'SSE client connected', { clients: clients.length });

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
    log('info', 'SSE client disconnected', { clients: clients.length });
  });
});

app.get('/api/dashboards', async (_req: Request, res: Response) => {
  const dashboards = await loadDashboards();
  res.json({ dashboards });
});

app.delete('/api/dashboards/:slug', async (req: Request, res: Response) => {
  const slug = (req.params.slug || '').trim();
  if (!slug || !isValidSlug(slug)) {
    res.status(400).json({ error: 'invalid slug' });
    return;
  }

  const filePath = path.join(dashboardsDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'dashboard not found' });
    return;
  }

  try {
    await fsPromises.unlink(filePath);
    dashboardsDirty = true;
    res.json({ ok: true });
  } catch (err) {
    log('error', 'failed to delete dashboard', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to delete dashboard' });
  }
});

app.post('/api/dashboards', async (req: Request, res: Response) => {
  const name = (req.body?.name || '').trim();
  const shortname = (req.body?.shortname || '').trim();
  const description = (req.body?.description || '').trim();
  const theme = (req.body?.theme || '').trim();
  const rowsRaw = req.body?.rows;
  const colsRaw = req.body?.columns;
  const widgetsRaw = Array.isArray(req.body?.widgets) ? req.body.widgets : [];

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const slugBase = slugifyValue(shortname || name) || 'dashboard';
  const slug = slugBase;
  const filePath = path.join(dashboardsDir, `${slug}.json`);

  if (fs.existsSync(filePath)) {
    res.status(409).json({ error: 'dashboard already exists' });
    return;
  }

  const maxRows = Number.isFinite(Number(rowsRaw)) ? Number(rowsRaw) : 6;
  const maxColumns = Number.isFinite(Number(colsRaw)) ? Number(colsRaw) : 12;
  const themeName = theme || 'main';

  const maxSlots = Math.max(1, maxRows * maxColumns);
  const widgetCounts: Record<string, number> = {};
  const widgets = widgetsRaw
    .slice(0, maxSlots)
    .map((item: any) => {
      const rawType = typeof item === 'string' ? item : item?.type;
      const type = slugifyValue(rawType || '');
      if (!type) return null;
      widgetCounts[type] = (widgetCounts[type] ?? 0) + 1;
      const id = typeof item === 'object' && typeof item?.id === 'string' && item.id.trim()
        ? item.id.trim()
        : widgetCounts[type] === 1
          ? type
          : `${type}-${widgetCounts[type]}`;
      return {
        id,
        type,
        position: { w: 1, h: 1 }
      } satisfies Dashboard['widgets'][number];
    })
    .filter(Boolean) as Dashboard['widgets'];

  if (widgetsRaw.length > maxSlots) {
    res.status(400).json({ error: `Too many widgets for grid capacity (${maxSlots} slots)` });
    return;
  }

  const dashboard: Dashboard = {
    slug,
    name,
    description,
    maxColumns,
    maxRows,
    gutter: 0,
    widgets,
    columnWidth: 160,
    rowHeight: 180,
    className: themeName ? `theme-${themeName}` : undefined,
    theme: themeName || undefined
  } as Dashboard & { className?: string; theme?: string; maxRows?: number; columnWidth?: number; rowHeight?: number };

  try {
    await prettyWriteDashboard(filePath, dashboard);
    dashboardsDirty = true;
    res.status(201).json({ dashboard });
  } catch (err) {
    log('error', 'failed to create dashboard', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to create dashboard' });
  }
});

app.post('/api/dashboards/:slug', async (req: Request, res: Response) => {
  const slug = (req.params.slug || '').trim();
  if (!slug || !isValidSlug(slug)) {
    res.status(400).json({ error: 'invalid slug' });
    return;
  }

  const filePath = path.join(dashboardsDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'dashboard not found' });
    return;
  }

  let existing: Dashboard & {
    className?: string;
    theme?: string;
    maxRows?: number;
    columnWidth?: number;
    rowHeight?: number;
  };

  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8');
    existing = JSON.parse(raw) as Dashboard & {
      className?: string;
      theme?: string;
      maxRows?: number;
      columnWidth?: number;
      rowHeight?: number;
    };
  } catch (err) {
    log('error', 'failed to read dashboard for edit', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to read dashboard' });
    return;
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : existing.name;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const description = typeof req.body?.description === 'string'
    ? req.body.description.trim()
    : existing.description ?? '';

  const themeProvided = typeof req.body?.theme === 'string';
  const themeInput = themeProvided ? req.body.theme.trim() : undefined;
  const existingThemeName = existing.theme ?? (existing.className?.startsWith('theme-') ? existing.className.replace(/^theme-/, '') : undefined);
  const themeName = themeProvided ? themeInput || '' : existingThemeName ?? '';

  const rowsRaw = req.body?.rows;
  const colsRaw = req.body?.columns;

  const maxRows = Number.isFinite(Number(rowsRaw)) ? Number(rowsRaw) : Number.isFinite(existing.maxRows) ? Number(existing.maxRows) : 6;
  const maxColumns = Number.isFinite(Number(colsRaw)) ? Number(colsRaw) : Number.isFinite(existing.maxColumns) ? Number(existing.maxColumns) : 12;

  if (!Number.isFinite(maxColumns) || maxColumns <= 0) {
    res.status(400).json({ error: 'columns must be greater than 0' });
    return;
  }

  if (!Number.isFinite(maxRows) || maxRows <= 0) {
    res.status(400).json({ error: 'rows must be greater than 0' });
    return;
  }

  const maxSlots = Math.max(1, maxRows * maxColumns);

  const sanitizeWidgets = (items: unknown[]): Dashboard['widgets'] => {
    const counts: Record<string, number> = {};
    const ids = new Set<string>();

    const widgets = items
      .map(item => {
        const raw = item as any;
        const rawType = typeof raw === 'string' ? raw : raw?.type;
        const type = slugifyValue(rawType || '');
        if (!type) return null;

        const rawId = typeof raw === 'object' && typeof raw?.id === 'string' ? raw.id.trim() : '';

        counts[type] = (counts[type] ?? 0) + 1;
        let id = rawId || (counts[type] === 1 ? type : `${type}-${counts[type]}`);
        let attempt = counts[type];
        while (ids.has(id)) {
          attempt += 1;
          id = `${type}-${attempt}`;
        }

        ids.add(id);

        const pos = raw?.position || {};
        const position: Dashboard['widgets'][number]['position'] = {};
        if (Number.isFinite(pos.w)) position.w = Number(pos.w);
        if (Number.isFinite(pos.h)) position.h = Number(pos.h);
        if (Number.isFinite(pos.x)) position.x = Number(pos.x);
        if (Number.isFinite(pos.y)) position.y = Number(pos.y);

        return { id, type, position } satisfies Dashboard['widgets'][number];
      })
      .filter(Boolean) as Dashboard['widgets'];

    return widgets;
  };

  let nextWidgets: Dashboard['widgets'] = existing.widgets ?? [];

  if (widgetsRaw !== undefined) {
    nextWidgets = sanitizeWidgets(widgetsRaw);
  }

  if (nextWidgets.length > maxSlots) {
    res.status(400).json({ error: `Too many widgets for grid capacity (${maxSlots} slots)` });
    return;
  }

  const nextDashboard: Dashboard & { className?: string; theme?: string; maxRows?: number; columnWidth?: number; rowHeight?: number } = {
    ...existing,
    name,
    description,
    maxColumns,
    maxRows,
    className: themeProvided ? (themeName ? `theme-${themeName}` : undefined) : existing.className,
    theme: themeProvided ? (themeName || undefined) : existingThemeName,
    widgets: nextWidgets
  };

  try {
    await prettyWriteDashboard(filePath, nextDashboard);
    dashboardsDirty = true;
    res.json({ ok: true, dashboard: nextDashboard });
  } catch (err) {
    log('error', 'failed to update dashboard', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to update dashboard' });
  }
});

app.post('/api/dashboards/:slug/layout', async (req: Request, res: Response) => {
  const slug = req.params.slug;
  const layout = req.body?.layout as Record<string, { x?: number; y?: number; w?: number; h?: number }> | undefined;

  if (!layout || typeof layout !== 'object') {
    res.status(400).json({ error: 'layout object required' });
    return;
  }

  try {
    const files = (await fsPromises.readdir(dashboardsDir)).filter(f => f.endsWith('.json'));
    let found = false;

    for (const file of files) {
      const full = path.join(dashboardsDir, file);
      const raw = await fsPromises.readFile(full, 'utf-8');
      let json: Dashboard;
      try {
        json = JSON.parse(raw) as Dashboard;
      } catch (err) {
        log('warn', 'failed to parse dashboard for layout save', { file, error: `${err}` });
        continue;
      }

      if (json.slug !== slug) continue;

      found = true;
      const updatedWidgets = json.widgets.map(w => {
        const l = layout[w.id];
        if (!l) return w;
        const pos = w.position ?? {};

        const next = { ...pos } as { w?: number; h?: number; x?: number; y?: number };
        if (Number.isFinite(l.x)) next.x = Number(l.x);
        if (Number.isFinite(l.y)) next.y = Number(l.y);
        if (Number.isFinite(l.w)) next.w = Number(l.w);
        if (Number.isFinite(l.h)) next.h = Number(l.h);
        return { ...w, position: next };
      });

      const nextDashboard: Dashboard = { ...json, widgets: updatedWidgets };

      // Pretty-print with widgets one per line
      await prettyWriteDashboard(full, nextDashboard);
      dashboardsDirty = true;
      log('info', 'dashboard layout saved', { slug, file });
      res.json({ ok: true });
      return;
    }

    if (!found) {
      res.status(404).json({ error: 'dashboard not found' });
    }
  } catch (err) {
    log('error', 'failed to save layout', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to save layout' });
  }
});

app.get('/api/playlists', async (_req: Request, res: Response) => {
  const playlists = await loadPlaylists();
  res.json({ playlists });
});

app.get('/api/playlists/:slug', async (req: Request, res: Response) => {
  const slug = (req.params.slug || '').trim();
  const playlists = await loadPlaylists();
  const found = playlists.find(p => p.slug === slug);
  if (!found) {
    res.status(404).json({ error: 'playlist not found' });
    return;
  }
  res.json({ playlist: found });
});

app.post('/api/playlists/:slug', async (req: Request, res: Response) => {
  const slug = (req.params.slug || '').trim();
  if (!slug || !isValidSlug(slug)) {
    res.status(400).json({ error: 'invalid slug' });
    return;
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const rotationSeconds = Number(req.body?.rotationSeconds);
  const dashboards = Array.isArray(req.body?.dashboards)
    ? (req.body.dashboards as unknown[]).filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean)
    : [];

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (!Number.isFinite(rotationSeconds) || rotationSeconds <= 0) {
    res.status(400).json({ error: 'rotationSeconds must be > 0' });
    return;
  }

  const dashboardsList = await loadDashboards();
  const dashboardSlugs = new Set(dashboardsList.map(d => d.slug));
  if (dashboardSlugs.has(slug)) {
    res.status(400).json({ error: 'playlist slug conflicts with dashboard' });
    return;
  }

  const playlist: Playlist = {
    slug,
    name,
    rotationSeconds,
    dashboards
  };

  try {
    await prettyWriteJson(path.join(playlistsDir, `${slug}.json`), playlist);
    playlistsDirty = true;
    res.json({ ok: true, playlist });
  } catch (err) {
    log('error', 'failed to save playlist', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to save playlist' });
  }
});

app.delete('/api/playlists/:slug', async (req: Request, res: Response) => {
  const slug = (req.params.slug || '').trim();
  const file = path.join(playlistsDir, `${slug}.json`);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: 'playlist not found' });
    return;
  }

  try {
    await fsPromises.unlink(file);
    playlistsDirty = true;
    res.json({ ok: true });
  } catch (err) {
    log('error', 'failed to delete playlist', { slug, error: `${err}` });
    res.status(500).json({ error: 'failed to delete playlist' });
  }
});

app.post('/api/events', (req: Request, res: Response) => {
  const { type = 'message', data = {}, widgetId } = req.body ?? {};
  broadcast({ widgetId, type, data, at: new Date().toISOString() });
  res.status(202).json({ ok: true });
});

app.post('/api/webhooks/:source', (req: Request, res: Response) => {
  const source = (req.params.source || '').toLowerCase();
  const target = webhookTargets.get(source);

  if (!target) {
    res.status(404).json({ error: 'unknown webhook' });
    return;
  }

  const secret = process.env[target.secretEnv];
  if (!secret) {
    log('warn', 'webhook secret not set; webhook disabled', { source, env: target.secretEnv });
    res.status(503).json({ error: 'webhook disabled' });
    return;
  }

  const provided = req.header(webhookSecretHeader) || '';
  if (!provided || !safeCompareSecret(provided, secret)) {
    log('warn', 'webhook auth failed', { source });
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const { data: bodyData, widgetId: bodyWidgetId, type: bodyType, ...rest } = payload as Record<string, unknown>;

  const widgetId = (typeof bodyWidgetId === 'string' && bodyWidgetId) || target.widgetId;
  const type = (typeof bodyType === 'string' && bodyType) || target.type || source;
  const data = bodyData !== undefined ? bodyData : rest;

  if (!widgetId && !type) {
    res.status(400).json({ error: 'widgetId or type required' });
    return;
  }

  const enriched: StreamMessage = {
    widgetId,
    type,
    data,
    at: new Date().toISOString()
  };

  broadcast(enriched);
  log('info', 'webhook accepted', { source, widgetId, type });
  res.status(202).json({ ok: true });
});

const ticker = setInterval(() => {
  // periodic heartbeat event to keep connections fresh
  broadcast({ type: 'tick', at: new Date().toISOString() });
}, 5000);

type JobDefaults = { widgetId?: string; type?: string; interval?: number };
type JobChild = {
  name: string;
  file: string;
  child: ChildProcess;
  defaults?: JobDefaults;
};

const jobChildren: JobChild[] = [];

function spawnJobProcess(file: string) {
  const fullPath = path.join(jobsDir, file);
  const runnerPath = path.join(projectRoot, 'job-runner.mjs');
  const child = fork(runnerPath, [fullPath], {
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  });

  const record: JobChild = { name: file, file: fullPath, child, defaults: undefined };
  jobChildren.push(record);

  child.on('message', msg => {
    const m = msg as { type?: string; payload?: StreamMessage; defaults?: JobDefaults; error?: string };
    if (!m || typeof m !== 'object') return;

    if (m.type === 'meta') {
      record.defaults = m.defaults;
      log('info', 'Job metadata received', { job: file, defaults: record.defaults });
      return;
    }

    if (m.type === 'emit' && m.payload) {
      const enriched: StreamMessage = {
        ...m.payload,
        widgetId: m.payload.widgetId ?? record.defaults?.widgetId,
        type: m.payload.type ?? record.defaults?.type,
        at: m.payload.at ?? new Date().toISOString()
      };
      broadcast(enriched);
      return;
    }

    if (m.type === 'run-error') {
      log('error', 'Job run error', { job: file, error: m.error });
      return;
    }
  });

  child.on('exit', (code, signal) => {
    log('warn', 'Job process exited', { job: file, code, signal });
    const idx = jobChildren.findIndex(j => j.child === child);
    if (idx >= 0) jobChildren.splice(idx, 1);
    setTimeout(() => spawnJobProcess(file), 2000);
  });

  log('info', 'Started job process', { job: file });
}

async function startJobs() {
  if (!fs.existsSync(jobsDir)) {
    log('warn', 'No jobs directory found; skipping scheduled jobs', { dir: jobsDir });
    return;
  }

  const files = fs
    .readdirSync(jobsDir)
    .filter(file => file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'));

  files.forEach(file => spawnJobProcess(file));
}

type Health = { status: string };
app.get('/api/health', (_req: Request, res: Response<Health>) => {
  res.json({ status: 'ok' });
});

app.get('/api/backup.zip', async (_req: Request, res: Response) => {
  const createdAt = new Date();
  const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
  const filename = `dashino-backup-${timestamp}.zip`;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const includes: string[] = [];
  const sources = [
    { name: 'dashboards', dir: dashboardsDir },
    { name: 'themes', dir: themesDir },
    { name: 'widgets', dir: widgetsDir },
    { name: 'jobs', dir: jobsDir },
    { name: 'playlists', dir: playlistsDir }
  ];

  const handleError = (err: unknown) => {
    log('error', 'backup zip error', { error: `${err}` });
    try {
      archive.destroy();
    } catch {
      // ignore
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'failed to create backup' });
    } else {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  };

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');

  archive.on('error', handleError);
  res.on('close', () => {
    try {
      archive.destroy();
    } catch {
      // ignore
    }
  });

  archive.pipe(res);

  for (const src of sources) {
    if (!fs.existsSync(src.dir)) {
      log('warn', 'backup source missing', { dir: src.dir });
      continue;
    }
    includes.push(src.name);
    archive.directory(src.dir, src.name);
  }

  const manifest = {
    createdAt: createdAt.toISOString(),
    includes
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  try {
    await archive.finalize();
  } catch (err) {
    handleError(err);
  }
});

app.get('/widgets/:type/widget.:ext', async (req: Request, res: Response) => {
  const { type, ext } = req.params;
  if (ext !== 'html' && ext !== 'css') {
    res.status(404).end();
    return;
  }
  const key = `${type}/widget.${ext}`;
  if (widgetsDirty) widgetCache.delete(key);
  widgetsDirty = false;

  const filePath = path.join(widgetsDir, type, `widget.${ext}`);

  if (cacheDisabled) {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.type(ext).send(content);
    } catch (err) {
      log('warn', 'widget load failed', { key, error: `${err}` });
      res.status(404).end();
    }
    return;
  }

  try {
    const stat = await fsPromises.stat(filePath);
    const cached = widgetCache.get(key);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      res.setHeader('Cache-Control', 'no-store');
      res.type(ext).send(cached.content);
      return;
    }

    const content = await fsPromises.readFile(filePath, 'utf-8');
    widgetCache.set(key, { content, mtimeMs: stat.mtimeMs });
    res.setHeader('Cache-Control', 'no-store');
    res.type(ext).send(content);
  } catch (err) {
    log('warn', 'widget load failed', { key, error: `${err}` });
    res.status(404).end();
  }
});

app.get('/themes/:name.css', async (req: Request, res: Response) => {
  const { name } = req.params;
  const key = `${name}.css`;
  if (themesDirty) themeCache.delete(key);
  themesDirty = false;

  const filePath = path.join(themesDir, `${name}.css`);

  if (cacheDisabled) {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.type('css').send(content);
    } catch (err) {
      log('warn', 'theme load failed', { key, error: `${err}` });
      res.status(404).end();
    }
    return;
  }

  try {
    const stat = await fsPromises.stat(filePath);
    const cached = themeCache.get(key);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      res.setHeader('Cache-Control', 'no-store');
      res.type('css').send(cached.content);
      return;
    }

    const content = await fsPromises.readFile(filePath, 'utf-8');
    themeCache.set(key, { content, mtimeMs: stat.mtimeMs });
    res.setHeader('Cache-Control', 'no-store');
    res.type('css').send(content);
  } catch (err) {
    log('warn', 'theme load failed', { key, error: `${err}` });
    res.status(404).end();
  }
});

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(webBuildDir, 'index.html'));
});

startJobs().catch(error => {
  log('error', 'Failed to start jobs', { error: `${error}` });
});

app.listen(port, () => {
  log('info', 'dashino server listening', { port });
});

if (cacheDisabled) {
  log('info', 'Cache disabled for dashboards/widgets/themes');
}

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down');
  clearInterval(ticker);
  jobChildren.forEach(job => {
    try {
      job.child.kill();
    } catch {
      // ignore
    }
  });
  try {
    logStream.end();
  } catch {
    // ignore
  }
});

// watch for file changes to invalidate caches
watchDirRecursive(dashboardsDir, () => {
  dashboardsDirty = true;
  log('info', 'dashboards changed; cache invalidated');
});

watchDirRecursive(widgetsDir, () => {
  widgetsDirty = true;
});

watchDirRecursive(themesDir, () => {
  themesDirty = true;
});

watchDirRecursive(playlistsDir, () => {
  playlistsDirty = true;
  log('info', 'playlists changed; cache invalidated');
});
