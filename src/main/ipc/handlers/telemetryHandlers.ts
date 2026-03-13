import { ipcMain } from 'electron';
import { IPCChannel, IPCResponse } from '@shared/types/ipc.types';
import type { TelemetrySettings } from '@shared/types/telemetry.types';
import { HandlerDependencies, createResponse } from './types';
import { logger } from '../../utils/logger';

export function registerTelemetryHandlers(deps: HandlerDependencies): void {
  ipcMain.handle(
    IPCChannel.TELEMETRY_GET_SETTINGS,
    async (): Promise<IPCResponse<TelemetrySettings>> => {
      try {
        if (!deps.telemetryManager) throw new Error('TelemetryManager not initialized');
        const settings = deps.telemetryManager.getSettings();
        return createResponse(settings);
      } catch (err) {
        logger.error('Failed to get telemetry settings:', err);
        return createResponse<TelemetrySettings>(undefined, String(err));
      }
    }
  );

  ipcMain.handle(
    IPCChannel.TELEMETRY_SET_ENABLED,
    async (_event, enabled: boolean): Promise<IPCResponse<TelemetrySettings>> => {
      try {
        if (!deps.telemetryManager) throw new Error('TelemetryManager not initialized');
        const settings = await deps.telemetryManager.setEnabled(enabled);
        return createResponse(settings);
      } catch (err) {
        logger.error('Failed to set telemetry enabled:', err);
        return createResponse<TelemetrySettings>(undefined, String(err));
      }
    }
  );

  ipcMain.handle(IPCChannel.TELEMETRY_SEND_NOW, async (): Promise<IPCResponse<void>> => {
    try {
      if (!deps.telemetryManager) throw new Error('TelemetryManager not initialized');
      await deps.telemetryManager.sendNow();
      return createResponse(undefined);
    } catch (err) {
      logger.error('Failed to send telemetry:', err);
      return createResponse<void>(undefined, String(err));
    }
  });
}
