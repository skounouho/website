import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadPins } from "../load-map";

const fx = (p: string) => path.join(__dirname, "..", "__fixtures__", p);

describe("loadPins", () => {
  it("parses valid pins", () => {
    const pins = loadPins(fx("map-valid.yaml"));
    expect(pins).toHaveLength(2);
    expect(pins[0].id).toBe("nyc");
    expect(pins[0].links[0].url).toBe("https://akaramarkets.com");
  });

  it("throws on duplicate id", () => {
    expect(() => loadPins(fx("map-dup.yaml"))).toThrow(/duplicate.*id.*x/i);
  });

  it("returns [] if file does not exist", () => {
    expect(loadPins(fx("nope.yaml"))).toEqual([]);
  });
});
