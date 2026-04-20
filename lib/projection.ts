import {
  geoEqualEarth,
  geoAlbersUsa,
  geoContains,
  geoPath,
  geoOrthographic,
  geoDistance,
} from "d3-geo";
import type { ExtendedFeatureCollection } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

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

// ---------------------------------------------------------------------------
// Flat-map projection helpers (Equal Earth world + Albers USA)
// Scheduled for removal in Task 3 once the globe replaces the flat views.
// ---------------------------------------------------------------------------

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 500;

export const US_MAP_WIDTH = 960;
export const US_MAP_HEIGHT = 600;

/*
 * Shared Equal Earth projection, centered and scaled to fit
 * MAP_WIDTH × MAP_HEIGHT. Used for both country paths and pin positions
 * so pins land exactly on the map.
 */
const projection = geoEqualEarth()
  .scale(175)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

/*
 * Composite projection for the U.S. map — includes insets for Alaska,
 * Hawaii, and Puerto Rico. Scaled and translated to fill the US canvas.
 */
const usProjection = geoAlbersUsa()
  .scale(1200)
  .translate([US_MAP_WIDTH / 2, US_MAP_HEIGHT / 2]);

// US country geometry, used for point-in-polygon classification.
// geoAlbersUsa's null check isn't reliable: it clips by bounding box,
// not by actual borders, so Vancouver and Tijuana would slip through.
const worldCountries = feature(
  worldTopo as unknown as Topology<{ countries: GeometryCollection }>,
  (worldTopo as unknown as Topology<{ countries: GeometryCollection }>).objects
    .countries,
) as unknown as ExtendedFeatureCollection;
const usFeature = worldCountries.features.find(
  (f) => f.properties?.name === "United States of America",
);

export function projectPoint(lon: number, lat: number): [number, number] {
  const xy = projection([lon, lat]);
  if (!xy) throw new Error(`Projection failed for (${lon}, ${lat})`);
  return [xy[0], xy[1]];
}

export function projectUsPoint(
  lon: number,
  lat: number,
): [number, number] | null {
  const xy = usProjection([lon, lat]);
  return xy ? [xy[0], xy[1]] : null;
}

// Excludes US territories (Puerto Rico, Guam, USVI, Samoa, N. Mariana).
// Neither world-atlas 110m nor the default geoAlbersUsa inset covers them,
// so a territory pin would currently render only on the world map. If that
// ever matters, switch to higher-resolution world-atlas and extend
// geoAlbersUsa with explicit insets, or add an explicit region field to
// MapPin.
export function isUsPin(p: { lat: number; lon: number }): boolean {
  if (!usFeature) return false;
  return geoContains(usFeature, [p.lon, p.lat]);
}

export function regionPathsFromGeojson(
  fc: ExtendedFeatureCollection,
  proj: typeof projection | typeof usProjection = projection,
): string[] {
  const path = geoPath(proj);
  const out: string[] = [];
  for (const feature of fc.features) {
    const d = path(feature);
    if (d) out.push(d);
  }
  return out;
}

export function countryPathsFromGeojson(
  fc: ExtendedFeatureCollection,
): string[] {
  return regionPathsFromGeojson(fc, projection);
}

export function statePathsFromGeojson(
  fc: ExtendedFeatureCollection,
): string[] {
  return regionPathsFromGeojson(fc, usProjection);
}
