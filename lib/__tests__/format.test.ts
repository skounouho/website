import { describe, it, expect } from "vitest";
import {
  formatPostDate,
  formatYearMonth,
  formatYearMonthRange,
} from "@/lib/format";

describe("formatPostDate", () => {
  it("renders a YYYY-MM-DD string as 'Mon D, YYYY'", () => {
    expect(formatPostDate("2025-01-08")).toBe("Jan 8, 2025");
    expect(formatPostDate("2024-12-31")).toBe("Dec 31, 2024");
  });
});

describe("formatYearMonth", () => {
  it("renders a YYYY-MM string as 'Mon YYYY'", () => {
    expect(formatYearMonth("2023-03")).toBe("Mar 2023");
    expect(formatYearMonth("2025-10")).toBe("Oct 2025");
  });
});

describe("formatYearMonthRange", () => {
  it("renders a closed range", () => {
    expect(formatYearMonthRange("2022-06", "2024-08")).toBe("Jun 2022 – Aug 2024");
  });

  it("renders an open-ended range with 'Present' when end is null", () => {
    expect(formatYearMonthRange("2024-01", null)).toBe("Jan 2024 – Present");
  });

  it("collapses a same-month range to a single label", () => {
    expect(formatYearMonthRange("2022-05", "2022-05")).toBe("May 2022");
  });
});
