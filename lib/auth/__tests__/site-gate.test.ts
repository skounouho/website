import { describe, it, expect } from "vitest";
import {
  signUnlockToken,
  verifyUnlockToken,
  signShareToken,
  verifyShareToken,
  shareableSlug,
  UNLOCK_COOKIE_NAME,
  SHARE_PARAM,
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

describe("signShareToken", () => {
  it("produces a stable, deterministic token for a slug and secret", () => {
    const a = signShareToken("why-we-sleep", "s3cret");
    const b = signShareToken("why-we-sleep", "s3cret");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different tokens for different slugs", () => {
    expect(signShareToken("why-we-sleep", "s3cret")).not.toBe(
      signShareToken("casablanca", "s3cret"),
    );
  });

  it("produces different tokens under different secrets", () => {
    expect(signShareToken("why-we-sleep", "s3cret")).not.toBe(
      signShareToken("why-we-sleep", "other"),
    );
  });

  it("is not interchangeable with an unlock token", () => {
    expect(signShareToken("why-we-sleep", "hunter2")).not.toBe(
      signUnlockToken("hunter2"),
    );
  });
});

describe("verifyShareToken", () => {
  it("accepts a token signed for the same slug and secret", () => {
    const token = signShareToken("why-we-sleep", "s3cret");
    expect(verifyShareToken(token, "why-we-sleep", "s3cret")).toBe(true);
  });

  it("rejects a token minted for a different post", () => {
    const token = signShareToken("casablanca", "s3cret");
    expect(verifyShareToken(token, "why-we-sleep", "s3cret")).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signShareToken("why-we-sleep", "old-secret");
    expect(verifyShareToken(token, "why-we-sleep", "s3cret")).toBe(false);
  });

  it("rejects missing tokens, slugs, and secrets", () => {
    const token = signShareToken("why-we-sleep", "s3cret");
    expect(verifyShareToken(undefined, "why-we-sleep", "s3cret")).toBe(false);
    expect(verifyShareToken("", "why-we-sleep", "s3cret")).toBe(false);
    expect(verifyShareToken(token, "", "s3cret")).toBe(false);
    expect(verifyShareToken(token, "why-we-sleep", "")).toBe(false);
  });

  it("rejects malformed tokens without crashing", () => {
    expect(verifyShareToken("not-a-real-token", "why-we-sleep", "s3cret")).toBe(
      false,
    );
    expect(verifyShareToken("a".repeat(63), "why-we-sleep", "s3cret")).toBe(
      false,
    );
    expect(verifyShareToken("z".repeat(64), "why-we-sleep", "s3cret")).toBe(
      false,
    );
  });
});

describe("shareableSlug", () => {
  it("extracts the slug from a post path", () => {
    expect(shareableSlug("/blog/why-we-sleep")).toBe("why-we-sleep");
    expect(shareableSlug("/blog/why-we-sleep/")).toBe("why-we-sleep");
  });

  it("decodes percent-encoded slugs", () => {
    expect(shareableSlug("/blog/why%20we%20sleep")).toBe("why we sleep");
  });

  it("returns null for the blog index", () => {
    expect(shareableSlug("/blog")).toBeNull();
    expect(shareableSlug("/blog/")).toBeNull();
  });

  it("returns null for paths nested under a post", () => {
    expect(shareableSlug("/blog/why-we-sleep/opengraph-image")).toBeNull();
    expect(shareableSlug("/blog/why-we-sleep/anything/deeper")).toBeNull();
  });

  it("returns null for paths outside the blog", () => {
    expect(shareableSlug("/map")).toBeNull();
    expect(shareableSlug("/")).toBeNull();
    expect(shareableSlug("/blogging/why-we-sleep")).toBeNull();
  });
});

describe("SHARE_PARAM", () => {
  it("is a stable, non-empty string", () => {
    expect(typeof SHARE_PARAM).toBe("string");
    expect(SHARE_PARAM.length).toBeGreaterThan(0);
  });
});
