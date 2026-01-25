import React from "react";
import BackupIcon from "../icons/Backup";
import DashboardIcon from "../icons/Dashboard";
import PlaylistIcon from "../icons/Playlist";
import ToolsIcon from "../icons/Tools";

export type SidebarNavProps = {
  isHomeActive?: boolean;
  isPlaylistManagerActive?: boolean;
  isBackupsActive?: boolean;
  isToolsActive?: boolean;
  onSelectHome: () => void;
  onOpenPlaylistManager: () => void;
  onOpenBackups: () => void;
  onOpenTools: () => void;
};

function SidebarNav({ isHomeActive, isPlaylistManagerActive, isBackupsActive, isToolsActive, onSelectHome, onOpenPlaylistManager, onOpenBackups, onOpenTools }: SidebarNavProps) {
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
          <span>Backups</span>
        </button>
        <button
          className={`sidebar-item ${isToolsActive ? "active" : ""}`}
          onClick={onOpenTools}
        >
          <ToolsIcon className="sidebar-icon" />
          <span>Tools</span>
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
