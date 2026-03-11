import React from 'react';
import type { TuningType } from '@shared/types/tuning.types';
import { TUNING_TYPE, TUNING_TYPE_LABELS } from '@shared/constants';
import './StartTuningModal.css';

interface StartTuningModalProps {
  onStart: (tuningType: TuningType) => void;
  onCancel: () => void;
}

export function StartTuningModal({ onStart, onCancel }: StartTuningModalProps) {
  return (
    <div className="start-tuning-overlay" onClick={onCancel}>
      <div className="start-tuning-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choose Tuning Mode</h2>
        <p className="start-tuning-subtitle">Select how you want to tune your drone.</p>

        <div className="start-tuning-options">
          <button className="start-tuning-option" onClick={() => onStart(TUNING_TYPE.FILTER)}>
            <div className="start-tuning-option-header">
              <span className="start-tuning-option-title">
                {TUNING_TYPE_LABELS[TUNING_TYPE.FILTER]}
              </span>
              <span className="start-tuning-option-badge">1-2 flights</span>
              <span className="start-tuning-option-recommended">Start here</span>
            </div>
            <p className="start-tuning-option-desc">
              Hover + throttle sweeps. Optimize gyro and D-term filters for clean noise baseline.
            </p>
          </button>

          <button className="start-tuning-option" onClick={() => onStart(TUNING_TYPE.PID)}>
            <div className="start-tuning-option-header">
              <span className="start-tuning-option-title">
                {TUNING_TYPE_LABELS[TUNING_TYPE.PID]}
              </span>
              <span className="start-tuning-option-badge">1-2 flights</span>
            </div>
            <p className="start-tuning-option-desc">
              Stick snaps on all axes. Tune P, I, D gains. Best after clean filter baseline.
            </p>
          </button>

          <button
            className="start-tuning-option start-tuning-option-quick"
            onClick={() => onStart(TUNING_TYPE.FLASH)}
          >
            <div className="start-tuning-option-header">
              <span className="start-tuning-option-title">
                {TUNING_TYPE_LABELS[TUNING_TYPE.FLASH]}
              </span>
              <span className="start-tuning-option-badge start-tuning-badge-quick">1 flight</span>
            </div>
            <p className="start-tuning-option-desc">
              Rip a pack, land, tune. Analyzes filters and PIDs from any flight — freestyle, racing,
              cruising. Perfect for iterating on an existing tune.
            </p>
          </button>
        </div>

        <button className="start-tuning-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
