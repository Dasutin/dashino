import fs from 'fs/promises';
import path from 'path';

// Use a browser-like UA to reduce blocks from some feeds.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const TIMEOUT_MS = 12_000;
const MAX_ITEMS = 12;

const INSTANCES_DIR = path.resolve(process.cwd(), 'widget-instances');

const defaultInstances = [
  { id: 'rss', title: 'Headlines', feeds: [{ name: 'Hacker News', url: 'https://hnrss.org/frontpage' }] },
  {
    id: 'rss2',
    title: 'Tech Headlines',
    feeds: [
      { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
    ]
  }
];

const decodeEntities = input => {
  const withoutCdata = input.replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1');
  return withoutCdata
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
};

const pickTag = (block, tags) => {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = block.match(re);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return null;
};

const pickAtomLink = block => {
  const re = /<link[^>]*href=["']([^"']+)["'][^>]*>/i;
  const match = block.match(re);
  return match?.[1] ? decodeEntities(match[1].trim()) : null;
};

const toIso = value => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
};

const makeId = (source, title, link) => [source || '', title || '', link || ''].join('|').toLowerCase();

const safeParseJson = async filePath => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeUrl = value => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.toString();
  } catch {
    return '';
  }
};

const validateRssInstance = input => {
  if (!input || typeof input !== 'object') return null;
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  if (!id || type !== 'rss') return null;
  const name = typeof input.name === 'string' ? input.name.trim() : 'Headlines';
  const cfg = input.config || {};
  const feedsRaw = Array.isArray(cfg.feeds) ? cfg.feeds : [];
  const feeds = feedsRaw
    .map(f => {
      const url = normalizeUrl(f?.url);
      if (!url) return null;
      const feedName = typeof f?.name === 'string' ? f.name.trim() : undefined;
      return { name: feedName, url };
    })
    .filter(Boolean);
  if (!feeds.length) return null;

  const maxItems = Number.isFinite(Number(cfg.maxItems)) ? Math.max(1, Math.min(50, Number(cfg.maxItems))) : undefined;

  return { id, title: cfg.title || name, feeds, maxItems };
};

const loadRssInstances = async () => {
  try {
    const files = await fs.readdir(INSTANCES_DIR);
    const instances = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          const data = await safeParseJson(path.join(INSTANCES_DIR, f));
          return validateRssInstance(data);
        })
    );
    return instances.filter(Boolean);
  } catch {
    return [];
  }
};

const parseRss = (xml, source) => {
  const blocks = xml.match(new RegExp('<item[\\s\\S]*?<\\/item>', 'gi')) || [];
  return blocks
    .map(block => {
      const title = pickTag(block, ['title']);
      if (!title) return null;
      const link = pickTag(block, ['link']);
      const publishedAt = toIso(pickTag(block, ['pubDate', 'published', 'updated']));
      return {
        id: makeId(source, title, link),
        source,
        title,
        link: link || null,
        publishedAt
      };
    })
    .filter(Boolean);
};

const parseAtom = (xml, source) => {
  const blocks = xml.match(new RegExp('<entry[\\s\\S]*?<\\/entry>', 'gi')) || [];
  return blocks
    .map(block => {
      const title = pickTag(block, ['title']);
      if (!title) return null;
      const link = pickAtomLink(block);
      const publishedAt = toIso(pickTag(block, ['updated', 'published']));
      return {
        id: makeId(source, title, link),
        source,
        title,
        link: link || null,
        publishedAt
      };
    })
    .filter(Boolean);
};

const parseFeed = (xml, source) => {
  if (/<rss[^>]*>/i.test(xml) || /<channel[^>]*>/i.test(xml)) {
    return parseRss(xml, source);
  }
  if (/<feed[^>]*>/i.test(xml)) {
    return parseAtom(xml, source);
  }
  return [];
};

const fetchWithTimeout = async url => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/atom+xml, text/xml, */*;q=0.1'
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

const fetchMergedItemsForFeeds = async (feeds, maxItems = MAX_ITEMS) => {
  const results = [];

  for (const feed of feeds) {
    try {
      const xml = await fetchWithTimeout(feed.url);
      const items = parseFeed(xml, feed.name);
      results.push(...items);
    } catch {
      // skip this feed on error
    }
  }

  const byId = new Map();
  results.forEach(item => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });

  return Array.from(byId.values())
    .sort((a, b) => {
      const da = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
      const db = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
      if (da === db) return 0;
      return db - da;
    })
    .slice(0, maxItems ?? MAX_ITEMS);
};

export default {
  interval: 60_000,
  widgetId: 'rss',
  type: 'rss',
  run: async emit => {
    const nowIso = new Date().toISOString();
    const instances = await loadRssInstances();
    const targets = instances.length ? instances : defaultInstances;

    for (const inst of targets) {
      try {
        const items = await fetchMergedItemsForFeeds(inst.feeds, inst.maxItems ?? MAX_ITEMS);
        emit({
          widgetId: inst.id,
          type: 'rss',
          data: {
            title: inst.title || 'Headlines',
            updatedAt: nowIso,
            items
          }
        });
      } catch (err) {
        emit({
          widgetId: inst.id,
          type: 'rss',
          data: {
            title: inst.title || 'Headlines',
            updatedAt: nowIso,
            error: `${err}`,
            items: []
          }
        });
      }
    }
  }
};
