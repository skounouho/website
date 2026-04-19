import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseMdx } from "../parse-mdx";

const fixture = (name: string) =>
  path.join(__dirname, "..", "__fixtures__", "mdx", name);

describe("parseMdx", () => {
  it("splits frontmatter and body", () => {
    const r = parseMdx(fixture("basic.mdx"));
    expect(r.data).toMatchObject({
      title: "Hello",
      description: "A short summary.",
      tags: ["jazz", "research"],
    });
    expect(r.body.trim().startsWith("Body starts here.")).toBe(true);
  });

  it("coerces date to YYYY-MM-DD string even when YAML parses it as Date", () => {
    const r = parseMdx(fixture("basic.mdx"));
    expect(r.data.date).toBe("2026-01-15");
  });

  it("throws ContentParseError when frontmatter missing", () => {
    expect(() => parseMdx(fixture("no-frontmatter.mdx"))).toThrow(/frontmatter/);
  });
});
