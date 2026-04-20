import { describe, it, expect } from "vitest";
import type { Publication, WorkEntry } from "../schemas";
import {
  partitionWorkByCategory,
  partitionPublicationsByKind,
  sortWorkByStartDesc,
  sortPublicationsByYearDesc,
} from "../resume-sections";

const work = (over: Partial<WorkEntry>): WorkEntry => ({
  id: "x",
  org: "Org",
  role: "Role",
  location: "L",
  start: "2020-01",
  end: null,
  highlights: ["h"],
  category: "paid",
  blog_slugs: [],
  map_pin_ids: [],
  ...over,
});

const pub = (over: Partial<Publication>): Publication => ({
  id: "p",
  title: "T",
  authors: ["A"],
  venue: "V",
  year: 2024,
  kind: "journal",
  status: "published",
  blog_slugs: [],
  ...over,
});

describe("partitionWorkByCategory", () => {
  it("splits entries into paid and teachingOther buckets", () => {
    const entries = [
      work({ id: "a", category: "paid" }),
      work({ id: "b", category: "teaching-other" }),
      work({ id: "c", category: "paid" }),
    ];
    const { paid, teachingOther } = partitionWorkByCategory(entries);
    expect(paid.map((e) => e.id)).toEqual(["a", "c"]);
    expect(teachingOther.map((e) => e.id)).toEqual(["b"]);
  });

  it("returns empty arrays when no entries", () => {
    expect(partitionWorkByCategory([])).toEqual({ paid: [], teachingOther: [] });
  });
});

describe("partitionPublicationsByKind", () => {
  it("splits journal/preprint into papers and presentation into conferences", () => {
    const entries = [
      pub({ id: "j", kind: "journal" }),
      pub({ id: "pr", kind: "preprint" }),
      pub({ id: "c", kind: "presentation" }),
    ];
    const { papers, conferences } = partitionPublicationsByKind(entries);
    expect(papers.map((e) => e.id)).toEqual(["j", "pr"]);
    expect(conferences.map((e) => e.id)).toEqual(["c"]);
  });
});

describe("sortWorkByStartDesc", () => {
  it("returns a new array sorted newest-first by start", () => {
    const entries = [
      work({ id: "old", start: "2020-01" }),
      work({ id: "new", start: "2026-01" }),
      work({ id: "mid", start: "2023-05" }),
    ];
    const result = sortWorkByStartDesc(entries);
    expect(result.map((e) => e.id)).toEqual(["new", "mid", "old"]);
    expect(result).not.toBe(entries);
  });
});

describe("sortPublicationsByYearDesc", () => {
  it("sorts by year desc using currentYear as fallback for missing year", () => {
    const entries = [
      pub({ id: "2024", year: 2024 }),
      pub({ id: "inreview", year: undefined, status: "in-review" }),
      pub({ id: "2025", year: 2025 }),
    ];
    const result = sortPublicationsByYearDesc(entries, 2026);
    expect(result.map((e) => e.id)).toEqual(["inreview", "2025", "2024"]);
  });

  it("is stable-ish for equal effective years (keeps relative input order)", () => {
    const entries = [
      pub({ id: "a", year: undefined, status: "in-review" }),
      pub({ id: "b", year: undefined, status: "in-review" }),
      pub({ id: "c", year: 2026 }),
    ];
    const result = sortPublicationsByYearDesc(entries, 2026);
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const entries = [pub({ id: "a", year: 2024 })];
    const result = sortPublicationsByYearDesc(entries, 2026);
    expect(result).not.toBe(entries);
  });
});
