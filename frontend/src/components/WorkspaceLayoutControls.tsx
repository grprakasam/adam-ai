import React from 'react';
import { useProjectStore } from '../store/projectStore';
import './WorkspaceLayoutControls.css';

type LayoutPresetKey = 'balanced' | 'focused' | 'immersive' | 'ultra';

const LAYOUT_PRESETS: Record<
  LayoutPresetKey,
  { label: string; subtitle: string; columns: string; pairPercentage: number }
> = {
  balanced: { label: 'Balanced', subtitle: '30% / 70%', columns: '30% 70%', pairPercentage: 70 },
  focused: { label: 'Focused', subtitle: '25% / 75%', columns: '25% 75%', pairPercentage: 75 },
  immersive: { label: 'Immersive', subtitle: '20% / 80%', columns: '20% 80%', pairPercentage: 80 },
  ultra: { label: 'Ultra Focus', subtitle: '5% / 95%', columns: '5% 95%', pairPercentage: 95 },
};

export const WorkspaceLayoutControls: React.FC = () => {
  const layoutPreset = useProjectStore((state) => state.workspaceLayoutPreset);
  const setLayoutPreset = useProjectStore((state) => state.setWorkspaceLayoutPreset);

  const layoutOptions = (
    Object.entries(LAYOUT_PRESETS) as [LayoutPresetKey, (typeof LAYOUT_PRESETS)[LayoutPresetKey]][]
  ).sort((a, b) => a[1].pairPercentage - b[1].pairPercentage);

  return (
    <div className="workspace-layout-controls">
      <span className="workspace-layout-label">Layout:</span>
      <div className="workspace-layout-buttons">
        {layoutOptions.map(([key, preset]) => {
          const isActive = layoutPreset === key;
          return (
            <button
              key={key}
              type="button"
              className={`workspace-layout-button ${isActive ? 'active' : ''}`}
              onClick={() => setLayoutPreset(key)}
              aria-pressed={isActive}
              title={`${preset.label} - ${preset.subtitle}`}
            >
              <span className="workspace-layout-title">{preset.label}</span>
              <span className="workspace-layout-subtitle">{preset.subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { LAYOUT_PRESETS };
export type { LayoutPresetKey };
