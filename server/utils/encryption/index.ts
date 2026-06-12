import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Field-level encryption for sensitive database fields.
 *
 * Uses AES-256-GCM with a configurable encryption key. Fields like API keys,
 * tokens, and user preferences are encrypted at rest in the database.
 *
 * Phase 6 — Privacy & Security Hardening
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: Buffer | null = null;

/**
 * Initialize the encryption module with a key.
 * If no key is provided via VOYEURR_ENCRYPTION_KEY env var, a random key is generated.
 * NOTE: Random keys mean data won't survive restarts. Set VOYEURR_ENCRYPTION_KEY for persistence.
 */
export function initEncryption(key?: string): void {
  if (key) {
    encryptionKey = Buffer.from(key.padEnd(32, '0').slice(0, 32));
  } else if (process.env.VOYEURR_ENCRYPTION_KEY) {
    encryptionKey = Buffer.from(process.env.VOYEURR_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  } else {
    // Generate a random key — warning: data encrypted with this won't survive restarts
    encryptionKey = randomBytes(32);
  }
}

/**
 * Encrypt a plaintext value.
 * Returns base64-encoded ciphertext with IV and auth tag prepended.
 */
export function encrypt(plaintext: string): string {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption() first.');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext.
 */
export function decrypt(ciphertext: string): string {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption() first.');
  }

  const buffer = Buffer.from(ciphertext, 'base64');

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * TypeORM transformer for automatic encryption/decryption of DB columns.
 * Usage: @Column({ transformer: encryptedTransformer })
 */
export const encryptedTransformer = {
  from: (value: string | null): string | null => {
    if (!value) return null;
    try {
      return decrypt(value);
    } catch {
      // If decryption fails, return the raw value (possibly unencrypted legacy data)
      return value;
    }
  },
  to: (value: string | null): string | null => {
    if (!value) return null;
    return encrypt(value);
  },
};

/**
 * Check if a value appears to be encrypted (starts with base64 IV + tag).
 */
export function isEncrypted(value: string): boolean {
  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
