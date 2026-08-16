import { describe, it, expect, afterEach, vi } from "vitest";
import { buildShareUrl } from "@/lib/auth/share-link";
import { SHARE_PARAM, verifyShareToken } from "@/lib/auth/site-gate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildShareUrl", () => {
  it("returns the plain post URL when the gate is off", () => {
    vi.stubEnv("SITE_PASSWORD", "");
    vi.stubEnv("SITE_SHARE_SECRET", "s3cret");
    const url = buildShareUrl("why-we-sleep");
    expect(url).toBe("http://localhost:3000/blog/why-we-sleep");
  });

  it("returns null when the gate is on but no share secret is set", () => {
    vi.stubEnv("SITE_PASSWORD", "hunter2");
    vi.stubEnv("SITE_SHARE_SECRET", "");
    expect(buildShareUrl("why-we-sleep")).toBeNull();
  });

  it("carries a token the proxy will accept for that post", () => {
    vi.stubEnv("SITE_PASSWORD", "hunter2");
    vi.stubEnv("SITE_SHARE_SECRET", "s3cret");

    const url = new URL(buildShareUrl("why-we-sleep")!);
    expect(url.pathname).toBe("/blog/why-we-sleep");

    const token = url.searchParams.get(SHARE_PARAM);
    expect(verifyShareToken(token ?? undefined, "why-we-sleep", "s3cret")).toBe(
      true,
    );
  });

  it("mints a token that does not open a different post", () => {
    vi.stubEnv("SITE_PASSWORD", "hunter2");
    vi.stubEnv("SITE_SHARE_SECRET", "s3cret");

    const token = new URL(buildShareUrl("why-we-sleep")!).searchParams.get(
      SHARE_PARAM,
    );
    expect(verifyShareToken(token ?? undefined, "casablanca", "s3cret")).toBe(
      false,
    );
  });
});
