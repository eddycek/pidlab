import React, { useState } from 'react';
import './ReportIssueModal.css';

interface ReportIssueModalProps {
  onSubmit: (email?: string, note?: string, includeFlightData?: boolean) => void;
  onClose: () => void;
  submitting: boolean;
  /** Whether flight data (BBL log) is available for this record */
  hasFlightData?: boolean;
  /** When set, modal is in "merge" mode — adds details to existing auto-report */
  mergeMode?: boolean;
}

export function ReportIssueModal({
  onSubmit,
  onClose,
  submitting,
  hasFlightData,
  mergeMode,
}: ReportIssueModalProps) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [includeFlightData, setIncludeFlightData] = useState(true);

  const handleSubmit = () => {
    onSubmit(
      email.trim() || undefined,
      note.trim() || undefined,
      hasFlightData ? includeFlightData : undefined
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h2>{mergeMode ? 'Add Details to Auto-Report' : 'Report Tuning Issue'}</h2>
          <button type="button" className="report-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="report-modal-body">
          <p className="report-modal-description">
            {mergeMode
              ? 'A diagnostic report was sent automatically. Add your email or description to help us investigate.'
              : "We'll send diagnostic data from this session to help us improve FPVPIDlab."}
          </p>

          <label className="report-field-label" htmlFor="report-email">
            Email (optional)
          </label>
          <input
            id="report-email"
            type="email"
            className="report-field-input"
            placeholder="So we can follow up on your report"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />

          <label className="report-field-label" htmlFor="report-note">
            What went wrong? (optional)
          </label>
          <textarea
            id="report-note"
            className="report-field-textarea"
            placeholder="e.g. Recommends lowering LPF1 to 80 Hz but my quad vibrates..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={submitting}
          />

          {!mergeMode && hasFlightData && (
            <label className="report-flight-data-toggle">
              <input
                type="checkbox"
                checked={includeFlightData}
                onChange={(e) => setIncludeFlightData(e.target.checked)}
                disabled={submitting}
              />
              <span>Include flight data (BBL log)</span>
              <span className="report-flight-data-hint">
                Helps us reproduce the issue with your exact flight recording.
              </span>
            </label>
          )}

          {!mergeMode && (
            <div className="report-privacy-note">
              <strong>What we'll send:</strong>
              <ul>
                <li>Analysis results &amp; recommendations</li>
                <li>Flight controller settings</li>
                <li>Data quality metrics</li>
                {hasFlightData && includeFlightData && <li>Raw flight recording (BBL file)</li>}
              </ul>
              {hasFlightData && includeFlightData ? (
                <p>No personal data or file paths.</p>
              ) : (
                <p>No personal data, file paths, or raw flight recordings.</p>
              )}
            </div>
          )}
        </div>

        <div className="report-modal-footer">
          <button
            className="wizard-btn wizard-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="wizard-btn wizard-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Sending...' : mergeMode ? 'Add Details' : 'Send Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
