import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  Dashboard,
  StreamPayload,
  WidgetController,
  WidgetFactory,
  WidgetPlacement,
  WidgetTemplate
} from "./types";
import "./dashboard.css";
import controllersMap from "./controllers/generated";

const DEFAULT_GUTTER = 16;
const DEFAULT_COLUMN_WIDTH = 160;
const DEFAULT_ROW_HEIGHT = 180;
const DEFAULT_MAX_ROWS = 200;

const widgetFactories: Record<string, WidgetFactory> = controllersMap;

function get(obj: any, path: string) {
  return path.split(".").reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : ""), obj);
}

function renderTemplate(template: string, data: Record<string, unknown>) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => {
    const value = get(data, key);
    return value === undefined ? "" : String(value);
  });
}

type LayoutPosition = { x: number; y: number; w: number; h: number };

function layoutsEqual(a: Record<string, LayoutPosition>, b: Record<string, LayoutPosition>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const va = a[key];
    const vb = b[key];
    if (!vb) return false;
    if (va.x !== vb.x || va.y !== vb.y || va.w !== vb.w || va.h !== vb.h) return false;
  }
  return true;
}

function loadSavedLayout(
  slug: string,
  widgets: WidgetPlacement[],
  columns: number,
  defaultSpan: { w?: number; h?: number } | undefined,
  maxRows: number
) {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(`layout:${slug}`);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<LayoutPosition>>;
    const preferred: Record<string, Partial<LayoutPosition>> = {};
    widgets.forEach(w => {
      const p = parsed[w.id];
      if (!p) return;
      const x = Number(p.x);
      const y = Number(p.y);
      const wSpan = Number(p.w) || undefined;
      const hSpan = Number(p.h) || undefined;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        preferred[w.id] = { x, y, w: wSpan, h: hSpan };
      }
    });
    return materializeLayout(widgets, columns, defaultSpan, preferred, maxRows);
  } catch {
    return undefined;
  }
}

function saveLayout(slug: string, layout: Record<string, LayoutPosition>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`layout:${slug}`, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

function sizeFor(widget: WidgetPlacement, defaultSpan?: { w?: number; h?: number }) {
  const w = widget.position?.w ?? defaultSpan?.w ?? 1;
  const h = widget.position?.h ?? defaultSpan?.h ?? 1;
  return { w, h };
}

function fitsAt(
  occupied: Set<string>,
  x: number,
  y: number,
  w: number,
  h: number,
  columns: number
) {
  if (x < 1 || y < 1) return false;
  if (x + w - 1 > columns) return false;
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (occupied.has(`${x + dx},${y + dy}`)) return false;
    }
  }
  return true;
}

function mark(occupied: Set<string>, x: number, y: number, w: number, h: number) {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      occupied.add(`${x + dx},${y + dy}`);
    }
  }
}

function findSpot(occupied: Set<string>, w: number, h: number, columns: number, maxRows: number): { x: number; y: number } {
  for (let row = 1; row <= maxRows; row++) {
    for (let col = 1; col <= columns; col++) {
      if (fitsAt(occupied, col, row, w, h, columns)) {
        return { x: col, y: row };
      }
    }
  }
  // Fallback: place at bottom of grid
  return { x: 1, y: maxRows };
}

function materializeLayout(
  widgets: WidgetPlacement[],
  columns: number,
  defaultSpan?: { w?: number; h?: number },
  preferred?: Record<string, Partial<LayoutPosition>>,
  maxRows: number = DEFAULT_MAX_ROWS
): Record<string, LayoutPosition> {
  const occupied = new Set<string>();
  const layout: Record<string, LayoutPosition> = {};

  for (const widget of widgets) {
    const { w, h } = sizeFor(widget, defaultSpan);
    const desired = preferred?.[widget.id] ?? widget.position;
    const desiredX = desired?.x ?? widget.position?.x;
    const desiredY = desired?.y ?? widget.position?.y;

    let placed = false;
    if (desiredX && desiredY && fitsAt(occupied, desiredX, desiredY, w, h, columns)) {
      layout[widget.id] = { x: desiredX, y: desiredY, w, h };
      mark(occupied, desiredX, desiredY, w, h);
      placed = true;
    }

    if (!placed) {
      const spot = findSpot(occupied, w, h, columns, maxRows);
      layout[widget.id] = { x: spot.x, y: spot.y, w, h };
      mark(occupied, spot.x, spot.y, w, h);
    }
  }

  return layout;
}

