/**
 * AES-256-GCM encryption for secrets at rest.
 *
 * Set SECRETS_KEY env var to a 64-char hex string (32 bytes / 256 bits).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * If SECRETS_KEY is not set, encryption is bypassed with a warning (dev mode only).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits

function getKey(): Buffer | null {
  const hex = process.env.SECRETS_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    throw new Error("SECRETS_KEY must be exactly 64 hex characters (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns format: `enc:iv:ciphertext:tag` (all base64).
 * If SECRETS_KEY is not set, returns plaintext unchanged (dev mode).
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[crypto] SECRETS_KEY not set — secrets stored unencrypted in production!");
    }
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

/**
 * Decrypt a secret string.
 * If the value doesn't start with `enc:`, assumes it's unencrypted (migration path).
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith("enc:")) {
    return value; // Not encrypted — plaintext fallback for migration
  }

  const key = getKey();
  if (!key) {
    throw new Error("SECRETS_KEY required to decrypt secrets");
  }

  const parts = value.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}

/** Fields in carrier credentials that should be encrypted. */
const SENSITIVE_FIELDS = ["clientSecret", "password", "accessKey"];

/**
 * Encrypt sensitive fields in a carrier credentials object.
 */
export function encryptCarrierCreds(creds: Record<string, string>): Record<string, string> {
  const result = { ...creds };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] && !result[field].startsWith("enc:")) {
      result[field] = encryptSecret(result[field]);
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in a carrier credentials object.
 */
export function decryptCarrierCreds(creds: Record<string, string>): Record<string, string> {
  const result = { ...creds };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field]) {
      result[field] = decryptSecret(result[field]);
    }
  }
  return result;
}
