import React, { useEffect, useMemo, useState } from 'react';
import type { TuningType } from '@shared/types/tuning.types';
import type { FCInfo } from '@shared/types/common.types';
import type { CompletedTuningRecord } from '@shared/types/tuning-history.types';
import { TUNING_TYPE, TUNING_TYPE_LABELS } from '@shared/constants';
import './StartTuningModal.css';

interface ProfileStats {
  sessionCount: number;
  lastTunedAt: string | null;
  lastTuningType: TuningType | null;
}

function computeProfileStats(
  history: CompletedTuningRecord[],
  profileCount: number
): Map<number, ProfileStats> {
  const map = new Map<number, ProfileStats>();
  for (let i = 0; i < profileCount; i++) {
    map.set(i, { sessionCount: 0, lastTunedAt: null, lastTuningType: null });
  }
  // history is newest-first
  for (const record of history) {
    if (record.bfPidProfileIndex == null) continue;
    const stats = map.get(record.bfPidProfileIndex);
    if (!stats) continue;
    stats.sessionCount++;
    if (!stats.lastTunedAt) {
      stats.lastTunedAt = record.completedAt;
      stats.lastTuningType = record.tuningType;
    }
  }
  return map;
}

function formatRelativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface StartTuningModalProps {
  onStart: (tuningType: TuningType, bfPidProfileIndex?: number) => void;
  onCancel: () => void;
  fcInfo?: FCInfo;
  defaultPidProfileIndex?: number;
  pidProfileLabels?: Record<number, string>;
  tuningHistory?: CompletedTuningRecord[];
}

export function StartTuningModal({
  onStart,
  onCancel,
  fcInfo: fcInfoProp,
  defaultPidProfileIndex,
  pidProfileLabels,
  tuningHistory,
}: StartTuningModalProps) {
  // FC info may be null after app restart or HMR — always fetch as fallback
  const [fetchedFcInfo, setFetchedFcInfo] = useState<FCInfo | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(!!fcInfoProp);
  useEffect(() => {
    if (!fcInfoProp) {
      window.betaflight
        .getConnectionStatus()
        .then((s) => {
          if (s.connected && s.fcInfo) setFetchedFcInfo(s.fcInfo);
        })
        .catch(() => {})
        .finally(() => setFetchAttempted(true));
    }
  }, [fcInfoProp]);
  const fcInfo = fcInfoProp ?? fetchedFcInfo ?? undefined;
  const loading = !fetchAttempted;
  const profileCount = fcInfo?.pidProfileCount ?? 0;
  const currentFcProfile = fcInfo?.pidProfileIndex ?? 0;
  const showProfileSelector = profileCount > 1;

  const [selectedProfile, setSelectedProfile] = useState<number>(
    defaultPidProfileIndex ?? currentFcProfile
  );

  // Update selection when FC info arrives async (after HMR state loss)
  useEffect(() => {
    if (fcInfo && defaultPidProfileIndex == null) {
      setSelectedProfile(fcInfo.pidProfileIndex ?? 0);
    }
  }, [fcInfo, defaultPidProfileIndex]);

  const profileStats = useMemo(
    () => computeProfileStats(tuningHistory ?? [], profileCount),
    [tuningHistory, profileCount]
  );

  const handleStart = (tuningType: TuningType) => {
    onStart(tuningType, showProfileSelector ? selectedProfile : undefined);
  };

  if (loading) {
    return (
      <div className="start-tuning-overlay">
        <div className="start-tuning-modal">
          <h2>Choose Tuning Mode</h2>
          <p className="start-tuning-subtitle">Loading flight controller info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="start-tuning-overlay" onClick={onCancel}>
      <div className="start-tuning-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choose Tuning Mode</h2>
        <p className="start-tuning-subtitle">
          Each mode uses a dedicated test flight + a verification flight to confirm results.
          {showProfileSelector && (
            <> Filters are global across all profiles; PIDs are per-profile.</>
          )}
        </p>

        {showProfileSelector && (
          <div className="start-tuning-profile-section">
            <label className="start-tuning-profile-label">BF PID Profile</label>
            <div className="start-tuning-profile-selector">
              {Array.from({ length: profileCount }, (_, i) => {
                const label = pidProfileLabels?.[i];
                const isCurrent = i === currentFcProfile;
                const stats = profileStats.get(i);
                return (
                  <button
                    key={i}
                    className={`start-tuning-profile-btn${selectedProfile === i ? ' active' : ''}`}
                    onClick={() => setSelectedProfile(i)}
                  >
                    <span className="start-tuning-profile-num">{i + 1}</span>
                    {label && <span className="start-tuning-profile-name">{label}</span>}
                    {isCurrent && <span className="start-tuning-profile-current">current</span>}
                    {stats && stats.sessionCount > 0 ? (
                      <span className="start-tuning-profile-stats">
                        {stats.sessionCount} tune{stats.sessionCount !== 1 ? 's' : ''}
                        {stats.lastTunedAt && ` · ${formatRelativeDate(stats.lastTunedAt)}`}
                      </span>
                    ) : (
                      !isCurrent && <span className="start-tuning-profile-stats empty">unused</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="start-tuning-options">
          <button className="start-tuning-option" onClick={() => handleStart(TUNING_TYPE.FILTER)}>
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

          <button className="start-tuning-option" onClick={() => handleStart(TUNING_TYPE.PID)}>
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

          <button className="start-tuning-option" onClick={() => handleStart(TUNING_TYPE.FLASH)}>
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
