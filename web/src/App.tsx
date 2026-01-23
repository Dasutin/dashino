import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { Dashboard, Playlist } from "./types";
import SidebarNav from "./components/SidebarNav";
import PlaylistEditor from "./components/PlaylistEditor";
import slugify from "./utils/slugify";
import SunIcon from "./icons/Sun";
import MoonIcon from "./icons/Moon";
import "./landing.css";

const DashboardView = lazy(() => import("./DashboardView"));
const PlaylistView = lazy(() => import("./PlaylistView"));

type Appearance = "light" | "dark";
const PLAYLISTS_ROUTE = "playlists";
const BACKUPS_ROUTE = "backups";
const TOOLS_ROUTE = "tools";

const isValidSlug = (value: string) => /^[a-z0-9-]+$/.test(value);

function App() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(true);
  const [dashboardsLoaded, setDashboardsLoaded] = useState(false);
  const [dashboardsError, setDashboardsError] = useState<string | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activePlaylistSlug, setActivePlaylistSlug] = useState<string | null>(null);
  const [pathSlug, setPathSlug] = useState<string | null>(() => {
    const slug = window.location.pathname.replace(/^\//, "").trim();
    return slug.length > 0 ? slug : null;
  });
  const [notFound, setNotFound] = useState(false);
  const isPlaylistManager = pathSlug === PLAYLISTS_ROUTE;
  const isBackupsPage = pathSlug === BACKUPS_ROUTE;
  const isToolsPage = pathSlug === TOOLS_ROUTE;

  const [rootTargetWidget, setRootTargetWidget] = useState("");
  const [rootMessage, setRootMessage] = useState("");

  const [appearance, setAppearance] = useState<Appearance>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("appearance");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorSlug, setEditorSlug] = useState("");
  const [editorRotation, setEditorRotation] = useState(30);
  const [editorDashboards, setEditorDashboards] = useState<string[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [deletingPlaylist, setDeletingPlaylist] = useState(false);

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
      setPathSlug(slug || null);
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
    const isLanding = !selectedSlug && !activePlaylistSlug;
    document.body.classList.toggle("landing-mode", isLanding);
    return () => {
      document.body.classList.remove("landing-mode");
    };
  }, [activePlaylistSlug, selectedSlug]);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboards() {
      setLoadingDashboards(true);
      setDashboardsError(null);
      try {
        const res = await fetch(`${apiOrigin}/api/dashboards`, { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        const loaded: Dashboard[] = body.dashboards ?? [];
        setDashboards(loaded);
        setDashboardsLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setDashboardsError("Failed to load dashboards");
          setDashboardsLoaded(true);
        }
        console.error("Failed to load dashboards", err);
      } finally {
        if (!cancelled) setLoadingDashboards(false);
      }
    }

    loadDashboards().catch(err => console.error("Failed to load dashboards", err));
    return () => {
      cancelled = true;
    };
  }, [apiOrigin]);

  const fetchPlaylists = useMemo(() => {
    return async () => {
      setLoadingPlaylists(true);
      setPlaylistsError(null);
      try {
        const res = await fetch(`${apiOrigin}/api/playlists`, { cache: "no-store" });
        const body = await res.json();
        setPlaylists(body.playlists ?? []);
        setPlaylistsLoaded(true);
      } catch (err) {
        setPlaylistsError("Failed to load playlists");
        setPlaylistsLoaded(true);
        console.error("Failed to load playlists", err);
      } finally {
        setLoadingPlaylists(false);
      }
    };
  }, [apiOrigin]);

  useEffect(() => {
    fetchPlaylists().catch(err => console.error("Failed to load playlists", err));
  }, [fetchPlaylists]);

  useEffect(() => {
    if (pathSlug === null || pathSlug === "") {
      setSelectedSlug(null);
      setActivePlaylistSlug(null);
      setNotFound(false);
      return;
    }

    if (pathSlug === PLAYLISTS_ROUTE) {
      setSelectedSlug(null);
      setActivePlaylistSlug(null);
      setNotFound(false);
      return;
    }

    if (pathSlug === BACKUPS_ROUTE) {
      setSelectedSlug(null);
      setActivePlaylistSlug(null);
      setNotFound(false);
      return;
    }

    if (pathSlug === TOOLS_ROUTE) {
      setSelectedSlug(null);
      setActivePlaylistSlug(null);
      setNotFound(false);
      return;
    }

    const dashboardMatch = dashboards.find(d => d.slug === pathSlug);
    if (dashboardsLoaded && dashboardMatch) {
      setSelectedSlug(pathSlug);
      setActivePlaylistSlug(null);
      setNotFound(false);
      return;
    }

    const playlistMatch = playlists.find(p => p.slug === pathSlug);
    if (playlistsLoaded && playlistMatch) {
      setActivePlaylistSlug(pathSlug);
      setSelectedSlug(null);
      setNotFound(false);
      return;
    }

    if (dashboardsLoaded && playlistsLoaded) {
      setNotFound(true);
      setSelectedSlug(null);
      setActivePlaylistSlug(null);
    }
  }, [dashboards, dashboardsLoaded, pathSlug, playlists, playlistsLoaded]);

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

  const navigateTo = (slug: string | null) => {
    const targetPath = slug ? `/${slug}` : "/";
    setPathSlug(slug);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  };

  const handleDashboardSelect = (slug: string) => {
    navigateTo(slug);
    setSelectedSlug(slug);
    setActivePlaylistSlug(null);
  };

  const handlePlaylistStart = (slug: string) => {
    navigateTo(slug);
    setActivePlaylistSlug(slug);
    setSelectedSlug(null);
  };

  const resetEditor = () => {
    setEditingSlug(null);
    setEditorName("");
    setEditorSlug("");
    setEditorRotation(30);
    setEditorDashboards([]);
    setEditorError(null);
    setSlugTouched(false);
  };

  const handleGoHome = () => {
    setSelectedSlug(null);
    setActivePlaylistSlug(null);
    setNotFound(false);
    navigateTo(null);
  };

  const handleOpenPlaylistManager = () => {
    resetEditor();
    setSelectedSlug(null);
    setActivePlaylistSlug(null);
    setNotFound(false);
    navigateTo(PLAYLISTS_ROUTE);
  };

  const handleOpenBackups = () => {
    setSelectedSlug(null);
    setActivePlaylistSlug(null);
    setNotFound(false);
    navigateTo(BACKUPS_ROUTE);
  };

  const handleOpenTools = () => {
    setSelectedSlug(null);
    setActivePlaylistSlug(null);
    setNotFound(false);
    navigateTo(TOOLS_ROUTE);
  };

  const handleEditPlaylist = (playlist: Playlist) => {
    setEditingSlug(playlist.slug);
    setEditorName(playlist.name);
    setEditorSlug(playlist.slug);
    setEditorRotation(Math.max(1, Math.round(playlist.rotationSeconds)));
    setEditorDashboards(playlist.dashboards ?? []);
    setEditorError(null);
    setSlugTouched(true);
  };

  const handleToggleDashboardSelection = (slug: string, selected: boolean) => {
    setEditorDashboards(prev => {
      if (selected) {
        if (prev.includes(slug)) return prev;
        return [...prev, slug];
      }
      return prev.filter(s => s !== slug);
    });
  };

  const moveDashboardInEditor = (slug: string, delta: number) => {
    setEditorDashboards(prev => {
      const idx = prev.indexOf(slug);
      if (idx < 0) return prev;
      const nextIdx = Math.max(0, Math.min(prev.length - 1, idx + delta));
      if (idx === nextIdx) return prev;
      const copy = [...prev];
      copy.splice(idx, 1);
      copy.splice(nextIdx, 0, slug);
      return copy;
    });
  };

  const handleSavePlaylist = async () => {
    const name = editorName.trim();
    const slug = (editorSlug || slugify(name)).trim();
    const rotationSeconds = Math.round(editorRotation);

    if (!name) {
      setEditorError("Name is required");
      return;
    }

    if (!slug || !isValidSlug(slug)) {
      setEditorError("Slug must contain only lowercase letters, numbers, and dashes");
      return;
    }

    if (!Number.isFinite(rotationSeconds) || rotationSeconds <= 0) {
      setEditorError("Rotation must be greater than 0 seconds");
      return;
    }

    const dashboardSlugs = new Set(dashboards.map(d => d.slug));
    if (dashboardSlugs.has(slug)) {
      setEditorError("Slug conflicts with a dashboard");
      return;
    }

    const playlistConflict = playlists.find(p => p.slug === slug && p.slug !== editingSlug);
    if (playlistConflict) {
      setEditorError("A playlist with this slug already exists");
      return;
    }

    setSavingPlaylist(true);
    try {
      const res = await fetch(`${apiOrigin}/api/playlists/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          rotationSeconds,
          dashboards: editorDashboards
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed with status ${res.status}`);
      }
      await fetchPlaylists();
      setEditingSlug(slug);
      setEditorSlug(slug);
      setEditorError(null);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to save playlist");
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (slugToDelete?: string) => {
    const targetSlug = slugToDelete ?? editingSlug;
    if (!targetSlug) return;
    setDeletingPlaylist(true);
    try {
      const res = await fetch(`${apiOrigin}/api/playlists/${targetSlug}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed with status ${res.status}`);
      }
      await fetchPlaylists();
      if (activePlaylistSlug === targetSlug) {
        navigateTo(null);
      }
      resetEditor();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to delete playlist");
    } finally {
      setDeletingPlaylist(false);
    }
  };

  const toggleAppearance = () => {
    setAppearance(prev => (prev === "dark" ? "light" : "dark"));
  };

  if (activePlaylistSlug) {
    return (
      <div className="dashboard">
        <Suspense fallback={<div className="panel"><p>Loading playlist…</p></div>}>
          <PlaylistView slug={activePlaylistSlug} apiOrigin={apiOrigin} />
        </Suspense>
      </div>
    );
  }

  if (selectedSlug && currentDashboard) {
    return (
      <div className="layout dashboard">
        <Suspense fallback={<section className="panel"><p>Loading dashboard…</p></section>}>
          <DashboardView dashboard={currentDashboard} apiOrigin={apiOrigin} onConnectionChange={() => {}} />
        </Suspense>
      </div>
    );
  }

  if (isToolsPage) {
    return (
      <div className="landing-shell">
        <SidebarNav
          isHomeActive={false}
          isPlaylistManagerActive={false}
          isBackupsActive={false}
          isToolsActive
          onSelectHome={handleGoHome}
          onOpenPlaylistManager={handleOpenPlaylistManager}
          onOpenBackups={handleOpenBackups}
          onOpenTools={handleOpenTools}
        />

        <main className="landing landing-main">
          <div className="top-bar">
            <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
              {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <header className="hero">
            <div>
              <h1>Tools</h1>
              <p>Developer utilities for testing events.</p>
            </div>
          </header>

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
        </main>
      </div>
    );
  }

  if (isBackupsPage) {
    return (
      <div className="landing-shell">
        <SidebarNav
          isHomeActive={false}
          isPlaylistManagerActive={false}
          isBackupsActive
          isToolsActive={false}
          onSelectHome={handleGoHome}
          onOpenPlaylistManager={handleOpenPlaylistManager}
          onOpenBackups={handleOpenBackups}
          onOpenTools={handleOpenTools}
        />

        <main className="landing landing-main">
          <div className="top-bar">
            <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
              {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <header className="hero">
            <div>
              <h1>Backups</h1>
              <p>Download a snapshot of dashboards, widgets, themes, jobs, and playlists.</p>
            </div>
            <div className="controls">
              <button
                onClick={() => {
                  window.location.href = backupUrl;
                }}
              >
                Create backup
              </button>
            </div>
          </header>
        </main>
      </div>
    );
  }

  if (isPlaylistManager) {
    return (
      <div className="landing-shell">
        <SidebarNav
          isHomeActive={false}
          isPlaylistManagerActive
          isBackupsActive={false}
          isToolsActive={false}
          onSelectHome={handleGoHome}
          onOpenPlaylistManager={handleOpenPlaylistManager}
          onOpenBackups={handleOpenBackups}
          onOpenTools={handleOpenTools}
        />

        <main className="landing landing-main">
          <div className="top-bar">
            <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
              {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <header className="hero">
            <div>
              <h1>Playlists</h1>
              <p>Rotate a set of dashboards automatically.</p>
            </div>
          </header>

          {dashboardsError ? <p className="error-text">{dashboardsError}</p> : null}
          {playlistsError ? <p className="error-text">{playlistsError}</p> : null}

          <section className="panel">
            <div className="panel-header">
              <h3>Saved Playlists</h3>
            </div>
            {loadingPlaylists ? (
              <p className="muted">Loading playlists…</p>
            ) : playlists.length === 0 ? (
              <p className="muted">No playlists yet. Create one to start rotating dashboards.</p>
            ) : (
              <div className="playlist-list">
                {playlists.map(p => (
                  <div key={p.slug} className="playlist-row">
                    <div>
                      <div className="playlist-name">{p.name}</div>
                      <div className="playlist-meta">{p.dashboards.length} dashboards · {Math.round(p.rotationSeconds)}s</div>
                    </div>
                    <div className="playlist-actions">
                      <button onClick={() => handlePlaylistStart(p.slug)}>Run</button>
                      <button onClick={() => handleEditPlaylist(p)}>Edit</button>
                      <button
                        onClick={() => {
                          setEditingSlug(p.slug);
                          handleDeletePlaylist(p.slug);
                        }}
                        disabled={deletingPlaylist && editingSlug === p.slug}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <PlaylistEditor
            name={editorName}
            slug={slugTouched ? editorSlug : editorSlug || slugify(editorName)}
            rotationSeconds={editorRotation}
            dashboards={dashboards}
            selectedDashboards={editorDashboards}
            error={editorError}
            isSaving={savingPlaylist}
            isDeleting={deletingPlaylist}
            onNameChange={value => {
              setEditorName(value);
              if (!slugTouched) {
                setEditorSlug(slugify(value));
              }
            }}
            onSlugChange={value => {
              setSlugTouched(true);
              setEditorSlug(value);
            }}
            onRotationChange={value => setEditorRotation(value)}
            onToggleDashboard={handleToggleDashboardSelection}
            onMoveDashboard={moveDashboardInEditor}
            onSave={handleSavePlaylist}
            onCancel={resetEditor}
            onDelete={editingSlug ? handleDeletePlaylist : undefined}
            canDelete={Boolean(editingSlug)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <SidebarNav
        isHomeActive={!isPlaylistManager && !isBackupsPage && !isToolsPage}
        isPlaylistManagerActive={false}
        isBackupsActive={isBackupsPage}
        isToolsActive={isToolsPage}
        onSelectHome={handleGoHome}
        onOpenPlaylistManager={handleOpenPlaylistManager}
        onOpenBackups={handleOpenBackups}
        onOpenTools={handleOpenTools}
      />

      <main className="landing landing-main">
        <div className="top-bar">
          <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
            {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        {notFound ? (
          <header className="hero">
            <div>
              <h1>Not found</h1>
              <p>We could not find that dashboard or playlist.</p>
            </div>
          </header>
        ) : loadingDashboards ? (
          <header className="hero">
            <div>
              <h1>Dashino</h1>
              <p>Loading dashboards</p>
            </div>
          </header>
        ) : (
          <header className="hero">
            <div>
              <h1>Dashino Dashboards</h1>
              <p>Beautiful, realtime dashboards for your home or fleet!</p>
              <p style={{ marginTop: 8, opacity: 0.85 }}>Choose a dashboard below to run</p>
            </div>
          </header>
        )}

        {dashboardsError ? <p className="error-text">{dashboardsError}</p> : null}
        {playlistsError ? <p className="error-text">{playlistsError}</p> : null}

        <section className="panel">
          <div className="panel-header">
            <h3>Dashboards</h3>
          </div>
          {loadingDashboards ? (
            <p className="muted">Loading dashboards…</p>
          ) : dashboards.length === 0 ? (
            <p className="muted">No dashboards found.</p>
          ) : (
            <div className="playlist-list">
              {dashboards.map(d => (
                <div key={d.slug} className="playlist-row">
                  <div>
                    <div className="playlist-name">{d.name}</div>
                    <div className="playlist-meta">{d.description || d.slug}</div>
                  </div>
                  <div className="playlist-actions">
                    <button onClick={() => handleDashboardSelect(d.slug)} aria-label={`Run ${d.name}`}>
                      ▶
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
