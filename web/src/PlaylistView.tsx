import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Dashboard, Playlist } from "./types";
import "./playlist.css";

const DashboardView = lazy(() => import("./DashboardView"));

type PlaylistViewProps = {
  slug: string;
  apiOrigin: string;
};

type SlotState = { slug: string | null; key: number };

function PlaylistView({ slug, apiOrigin }: PlaylistViewProps) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sequence, setSequence] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState<"a" | "b">("a");
  const [activeIndex, setActiveIndex] = useState(0);
  const [slotA, setSlotA] = useState<SlotState>({ slug: null, key: 0 });
  const [slotB, setSlotB] = useState<SlotState>({ slug: null, key: 1 });
  const rotationMsRef = useRef<number>(30000);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [playlistRes, dashboardsRes] = await Promise.all([
          fetch(`${apiOrigin}/api/playlists/${slug}`).then(r => {
            if (!r.ok) throw new Error(`status ${r.status}`);
            return r.json();
          }),
          fetch(`${apiOrigin}/api/dashboards`).then(r => r.json())
        ]);

        if (cancelled) return;
        const loadedPlaylist = (playlistRes as any)?.playlist as Playlist | undefined;
        const loadedDashboards = (dashboardsRes as any)?.dashboards as Dashboard[] | undefined;

        if (!loadedPlaylist) {
          setError("Playlist not found");
          setPlaylist(null);
          setDashboards([]);
          setSequence([]);
          return;
        }

        setPlaylist(loadedPlaylist);
        setDashboards(Array.isArray(loadedDashboards) ? loadedDashboards : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load playlist");
        setPlaylist(null);
        setDashboards([]);
        setSequence([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load().catch(err => console.error("Failed to load playlist", err));
    return () => {
      cancelled = true;
    };
  }, [apiOrigin, slug]);

  const dashboardMap = useMemo(() => {
    const map = new Map<string, Dashboard>();
    dashboards.forEach(d => map.set(d.slug, d));
    return map;
  }, [dashboards]);

  useEffect(() => {
    if (!playlist) return;
    const available = playlist.dashboards.filter(d => dashboardMap.has(d));
    const missingList = playlist.dashboards.filter(d => !dashboardMap.has(d));
    setMissing(missingList);
    setSequence(available);
    setActiveIndex(0);
    setActiveSlot("a");
    const first = available[0] ?? null;
    const second = available[1] ?? first ?? null;
    setSlotA({ slug: first, key: Date.now() });
    setSlotB({ slug: second, key: Date.now() + 1 });
    rotationMsRef.current = Math.max(3000, Math.round((playlist.rotationSeconds || 0) * 1000));
  }, [dashboardMap, playlist]);

  useEffect(() => {
    if (!playlist) return;
    rotationMsRef.current = Math.max(3000, Math.round((playlist.rotationSeconds || 0) * 1000));
  }, [playlist]);

  useEffect(() => {
    if (!sequence.length || !playlist) return;
    if (sequence.length === 1) return;

    const timeout = setTimeout(() => {
      const nextIndex = (activeIndex + 1) % sequence.length;
      const nextSlug = sequence[nextIndex];
      const inactive = activeSlot === "a" ? "b" : "a";
      const key = Date.now();

      if (inactive === "a") {
        setSlotA({ slug: nextSlug, key });
      } else {
        setSlotB({ slug: nextSlug, key });
      }

      // allow the inactive slot to mount before switching
      requestAnimationFrame(() => setActiveSlot(inactive));
      setActiveIndex(nextIndex);
    }, rotationMsRef.current || 30000);

    return () => clearTimeout(timeout);
  }, [activeIndex, activeSlot, playlist, sequence]);

  const renderSlot = (slot: SlotState, isActive: boolean) => {
    if (!slot.slug) return <div className="playlist-slot-placeholder">No dashboard</div>;
    const dashboard = dashboardMap.get(slot.slug);
    if (!dashboard) return <div className="playlist-slot-placeholder">Missing dashboard: {slot.slug}</div>;
    return (
      <Suspense fallback={<div className="playlist-slot-placeholder">Loading…</div>}>
        <DashboardView dashboard={dashboard} apiOrigin={apiOrigin} onConnectionChange={() => {}} sseEnabled={isActive} />
      </Suspense>
    );
  };

  if (loading) {
    return (
      <div className="playlist-view">
        <p>Loading playlist…</p>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="playlist-view">
        <p className="error-text">{error || "Playlist not found"}</p>
      </div>
    );
  }

  if (!sequence.length) {
    return (
      <div className="playlist-view">
        <h2>{playlist.name}</h2>
        <p className="muted">This playlist has no playable dashboards.</p>
        {missing.length ? <p className="muted">Missing: {missing.join(", ")}</p> : null}
      </div>
    );
  }

  return (
    <div className="playlist-view">
      <div className="playlist-stage">
        <div className={`playlist-slot ${activeSlot === "a" ? "active" : ""}`} key={slotA.key}>
          {renderSlot(slotA, activeSlot === "a")}
        </div>
        <div className={`playlist-slot ${activeSlot === "b" ? "active" : ""}`} key={slotB.key}>
          {renderSlot(slotB, activeSlot === "b")}
        </div>
      </div>
    </div>
  );
}

export default PlaylistView;
