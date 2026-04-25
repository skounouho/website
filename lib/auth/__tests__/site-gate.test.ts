import { describe, it, expect } from "vitest";
import {
  signUnlockToken,
  verifyUnlockToken,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth/site-gate";

describe("signUnlockToken", () => {
  it("produces a stable, deterministic token for a given password", () => {
    const a = signUnlockToken("hunter2");
    const b = signUnlockToken("hunter2");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different tokens for different passwords", () => {
    expect(signUnlockToken("a")).not.toBe(signUnlockToken("b"));
  });
});

describe("verifyUnlockToken", () => {
  it("accepts a token signed with the same password", () => {
    const token = signUnlockToken("hunter2");
    expect(verifyUnlockToken(token, "hunter2")).toBe(true);
  });

  it("rejects a token signed with a different password", () => {
    const token = signUnlockToken("hunter2");
    expect(verifyUnlockToken(token, "letmein")).toBe(false);
  });

  it("rejects undefined or empty tokens", () => {
    expect(verifyUnlockToken(undefined, "hunter2")).toBe(false);
    expect(verifyUnlockToken("", "hunter2")).toBe(false);
  });

  it("rejects malformed tokens without crashing", () => {
    expect(verifyUnlockToken("not-a-real-token", "hunter2")).toBe(false);
    expect(verifyUnlockToken("a".repeat(63), "hunter2")).toBe(false);
    expect(verifyUnlockToken("z".repeat(64), "hunter2")).toBe(false);
  });

  it("rejects when the configured password is empty", () => {
    const token = signUnlockToken("hunter2");
    expect(verifyUnlockToken(token, "")).toBe(false);
  });
});

describe("UNLOCK_COOKIE_NAME", () => {
  it("is a stable, non-empty string", () => {
    expect(typeof UNLOCK_COOKIE_NAME).toBe("string");
    expect(UNLOCK_COOKIE_NAME.length).toBeGreaterThan(0);
  });
});
