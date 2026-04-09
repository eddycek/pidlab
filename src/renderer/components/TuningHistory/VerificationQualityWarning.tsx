import React from 'react';
import type { DataQualityScore } from '@shared/types/analysis.types';

interface VerificationQualityWarningProps {
  dataQuality: DataQualityScore;
  onAccept: () => void;
  onReject: () => void;
}

export function VerificationQualityWarning({
  dataQuality,
  onAccept,
  onReject,
}: VerificationQualityWarningProps) {
  const tierLabel = dataQuality.tier === 'poor' ? 'Poor' : 'Fair';
  const tierColor = dataQuality.tier === 'poor' ? '#e74c3c' : '#f39c12';

  return (
    <div className="profile-wizard-overlay" role="dialog" aria-label="Verification quality warning">
      <div className="profile-wizard-modal" style={{ maxWidth: 480 }}>
        <h3>Low Verification Data Quality</h3>
        <p style={{ margin: '12px 0' }}>
          The verification flight data quality is{' '}
          <strong style={{ color: tierColor }}>
            {tierLabel} ({dataQuality.overall}/100)
          </strong>
          . This may not give reliable results.
        </p>

        {dataQuality.subScores && dataQuality.subScores.length > 0 && (
          <div style={{ margin: '12px 0', fontSize: 13, color: 'var(--text-secondary, #888)' }}>
            {dataQuality.subScores
              .filter((s) => s.score < 60)
              .map((s) => (
                <div key={s.name}>
                  {s.name}: {s.score}/100
                </div>
              ))}
          </div>
        )}

        <p style={{ margin: '12px 0', fontSize: 13 }}>
          For PID Tune, include at least 8-10 sharp stick snaps across roll and pitch axes. For
          Filter Tune, include a steady throttle sweep from low to high.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="wizard-btn wizard-btn-secondary" onClick={onReject}>
            Fly Again
          </button>
          <button className="wizard-btn wizard-btn-primary" onClick={onAccept}>
            Accept Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
