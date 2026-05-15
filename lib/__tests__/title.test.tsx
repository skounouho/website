import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderTitle, stripTitle } from "@/lib/title";

describe("renderTitle", () => {
  it("renders plain text unchanged", () => {
    expect(renderToStaticMarkup(<>{renderTitle("When in Rome")}</>)).toBe(
      "When in Rome",
    );
  });

  it("wraps *...* spans in <em>", () => {
    expect(
      renderToStaticMarkup(<>{renderTitle("*Lost Highway* (1997)")}</>),
    ).toBe("<em>Lost Highway</em>  (1997)");
  });

  it("handles multiple spans", () => {
    expect(
      renderToStaticMarkup(<>{renderTitle("on *A* and *B*")}</>),
    ).toBe("on <em>A</em> and <em>B</em>");
  });

  it("inserts a space before trailing text after an italic span", () => {
    expect(
      renderToStaticMarkup(<>{renderTitle("*A*B")}</>),
    ).toBe("<em>A</em> B");
  });
});

describe("stripTitle", () => {
  it("removes asterisks but keeps the inner text", () => {
    expect(stripTitle("*Lost Highway* (1997)")).toBe("Lost Highway (1997)");
  });

  it("leaves un-marked titles untouched", () => {
    expect(stripTitle("When in Rome")).toBe("When in Rome");
  });
});
