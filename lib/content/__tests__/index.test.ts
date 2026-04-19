import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import {
  configureContent,
  getBlogPosts,
  getBlogPost,
  getWork,
  getEducation,
  getPublications,
  getPins,
  getPin,
  _resetContentForTests,
} from "../index";

const root = path.join(__dirname, "..", "__fixtures__", "tree-ok");

describe("public API", () => {
  beforeEach(() => {
    _resetContentForTests();
    configureContent({ contentRoot: root, includeDrafts: true });
  });

  it("returns the expected collections", () => {
    expect(getBlogPosts().map((p) => p.slug)).toEqual(["hello"]);
    expect(getBlogPost("hello")?.title).toBe("Hello");
    expect(getBlogPost("missing")).toBeNull();
    expect(getWork()[0].id).toBe("akara");
    expect(getEducation()[0].id).toBe("duke-bse");
    expect(getPublications()[0].id).toBe("cma-2024");
    expect(getPins().map((x) => x.id)).toEqual(["nyc", "durham"]);
    expect(getPin("nyc")?.name).toBe("New York City");
    expect(getPin("mars")).toBeNull();
  });

  it("memoizes across calls", () => {
    const a = getBlogPosts();
    const b = getBlogPosts();
    expect(a).toBe(b);
  });
});
