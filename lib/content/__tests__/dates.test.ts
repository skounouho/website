import { describe, it, expect } from "vitest";
import { yearMonth, isoDate, yearMonthOrNull } from "../dates";

describe("yearMonth", () => {
  it("accepts YYYY-MM strings", () => {
    expect(yearMonth.parse("2026-01")).toBe("2026-01");
  });

  it("rejects YYYY-MM-DD strings", () => {
    expect(() => yearMonth.parse("2026-01-15")).toThrow();
  });

  it("rejects bad months", () => {
    expect(() => yearMonth.parse("2026-13")).toThrow();
    expect(() => yearMonth.parse("2026-00")).toThrow();
  });

  it("rejects non-strings", () => {
    expect(() => yearMonth.parse(202601)).toThrow();
  });
});

describe("yearMonthOrNull", () => {
  it("accepts null", () => {
    expect(yearMonthOrNull.parse(null)).toBeNull();
  });
  it("accepts YYYY-MM", () => {
    expect(yearMonthOrNull.parse("2026-01")).toBe("2026-01");
  });
});

describe("isoDate", () => {
  it("accepts YYYY-MM-DD strings", () => {
    expect(isoDate.parse("2026-03-15")).toBe("2026-03-15");
  });

  it("coerces Date objects from YAML auto-parse", () => {
    const d = new Date(Date.UTC(2026, 2, 15));
    expect(isoDate.parse(d)).toBe("2026-03-15");
  });

  it("rejects YYYY-MM", () => {
    expect(() => isoDate.parse("2026-03")).toThrow();
  });

  it("rejects invalid calendar dates", () => {
    expect(() => isoDate.parse("2026-02-30")).toThrow();
  });
});
