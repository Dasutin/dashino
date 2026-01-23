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
import { loadDebugFromStorage, parseDebugFromUrl, saveDebugToStorage } from "./debugOverlay";

const DEFAULT_GUTTER = 16;
const DEFAULT_COLUMN_WIDTH = 300;
const DEFAULT_ROW_HEIGHT = 360;
const DEFAULT_MAX_ROWS = 3;
const DEFAULT_MAX_COLUMNS = 4;

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

type WidgetDebugInfo = {
  lastEventAt: number | null;
  lastEventType: string | null;
  lastEventSize: number | null;
  cached: boolean | null;
  fetchedAt: string | null;
  error: string | null;
  updateCount: number;
};

function formatDebugTime(ms: number | null) {
  if (!Number.isFinite(ms) || ms === null) return "--";
  return new Date(ms).toLocaleTimeString();
}

function truncateError(value: unknown, limit = 80) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

function isInputLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

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
  maxColumns: number,
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
    return materializeLayout(widgets, maxColumns, defaultSpan, preferred, maxRows);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveConstraints(widget: WidgetPlacement) {
  const pos = widget.position ?? {};
  return {
    minW: Math.max(1, pos.minW ?? 1),
    minH: Math.max(1, pos.minH ?? 1),
    maxW: pos.maxW,
    maxH: pos.maxH
  } as const;
}

function sizeFor(
  widget: WidgetPlacement,
  defaultSpan: { w?: number; h?: number } | undefined,
  preferred?: Partial<LayoutPosition>,
  maxColumns: number = DEFAULT_MAX_COLUMNS,
  maxRows: number = DEFAULT_MAX_ROWS
) {
  const constraints = resolveConstraints(widget);
  const baseW = preferred?.w ?? widget.position?.w ?? defaultSpan?.w ?? 1;
  const baseH = preferred?.h ?? widget.position?.h ?? defaultSpan?.h ?? 1;
  const maxW = constraints.maxW ?? maxColumns;
  const maxH = constraints.maxH ?? maxRows;
  const w = clamp(baseW, constraints.minW, maxW);
  const h = clamp(baseH, constraints.minH, maxH);
  return { w, h };
}

