import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { Dashboard } from "./types";
import SunIcon from "./icons/Sun";
import MoonIcon from "./icons/Moon";
import "./landing.css";

const DashboardView = lazy(() => import("./DashboardView"));

type Appearance = "light" | "dark";

function App() {
  const [connected, setConnected] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [rootTargetWidget, setRootTargetWidget] = useState("");
  const [rootMessage, setRootMessage] = useState("");
  const [appearance, setAppearance] = useState<Appearance>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("appearance");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const initialPathSlug = useMemo(() => {
    const slug = window.location.pathname.replace(/^\//, "").trim();
    return slug.length > 0 ? slug : null;
  }, []);
  const initialPathHandled = useRef(false);
  const selectedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    selectedSlugRef.current = selectedSlug;
  }, [selectedSlug]);

  const apiOrigin = useMemo(() => {
    const raw = (import.meta as any).env?.VITE_API_ORIGIN as string | undefined;
    if (!raw) return "";
    return raw.replace(/\/$/, "");
  }, []);

  const backupUrl = useMemo(() => `${apiOrigin}/api/backup.zip`, [apiOrigin]);

  const currentDashboard = useMemo(() => {
    if (!selectedSlug) return undefined;
    return dashboards.find(d => d.slug === selectedSlug);
  }, [dashboards, selectedSlug]);

  useEffect(() => {
    const handlePopState = () => {
      const slug = window.location.pathname.replace(/^\//, "").trim();
      setSelectedSlug(slug || null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", appearance === "dark");
    if (typeof window !== "undefined") {
      window.localStorage.setItem("appearance", appearance);
    }
  }, [appearance]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboards() {
      setLoadingDashboards(true);
      try {
        const res = await fetch(`${apiOrigin}/api/dashboards`);
        const body = await res.json();
        if (cancelled) return;

        const loaded: Dashboard[] = body.dashboards ?? [];
        setDashboards(loaded);

        const slugSet = new Set(loaded.map(d => d.slug));

        if (!initialPathHandled.current) {
          initialPathHandled.current = true;
          if (initialPathSlug && slugSet.has(initialPathSlug)) {
            setSelectedSlug(initialPathSlug);
          } else if (initialPathSlug) {
            window.history.replaceState(null, "", "/");
            setSelectedSlug(null);
          }
        }

        const selected = selectedSlugRef.current;
        if (selected && !slugSet.has(selected)) {
          setSelectedSlug(null);
          window.history.replaceState(null, "", "/");
        }
      } catch (err) {
        console.error("Failed to load dashboards", err);
      } finally {
        if (!cancelled) setLoadingDashboards(false);
      }
    }

    loadDashboards().catch(err => console.error("Failed to load dashboards", err));
    return () => {
      cancelled = true;
    };
  }, [apiOrigin, initialPathSlug]);

  const sendDemoEvent = async (widgetId?: string, rawMessage?: string) => {
    const targetId = widgetId || currentDashboard?.widgets[0]?.id;
    if (!targetId) return;

    let type = "demo";
    let data: unknown = { note: "manual trigger" };

    if (rawMessage && rawMessage.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawMessage);
        if (parsed && typeof parsed === "object") {
          type = typeof (parsed as any).type === "string" ? (parsed as any).type : "demo";
          data = (parsed as any).data && typeof (parsed as any).data === "object" ? (parsed as any).data : parsed;
        } else {
          data = { note: "manual trigger", message: rawMessage };
        }
      } catch (_) {
        data = { note: "manual trigger", message: rawMessage };
      }
    }

    await fetch(`${apiOrigin}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        widgetId: targetId,
        type,
        data
      })
    });
  };

  const handleDashboardChange = (slug: string) => {
    const normalized = slug || null;
    setSelectedSlug(normalized);
    const targetPath = normalized ? `/${normalized}` : "/";
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  };

  useEffect(() => {
    if (!currentDashboard) {
      document.body.classList.add("landing-mode");
    } else {
      document.body.classList.remove("landing-mode");
    }
    return () => {
      document.body.classList.remove("landing-mode");
    };
  }, [currentDashboard]);

  const toggleAppearance = () => {
    setAppearance(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className={`layout ${currentDashboard ? "dashboard" : "landing"}`}>
      {!currentDashboard && (
        <div className="top-bar">
          <button
            onClick={() => {
              window.location.href = backupUrl;
            }}
          >
            Create backup
          </button>
          <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
            {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      )}

      {loadingDashboards ? (
        <header className="hero">
          <div>
            <h1>Dashino</h1>
            <p>Loading dashboards</p>
          </div>
        </header>
      ) : !currentDashboard ? (
        <header className="hero">
          <div>
            <h1>Dashino Dashboards</h1>
            <p>Beautiful, realtime dashboards for your home or fleet!</p>
            <p style={{ marginTop: 8, opacity: 0.85 }}>Select a dashboard to begin</p>
          </div>
          <div className="controls">
            <label>
              Dashboard
              <select
                value={selectedSlug ?? ""}
                onChange={e => handleDashboardChange(e.target.value)}
              >
                <option value="">Select a dashboard</option>
                {dashboards.map(d => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
      ) : null}

      {!currentDashboard && (
        <section className="panel">
          <div className="panel-header">
            <h3>Event Testing</h3>
          </div>
          <div className="panel-grid">
            <label>
              Widget
              <select
                value={rootTargetWidget}
                onChange={e => setRootTargetWidget(e.target.value)}
              >
                <option value="">Select a widget</option>
                {dashboards.flatMap(d =>
                  d.widgets.map(w => (
                    <option key={`${d.slug}-${w.id}`} value={w.id}>
                      {d.name}: {w.id}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Message
              <input
                type="text"
                placeholder="message or JSON payload"
                value={rootMessage}
                onChange={e => setRootMessage(e.target.value)}
              />
            </label>
            <div className="panel-actions">
              <button
                onClick={() => {
                  const widgetId = rootTargetWidget || undefined;
                  sendDemoEvent(widgetId, rootMessage.trim() || undefined);
                }}
              >
                Send event
              </button>
            </div>
          </div>
        </section>
      )}

      {currentDashboard ? (
        <Suspense fallback={<section className="panel"><p>Loading dashboard…</p></section>}>
          <DashboardView
            dashboard={currentDashboard}
            apiOrigin={apiOrigin}
            onConnectionChange={setConnected}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default App;
