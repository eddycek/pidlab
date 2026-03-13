import React, { useState } from 'react';
import { useTelemetrySettings } from '../../hooks/useTelemetrySettings';
import './TelemetrySettingsModal.css';

interface TelemetrySettingsModalProps {
  onClose: () => void;
}

export function TelemetrySettingsModal({ onClose }: TelemetrySettingsModalProps) {
  const { settings, loading, toggleEnabled, sendNow, sending } = useTelemetrySettings();
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.installationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied
    }
  };

  const formatLastUpload = (iso: string | null): string => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="telemetry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="telemetry-modal-header">
          <h2>Telemetry Settings</h2>
          <button className="telemetry-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {loading ? (
          <div className="telemetry-modal-body">
            <p>Loading...</p>
          </div>
        ) : !settings ? (
          <div className="telemetry-modal-body">
            <p>Failed to load telemetry settings.</p>
          </div>
        ) : (
          <div className="telemetry-modal-body">
            <div className="telemetry-toggle-row">
              <label className="telemetry-toggle-label" htmlFor="telemetry-toggle">
                Send anonymous usage data
              </label>
              <button
                id="telemetry-toggle"
                role="switch"
                aria-checked={settings.enabled}
                className={`telemetry-toggle ${settings.enabled ? 'telemetry-toggle-on' : ''}`}
                onClick={toggleEnabled}
              >
                <span className="telemetry-toggle-thumb" />
              </button>
            </div>

            <p className="telemetry-description">
              Help improve PIDlab by sharing anonymous usage data. We collect tuning mode usage,
              drone sizes, flight quality scores, and Betaflight versions. No flight data, PID
              values, or personal information is ever sent.
            </p>

            <div className="telemetry-info-row">
              <span className="telemetry-info-label">Installation ID</span>
              <span className="telemetry-info-value">
                <code>{settings.installationId.substring(0, 8)}...</code>
                <button className="telemetry-copy-btn" onClick={handleCopyId}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </span>
            </div>

            <div className="telemetry-info-row">
              <span className="telemetry-info-label">Last upload</span>
              <span className="telemetry-info-value">
                {formatLastUpload(settings.lastUploadAt)}
              </span>
            </div>

            <div className="telemetry-actions">
              <button
                className="wizard-btn wizard-btn-secondary"
                onClick={sendNow}
                disabled={!settings.enabled || sending}
              >
                {sending ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
