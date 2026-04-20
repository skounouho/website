import { describe, it, expect } from "vitest";
import {
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
