import type { Metadata } from "next";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { ExtendedFeatureCollection } from "d3-geo";
import worldTopo from "world-atlas/countries-110m.json";
import statesTopo from "us-atlas/states-10m.json";
import { getPins } from "@/lib/content";
import {
  countryPathsFromGeojson,
  statePathsFromGeojson,
  projectPoint,
  projectUsPoint,
  isUsPin,
  MAP_WIDTH,
  MAP_HEIGHT,
  US_MAP_WIDTH,
  US_MAP_HEIGHT,
} from "@/lib/projection";
import { type ProjectedPin } from "@/components/map/MapCanvas";
import { MapSwitcher } from "@/components/map/MapSwitcher";

export const metadata: Metadata = {
  title: "Map",
  description: "Places I've lived, worked, and visited.",
};

export default function MapPage() {
  const pins = getPins();

  const worldGeo = feature(
    worldTopo as unknown as Topology<{ countries: GeometryCollection }>,
    (worldTopo as unknown as Topology<{ countries: GeometryCollection }>)
      .objects.countries,
  ) as unknown as ExtendedFeatureCollection;
  const countryPaths = countryPathsFromGeojson(worldGeo);

  const statesGeo = feature(
    statesTopo as unknown as Topology<{ states: GeometryCollection }>,
    (statesTopo as unknown as Topology<{ states: GeometryCollection }>).objects
      .states,
  ) as unknown as ExtendedFeatureCollection;
  const statePaths = statePathsFromGeojson(statesGeo);

  const usPins: ProjectedPin[] = [];
  const worldPins: ProjectedPin[] = [];
  for (const pin of pins) {
    const [wx, wy] = projectPoint(pin.lon, pin.lat);
    worldPins.push({ pin, x: wx, y: wy });
    if (isUsPin(pin)) {
      const xy = projectUsPoint(pin.lon, pin.lat);
      if (xy) usPins.push({ pin, x: xy[0], y: xy[1] });
    }
  }

  return (
    <MapSwitcher
      usMap={{
        ariaLabel: "United States map",
        viewBox: `0 0 ${US_MAP_WIDTH} ${US_MAP_HEIGHT}`,
        width: US_MAP_WIDTH,
        height: US_MAP_HEIGHT,
        regionPaths: statePaths,
        pins: usPins,
      }}
      worldMap={{
        ariaLabel: "World map",
        viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        regionPaths: countryPaths,
        pins: worldPins,
      }}
    />
  );
}