function fitsAt(
  occupied: Set<string>,
  x: number,
  y: number,
  w: number,
  h: number,
  maxColumns: number,
  maxRows: number
) {
  if (x < 1 || y < 1) return false;
  if (x + w - 1 > maxColumns) return false;
  if (y + h - 1 > maxRows) return false;
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

function findSpot(occupied: Set<string>, w: number, h: number, maxColumns: number, maxRows: number): { x: number; y: number } {
  for (let row = 1; row <= maxRows; row++) {
    for (let col = 1; col <= maxColumns; col++) {
      if (fitsAt(occupied, col, row, w, h, maxColumns, maxRows)) {
        return { x: col, y: row };
      }
    }
  }
  // Fallback: place at bottom of grid
  return { x: 1, y: maxRows };
}

function materializeLayout(
  widgets: WidgetPlacement[],
  maxColumns: number,
  defaultSpan?: { w?: number; h?: number },
  preferred?: Record<string, Partial<LayoutPosition>>,
  maxRows: number = DEFAULT_MAX_ROWS
): Record<string, LayoutPosition> {
  const occupied = new Set<string>();
  const layout: Record<string, LayoutPosition> = {};

  for (const widget of widgets) {
    const preferredPos = preferred?.[widget.id];
    const { w, h } = sizeFor(widget, defaultSpan, preferredPos, maxColumns, maxRows);
    const desired = preferredPos ?? widget.position;
    const desiredX = desired?.x ?? widget.position?.x;
    const desiredY = desired?.y ?? widget.position?.y;

    let placed = false;
    if (desiredX && desiredY && fitsAt(occupied, desiredX, desiredY, w, h, maxColumns, maxRows)) {
      layout[widget.id] = { x: desiredX, y: desiredY, w, h };
      mark(occupied, desiredX, desiredY, w, h);
      placed = true;
    }

    if (!placed) {
      const spot = findSpot(occupied, w, h, maxColumns, maxRows);
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
  isResizing?: boolean;
  editing?: boolean;
  onResizeStart?: (widget: WidgetPlacement, evt: React.PointerEvent, cardRect: DOMRect | null) => void;
  debugEnabled?: boolean;
  debugInfo?: WidgetDebugInfo;
  sseConnected?: boolean;
  lastSseAt?: number | null;
};

function WidgetCard({
  widget,
  position,
  template,
  payload,
  defaultSpan,
  dragStyle,
  isDragging,
  isResizing,
  editing,
  onPointerDown,
  onResizeStart,
  debugEnabled,
  debugInfo,
  sseConnected,
  lastSseAt
}: WidgetCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const controllerRef = useRef<WidgetController | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pendingRectRef = useRef<DOMRectReadOnly | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(entries => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      pendingRectRef.current = entry.contentRect;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const rect = pendingRectRef.current;
        pendingRectRef.current = null;
        if (rect) {
          const body = ref.current;
          if (body) {
            body.style.setProperty("--widget-w", `${rect.width}px`);
            body.style.setProperty("--widget-h", `${rect.height}px`);
          }
          controllerRef.current?.resize?.({ width: rect.width, height: rect.height, dpr: window.devicePixelRatio || 1 });
        }
      });
    });

    resizeObserverRef.current = ro;
    ro.observe(el);

    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRectRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const factory = widgetFactories[widget.type];
    if (!factory) return;

    controllerRef.current?.destroy?.();
    controllerRef.current = factory({ root, widget, template });
    controllerRef.current?.update?.(payload);

    const el = cardRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const body = ref.current;
      if (body) {
        body.style.setProperty("--widget-w", `${rect.width}px`);
        body.style.setProperty("--widget-h", `${rect.height}px`);
      }
      controllerRef.current?.resize?.({ width: rect.width, height: rect.height, dpr: window.devicePixelRatio || 1 });
    }

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

  const info: WidgetDebugInfo = debugInfo ?? {
    lastEventAt: null,
    lastEventType: null,
    lastEventSize: null,
    cached: null,
    fetchedAt: null,
    error: null,
    updateCount: 0
  };

  const overlay = debugEnabled ? (
    <div className={`widget-debug-overlay ${sseConnected ? "" : "disconnected"}`}>
      <div>id: {widget.id}</div>
      <div>type: {widget.type}</div>
      <div>updates: {info.updateCount}</div>
      <div>at: {formatDebugTime(info.lastEventAt)}</div>
      <div>event: {info.lastEventType ?? "--"}</div>
      <div>cached: {info.cached === null ? "--" : String(info.cached)}</div>
      <div>bytes: {info.lastEventSize ?? "--"}</div>
      {info.fetchedAt ? <div>fetchedAt: {info.fetchedAt}</div> : null}
      {info.error ? <div>error: {info.error}</div> : null}
      <div>sse: {sseConnected ? "connected" : "disconnected"}</div>
      <div>lastSSE: {formatDebugTime(lastSseAt ?? null)}</div>
    </div>
  ) : null;

  return (
    <article
      key={widget.id}
      className={`widget ${widget.type === "nest" ? "nest-container" : ""} ${widget.type === "ev" ? "ev-container" : ""} widget-editable ${isDragging ? "widget-dragging" : ""} ${isResizing ? "widget-resizing" : ""} ${editing ? "widget-editing-enabled" : ""}`}
      style={articleStyle}
      ref={node => {
        cardRef.current = node;
      }}
      onPointerDownCapture={onPointerDown}
    >
      {overlay}
      <div
        className="widget-body"
        ref={ref}
        style={bodyStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {editing ? (
        <div
          className="widget-resize-handle"
          onPointerDown={evt => onResizeStart?.(widget, evt, cardRef.current ? cardRef.current.getBoundingClientRect() : null)}
        />
      ) : null}
    </article>
  );
}

type DashboardViewProps = {
  dashboard: Dashboard;
  apiOrigin: string;
  onConnectionChange?: (connected: boolean) => void;
  sseEnabled?: boolean;
};

