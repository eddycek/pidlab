import React, { useState } from 'react';
import { useLicense } from '../../hooks/useLicense';
import { useToast } from '../../hooks/useToast';
import { ReportIssueModal } from './ReportIssueModal';

interface ReportIssueButtonProps {
  /** Tuning history record ID to report */
  recordId: string;
  /** Whether flight data (BBL log) is available */
  hasFlightData?: boolean;
  /** Auto-report ID — when set, modal uses merge mode (PATCH instead of POST) */
  autoReportId?: string;
  /** Button style variant */
  variant?: 'button' | 'link';
  /** Custom class name */
  className?: string;
}

export function ReportIssueButton({
  recordId,
  hasFlightData,
  autoReportId,
  variant = 'link',
  className,
}: ReportIssueButtonProps) {
  const { isPro } = useLicense();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Only visible for Pro/Tester users (and demo/dev mode)
  if (!isPro) return null;

  const mergeMode = !!autoReportId;

  const handleSubmit = async (email?: string, note?: string, includeFlightData?: boolean) => {
    setSubmitting(true);
    try {
      if (mergeMode) {
        await window.betaflight.patchDiagnosticReport({
          reportId: autoReportId!,
          userEmail: email,
          userNote: note,
        });
        setShowModal(false);
        toast.success('Details added to auto-report — thank you!');
      } else {
        await window.betaflight.sendDiagnosticReport({
          recordId,
          userEmail: email,
          userNote: note,
          includeFlightData,
        });
        setShowModal(false);
        toast.success('Diagnostic report sent — thank you!');
      }
    } catch (err) {
      toast.error(`Failed to send report: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const btnClass =
    variant === 'button'
      ? `wizard-btn wizard-btn-secondary ${className ?? ''}`
      : `completion-reanalyze-link ${className ?? ''}`;

  return (
    <>
      <button className={btnClass} onClick={() => setShowModal(true)}>
        {mergeMode ? 'Add Details to Report' : 'Report Issue'}
      </button>
      {showModal && (
        <ReportIssueModal
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
          submitting={submitting}
          hasFlightData={hasFlightData}
          mergeMode={mergeMode}
        />
      )}
    </>
  );
}
