import React from "react";

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
          Dashboards
        </button>
        <button
          className={`sidebar-item ${isPlaylistManagerActive ? "active" : ""}`}
          onClick={onOpenPlaylistManager}
        >
          Playlists
        </button>
      </div>
      <div className="sidebar-section sidebar-section-secondary">
        <button
          className={`sidebar-item ${isBackupsActive ? "active" : ""}`}
          onClick={onOpenBackups}
        >
          Backups
        </button>
        <button
          className={`sidebar-item ${isToolsActive ? "active" : ""}`}
          onClick={onOpenTools}
        >
          Tools
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
