import type { Metadata } from "next";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { ExtendedFeatureCollection } from "d3-geo";
import worldTopo from "world-atlas/countries-110m.json";
import { getPins } from "@/lib/content";
import {
  countryPathsFromGeojson,
  projectPoint,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "@/lib/projection";
import { MapCanvas, type ProjectedPin } from "@/components/map/MapCanvas";

export const metadata: Metadata = {
  title: "Map",
  description: "Places I've lived, worked, and visited.",
};

export default function MapPage() {
  const topo = worldTopo as unknown as Topology<{
    countries: GeometryCollection;
  }>;
  const countries = feature(
    topo,
    topo.objects.countries,
  ) as unknown as ExtendedFeatureCollection;
  const countryPaths = countryPathsFromGeojson(countries);

  const pins: ProjectedPin[] = getPins().map((pin) => {
    const [x, y] = projectPoint(pin.lon, pin.lat);
    return { pin, x, y };
  });

  return (
    <MapCanvas
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      countryPaths={countryPaths}
      pins={pins}
    />
  );
}
