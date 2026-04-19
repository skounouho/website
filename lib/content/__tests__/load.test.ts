import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadAll } from "../load";

const fx = (p: string) => path.join(__dirname, "..", "__fixtures__", p);

describe("loadAll", () => {
  it("loads a valid content tree", () => {
    const all = loadAll({ contentRoot: fx("tree-ok"), includeDrafts: true });
    expect(all.posts.map((p) => p.slug)).toEqual(["hello"]);
    expect(all.work[0].id).toBe("akara");
    expect(all.education[0].id).toBe("duke-bse");
    expect(all.publications[0].id).toBe("cma-2024");
    expect(all.pins.map((p) => p.id)).toEqual(["nyc", "durham"]);
  });

  it("rejects blog post referencing unknown pin id", () => {
    expect(() =>
      loadAll({ contentRoot: fx("tree-bad-place"), includeDrafts: true }),
    ).toThrow(/unknown.*pin.*mars/i);
  });

  it("rejects work entry referencing unknown blog slug", () => {
    expect(() =>
      loadAll({ contentRoot: fx("tree-bad-blog-ref"), includeDrafts: true }),
    ).toThrow(/unknown.*blog.*missing/i);
  });

  it("validates draft cross-refs even when drafts are excluded from output", () => {
    expect(() =>
      loadAll({
        contentRoot: fx("tree-bad-draft-place"),
        includeDrafts: false,
      }),
    ).toThrow(/unknown.*pin.*mars/i);
  });
});
