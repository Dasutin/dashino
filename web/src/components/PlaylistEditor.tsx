import React from "react";
import type { Dashboard } from "../types";

export type PlaylistEditorProps = {
  name: string;
  slug: string;
  rotationSeconds: number;
  dashboards: Dashboard[];
  selectedDashboards: string[];
  error?: string | null;
  isSaving?: boolean;
  isDeleting?: boolean;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onRotationChange: (value: number) => void;
  onToggleDashboard: (slug: string, selected: boolean) => void;
  onMoveDashboard: (slug: string, delta: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
};

function PlaylistEditor({
  name,
  slug,
  rotationSeconds,
  dashboards,
  selectedDashboards,
  error,
  isSaving,
  isDeleting,
  onNameChange,
  onSlugChange,
  onRotationChange,
  onToggleDashboard,
  onMoveDashboard,
  onSave,
  onCancel,
  onDelete,
  canDelete
}: PlaylistEditorProps) {
  return (
    <div className="panel playlist-editor">
      <div className="panel-header">
        <h3>{canDelete ? "Edit Playlist" : "New Playlist"}</h3>
      </div>
      <div className="panel-grid">
        <label>
          Name
          <input type="text" value={name} onChange={e => onNameChange(e.target.value)} placeholder="Morning loop" />
        </label>
        <label>
          Slug
          <input type="text" value={slug} onChange={e => onSlugChange(e.target.value)} placeholder="morning-loop" />
        </label>
        <label>
          Rotation (seconds)
          <input
            type="number"
            min={3}
            max={600}
            value={rotationSeconds}
            onChange={e => onRotationChange(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className="dashboard-picker">
        <div className="available">
          <div className="picker-title">Dashboards</div>
          <div className="picker-list">
            {dashboards.map(d => {
              const checked = selectedDashboards.includes(d.slug);
              return (
                <label key={d.slug} className="picker-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => onToggleDashboard(d.slug, e.target.checked)}
                  />
                  <span>{d.name}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="selected">
          <div className="picker-title">Selected Order</div>
          {selectedDashboards.length === 0 ? (
            <p className="muted">Choose dashboards to include</p>
          ) : (
            <ul className="selected-list">
              {selectedDashboards.map(slugVal => (
                <li key={slugVal}>
                  <span>{slugVal}</span>
                  <div className="reorder">
                    <button onClick={() => onMoveDashboard(slugVal, -1)} aria-label="Move up">↑</button>
                    <button onClick={() => onMoveDashboard(slugVal, 1)} aria-label="Move down">↓</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel-actions">
        {canDelete && onDelete ? (
          <button onClick={onDelete} disabled={isDeleting} className="ghost">
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        ) : null}
        <div className="spacer" />
        <button onClick={onCancel} className="ghost">Cancel</button>
        <button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default PlaylistEditor;
