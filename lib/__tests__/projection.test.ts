import { describe, it, expect } from "vitest";
import {
  projectPoint,
  projectUsPoint,
  isUsPin,
  MAP_WIDTH,
  MAP_HEIGHT,
  US_MAP_WIDTH,
  US_MAP_HEIGHT,
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  flyToTarget,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
} from "@/lib/projection";
import type { ExtendedFeatureCollection } from "d3-geo";

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

describe("createGlobeProjection", () => {
  it("places the rotation center at the middle of the canvas at scale 1", () => {
    // rotation [30, 0] puts lon=-30 at the view center.
    const proj = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 1,
      rotation: [30, 0],
    });
    const xy = proj([-30, 0]);
    expect(xy).not.toBeNull();
    expect(xy![0]).toBeCloseTo(GLOBE_WIDTH / 2, 5);
    expect(xy![1]).toBeCloseTo(GLOBE_HEIGHT / 2, 5);
  });

  it("scales the sphere radius multiplicatively", () => {
    const scale1 = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 1,
      rotation: [0, 0],
    });
    const scale2 = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 2,
      rotation: [0, 0],
    });
    // A point at (45 lon, 0) should project twice as far from center at scale 2.
    const [x1] = scale1([45, 0])!;
    const [x2] = scale2([45, 0])!;
    const d1 = x1 - GLOBE_WIDTH / 2;
    const d2 = x2 - GLOBE_WIDTH / 2;
    expect(d2 / d1).toBeCloseTo(2, 3);
  });

  it("clips the far hemisphere (geoPath returns null for antipodal features)", () => {
    const proj = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 1,
      rotation: [0, 0],
    });
    // A tiny feature at the antipode should clip entirely.
    const fc: ExtendedFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            // GeoJSON exterior rings use counter-clockwise winding; otherwise
            // d3-geo treats the polygon as the complement (covering nearly
            // the whole sphere).
            coordinates: [
              [
                [179, -1],
                [179, 1],
                [180, 1],
                [180, -1],
                [179, -1],
              ],
            ],
          },
        },
      ],
    };
    const paths = pathsFromGeojson(fc, proj);
    expect(paths).toEqual([]);
  });
});

describe("isPinVisible", () => {
  it("returns true for a pin at the view center", () => {
    // rotation [30, 0] → center at (-30, 0). A pin at (-30, 0) is visible.
    expect(isPinVisible({ lon: -30, lat: 0 }, [30, 0])).toBe(true);
  });

  it("returns false for a pin at the antipode of the view center", () => {
    // rotation [0, 0] → center at (0, 0). Antipode is (180, 0).
    expect(isPinVisible({ lon: 180, lat: 0 }, [0, 0])).toBe(false);
  });

  it("returns false at exactly 90° from center (limb is a visual edge)", () => {
    // rotation [0, 0] → center at (0, 0). Point (90, 0) is exactly π/2 away.
    expect(isPinVisible({ lon: 90, lat: 0 }, [0, 0])).toBe(false);
  });

  it("returns true for NYC when center is on North America", () => {
    // rotation [74, -40.7] → center at (-74, 40.7), which is NYC.
    expect(isPinVisible({ lon: -74.006, lat: 40.7128 }, [74, -40.7])).toBe(true);
  });
});

describe("flyToTarget", () => {
  it("returns rotation that brings the pin to the view center and scale 2.2", () => {
    const t = flyToTarget({ lon: -74.006, lat: 40.7128 });
    expect(t.rotation[0]).toBeCloseTo(74.006, 5);
    expect(t.rotation[1]).toBeCloseTo(-40.7128, 5);
    expect(t.scale).toBe(2.2);
  });
});

describe("shouldShowStateBorders", () => {
  it("is false below the threshold", () => {
    expect(shouldShowStateBorders(1)).toBe(false);
    expect(shouldShowStateBorders(2.49)).toBe(false);
  });

  it("is true at and above the threshold", () => {
    expect(shouldShowStateBorders(2.5)).toBe(true);
    expect(shouldShowStateBorders(4)).toBe(true);
  });
});

describe("GLOBE_BASE_RADIUS / canvas", () => {
  it("leaves padding around the sphere inside the canvas", () => {
    expect(GLOBE_BASE_RADIUS).toBeLessThan(GLOBE_HEIGHT / 2);
    expect(GLOBE_BASE_RADIUS).toBeLessThan(GLOBE_WIDTH / 2);
  });
});
