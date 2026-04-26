import { createHash, timingSafeEqual } from "node:crypto";

export const UNLOCK_COOKIE_NAME = "site_unlock";

const TOKEN_PREFIX = "v1:";

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function signUnlockToken(password: string): string {
  return hash(TOKEN_PREFIX + password);
}

export function verifyUnlockToken(
  token: string | undefined,
  password: string,
): boolean {
  if (!token || !password) return false;
  const expected = signUnlockToken(password);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
