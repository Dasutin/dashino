import React from "react";
import BackupIcon from "@mui/icons-material/Backup";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaylistIcon from "@mui/icons-material/QueueMusic";

export type SidebarNavProps = {
  isHomeActive?: boolean;
  isPlaylistManagerActive?: boolean;
  isBackupsActive?: boolean;
  onSelectHome: () => void;
  onOpenPlaylistManager: () => void;
  onOpenBackups: () => void;
};

function SidebarNav({ isHomeActive, isPlaylistManagerActive, isBackupsActive, onSelectHome, onOpenPlaylistManager, onOpenBackups }: SidebarNavProps) {
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
      </div>
      <div className="sidebar-section sidebar-section-secondary">
        <button
          className={`sidebar-item ${isBackupsActive ? "active" : ""}`}
          onClick={onOpenBackups}
        >
          <BackupIcon className="sidebar-icon" />
          <span>Settings</span>
        </button>
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-footer-separator" />
        <div>Dashino v0.1.0</div>
      </div>
    </aside>
  );
}

export default SidebarNav;
