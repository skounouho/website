import { geoOrthographic, geoDistance, geoPath } from "d3-geo";
import type { ExtendedFeatureCollection } from "d3-geo";

// ---------------------------------------------------------------------------
// Globe (orthographic) projection helpers
// ---------------------------------------------------------------------------

export const GLOBE_WIDTH = 960;
export const GLOBE_HEIGHT = 540;
export const GLOBE_BASE_RADIUS = 240;

export const STATE_BORDER_SCALE_THRESHOLD = 2.5;
export const FLY_TO_SCALE = 2.2;
export const SCALE_MIN = 1;
export const SCALE_MAX = 4;

export interface GlobeProjectionConfig {
  width: number;
  height: number;
  /** Multiplicative zoom; 1 = sphere radius GLOBE_BASE_RADIUS. */
  scale: number;
  /** [lambda, phi] — yaw and pitch in degrees. */
  rotation: [number, number];
}

export function createGlobeProjection(cfg: GlobeProjectionConfig) {
  return geoOrthographic()
    .scale(GLOBE_BASE_RADIUS * cfg.scale)
    .translate([cfg.width / 2, cfg.height / 2])
    .rotate([cfg.rotation[0], cfg.rotation[1], 0])
    .clipAngle(90);
}

export function pathsFromGeojson(
  fc: ExtendedFeatureCollection,
  projection: ReturnType<typeof createGlobeProjection>,
): string[] {
  const path = geoPath(projection);
  const out: string[] = [];
  for (const f of fc.features) {
    const d = path(f);
    if (d) out.push(d);
  }
  return out;
}

export function isPinVisible(
  pin: { lon: number; lat: number },
  rotation: [number, number],
): boolean {
  // geoOrthographic().rotate([λ, φ]) brings the point at [-λ, -φ] to the view center.
  const center: [number, number] = [-rotation[0], -rotation[1]];
  return geoDistance([pin.lon, pin.lat], center) < Math.PI / 2;
}

export function flyToTarget(pin: { lon: number; lat: number }): {
  rotation: [number, number];
  scale: number;
} {
  return {
    rotation: [-pin.lon, -pin.lat],
    scale: FLY_TO_SCALE,
  };
}

export function shouldShowStateBorders(scale: number): boolean {
  return scale >= STATE_BORDER_SCALE_THRESHOLD;
}
