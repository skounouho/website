import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  loadWork,
  loadEducation,
  loadPublications,
} from "../load-resume";

const fx = (p: string) => path.join(__dirname, "..", "__fixtures__", p);

describe("loadWork", () => {
  it("parses work.yaml and validates each entry", () => {
    const work = loadWork(fx("resume-valid/work.yaml"));
    expect(work).toHaveLength(1);
    expect(work[0].id).toBe("akara");
    expect(work[0].end).toBeNull();
    expect(work[0].map_pin_ids).toEqual(["nyc"]);
  });

  it("throws on duplicate id within a file", () => {
    expect(() => loadWork(fx("resume-dup-id/work.yaml"))).toThrow(
      /duplicate.*id.*dup/i,
    );
  });

  it("returns [] if file does not exist", () => {
    expect(loadWork(fx("does-not-exist.yaml"))).toEqual([]);
  });
});

describe("loadEducation", () => {
  it("parses education.yaml", () => {
    const r = loadEducation(fx("resume-valid/education.yaml"));
    expect(r[0].id).toBe("duke-bse");
    expect(r[0].gpa).toBe("3.93/4.00");
  });
});

describe("loadPublications", () => {
  it("parses publications.yaml", () => {
    const r = loadPublications(fx("resume-valid/publications.yaml"));
    expect(r[0].kind).toBe("journal");
    expect(r[0].doi).toBe("10.1016/example");
  });
});
