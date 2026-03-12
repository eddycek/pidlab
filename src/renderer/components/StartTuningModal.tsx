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
        <p className="start-tuning-subtitle">
          Each mode uses a dedicated test flight + a verification flight to confirm results.
        </p>

        <div className="start-tuning-options">
          <button className="start-tuning-option" onClick={() => onStart(TUNING_TYPE.FILTER)}>
            <div className="start-tuning-option-header">
              <span className="start-tuning-option-title">
                {TUNING_TYPE_LABELS[TUNING_TYPE.FILTER]}
              </span>
              <span className="start-tuning-option-badge">2 flights</span>
              <span className="start-tuning-option-recommended">Start here</span>
            </div>
            <p className="start-tuning-option-desc">
              Dedicated hover + throttle sweeps (~30 sec). FFT noise analysis optimizes gyro and
              D-term filter cutoffs. Best accuracy for filter tuning.
            </p>
          </button>

          <button className="start-tuning-option" onClick={() => onStart(TUNING_TYPE.PID)}>
            <div className="start-tuning-option-header">
              <span className="start-tuning-option-title">
                {TUNING_TYPE_LABELS[TUNING_TYPE.PID]}
              </span>
              <span className="start-tuning-option-badge">2 flights</span>
            </div>
            <p className="start-tuning-option-desc">
              Dedicated stick snaps on all axes (~30 sec). Step response analysis tunes P, I, D
              gains. Run after Filter Tune for best results.
            </p>
          </button>

          <button className="start-tuning-option" onClick={() => onStart(TUNING_TYPE.FLASH)}>
            <div className="start-tuning-option-header">
              <span className="start-tuning-option-title">
                {TUNING_TYPE_LABELS[TUNING_TYPE.FLASH]}
              </span>
              <span className="start-tuning-option-badge">2 flights</span>
            </div>
            <p className="start-tuning-option-desc">
              Fly any style — freestyle, racing, cruising. Estimates filters and PIDs from normal
              flight data via Wiener deconvolution. Faster and easier, but less precise than
              dedicated test flights.
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
