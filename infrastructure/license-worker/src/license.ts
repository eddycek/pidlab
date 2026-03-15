import type { Env, LicenseRow, ActivateRequest, ValidateRequest, ResetRequest } from './types';
import { signLicense } from './crypto';
import { validateActivateRequest, validateValidateRequest, validateResetRequest } from './validation';

const MAX_SELF_RESETS_PER_YEAR = 3;

/**
 * POST /license/activate — activate a key on a machine.
 *
 * Decision table:
 * | Key exists? | Revoked? | Bound? | Same machine? | Result |
 * |-------------|----------|--------|---------------|--------|
 * | No          | —        | —      | —             | 404    |
 * | Yes         | Yes      | —      | —             | 403 revoked |
 * | Yes         | No       | No     | —             | Bind + 200 + signed license |
 * | Yes         | No       | Yes    | Yes           | 200 + signed license |
 * | Yes         | No       | Yes    | No            | 403 already activated |
 */
export async function handleActivate(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!validateActivateRequest(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, installationId } = body as ActivateRequest;

  const row = await env.LICENSE_DB.prepare('SELECT * FROM licenses WHERE license_key = ?')
    .bind(key)
    .first<LicenseRow>();

  if (!row) {
    return Response.json({ error: 'Invalid license key' }, { status: 404 });
  }

  if (row.status === 'revoked') {
    return Response.json({ error: 'License revoked' }, { status: 403 });
  }

  // Already bound to a different machine
  if (row.installation_id && row.installation_id !== installationId) {
    return Response.json(
      { error: 'Already activated on another machine' },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();

  // Bind installation if not yet bound
  if (!row.installation_id) {
    await env.LICENSE_DB.prepare(
      `UPDATE licenses SET installation_id = ?, activated_at = ?, last_validated_at = ? WHERE id = ?`
    )
      .bind(installationId, now, now, row.id)
      .run();
  } else {
    // Same machine — just update last_validated_at
    await env.LICENSE_DB.prepare(
      `UPDATE licenses SET last_validated_at = ? WHERE id = ?`
    )
      .bind(now, row.id)
      .run();
  }

  // Sign and return license object
  const signedLicense = await signLicense(
    {
      keyId: row.id,
      type: row.type as 'paid' | 'tester',
      expiresAt: null, // Permanent for now
      installationId,
      issuedAt: now,
    },
    env.ED25519_PRIVATE_KEY
  );

  return Response.json({
    status: row.installation_id ? 'valid' : 'activated',
    license: signedLicense,
  });
}

/**
 * POST /license/validate — periodic validation (revocation sync).
 */
export async function handleValidate(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!validateValidateRequest(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, installationId } = body as ValidateRequest;

  const row = await env.LICENSE_DB.prepare('SELECT * FROM licenses WHERE license_key = ?')
    .bind(key)
    .first<LicenseRow>();

  if (!row) {
    return Response.json({ error: 'Invalid license key' }, { status: 404 });
  }

  if (row.status === 'revoked') {
    return Response.json({ status: 'revoked' });
  }

  // Installation mismatch — key was reset and reactivated on another machine
  if (row.installation_id && row.installation_id !== installationId) {
    return Response.json({ status: 'revoked' });
  }

  // Update last_validated_at
  await env.LICENSE_DB.prepare(
    `UPDATE licenses SET last_validated_at = ? WHERE id = ?`
  )
    .bind(new Date().toISOString(), row.id)
    .run();

  return Response.json({ status: 'valid', type: row.type });
}

/**
 * POST /license/reset — self-service machine reset.
 * Requires key + email match. Max 3 resets per year.
 */
export async function handleSelfReset(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!validateResetRequest(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, email } = body as ResetRequest;

  const row = await env.LICENSE_DB.prepare(
    'SELECT * FROM licenses WHERE license_key = ? AND email = ?'
  )
    .bind(key, email)
    .first<LicenseRow>();

  if (!row) {
    return Response.json({ error: 'Invalid key or email' }, { status: 404 });
  }

  if (row.status === 'revoked') {
    return Response.json({ error: 'License revoked' }, { status: 403 });
  }

  if (!row.installation_id) {
    return Response.json({ error: 'Key is not activated' }, { status: 400 });
  }

  if (row.reset_count >= (row.max_resets || MAX_SELF_RESETS_PER_YEAR)) {
    return Response.json(
      { error: 'Maximum resets reached. Contact support for assistance.' },
      { status: 429 }
    );
  }

  await env.LICENSE_DB.prepare(
    `UPDATE licenses SET installation_id = NULL, activated_at = NULL, reset_count = reset_count + 1
     WHERE id = ?`
  )
    .bind(row.id)
    .run();

  return Response.json({
    message: 'Installation reset. You can activate on a new machine.',
    resetsRemaining: (row.max_resets || MAX_SELF_RESETS_PER_YEAR) - row.reset_count - 1,
  });
}
