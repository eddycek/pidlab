/** License status stored locally and exposed to renderer */
export interface LicenseInfo {
  type: 'free' | 'paid' | 'tester';
  key?: string;
  expiresAt: string | null;
  activatedAt?: string;
  lastValidatedAt?: string;
}

/** Signed license object from the server */
export interface SignedLicense {
  payload: LicensePayload;
  signature: string;
}

/** Payload in the signed license */
export interface LicensePayload {
  keyId: string;
  type: 'paid' | 'tester';
  expiresAt: string | null;
  installationId: string;
  issuedAt: string;
}

/** Persisted license data in license.json */
export interface PersistedLicense {
  key: string;
  signedLicense: SignedLicense;
  status: 'active' | 'revoked';
  type: 'paid' | 'tester';
  expiresAt: string | null;
  activatedAt: string;
  lastValidatedAt: string | null;
}