type WidgetCardProps = {
  widget: WidgetPlacement;
  position?: { x?: number; y?: number; w?: number; h?: number };
  template?: WidgetTemplate;
  payload?: StreamPayload;
  defaultSpan?: { w?: number; h?: number };
  dragStyle?: CSSProperties;
  isDragging?: boolean;
  onPointerDown?: (evt: React.PointerEvent) => void;
};

function WidgetCard({ widget, position, template, payload, defaultSpan, dragStyle, isDragging, onPointerDown }: WidgetCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<WidgetController | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const factory = widgetFactories[widget.type];
    if (!factory) return;

    controllerRef.current?.destroy?.();
    controllerRef.current = factory({ root, widget, template });
    controllerRef.current?.update?.(payload);

    return () => {
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
    };
  }, [widget.id, widget.type, template]);

  useEffect(() => {
    controllerRef.current?.update?.(payload);
  }, [payload]);

  const pos = position ?? widget.position ?? {};
  const style: CSSProperties = {
    gridColumnEnd: `span ${pos.w ?? defaultSpan?.w ?? 1}`,
    gridRowEnd: `span ${pos.h ?? defaultSpan?.h ?? 1}`
  };

  if (pos.x) style.gridColumnStart = pos.x;
  if (pos.y) style.gridRowStart = pos.y;

  const data = payload?.data ?? payload ?? {};
  const html = template
    ? renderTemplate(template.html, {
        ...data,
        type: payload?.type,
        at: payload?.at,
        title: widget.title,
        id: widget.id
      })
    : '<div class="placeholder">Loading widget...</div>';

  const isGradientWidget = widget.type === "nest" || widget.type === "ev";
  const articleStyle: CSSProperties = isGradientWidget
    ? { ...style, background: "transparent", boxShadow: "none", border: "none" }
    : style;

  if (dragStyle) {
    Object.assign(articleStyle, dragStyle);
  }

  const bodyStyle: CSSProperties | undefined = isGradientWidget
    ? { background: "transparent", padding: 0 }
    : undefined;

  return (
    <article
      key={widget.id}
      className={`widget ${widget.type === "nest" ? "nest-container" : ""} ${widget.type === "ev" ? "ev-container" : ""} widget-editable ${isDragging ? "widget-dragging" : ""}`}
      style={articleStyle}
      onPointerDownCapture={onPointerDown}
    >
      <div
        className="widget-body"
        ref={ref}
        style={bodyStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

type DashboardViewProps = {
  dashboard: Dashboard;
  apiOrigin: string;
  onConnectionChange?: (connected: boolean) => void;
};

function DashboardView({ dashboard, apiOrigin, onConnectionChange }: DashboardViewProps) {
  const [templates, setTemplates] = useState<Record<string, WidgetTemplate>>({});
  const [widgetData, setWidgetData] = useState<Record<string, StreamPayload>>({});
  const stylesInjected = useRef<Set<string>>(new Set());
  const themeStylesInjected = useRef<Set<string>>(new Set());
  const bodyThemeClass = useRef<string | null>(null);
  const mountStartedAt = useRef<number>(Date.now());
  const lastReloadAt = useRef<number>(0);
  const [connected, setConnected] = useState(false);
  const gridRef = useRef<HTMLElement | null>(null);
  const maxRows = dashboard.maxRows ?? DEFAULT_MAX_ROWS;
  const baseLayoutRef = useRef<Record<string, LayoutPosition> | null>(null);
  const [layout, setLayout] = useState<Record<string, LayoutPosition>>(() => {
    const saved = loadSavedLayout(dashboard.slug, dashboard.widgets, dashboard.columns, dashboard.defaultWidgetSpan, maxRows);
    const next = saved ?? materializeLayout(dashboard.widgets, dashboard.columns, dashboard.defaultWidgetSpan, undefined, maxRows);
    baseLayoutRef.current = next;
    return next;
  });
  const [pendingLayoutChange, setPendingLayoutChange] = useState(false);
  const [savingPermanent, setSavingPermanent] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragTarget, setDragTarget] = useState<{ x: number; y: number } | null>(null);
  const dragTargetRef = useRef<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; origin: LayoutPosition } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const columnWidth = dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH;
  const rowHeight = dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const gutter = dashboard.gutter ?? DEFAULT_GUTTER;
  const overlayVisible = Boolean(draggingId);

  const widgetIds = useMemo(() => new Set(dashboard.widgets.map(w => w.id)), [dashboard.widgets]);

  useEffect(() => {
    setWidgetData({});
    const saved = loadSavedLayout(dashboard.slug, dashboard.widgets, dashboard.columns, dashboard.defaultWidgetSpan, maxRows);
    const next = saved ?? materializeLayout(dashboard.widgets, dashboard.columns, dashboard.defaultWidgetSpan, undefined, maxRows);
    baseLayoutRef.current = next;
    setLayout(next);
    setPendingLayoutChange(false);
  }, [dashboard.slug, dashboard.columns, dashboard.defaultWidgetSpan, maxRows, dashboard.widgets]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragState.current) return;
      const dx = event.clientX - dragState.current.startX;
      const dy = event.clientY - dragState.current.startY;
      setDragOffset({ x: dx, y: dy });

      const gridRect = gridRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const overlayRect = overlayRef.current?.getBoundingClientRect();
      const referenceRect = overlayRect ?? gridRect;

      const cellW = columnWidth + gutter;
      const cellH = rowHeight + gutter;

      const relX = event.clientX - referenceRect.left;
      const relY = event.clientY - referenceRect.top;

      const spanW = dragState.current.origin.w;
      const spanH = dragState.current.origin.h;

      const col = Math.min(
        Math.max(1, Math.floor(relX / cellW) + 1),
        Math.max(1, dashboard.columns - spanW + 1)
      );
      const row = Math.min(
        Math.max(1, Math.floor(relY / cellH) + 1),
        Math.max(1, maxRows - spanH + 1)
      );

      const next = { x: col, y: row };
      dragTargetRef.current = next;
      setDragTarget(next);
    },
    [columnWidth, gutter, rowHeight, dashboard.columns, maxRows]
  );

  const finishDrag = useCallback(() => {
    if (!dragState.current) return;
    const currentId = dragState.current.id;
    window.removeEventListener("pointermove", handlePointerMove, true);
    window.removeEventListener("pointerup", finishDrag, true);
    window.removeEventListener("pointercancel", finishDrag, true);
    dragState.current = null;

    const target = dragTargetRef.current;
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    setDragTarget(null);
    dragTargetRef.current = null;

    if (!target) return;

    setLayout(prev => {
      const preferred: Record<string, Partial<LayoutPosition>> = {};
      dashboard.widgets.forEach(w => {
        const existing = prev[w.id];
        if (existing) preferred[w.id] = { ...existing };
      });

      preferred[currentId] = { ...(preferred[currentId] ?? {}), x: target.x, y: target.y };
      const next = materializeLayout(dashboard.widgets, dashboard.columns, dashboard.defaultWidgetSpan, preferred, maxRows);
      const base = baseLayoutRef.current ?? {};
      setPendingLayoutChange(!layoutsEqual(next, base));
      return next;
    });
  }, [dashboard.columns, dashboard.defaultWidgetSpan, dashboard.widgets, handlePointerMove, maxRows]);

  const handlePointerDown = useCallback(
    (widgetId: string) => (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const origin = layout[widgetId] ?? materializeLayout(dashboard.widgets, dashboard.columns, dashboard.defaultWidgetSpan, undefined, maxRows)[widgetId];
      if (!origin) return;
      dragState.current = {
        id: widgetId,
        startX: event.clientX,
        startY: event.clientY,
        origin
      };
      setDraggingId(widgetId);
      setDragOffset({ x: 0, y: 0 });
      const start = { x: origin.x, y: origin.y };
      dragTargetRef.current = start;
      setDragTarget(start);
      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", finishDrag, true);
      window.addEventListener("pointercancel", finishDrag, true);
    },
    [dashboard.columns, dashboard.defaultWidgetSpan, dashboard.widgets, finishDrag, handlePointerMove, layout, maxRows]
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);
    },
    [handlePointerMove, finishDrag]
  );

  const handleSaveTemporary = useCallback(() => {
    if (layout) {
      baseLayoutRef.current = layout;
      saveLayout(dashboard.slug, layout);
      setPendingLayoutChange(false);
    }
  }, [dashboard.slug, layout]);

  const handleSavePermanent = useCallback(async () => {
    if (!layout) return;
    setSavingPermanent(true);
    try {
      const res = await fetch(`${apiOrigin || ''}/api/dashboards/${dashboard.slug}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout })
      });
      if (!res.ok) {
        console.error('Failed to save layout permanently', await res.text());
        return;
      }
      baseLayoutRef.current = layout;
      saveLayout(dashboard.slug, layout);
      setPendingLayoutChange(false);
    } catch (err) {
      console.error('Failed to save layout permanently', err);
    } finally {
      setSavingPermanent(false);
    }
  }, [apiOrigin, dashboard.slug, layout]);

  const handleRevertLayout = useCallback(() => {
    const base = baseLayoutRef.current;
    if (base) {
      setLayout(base);
    }
    setPendingLayoutChange(false);
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    setDragTarget(null);
  }, []);

  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  useEffect(() => {
    const es = new EventSource(`${apiOrigin}/events`);

    es.onopen = () => setConnected(true);

    es.onerror = err => {
      console.error("SSE connection error", err);
      setConnected(false);
      if (es.readyState === EventSource.CLOSED) {
        es.close();
      }
    };

    es.onmessage = evt => {
      try {
        const payload: StreamPayload = JSON.parse(evt.data);

        const shouldReload =
          payload.type === "reload-dashboard" ||
          payload.type === "reload" ||
          payload.data?.reload === true;

        const eventAtRaw = (payload as any).at;
        const eventAt = typeof eventAtRaw === "number" ? eventAtRaw : Date.parse(eventAtRaw ?? "");
        const isFresh = Number.isFinite(eventAt) ? eventAt >= mountStartedAt.current : true;

        if (shouldReload && isFresh) {
          const now = Date.now();
          if (now - lastReloadAt.current > 5000) {
            lastReloadAt.current = now;
            window.location.reload();
          }
          return;
        }

        if (payload.widgetId && widgetIds.has(payload.widgetId)) {
          setWidgetData(current => ({ ...current, [payload.widgetId!]: payload }));
        }
        setConnected(true);
      } catch (error) {
        console.error("Failed to parse event payload", error);
      }
    };

    return () => {
      setConnected(false);
      onConnectionChange?.(false);
      es.close();
    };
  }, [apiOrigin, onConnectionChange, widgetIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      const uniqueTypes = Array.from(new Set(dashboard.widgets.map(w => w.type)));
      const missing = uniqueTypes.filter(t => !templates[t]);
      if (missing.length === 0) return;

      const fetched = await Promise.all(
        missing.map(async type => {
          const [html, css] = await Promise.all([
            fetch(`${apiOrigin}/widgets/${type}/widget.html`).then(r => r.text()),
            fetch(`${apiOrigin}/widgets/${type}/widget.css`).then(r => r.text())
          ]);
          return [type, { type, html, css }] as const;
        })
      );

      if (cancelled) return;

      setTemplates(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [type, tpl] of fetched) {
          if (!next[type]) {
            next[type] = tpl;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    loadTemplates().catch(err => console.error("Failed to load widget templates", err));
    return () => {
      cancelled = true;
    };
  }, [apiOrigin, dashboard.widgets, templates]);

  useEffect(() => {
    Object.values(templates).forEach(template => {
      if (stylesInjected.current.has(template.type)) return;
      const style = document.createElement("style");
      style.id = `widget-style-${template.type}`;
      style.textContent = template.css;
      document.head.appendChild(style);
      stylesInjected.current.add(template.type);
    });
  }, [templates]);

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      if (!dashboard.theme) return;
      const themeKey = dashboard.theme;
      if (themeStylesInjected.current.has(themeKey)) return;

      try {
        const css = await fetch(`${apiOrigin}/themes/${themeKey}.css`).then(r => r.text());
        if (cancelled) return;
        const style = document.createElement("style");
        style.id = `theme-style-${themeKey}`;
        style.textContent = css;
        document.head.appendChild(style);
        themeStylesInjected.current.add(themeKey);
      } catch (error) {
        console.error("Failed to load theme css", error);
      }
    }

    loadTheme();
    return () => {
      cancelled = true;
    };
  }, [apiOrigin, dashboard.theme]);

  useEffect(() => {
    const cls = dashboard.className ?? null;

    if (bodyThemeClass.current && bodyThemeClass.current !== cls) {
      document.body.classList.remove(bodyThemeClass.current);
    }

    if (cls) {
      document.body.classList.add(cls);
      bodyThemeClass.current = cls;
    } else {
      bodyThemeClass.current = null;
    }

    return () => {
      if (cls) {
        document.body.classList.remove(cls);
      }
    };
  }, [dashboard.className]);

  return (
    <div className="grid-shell">
      {pendingLayoutChange ? (
        <div className="layout-banner">
          <span>Save layout changes?</span>
          <div className="actions">
            <button onClick={handleSaveTemporary}>Save temporarily</button>
            <button onClick={handleSavePermanent} disabled={savingPermanent}>
              {savingPermanent ? 'Saving…' : 'Save permanently'}
            </button>
            <button onClick={handleRevertLayout} className="ghost">Revert</button>
          </div>
        </div>
      ) : null}

      <section
        ref={node => {
          gridRef.current = node;
        }}
        className={`grid ${overlayVisible ? "grid-editing" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${dashboard.columns}, ${dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH}px)`,
          gridAutoRows: `${dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT}px`,
          gap: `${dashboard.gutter ?? DEFAULT_GUTTER}px`,
          justifyContent: "center"
        }}
      >
        {overlayVisible ? (
          <div
            className="grid-overlay"
            ref={overlayRef}
            style={{
              gridTemplateColumns: `repeat(${dashboard.columns}, ${dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH}px)`,
              gridTemplateRows: `repeat(${maxRows}, ${dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT}px)`,
              gap: `${dashboard.gutter ?? DEFAULT_GUTTER}px`,
              width: `${dashboard.columns * (dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH) + (dashboard.columns - 1) * (dashboard.gutter ?? DEFAULT_GUTTER)}px`,
              height: `${maxRows * (dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT) + (maxRows - 1) * (dashboard.gutter ?? DEFAULT_GUTTER)}px`
            }}
          >
            {draggingId && dragTargetRef.current && dragState.current ? (
              <div
                className="grid-highlight"
                style={{
                  gridColumnStart: dragTargetRef.current.x,
                  gridColumnEnd: `span ${dragState.current.origin.w}`,
                  gridRowStart: dragTargetRef.current.y,
                  gridRowEnd: `span ${dragState.current.origin.h}`
                }}
              />
            ) : null}
            {Array.from({ length: dashboard.columns * maxRows }).map((_, idx) => (
              <div key={`cell-${idx}`} className="grid-cell" />
            ))}
          </div>
        ) : null}
        {dashboard.widgets.map(widget => {
          const template = templates[widget.type];
          const payload = widgetData[widget.id];
          const position = layout[widget.id] ?? widget.position;
          const isDragging = draggingId === widget.id;
          const dragStyle = isDragging ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`, zIndex: 5, cursor: "grabbing" } : undefined;

          return (
            <WidgetCard
              key={widget.id}
              widget={widget}
              position={position}
              template={template}
              payload={payload}
              defaultSpan={dashboard.defaultWidgetSpan}
              isDragging={isDragging}
              dragStyle={dragStyle}
              onPointerDown={handlePointerDown(widget.id)}
            />
          );
        })}
      </section>
    </div>
  );
}

export default DashboardView;