function DashboardView({ dashboard, apiOrigin, onConnectionChange, sseEnabled = true }: DashboardViewProps) {
  const [templates, setTemplates] = useState<Record<string, WidgetTemplate>>({});
  const [widgetData, setWidgetData] = useState<Record<string, StreamPayload>>({});
  const stylesInjected = useRef<Set<string>>(new Set());
  const themeStylesInjected = useRef<Set<string>>(new Set());
  const bodyThemeClass = useRef<string | null>(null);
  const mountStartedAt = useRef<number>(Date.now());
  const lastReloadAt = useRef<number>(0);
  const [connected, setConnected] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState<boolean>(() => {
    const fromUrl = parseDebugFromUrl();
    if (fromUrl !== null) return fromUrl;
    return loadDebugFromStorage();
  });
  const [debugInfo, setDebugInfo] = useState<Record<string, WidgetDebugInfo>>({});
  const [lastSseAt, setLastSseAt] = useState<number | null>(null);
  const gridRef = useRef<HTMLElement | null>(null);
  const maxRows = dashboard.maxRows ?? DEFAULT_MAX_ROWS;
  const maxColumns = dashboard.maxColumns ?? (dashboard as any).columns ?? DEFAULT_MAX_COLUMNS;
  const baseLayoutRef = useRef<Record<string, LayoutPosition> | null>(null);
  const [layout, setLayout] = useState<Record<string, LayoutPosition>>(() => {
    const saved = loadSavedLayout(dashboard.slug, dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, maxRows);
    const next = saved ?? materializeLayout(dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, undefined, maxRows);
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
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeState = useRef<{
    id: string;
    startRect: DOMRect;
    origin: LayoutPosition;
    minW: number;
    minH: number;
    maxW?: number;
    maxH?: number;
    pointerId: number;
  } | null>(null);
  const resizeRaf = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const columnWidth = dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH;
  const rowHeight = dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const gutter = dashboard.gutter ?? DEFAULT_GUTTER;
  const overlayVisible = Boolean(draggingId || resizingId);
  const editingEnabled = true;
  const [resizeHandlesVisible, setResizeHandlesVisible] = useState(false);

  const widgetIds = useMemo(() => new Set(dashboard.widgets.map(w => w.id)), [dashboard.widgets]);
  const editingActive = editingEnabled && resizeHandlesVisible;

  useEffect(() => {
    setWidgetData({});
    const saved = loadSavedLayout(dashboard.slug, dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, maxRows);
    const next = saved ?? materializeLayout(dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, undefined, maxRows);
    baseLayoutRef.current = next;
    setLayout(next);
    setPendingLayoutChange(false);
  }, [dashboard.slug, dashboard.defaultWidgetSpan, dashboard.widgets, maxColumns, maxRows]);

  const toggleDebug = useCallback(() => setDebugEnabled(prev => !prev), []);

  useEffect(() => {
    saveDebugToStorage(debugEnabled);
  }, [debugEnabled]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "d" && event.key !== "D") return;
      if (isInputLike(event.target)) return;
      toggleDebug();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleDebug]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "e" && event.key !== "E") return;
      if (isInputLike(event.target)) return;
      setResizeHandlesVisible(prev => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setDebugInfo(prev => {
      const next: Record<string, WidgetDebugInfo> = {};
      dashboard.widgets.forEach(w => {
        if (prev[w.id]) next[w.id] = prev[w.id];
      });
      return next;
    });
  }, [dashboard.widgets]);

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
        Math.max(1, maxColumns - spanW + 1)
      );
      const row = Math.min(
        Math.max(1, Math.floor(relY / cellH) + 1),
        Math.max(1, maxRows - spanH + 1)
      );

      const next = { x: col, y: row };
      dragTargetRef.current = next;
      setDragTarget(next);
    },
    [columnWidth, gutter, rowHeight, maxColumns, maxRows]
  );

  const handleResizePointerMove = useCallback(
    (event: PointerEvent) => {
      const state = resizeState.current;
      if (!state) return;
      if (resizeRaf.current !== null) return;

      const clientX = event.clientX;
      const clientY = event.clientY;

      resizeRaf.current = requestAnimationFrame(() => {
        resizeRaf.current = null;
        const active = resizeState.current;
        if (!active) return;

        const desiredWidthPx = clientX - active.startRect.left;
        const desiredHeightPx = clientY - active.startRect.top;

        const pitchX = columnWidth + gutter;
        const pitchY = rowHeight + gutter;

        let nextW = Math.round((desiredWidthPx + gutter) / pitchX);
        let nextH = Math.round((desiredHeightPx + gutter) / pitchY);

        const maxWGrid = maxColumns - active.origin.x + 1;
        const maxHGrid = maxRows - active.origin.y + 1;
        const capW = active.maxW !== undefined ? Math.min(active.maxW, maxWGrid) : maxWGrid;
        const capH = active.maxH !== undefined ? Math.min(active.maxH, maxHGrid) : maxHGrid;

        nextW = clamp(nextW, active.minW, Math.max(1, capW));
        nextH = clamp(nextH, active.minH, Math.max(1, capH));

        setLayout(prev => {
          const current = prev[active.id];
          if (current && current.w === nextW && current.h === nextH) return prev;

          const preferred: Record<string, Partial<LayoutPosition>> = {};
          dashboard.widgets.forEach(w => {
            const existing = prev[w.id];
            if (existing) preferred[w.id] = { ...existing };
          });

          preferred[active.id] = {
            ...(preferred[active.id] ?? {}),
            x: active.origin.x,
            y: active.origin.y,
            w: nextW,
            h: nextH
          };

          const next = materializeLayout(dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, preferred, maxRows);
          const base = baseLayoutRef.current ?? {};
          setPendingLayoutChange(!layoutsEqual(next, base));
          return next;
        });
      });
    },
    [columnWidth, dashboard.defaultWidgetSpan, dashboard.widgets, gutter, maxColumns, maxRows]
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
      const next = materializeLayout(dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, preferred, maxRows);
      const base = baseLayoutRef.current ?? {};
      setPendingLayoutChange(!layoutsEqual(next, base));
      return next;
    });
  }, [dashboard.defaultWidgetSpan, dashboard.widgets, handlePointerMove, maxColumns, maxRows]);

  const finishResize = useCallback(() => {
    if (!resizeState.current) return;
    window.removeEventListener("pointermove", handleResizePointerMove, true);
    window.removeEventListener("pointerup", finishResize, true);
    window.removeEventListener("pointercancel", finishResize, true);
    if (resizeRaf.current !== null) {
      cancelAnimationFrame(resizeRaf.current);
      resizeRaf.current = null;
    }
    resizeState.current = null;
    setResizingId(null);
  }, [handleResizePointerMove]);

  const handlePointerDown = useCallback(
    (widgetId: string) => (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest(".widget-resize-handle")) return;
      if (resizingId) return;
      event.preventDefault();
      const origin = layout[widgetId] ?? materializeLayout(dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, undefined, maxRows)[widgetId];
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
    [dashboard.defaultWidgetSpan, dashboard.widgets, finishDrag, handlePointerMove, layout, maxColumns, maxRows, resizingId]
  );

  const handleResizeStart = useCallback(
    (widget: WidgetPlacement, event: React.PointerEvent, cardRect: DOMRect | null) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (resizingId) return;

      const origin = layout[widget.id] ?? materializeLayout(dashboard.widgets, maxColumns, dashboard.defaultWidgetSpan, undefined, maxRows)[widget.id];
      if (!origin) return;

      const rect =
        cardRect ??
        ((event.currentTarget as HTMLElement).closest("article")?.getBoundingClientRect() ??
          (event.currentTarget as HTMLElement).getBoundingClientRect());
      const pos = widget.position ?? {};

      if ((event.currentTarget as HTMLElement)?.setPointerCapture) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }

      resizeState.current = {
        id: widget.id,
        startRect: rect,
        origin,
        minW: Math.max(1, pos.minW ?? 1),
        minH: Math.max(1, pos.minH ?? 1),
        maxW: pos.maxW,
        maxH: pos.maxH,
        pointerId: event.pointerId
      };
      setResizingId(widget.id);

      window.addEventListener("pointermove", handleResizePointerMove, true);
      window.addEventListener("pointerup", finishResize, true);
      window.addEventListener("pointercancel", finishResize, true);
    },
    [dashboard.defaultWidgetSpan, dashboard.widgets, finishResize, handleResizePointerMove, layout, maxColumns, maxRows, resizingId]
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);
      window.removeEventListener("pointermove", handleResizePointerMove, true);
      window.removeEventListener("pointerup", finishResize, true);
      window.removeEventListener("pointercancel", finishResize, true);
    },
    [finishDrag, finishResize, handlePointerMove, handleResizePointerMove]
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
    setResizingId(null);
    resizeState.current = null;
    if (resizeRaf.current !== null) {
      cancelAnimationFrame(resizeRaf.current);
      resizeRaf.current = null;
    }
  }, []);

  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  useEffect(() => {
    if (!sseEnabled) {
      setConnected(false);
      onConnectionChange?.(false);
      return;
    }

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
        const now = Date.now();
        setLastSseAt(now);

        let eventSize: number | null = null;
        if (typeof evt.data === "string") {
          try {
            eventSize = new TextEncoder().encode(evt.data).length;
          } catch {
            eventSize = evt.data.length;
          }
        }

        const payload: StreamPayload = JSON.parse(evt.data);

        const shouldReload =
          payload.type === "reload-dashboard" ||
          payload.type === "reload" ||
          payload.data?.reload === true;

        const eventAtRaw = (payload as any).at;
        const eventAt = typeof eventAtRaw === "number" ? eventAtRaw : Date.parse(eventAtRaw ?? "");
        const eventAtMs = Number.isFinite(eventAt) ? eventAt : now;
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
          const dataAny = (payload as any)?.data ?? {};
          const cached = (dataAny as any)?.cached;
          const fetchedAt = (dataAny as any)?.fetchedAt ?? null;
          const errorVal = (dataAny as any)?.error ?? null;

          setDebugInfo(prev => {
            const prevInfo = prev[payload.widgetId!] ?? {
              lastEventAt: null,
              lastEventType: null,
              lastEventSize: null,
              cached: null,
              fetchedAt: null,
              error: null,
              updateCount: 0
            };

            const nextInfo: WidgetDebugInfo = {
              lastEventAt: eventAtMs,
              lastEventType: payload.type ?? null,
              lastEventSize: eventSize,
              cached: cached === undefined ? prevInfo.cached : Boolean(cached),
              fetchedAt: fetchedAt ?? prevInfo.fetchedAt,
              error: truncateError(errorVal),
              updateCount: (prevInfo.updateCount ?? 0) + 1
            };

            return { ...prev, [payload.widgetId!]: nextInfo };
          });

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
  }, [apiOrigin, onConnectionChange, sseEnabled, widgetIds]);

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

  const dragHighlight = draggingId && dragTargetRef.current && dragState.current
    ? {
        x: dragTargetRef.current.x,
        y: dragTargetRef.current.y,
        w: dragState.current.origin.w,
        h: dragState.current.origin.h
      }
    : null;

  const resizeHighlight = resizingId && layout[resizingId] ? layout[resizingId] : null;
  const overlayHighlight = dragHighlight ?? resizeHighlight;

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
        className={`grid ${overlayVisible ? "grid-editing" : ""} ${editingActive ? "grid-editing-enabled" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${maxColumns}, ${dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH}px)`,
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
              gridTemplateColumns: `repeat(${maxColumns}, ${dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH}px)`,
              gridTemplateRows: `repeat(${maxRows}, ${dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT}px)`,
              gap: `${dashboard.gutter ?? DEFAULT_GUTTER}px`,
              width: `${maxColumns * (dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH) + (maxColumns - 1) * (dashboard.gutter ?? DEFAULT_GUTTER)}px`,
              height: `${maxRows * (dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT) + (maxRows - 1) * (dashboard.gutter ?? DEFAULT_GUTTER)}px`
            }}
          >
            {overlayHighlight ? (
              <div
                className="grid-highlight"
                style={{
                  gridColumnStart: overlayHighlight.x,
                  gridColumnEnd: `span ${overlayHighlight.w}`,
                  gridRowStart: overlayHighlight.y,
                  gridRowEnd: `span ${overlayHighlight.h}`
                }}
              />
            ) : null}
            {Array.from({ length: maxColumns * maxRows }).map((_, idx) => (
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
              isResizing={resizingId === widget.id}
              dragStyle={dragStyle}
              onPointerDown={editingActive ? handlePointerDown(widget.id) : undefined}
              onResizeStart={handleResizeStart}
              editing={editingActive}
              debugEnabled={debugEnabled}
              debugInfo={debugInfo[widget.id]}
              sseConnected={connected}
              lastSseAt={lastSseAt}
            />
          );
        })}
      </section>
    </div>
  );
}

export default DashboardView;
