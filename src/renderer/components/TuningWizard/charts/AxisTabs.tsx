import React from 'react';
import { AXIS_COLORS, type Axis } from './chartUtils';
import './AxisTabs.css';

export type AxisSelection = Axis | 'all';

interface AxisTabsProps {
  selected: AxisSelection;
  onChange: (axis: AxisSelection) => void;
  /** Whether to show the "All" tab (default: true) */
  showAll?: boolean;
}

const TABS: { key: AxisSelection; label: string }[] = [
  { key: 'roll', label: 'Roll' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'yaw', label: 'Yaw' },
  { key: 'all', label: 'All' },
];

export function AxisTabs({ selected, onChange, showAll = true }: AxisTabsProps) {
  const visibleTabs = showAll ? TABS : TABS.filter((t) => t.key !== 'all');
  return (
    <div className="axis-tabs" role="tablist">
      {visibleTabs.map(({ key, label }) => {
        const isActive = selected === key;
        const color = key !== 'all' ? AXIS_COLORS[key] : undefined;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            className={`axis-tab ${isActive ? 'active' : ''}`}
            style={isActive && color ? { borderBottomColor: color, color } : undefined}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
