import { geoEqualEarth, geoAlbersUsa, geoContains, geoPath } from "d3-geo";
import type { ExtendedFeatureCollection } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

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
