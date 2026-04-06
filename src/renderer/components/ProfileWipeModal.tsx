import { useState } from 'react';
import type { DroneProfile } from '@shared/types/profile.types';
import './ProfileWipeModal.css';

interface ProfileWipeModalProps {
  profile: DroneProfile;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ProfileWipeModal({ profile, onConfirm, onCancel }: ProfileWipeModalProps) {
  const [isWiping, setIsWiping] = useState(false);

  const handleConfirm = async () => {
    setIsWiping(true);
    try {
      await onConfirm();
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="profile-wizard-overlay">
      <div className="profile-wizard-modal" style={{ maxWidth: '500px' }}>
        <div className="profile-wizard-header">
          <h2>Wipe Profile Data</h2>
          <p>
            This will permanently delete all data for <strong>{profile.name}</strong> but keep the
            profile configuration.
          </p>
        </div>

        <div className="wipe-warning-box">
          <div className="wipe-warning-content">
            <svg className="wipe-warning-icon" fill="#d97706" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <div className="wipe-warning-title">
                The following data will be permanently deleted:
              </div>
              <ul className="wipe-warning-list">
                <li>All snapshots and backups</li>
                <li>All downloaded flight logs</li>
                <li>Active tuning session</li>
                <li>Tuning history</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="wipe-info-box">
          <div className="wipe-info-content">
            <svg className="wipe-info-icon" fill="#3b82f6" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <div className="wipe-info-title">The following will be kept:</div>
              <ul className="wipe-info-list">
                <li>Profile configuration (name, drone size, battery, etc.)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="wizard-actions">
          <button
            onClick={onCancel}
            disabled={isWiping}
            className="wizard-btn wizard-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isWiping}
            className="wizard-btn wipe-confirm-btn"
          >
            {isWiping ? 'Wiping...' : 'Wipe Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
