import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadBlogPosts } from "../load-blog";

const fx = (name: string) =>
  path.join(__dirname, "..", "__fixtures__", name);

describe("loadBlogPosts", () => {
  it("loads .mdx files, derives slug, sorts newest first", () => {
    const posts = loadBlogPosts(fx("blog-valid"), { includeDrafts: true });
    expect(posts.map((p) => p.slug)).toEqual(["world", "hello"]);
    expect(posts[0].title).toBe("World");
    expect(posts[0].body.trim()).toBe("Body B.");
  });

  it("excludes drafts when includeDrafts is false", () => {
    const posts = loadBlogPosts(fx("blog-draft"), { includeDrafts: false });
    expect(posts).toEqual([]);
  });

  it("includes drafts when includeDrafts is true", () => {
    const posts = loadBlogPosts(fx("blog-draft"), { includeDrafts: true });
    expect(posts).toHaveLength(1);
    expect(posts[0].draft).toBe(true);
  });

  it("throws when filename date prefix disagrees with frontmatter date", () => {
    expect(() =>
      loadBlogPosts(fx("blog-bad-date"), { includeDrafts: true }),
    ).toThrow(/filename.*date|date.*filename/i);
  });

  it("throws on duplicate slug", () => {
    expect(() =>
      loadBlogPosts(fx("blog-dup-slug"), { includeDrafts: true }),
    ).toThrow(/duplicate.*slug|slug.*dup/i);
  });

  it("throws on duplicate slug across draft + non-draft", () => {
    expect(() =>
      loadBlogPosts(fx("blog-dup-slug-draft"), { includeDrafts: false }),
    ).toThrow(/duplicate.*slug|slug.*dup/i);
  });

  it("returns [] if directory does not exist", () => {
    expect(
      loadBlogPosts(fx("blog-does-not-exist"), { includeDrafts: true }),
    ).toEqual([]);
  });
});
