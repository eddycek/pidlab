import React, { useState } from 'react';
import { useLicense } from '../../hooks/useLicense';
import './LicenseSettingsModal.css';

interface LicenseSettingsModalProps {
  onClose: () => void;
}

export function LicenseSettingsModal({ onClose }: LicenseSettingsModalProps) {
  const { status, loading, activating, error, activate, remove, isPro } = useLicense();
  const [keyInput, setKeyInput] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleActivate = async () => {
    if (!keyInput.trim()) return;
    try {
      await activate(keyInput.trim());
      setKeyInput('');
    } catch {
      // Error is set in hook
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    await remove();
    setConfirmRemove(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleActivate();
    }
  };

  const formatDate = (iso: string | undefined): string => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="license-modal" onClick={(e) => e.stopPropagation()}>
        <div className="license-modal-header">
          <h2>License</h2>
          <button className="license-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {loading ? (
          <div className="license-modal-body">
            <p>Loading...</p>
          </div>
        ) : (
          <div className="license-modal-body">
            <div className="license-status-row">
              <span className="license-status-label">Status</span>
              <span
                className={`license-badge ${isPro ? 'license-badge-pro' : 'license-badge-free'}`}
              >
                {isPro ? 'Pro' : 'Free'}
              </span>
            </div>

            {isPro && status && (
              <>
                {status.key && (
                  <div className="license-info-row">
                    <span className="license-info-label">Key</span>
                    <span className="license-info-value">
                      <code>{status.key}</code>
                    </span>
                  </div>
                )}
                <div className="license-info-row">
                  <span className="license-info-label">Activated</span>
                  <span className="license-info-value">{formatDate(status.activatedAt)}</span>
                </div>
                <div className="license-info-row">
                  <span className="license-info-label">Last validated</span>
                  <span className="license-info-value">{formatDate(status.lastValidatedAt)}</span>
                </div>

                <div className="license-actions">
                  <button
                    className="wizard-btn wizard-btn-secondary license-remove-btn"
                    onClick={handleRemove}
                  >
                    {confirmRemove ? 'Confirm Remove' : 'Remove License'}
                  </button>
                  {confirmRemove && (
                    <button
                      className="wizard-btn wizard-btn-secondary"
                      onClick={() => setConfirmRemove(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}

            {!isPro && (
              <>
                <p className="license-description">
                  Enter your license key to unlock Pro features (unlimited profiles).
                </p>

                <div className="license-key-input-row">
                  <input
                    type="text"
                    className="license-key-input"
                    placeholder="PIDLAB-XXXX-XXXX-XXXX"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    maxLength={21}
                    disabled={activating}
                  />
                  <button
                    className="wizard-btn wizard-btn-primary"
                    onClick={handleActivate}
                    disabled={!keyInput.trim() || activating}
                  >
                    {activating ? 'Activating...' : 'Activate'}
                  </button>
                </div>

                {error && <p className="license-error">{error}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
