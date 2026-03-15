import { useState, useEffect, useCallback } from 'react';
import type { LicenseInfo } from '@shared/types/license.types';

export function useLicense() {
  const [status, setStatus] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.betaflight
      .getLicenseStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus({ type: 'free', expiresAt: null }))
      .finally(() => setLoading(false));

    const cleanup = window.betaflight.onLicenseChanged((info) => {
      setStatus(info);
    });

    return cleanup;
  }, []);

  const activate = useCallback(async (key: string) => {
    setActivating(true);
    setError(null);
    try {
      const newStatus = await window.betaflight.activateLicense(key);
      setStatus(newStatus);
      return newStatus;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setActivating(false);
    }
  }, []);

  const remove = useCallback(async () => {
    setError(null);
    try {
      await window.betaflight.removeLicense();
      setStatus({ type: 'free', expiresAt: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, []);

  const isPro = status?.type === 'paid' || status?.type === 'tester';

  return { status, loading, activating, error, activate, remove, isPro };
}
