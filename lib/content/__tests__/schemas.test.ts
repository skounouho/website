import { describe, it, expect } from "vitest";
import {
  blogFrontmatterSchema,
  workEntrySchema,
  educationEntrySchema,
  publicationSchema,
  mapPinSchema,
} from "../schemas";

describe("blogFrontmatterSchema", () => {
  const base = {
    title: "Hello",
    date: "2026-03-15",
    description: "Short summary.",
  };

  it("accepts minimal valid input and fills defaults", () => {
    const r = blogFrontmatterSchema.parse(base);
    expect(r.tags).toEqual([]);
    expect(r.draft).toBe(false);
    expect(r.places).toEqual([]);
    expect(r.updated).toBeUndefined();
  });

  it("rejects missing title", () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...base, title: undefined }),
    ).toThrow();
  });

  it("rejects updated < date", () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...base, updated: "2026-03-14" }),
    ).toThrow(/updated/);
  });

  it("accepts updated === date", () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...base, updated: "2026-03-15" }),
    ).not.toThrow();
  });

  it("rejects non-kebab-case tags", () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...base, tags: ["Data Science"] }),
    ).toThrow();
  });
});

describe("workEntrySchema", () => {
  const base = {
    id: "akara",
    org: "Akara",
    role: "Head of Product",
    location: "NYC",
    start: "2026-01",
    end: null,
    highlights: ["Did a thing."],
  };

  it("accepts null end", () => {
    expect(workEntrySchema.parse(base).end).toBeNull();
  });

  it("requires at least one highlight", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, highlights: [] }),
    ).toThrow();
  });

  it("rejects end < start when both present", () => {
    expect(() => workEntrySchema.parse({ ...base, end: "2025-12" })).toThrow(
      /end/,
    );
  });

  it("accepts end === start", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, end: "2026-01" }),
    ).not.toThrow();
  });

  it("rejects bad id (must be kebab-case)", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, id: "Akara Markets" }),
    ).toThrow();
  });
});

describe("educationEntrySchema", () => {
  it("accepts minimal valid", () => {
    expect(() =>
      educationEntrySchema.parse({
        id: "duke-bse",
        institution: "Duke",
        degree: "BSE",
        start: "2022-08",
        end: "2026-05",
      }),
    ).not.toThrow();
  });
});

describe("publicationSchema", () => {
  const base = {
    id: "cma-2024",
    title: "A Paper",
    authors: ["A"],
    venue: "CMA",
    year: 2024,
    kind: "journal",
    status: "published",
  };
  it("accepts valid journal publication", () => {
    expect(() => publicationSchema.parse(base)).not.toThrow();
  });
  it("rejects unknown kind", () => {
    expect(() => publicationSchema.parse({ ...base, kind: "book" })).toThrow();
  });
  it("rejects empty authors", () => {
    expect(() =>
      publicationSchema.parse({ ...base, authors: [] }),
    ).toThrow();
  });
});

describe("mapPinSchema", () => {
  const base = {
    id: "nyc",
    name: "New York City",
    kind: "worked",
    lat: 40.7128,
    lon: -74.006,
  };

  it("accepts minimal pin with no dates", () => {
    const r = mapPinSchema.parse(base);
    expect(r.blog_slugs).toEqual([]);
    expect(r.links).toEqual([]);
  });

  it("rejects out-of-range lat/lon", () => {
    expect(() => mapPinSchema.parse({ ...base, lat: 91 })).toThrow();
    expect(() => mapPinSchema.parse({ ...base, lon: -181 })).toThrow();
  });

  it("rejects unknown kind", () => {
    expect(() =>
      mapPinSchema.parse({ ...base, kind: "birthplace" }),
    ).toThrow();
  });
});
