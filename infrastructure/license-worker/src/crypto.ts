import type { LicensePayload, SignedLicense } from './types';

/**
 * Import Ed25519 private key from base64-encoded PKCS8 DER.
 */
async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const der = base64ToBuffer(base64Key);
  return crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
}

/**
 * Import Ed25519 public key from base64-encoded SPKI DER.
 */
async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const der = base64ToBuffer(base64Key);
  return crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
}

/**
 * Sign a license payload with Ed25519 private key.
 * Returns a SignedLicense with base64url-encoded signature.
 */
export async function signLicense(
  payload: LicensePayload,
  privateKeyBase64: string
): Promise<SignedLicense> {
  const key = await importPrivateKey(privateKeyBase64);
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('Ed25519', key, data);
  return {
    payload,
    signature: bufferToBase64Url(signature),
  };
}

/**
 * Verify a signed license with Ed25519 public key.
 */
export async function verifyLicense(
  signedLicense: SignedLicense,
  publicKeyBase64: string
): Promise<boolean> {
  const key = await importPublicKey(publicKeyBase64);
  const data = new TextEncoder().encode(JSON.stringify(signedLicense.payload));
  const signature = base64UrlToBuffer(signedLicense.signature);
  return crypto.subtle.verify('Ed25519', key, signature, data);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
