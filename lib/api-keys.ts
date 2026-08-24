import { randomBytes, createHash } from "crypto";

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Generates a new API key. The plaintext `key` is only ever returned here — callers must show it once and store only the hash. */
export function generateApiKey() {
  const key = `altk_${randomBytes(24).toString("base64url")}`;
  return { key, keyHash: hashApiKey(key), keyPrefix: key.slice(0, 12) };
}
