import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import {
  configureContent,
  _resetContentForTests,
  getBlogPosts,
  getWork,
  getEducation,
  getPublications,
  getPins,
} from "../index";

describe("real content/ tree", () => {
  beforeEach(() => {
    _resetContentForTests();
    configureContent({
      contentRoot: path.join(process.cwd(), "content"),
      includeDrafts: true,
    });
  });

  it("loads without throwing and returns non-empty collections", () => {
    expect(getBlogPosts().length).toBeGreaterThan(0);
    expect(getWork().length).toBeGreaterThan(0);
    expect(getEducation().length).toBeGreaterThan(0);
    expect(getPublications().length).toBeGreaterThan(0);
    expect(getPins().length).toBeGreaterThan(0);
  });
});
