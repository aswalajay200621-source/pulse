import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw = process.env.FLOW_CHECK_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("FLOW_CHECK_ENCRYPTION_KEY is not configured.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("FLOW_CHECK_ENCRYPTION_KEY must be 32 bytes (base64 encoded).");
  }
  return key;
}

export interface EncryptedSecret {
  encryptedPassword: string;
  iv: string;
  authTag: string;
}

export function encryptFlowPassword(
  plaintext: string,
  overrideKey?: Buffer
): EncryptedSecret {
  const key = overrideKey ?? getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPassword: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptFlowPassword(
  secret: EncryptedSecret,
  overrideKey?: Buffer
): string {
  const key = overrideKey ?? getEncryptionKey();
  const iv = Buffer.from(secret.iv, "base64");
  const authTag = Buffer.from(secret.authTag, "base64");
  const encrypted = Buffer.from(secret.encryptedPassword, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
