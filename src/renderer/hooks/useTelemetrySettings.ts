import { useState, useEffect, useCallback } from 'react';
import type { TelemetrySettings } from '@shared/types/telemetry.types';

export function useTelemetrySettings() {
  const [settings, setSettings] = useState<TelemetrySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    window.betaflight
      .getTelemetrySettings()
      .then((s) => setSettings(s))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  const toggleEnabled = useCallback(async () => {
    if (!settings) return;
    try {
      const updated = await window.betaflight.setTelemetryEnabled(!settings.enabled);
      setSettings(updated);
    } catch {
      // Silently fail — toast could be added by caller
    }
  }, [settings]);

  const sendNow = useCallback(async () => {
    if (!settings?.enabled) return;
    try {
      setSending(true);
      await window.betaflight.sendTelemetryNow();
      // Refresh settings to get updated lastUploadAt
      const updated = await window.betaflight.getTelemetrySettings();
      setSettings(updated);
    } catch {
      // Upload may silently fail (no server yet)
    } finally {
      setSending(false);
    }
  }, [settings]);

  return { settings, loading, toggleEnabled, sendNow, sending };
}
