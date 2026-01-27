import React from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import StorageIcon from "@mui/icons-material/Storage";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaylistIcon from "@mui/icons-material/QueueMusic";
import LayersIcon from "@mui/icons-material/Layers";

export type SidebarNavProps = {
  isHomeActive?: boolean;
  isPlaylistManagerActive?: boolean;
  isStacksActive?: boolean;
  isBackupsActive?: boolean;
  buildLabel?: string;
  version?: string;
  onSelectHome: () => void;
  onOpenPlaylistManager: () => void;
  onOpenStacks: () => void;
  onOpenBackups: () => void;
  onOpenAbout?: () => void;
};

function SidebarNav({
  isHomeActive,
  isPlaylistManagerActive,
  isStacksActive,
  isBackupsActive,
  buildLabel = "dev",
  version = "0.0.0",
  onSelectHome,
  onOpenPlaylistManager,
  onOpenStacks,
  onOpenBackups,
  onOpenAbout,
}: SidebarNavProps) {
  return (
    <aside className="sidebar-nav">
      <div className="sidebar-brand">Dashino</div>
      <div className="sidebar-section">
        <button
          className={`sidebar-item ${isHomeActive ? "active" : ""}`}
          onClick={onSelectHome}
        >
          <DashboardIcon className="sidebar-icon" />
          <span>Dashboards</span>
        </button>
        <button
          className={`sidebar-item ${isPlaylistManagerActive ? "active" : ""}`}
          onClick={onOpenPlaylistManager}
        >
          <PlaylistIcon className="sidebar-icon" />
          <span>Playlists</span>
        </button>
        <button
          className={`sidebar-item ${isStacksActive ? "active" : ""}`}
          onClick={onOpenStacks}
        >
          <LayersIcon className="sidebar-icon" />
          <span>Stacks</span>
        </button>
        <button
          className={`sidebar-item ${isBackupsActive ? "active" : ""}`}
          onClick={onOpenBackups}
        >
          <SettingsIcon className="sidebar-icon" />
          <span>Settings</span>
        </button>
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-footer-separator" />
        <button className="sidebar-item" onClick={onOpenAbout || onOpenBackups}>
          <StorageIcon className="sidebar-icon" />
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              lineHeight: 1.2,
            }}
          >
            <span>{`Dashino ${buildLabel}`}</span>
            <span
              className="muted"
              style={{
                fontSize: 12,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              }}
            >
              {version}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarNav;
