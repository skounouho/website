import { describe, it, expect } from "vitest";
import {
  projectPoint,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "@/lib/projection";

describe("projectPoint", () => {
  it("places (0, 0) near the center of the canvas", () => {
    const [x, y] = projectPoint(0, 0);
    expect(x).toBeCloseTo(MAP_WIDTH / 2, 5);
    expect(y).toBeCloseTo(MAP_HEIGHT / 2, 5);
  });

  it("places NYC (~40.7, -74.0) in the upper-left quadrant", () => {
    const [x, y] = projectPoint(-74.006, 40.7128);
    expect(x).toBeLessThan(MAP_WIDTH / 2);
    expect(y).toBeLessThan(MAP_HEIGHT / 2);
  });

  it("places Durham (~36.0, -78.9) above the equator and left of center", () => {
    const [x, y] = projectPoint(-78.8986, 35.994);
    expect(x).toBeLessThan(MAP_WIDTH / 2);
    expect(y).toBeLessThan(MAP_HEIGHT / 2);
  });

  it("mirrors east/west around x=center", () => {
    const [xEast] = projectPoint(50, 0);
    const [xWest] = projectPoint(-50, 0);
    expect(xEast - MAP_WIDTH / 2).toBeCloseTo(MAP_WIDTH / 2 - xWest, 5);
  });
});
