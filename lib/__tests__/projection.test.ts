import { describe, it, expect } from "vitest";
import {
  projectPoint,
  projectUsPoint,
  isUsPin,
  MAP_WIDTH,
  MAP_HEIGHT,
  US_MAP_WIDTH,
  US_MAP_HEIGHT,
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

describe("projectUsPoint", () => {
  it("projects continental US points inside the US canvas", () => {
    const xy = projectUsPoint(-74.006, 40.7128); // NYC
    expect(xy).not.toBeNull();
    const [x, y] = xy!;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(US_MAP_WIDTH);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(US_MAP_HEIGHT);
  });

  it("projects Alaska and Hawaii inside the US canvas via composite projection", () => {
    const anchorage = projectUsPoint(-149.9003, 61.2181);
    const honolulu = projectUsPoint(-157.8583, 21.3069);
    expect(anchorage).not.toBeNull();
    expect(honolulu).not.toBeNull();
  });

  it("returns null for points far outside any US region", () => {
    // geoAlbersUsa clips by inset bounding boxes, not national borders,
    // so nearby-foreign points (Vancouver, Tijuana) still project.
    // Use isUsPin for true US classification.
    expect(projectUsPoint(2.3522, 48.8566)).toBeNull(); // Paris
    expect(projectUsPoint(151.2093, -33.8688)).toBeNull(); // Sydney
  });
});

describe("isUsPin", () => {
  it("returns true for US locations", () => {
    expect(isUsPin({ lat: 40.7128, lon: -74.006 })).toBe(true); // NYC
    expect(isUsPin({ lat: 35.994, lon: -78.8986 })).toBe(true); // Durham
    expect(isUsPin({ lat: 61.2181, lon: -149.9003 })).toBe(true); // Anchorage
    expect(isUsPin({ lat: 21.3069, lon: -157.8583 })).toBe(true); // Honolulu
  });

  it("returns false for international locations", () => {
    expect(isUsPin({ lat: 49.2827, lon: -123.1207 })).toBe(false); // Vancouver
    expect(isUsPin({ lat: 48.8566, lon: 2.3522 })).toBe(false); // Paris
    expect(isUsPin({ lat: -33.8688, lon: 151.2093 })).toBe(false); // Sydney
  });

  it("returns false for US territories (documented limitation at 110m resolution)", () => {
    // Territories aren't included in world-atlas 110m's US feature. A pin
    // placed in any of these would currently render only on the world map.
    expect(isUsPin({ lat: 18.4655, lon: -66.1057 })).toBe(false); // San Juan, PR
    expect(isUsPin({ lat: 13.4443, lon: 144.7937 })).toBe(false); // Hagåtña, Guam
    expect(isUsPin({ lat: 18.3358, lon: -64.8963 })).toBe(false); // St. Thomas, USVI
  });
});
