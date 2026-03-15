import type { ActivateRequest, ValidateRequest, ResetRequest, GenerateKeyRequest } from './types';
import { isValidKeyFormat } from './keygen';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 320;
}

export function validateActivateRequest(data: unknown): data is ActivateRequest {
  if (!data || typeof data !== 'object') return false;
  const req = data as Record<string, unknown>;
  return (
    typeof req.key === 'string' &&
    isValidKeyFormat(req.key) &&
    typeof req.installationId === 'string' &&
    isValidUUID(req.installationId)
  );
}

export function validateValidateRequest(data: unknown): data is ValidateRequest {
  if (!data || typeof data !== 'object') return false;
  const req = data as Record<string, unknown>;
  return (
    typeof req.key === 'string' &&
    isValidKeyFormat(req.key) &&
    typeof req.installationId === 'string' &&
    isValidUUID(req.installationId)
  );
}

export function validateResetRequest(data: unknown): data is ResetRequest {
  if (!data || typeof data !== 'object') return false;
  const req = data as Record<string, unknown>;
  return (
    typeof req.key === 'string' &&
    isValidKeyFormat(req.key) &&
    typeof req.email === 'string' &&
    isValidEmail(req.email)
  );
}

export function validateGenerateRequest(data: unknown): data is GenerateKeyRequest {
  if (!data || typeof data !== 'object') return false;
  const req = data as Record<string, unknown>;
  if (typeof req.email !== 'string' || !isValidEmail(req.email)) return false;
  if (req.type !== undefined && req.type !== 'paid' && req.type !== 'tester') return false;
  if (req.note !== undefined && typeof req.note !== 'string') return false;
  if (req.stripePaymentId !== undefined && typeof req.stripePaymentId !== 'string') return false;
  if (req.triviDocumentId !== undefined && typeof req.triviDocumentId !== 'string') return false;
  return true;
}
