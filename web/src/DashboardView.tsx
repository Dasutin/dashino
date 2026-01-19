import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

type WidgetCardProps = {
  widget: WidgetPlacement;
  template?: WidgetTemplate;
  payload?: StreamPayload;
  defaultSpan?: { w?: number; h?: number };
};

function WidgetCard({ widget, template, payload, defaultSpan }: WidgetCardProps) {
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

  const pos = widget.position ?? {};
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

  const bodyStyle: CSSProperties | undefined = isGradientWidget
    ? { background: "transparent", padding: 0 }
    : undefined;

  return (
    <article
      key={widget.id}
      className={`widget ${widget.type === "nest" ? "nest-container" : ""} ${widget.type === "ev" ? "ev-container" : ""}`}
      style={articleStyle}
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
  const lastReloadAt = useRef<number>(0);
  const [connected, setConnected] = useState(false);

  const widgetIds = useMemo(() => new Set(dashboard.widgets.map(w => w.id)), [dashboard.widgets]);

  useEffect(() => {
    setWidgetData({});
  }, [dashboard.slug]);

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

        if (shouldReload) {
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
    <section
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${dashboard.columns}, ${dashboard.columnWidth ?? DEFAULT_COLUMN_WIDTH}px)`,
        gridAutoRows: `${dashboard.rowHeight ?? DEFAULT_ROW_HEIGHT}px`,
        gap: `${dashboard.gutter ?? DEFAULT_GUTTER}px`,
        justifyContent: "center"
      }}
    >
      {dashboard.widgets.map(widget => {
        const template = templates[widget.type];
        const payload = widgetData[widget.id];
        return (
          <WidgetCard
            key={widget.id}
            widget={widget}
            template={template}
            payload={payload}
            defaultSpan={dashboard.defaultWidgetSpan}
          />
        );
      })}
    </section>
  );
}

export default DashboardView;
