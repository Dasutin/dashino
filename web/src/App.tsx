import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditIcon from "@mui/icons-material/Edit";
import ClearIcon from "@mui/icons-material/Clear";
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
const BACKUPS_ROUTE = "settings";
const APP_VERSION = "0.1.0";

const DEFAULT_WIDGET_TYPES = [
  "camera",
  "camera2",
  "clock",
  "ev",
  "forecast",
  "hourly",
  "message",
  "metric",
  "nest",
  "radar",
  "roomtemp",
  "stocks",
  "tomorrow",
  "twitchstream",
  "wispers"
];

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

  const [rootTargetWidget, setRootTargetWidget] = useState("");
  const [rootMessage, setRootMessage] = useState("");
  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
    } catch (err) {
      console.error("Failed to detect timezone", err);
      return "Unknown";
    }
  }, []);

  const infoTableRows = useMemo(() => (
    [
      ["Version", `v${APP_VERSION}`],
      ["Total Dashboards", String(dashboards.length)],
      ["Total Playlists", String(playlists.length)],
      ["Time Zone", timeZone]
    ]
  ), [dashboards.length, playlists.length, timeZone]);

  const supportTableRows = useMemo(() => (
    [
      ["Documentation", <a href="https://github.com/Dasutin/dashino#readme" target="_blank" rel="noreferrer">GitHub README</a>],
      ["GitHub Issues", <a href="https://github.com/Dasutin/dashino/issues" target="_blank" rel="noreferrer">Issue Tracker</a>]
    ]
  ), []);

  const [appearance, setAppearance] = useState<Appearance>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("appearance");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [settingsTab, setSettingsTab] = useState<"backup" | "tools" | "about">("backup");

  const widgetChoices = useMemo(() => {
    const discovered = dashboards.flatMap(d => d.widgets.map(w => w.type));
    return Array.from(new Set([...DEFAULT_WIDGET_TYPES, ...discovered])).sort();
  }, [dashboards]);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorSlug, setEditorSlug] = useState("");
  const [editorRotation, setEditorRotation] = useState(30);
  const [editorDashboards, setEditorDashboards] = useState<string[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [deletingPlaylist, setDeletingPlaylist] = useState(false);
  const [deletePlaylistSlug, setDeletePlaylistSlug] = useState<string | null>(null);
  const [deletePlaylistName, setDeletePlaylistName] = useState("");
  const [deletePlaylistError, setDeletePlaylistError] = useState<string | null>(null);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createShortname, setCreateShortname] = useState("");
  const [createIdTouched, setCreateIdTouched] = useState(false);
  const [createDescription, setCreateDescription] = useState("");
  const [createTheme, setCreateTheme] = useState("main");
  const [createRows, setCreateRows] = useState("6");
  const [createColumns, setCreateColumns] = useState("12");
  const [createWidgets, setCreateWidgets] = useState<string[]>([]);
  const [createWidgetSelect, setCreateWidgetSelect] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [deletingDashboard, setDeletingDashboard] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<string[]>([]);
  const [editDashboardSlug, setEditDashboardSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTheme, setEditTheme] = useState("");
  const [editRows, setEditRows] = useState("");
  const [editColumns, setEditColumns] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [updatingDashboard, setUpdatingDashboard] = useState(false);
  const [editWidgets, setEditWidgets] = useState<Dashboard["widgets"]>([]);
  const [editWidgetSelect, setEditWidgetSelect] = useState("");

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

  const resetCreateForm = () => {
    setCreateName("");
    setCreateShortname("");
    setCreateIdTouched(false);
    setCreateDescription("");
    setCreateTheme("main");
    setCreateRows("6");
    setCreateColumns("12");
    setCreateWidgets([]);
    setCreateWidgetSelect("");
    setCreateError(null);
  };

  const openDeleteDashboard = (slug: string, name: string) => {
    setDeleteSlug(slug);
    setDeleteName(name || slug);
    setDeleteError(null);
    const usedBy = playlists
      .filter(p => p.dashboards?.includes(slug))
      .map(p => p.name || p.slug);
    setDeleteUsage(usedBy);
  };

  const resetDeleteState = () => {
    setDeleteSlug(null);
    setDeleteName("");
    setDeleteError(null);
    setDeleteUsage([]);
  };

  const openEditDashboard = (dashboard: Dashboard) => {
    const themeValue = dashboard.theme ?? (dashboard.className?.startsWith("theme-") ? dashboard.className.replace(/^theme-/, "") : "");
    setEditDashboardSlug(dashboard.slug);
    setEditName(dashboard.name);
    setEditDescription(dashboard.description ?? "");
    setEditTheme(themeValue);
    setEditRows(Number.isFinite(dashboard.maxRows) ? String(dashboard.maxRows) : "");
    setEditColumns(Number.isFinite(dashboard.maxColumns) ? String(dashboard.maxColumns) : "");
    setEditError(null);
    setEditWidgets(dashboard.widgets ?? []);
    setEditWidgetSelect("");
  };

  const resetEditDashboard = () => {
    setEditDashboardSlug(null);
    setEditName("");
    setEditDescription("");
    setEditTheme("");
    setEditRows("");
    setEditColumns("");
    setEditError(null);
    setUpdatingDashboard(false);
    setEditWidgets([]);
    setEditWidgetSelect("");
  };

  const handleDeleteDashboard = async () => {
    if (!deleteSlug) return;
    setDeletingDashboard(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${apiOrigin}/api/dashboards/${deleteSlug}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed with status ${res.status}`);
      }
      setDashboards(prev => prev.filter(d => d.slug !== deleteSlug));
      setPlaylists(prev => prev.map(p => ({ ...p, dashboards: p.dashboards.filter(s => s !== deleteSlug) })));
      if (selectedSlug === deleteSlug) {
        navigateTo(null);
        setSelectedSlug(null);
      }
      resetDeleteState();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete dashboard");
    } finally {
      setDeletingDashboard(false);
    }
  };

  const handleUpdateDashboard = async () => {
    if (!editDashboardSlug) return;
    const target = dashboards.find(d => d.slug === editDashboardSlug);
    if (!target) {
      setEditError("Dashboard not found");
      return;
    }

    const name = editName.trim();
    if (!name) {
      setEditError("Name is required");
      return;
    }

    const description = editDescription.trim();
    const theme = editTheme.trim();

    const rowsValue = editRows.trim();
    const colsValue = editColumns.trim();

    const nextRows = rowsValue ? Number(rowsValue) : target.maxRows ?? 6;
    if (!Number.isFinite(nextRows) || nextRows <= 0) {
      setEditError("Rows must be greater than 0");
      return;
    }

    const nextColumns = colsValue ? Number(colsValue) : target.maxColumns;
    if (!Number.isFinite(nextColumns) || nextColumns <= 0) {
      setEditError("Columns must be greater than 0");
      return;
    }

    const maxSlots = Math.max(1, nextRows * nextColumns);
    if (editWidgets.length > maxSlots) {
      setEditError(`Too many widgets for grid (${maxSlots} slots). Remove some or increase rows/columns.`);
      return;
    }

    const sanitizedWidgets = editWidgets.map(w => {
      const type = slugify(w.type, w.type);
      const id = w.id && typeof w.id === "string" ? w.id.trim() : type;
      const pos = w.position || {};
      const position: typeof w.position = {};
      if (Number.isFinite(pos.w)) position.w = Number(pos.w);
      if (Number.isFinite(pos.h)) position.h = Number(pos.h);
      if (Number.isFinite(pos.x)) position.x = Number(pos.x);
      if (Number.isFinite(pos.y)) position.y = Number(pos.y);
      return { id, type, position } as Dashboard["widgets"][number];
    });

    setUpdatingDashboard(true);
    setEditError(null);

    try {
      const res = await fetch(`${apiOrigin}/api/dashboards/${editDashboardSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          theme,
          rows: nextRows,
          columns: nextColumns,
          widgets: sanitizedWidgets
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed with status ${res.status}`);
      }

      const body = await res.json();
      const updated = body?.dashboard as Dashboard | undefined;
      if (updated) {
        setDashboards(prev => prev.map(d => (d.slug === updated.slug ? updated : d)));
      }
      resetEditDashboard();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update dashboard");
    } finally {
      setUpdatingDashboard(false);
    }
  };

  const handleAddWidget = () => {
    const type = slugify(createWidgetSelect.trim(), createWidgetSelect.trim());
    if (!type) return;
    const rows = Math.max(1, Number(createRows) || 0);
    const cols = Math.max(1, Number(createColumns) || 0);
    const maxSlots = rows * cols;
    if (createWidgets.length >= maxSlots) {
      setCreateError(`Grid capacity reached (${maxSlots} slots). Increase rows/columns to add more widgets.`);
      return;
    }
    setCreateError(null);
    setCreateWidgets(prev => [...prev, type]);
    setCreateWidgetSelect("");
  };

  const handleRemoveWidget = (index: number) => {
    setCreateWidgets(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddEditWidget = () => {
    const type = slugify(editWidgetSelect.trim(), editWidgetSelect.trim());
    if (!type) return;

    setEditError(null);

    setEditWidgets(prev => {
      const counts: Record<string, number> = {};
      const existingIds = new Set(prev.map(w => w.id));

      prev.forEach(w => {
        const key = w.type;
        counts[key] = (counts[key] ?? 0) + 1;
      });

      let nextId = counts[type] ? `${type}-${counts[type] + 1}` : type;
      let attempt = counts[type] ? counts[type] + 1 : 1;
      while (existingIds.has(nextId)) {
        attempt += 1;
        nextId = `${type}-${attempt}`;
      }

      const nextWidget = { id: nextId, type, position: { w: 1, h: 1 } } as Dashboard["widgets"][number];
      return [...prev, nextWidget];
    });

    setEditWidgetSelect("");
  };

  const handleRemoveEditWidget = (index: number) => {
    setEditWidgets(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateDashboard = async () => {
    if (!createName.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!createShortname.trim()) {
      setCreateError("Dashboard ID is required");
      return;
    }
    const rows = Math.max(1, Number(createRows) || 0);
    const columns = Math.max(1, Number(createColumns) || 0);
    const maxSlots = rows * columns;
    if (createWidgets.length > maxSlots) {
      setCreateError(`Too many widgets for grid (${maxSlots} slots). Remove some or increase rows/columns.`);
      return;
    }

    const counts: Record<string, number> = {};
    const widgetsPayload = createWidgets.slice(0, maxSlots).map(rawType => {
      const type = slugify(rawType, rawType);
      if (!type) return null;
      counts[type] = (counts[type] ?? 0) + 1;
      const id = counts[type] === 1 ? type : `${type}-${counts[type]}`;
      return {
        id,
        type,
        position: { w: 1, h: 1 }
      };
    }).filter(Boolean) as Dashboard["widgets"];

    setCreateError(null);
    setCreatingDashboard(true);
    try {
      const res = await fetch(`${apiOrigin}/api/dashboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          shortname: createShortname.trim(),
          description: createDescription.trim(),
          theme: createTheme.trim(),
          rows,
          columns,
          widgets: widgetsPayload
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCreateError(body?.error || "Failed to create dashboard");
        return;
      }

      const body = await res.json();
      const created = body?.dashboard as Dashboard | undefined;
      if (created) {
        setDashboards(prev => [...prev, created]);
      }
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      setCreateError("Failed to create dashboard");
      console.error(err);
    } finally {
      setCreatingDashboard(false);
    }
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
    setPlaylistModalOpen(false);
  };

  const openDeletePlaylist = (slug: string, name: string) => {
    setDeletePlaylistSlug(slug);
    setDeletePlaylistName(name || slug);
    setDeletePlaylistError(null);
  };

  const resetDeletePlaylistState = () => {
    setDeletePlaylistSlug(null);
    setDeletePlaylistName("");
    setDeletePlaylistError(null);
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

  const handleEditPlaylist = (playlist: Playlist) => {
    setEditingSlug(playlist.slug);
    setEditorName(playlist.name);
    setEditorSlug(playlist.slug);
    setEditorRotation(Math.max(1, Math.round(playlist.rotationSeconds)));
    setEditorDashboards(playlist.dashboards ?? []);
    setEditorError(null);
    setSlugTouched(true);
    setPlaylistModalOpen(true);
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
      setPlaylistModalOpen(false);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to save playlist");
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async () => {
    const targetSlug = deletePlaylistSlug ?? editingSlug;
    if (!targetSlug) return;
    setDeletingPlaylist(true);
    setDeletePlaylistError(null);
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
      resetDeletePlaylistState();
    } catch (err) {
      setDeletePlaylistError(err instanceof Error ? err.message : "Failed to delete playlist");
    } finally {
      setDeletingPlaylist(false);
    }
  };

  const toggleAppearance = () => {
    setAppearance(prev => (prev === "dark" ? "light" : "dark"));
  };

  const playlistSlugValue = slugTouched ? editorSlug : editorSlug || slugify(editorName, "");

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


  if (isBackupsPage) {
    return (
      <div className="landing-shell">
        <SidebarNav
          isHomeActive={false}
          isPlaylistManagerActive={false}
          isBackupsActive
          onSelectHome={handleGoHome}
          onOpenPlaylistManager={handleOpenPlaylistManager}
          onOpenBackups={handleOpenBackups}
        />

        <main className="landing landing-main">
          <div className="top-bar">
            <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
              {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <header className="hero">
            <div>
              <h1>Settings</h1>
              <p>Download backups and access utilities for your Dashino instance.</p>
            </div>
          </header>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panel-header">
              <h3>Settings</h3>
            </div>
            <div className="tab-row">
              <button className={`tab ${settingsTab === "backup" ? "active" : ""}`} type="button" onClick={() => setSettingsTab("backup")}>Backup</button>
              <button className={`tab ${settingsTab === "tools" ? "active" : ""}`} type="button" onClick={() => setSettingsTab("tools")}>Tools</button>
              <button className={`tab ${settingsTab === "about" ? "active" : ""}`} type="button" onClick={() => setSettingsTab("about")}>About</button>
            </div>
            <div className="tab-panels">
              {settingsTab === "backup" ? (
                <div className="tab-panel">
                  <p className="muted" style={{ marginBottom: 8 }}>Download a snapshot of dashboards, widgets, themes, jobs, and playlists.</p>
                  <div className="panel-actions" style={{ marginTop: 6 }}>
                    <button
                      onClick={() => {
                        window.location.href = backupUrl;
                      }}
                    >
                      Create backup
                    </button>
                  </div>
                </div>
              ) : null}

              {settingsTab === "tools" ? (
                <div className="tab-panel">
                  <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Event Testing</h3>
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
                </div>
              ) : null}

              {settingsTab === "about" ? (
                <div className="tab-panel">
                  <h2 style={{ margin: 0, marginBottom: 24 }}>About Dashino</h2>
                  <table className="info-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
                    <tbody>
                      {infoTableRows.map(([label, value]) => (
                        <tr key={label} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                          <td style={{ padding: "14px 0", fontWeight: 600 }}>{label}</td>
                          <td style={{ padding: "14px 0" }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h2 style={{ margin: 0, marginTop: 28, marginBottom: 18 }}>Getting Support</h2>
                  <table className="info-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
                    <tbody>
                      {supportTableRows.map(([label, value]) => (
                        <tr key={label} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                          <td style={{ padding: "14px 0", fontWeight: 600 }}>{label}</td>
                          <td style={{ padding: "14px 0" }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h2 style={{ margin: 0, marginTop: 28 }}>Support Dashino</h2>
                </div>
              ) : null}
            </div>
          </div>
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
          onSelectHome={handleGoHome}
          onOpenPlaylistManager={handleOpenPlaylistManager}
          onOpenBackups={handleOpenBackups}
        />

        <main className="landing landing-main">
          <div className="top-bar">
            <button className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle appearance">
              {appearance === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <header className="hero">
            <div>
              <h1>Dashino Playlists</h1>
              <p>Rotate a set of dashboards automatically.</p>
            </div>
            <div className="hero-actions">
              <button onClick={() => { resetEditor(); setPlaylistModalOpen(true); }}>New Playlist</button>
            </div>
          </header>

          {dashboardsError ? <p className="error-text">{dashboardsError}</p> : null}
          {playlistsError ? <p className="error-text">{playlistsError}</p> : null}

          <section className="panel">
            <div className="panel-header">
              <h3>Playlists</h3>
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
                      <button onClick={() => handlePlaylistStart(p.slug)} aria-label={`Run ${p.name}`}>
                        <PlayArrowIcon fontSize="small" />
                      </button>
                      <button onClick={() => handleEditPlaylist(p)} aria-label={`Edit ${p.name}`}>
                        <EditIcon fontSize="small" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingSlug(p.slug);
                          openDeletePlaylist(p.slug, p.name);
                        }}
                        disabled={deletingPlaylist && editingSlug === p.slug}
                        className="danger icon"
                        aria-label={`Delete ${p.name}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {deletePlaylistSlug ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <div className="modal">
                <div className="modal-header">
                  <h3>Delete Playlist</h3>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete “{deletePlaylistName || deletePlaylistSlug}”?</p>
                  <p className="muted">This only removes the playlist file. Dashboards will remain untouched.</p>
                  {deletePlaylistError ? <p className="error-text" style={{ marginTop: 8 }}>{deletePlaylistError}</p> : null}
                </div>
                <div className="modal-actions">
                  <button className="ghost" disabled={deletingPlaylist} onClick={resetDeletePlaylistState}>Cancel</button>
                  <button className="danger" disabled={deletingPlaylist} onClick={handleDeletePlaylist}>
                    {deletingPlaylist ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {playlistModalOpen ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <div className="modal">
                <div className="modal-header">
                  <h3>{editingSlug ? "Edit Playlist" : "New Playlist"}</h3>
                </div>
                <div className="modal-body">
                  <PlaylistEditor
                    name={editorName}
                    slug={playlistSlugValue}
                    rotationSeconds={editorRotation}
                    dashboards={dashboards}
                    selectedDashboards={editorDashboards}
                    error={editorError}
                    isSaving={savingPlaylist}
                    isDeleting={deletingPlaylist}
                    onNameChange={value => {
                      setEditorName(value);
                      if (!slugTouched) {
                        setEditorSlug(slugify(value, ""));
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
                    onDelete={editingSlug ? () => openDeletePlaylist(editingSlug, editorName || editingSlug) : undefined}
                    canDelete={Boolean(editingSlug)}
                  />
                </div>
              </div>
            </div>
          ) : null}

        </main>
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <SidebarNav
        isHomeActive={!isPlaylistManager && !isBackupsPage}
        isPlaylistManagerActive={false}
        isBackupsActive={isBackupsPage}
        onSelectHome={handleGoHome}
        onOpenPlaylistManager={handleOpenPlaylistManager}
        onOpenBackups={handleOpenBackups}
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
            <div className="hero-actions">
              <button onClick={() => setCreateOpen(true)}>New Dashboard</button>
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
                      <PlayArrowIcon fontSize="small" />
                    </button>
                    <button onClick={() => openEditDashboard(d)} aria-label={`Edit ${d.name}`}>
                      <EditIcon fontSize="small" />
                    </button>
                    <button className="danger icon" onClick={() => openDeleteDashboard(d.slug, d.name)} aria-label={`Delete ${d.name}`}>
                      <DeleteIcon fontSize="small" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {createOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header">
                <h3>New Dashboard</h3>
              </div>
              <div className="modal-body modal-grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={createName}
                    onChange={e => {
                      setCreateName(e.target.value);
                      if (!createIdTouched) {
                        setCreateShortname(slugify(e.target.value, ""));
                      }
                    }}
                  />
                </label>
                <label>
                  Dashboard ID (URL)
                  <input
                    type="text"
                    value={createShortname}
                    onChange={e => {
                      setCreateIdTouched(true);
                      setCreateShortname(slugify(e.target.value, ""));
                    }}
                  />
                </label>
                <label className="full-row">
                  Description
                  <input
                    type="text"
                    value={createDescription}
                    onChange={e => setCreateDescription(e.target.value)}
                  />
                </label>
                <label>
                  Theme
                  <input
                    type="text"
                    value={createTheme}
                    onChange={e => setCreateTheme(e.target.value)}
                    placeholder="main"
                  />
                </label>
                <div className="full-row modal-row-pair">
                  <label>
                    Columns
                    <input
                      type="number"
                      min={1}
                      value={createColumns}
                      onChange={e => setCreateColumns(e.target.value)}
                    />
                  </label>
                  <label>
                    Rows
                    <input
                      type="number"
                      min={1}
                      value={createRows}
                      onChange={e => setCreateRows(e.target.value)}
                    />
                  </label>
                </div>
                <div className="full-row">
                  <label>
                    Add widgets
                    <div className="widget-picker">
                      <select
                        value={createWidgetSelect}
                        onChange={e => setCreateWidgetSelect(e.target.value)}
                      >
                        <option value="">Select a widget type</option>
                        {widgetChoices.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={handleAddWidget} disabled={!createWidgetSelect}>
                        Add
                      </button>
                    </div>
                  </label>
                  {createWidgets.length > 0 ? (
                    <div className="chip-row">
                      {createWidgets.map((type, idx) => (
                        <span key={`${type}-${idx}`} className="chip">
                          {type}
                          <button type="button" onClick={() => handleRemoveWidget(idx)} aria-label={`Remove ${type}`}>
                            <ClearIcon fontSize="small" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: "6px 0 0" }}>No widgets selected</p>
                  )}
                </div>
              </div>
              {createError ? <p className="error-text" style={{ marginTop: 8 }}>{createError}</p> : null}
              <div className="modal-actions">
                <button
                  onClick={() => {
                    setCreateOpen(false);
                    resetCreateForm();
                  }}
                  disabled={creatingDashboard}
                  className="ghost"
                >
                  Cancel
                </button>
                <button onClick={handleCreateDashboard} disabled={creatingDashboard}>
                  {creatingDashboard ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editDashboardSlug ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header">
                <h3>Edit Dashboard</h3>
              </div>
              <div className="modal-body modal-grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </label>
                <label>
                  Dashboard ID
                  <input type="text" value={editDashboardSlug} disabled />
                </label>
                <label className="full-row">
                  Description
                  <input
                    type="text"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                  />
                </label>
                <label>
                  Theme
                  <input
                    type="text"
                    placeholder="main"
                    value={editTheme}
                    onChange={e => setEditTheme(e.target.value)}
                  />
                </label>
                <div className="full-row modal-row-pair">
                  <label>
                    Columns
                    <input
                      type="number"
                      min={1}
                      value={editColumns}
                      onChange={e => setEditColumns(e.target.value)}
                    />
                  </label>
                  <label>
                    Rows
                    <input
                      type="number"
                      min={1}
                      value={editRows}
                      onChange={e => setEditRows(e.target.value)}
                    />
                  </label>
                </div>
                <div className="full-row">
                  <label>
                    Add widgets
                    <div className="widget-picker">
                      <select
                        value={editWidgetSelect}
                        onChange={e => setEditWidgetSelect(e.target.value)}
                      >
                        <option value="">Select a widget type</option>
                        {widgetChoices.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={handleAddEditWidget} disabled={!editWidgetSelect}>
                        Add
                      </button>
                    </div>
                  </label>
                  {editWidgets.length > 0 ? (
                    <div className="chip-row">
                      {editWidgets.map((w, idx) => (
                        <span key={`${w.id}-${idx}`} className="chip">
                          {w.type} ({w.id})
                          <button type="button" onClick={() => handleRemoveEditWidget(idx)} aria-label={`Remove ${w.id}`}>
                            <ClearIcon fontSize="small" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: "6px 0 0" }}>No widgets</p>
                  )}
                </div>
              </div>
              {editError ? <p className="error-text" style={{ marginTop: 8 }}>{editError}</p> : null}
              <div className="modal-actions">
                <button
                  className="ghost"
                  disabled={updatingDashboard}
                  onClick={resetEditDashboard}
                >
                  Cancel
                </button>
                <button onClick={handleUpdateDashboard} disabled={updatingDashboard}>
                  {updatingDashboard ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteSlug ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header">
                <h3>Delete Dashboard</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete “{deleteName || deleteSlug}”?</p>
                <p className="muted">This only removes the dashboard. Widgets will remain untouched.</p>
                {deleteUsage.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <p className="error-text" style={{ margin: 0 }}>Used in playlists:</p>
                    <ul className="muted" style={{ margin: 4, paddingLeft: 18 }}>
                      {deleteUsage.map(name => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>Not referenced by any playlists.</p>
                )}
                {deleteError ? <p className="error-text" style={{ marginTop: 8 }}>{deleteError}</p> : null}
              </div>
              <div className="modal-actions">
                <button className="ghost" disabled={deletingDashboard} onClick={resetDeleteState}>Cancel</button>
                <button className="danger" disabled={deletingDashboard} onClick={handleDeleteDashboard}>
                  {deletingDashboard ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </main>
    </div>
  );
}

export default App;
