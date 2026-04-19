import { describe, it, expect } from "vitest";
import { isExternalHref } from "@/components/mdx/link-util";

describe("isExternalHref", () => {
  it("treats http/https URLs as external", () => {
    expect(isExternalHref("http://example.com")).toBe(true);
    expect(isExternalHref("https://example.com/path")).toBe(true);
  });

  it("treats protocol-relative URLs as external", () => {
    expect(isExternalHref("//cdn.example.com/x.js")).toBe(true);
  });

  it("treats mailto: and tel: as external", () => {
    expect(isExternalHref("mailto:a@b.c")).toBe(true);
    expect(isExternalHref("tel:+15551234")).toBe(true);
  });

  it("treats internal paths as non-external", () => {
    expect(isExternalHref("/blog")).toBe(false);
    expect(isExternalHref("/blog/post#section")).toBe(false);
    expect(isExternalHref("#heading")).toBe(false);
    expect(isExternalHref("./relative")).toBe(false);
    expect(isExternalHref("../up")).toBe(false);
  });
});
