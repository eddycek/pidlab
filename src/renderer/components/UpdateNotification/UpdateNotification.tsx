import React, { useState } from 'react';
import { useAutoUpdate } from '../../hooks/useAutoUpdate';
import './UpdateNotification.css';

export function UpdateNotification() {
  const { updateVersion, releaseNotes, updateReady, installUpdate } = useAutoUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  if (!updateReady || dismissed) return null;

  return (
    <>
      <div className="update-notification">
        <span className="update-notification-text">v{updateVersion} available</span>
        {releaseNotes && (
          <button
            className="update-notification-changelog-btn"
            onClick={() => setShowChangelog(true)}
          >
            What's new
          </button>
        )}
        <button className="update-notification-btn" onClick={installUpdate}>
          Restart
        </button>
        <button
          className="update-notification-dismiss"
          onClick={() => setDismissed(true)}
          title="Dismiss (will install on next quit)"
        >
          &times;
        </button>
      </div>

      {showChangelog && releaseNotes && (
        <div className="modal-overlay" onClick={() => setShowChangelog(false)}>
          <div className="update-changelog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="update-changelog-header">
              <h2>What's new in v{updateVersion}</h2>
              <button className="update-changelog-close" onClick={() => setShowChangelog(false)}>
                &times;
              </button>
            </div>
            <div
              className="update-changelog-body"
              dangerouslySetInnerHTML={{ __html: releaseNotes }}
            />
            <div className="update-changelog-footer">
              <button
                className="wizard-btn wizard-btn-secondary"
                onClick={() => setShowChangelog(false)}
              >
                Close
              </button>
              <button className="wizard-btn wizard-btn-primary" onClick={installUpdate}>
                Restart to update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
