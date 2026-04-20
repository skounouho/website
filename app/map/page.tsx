import type { Metadata } from "next";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { ExtendedFeatureCollection } from "d3-geo";
import worldTopo from "world-atlas/countries-110m.json";
import statesTopo from "us-atlas/states-10m.json";
import { getPins } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
} from "@/lib/projection";
import { MapGlobe } from "@/components/map/MapGlobe";

export const metadata: Metadata = {
  title: "Map",
  description: "Places I've lived, worked, and visited.",
};

// Mid-Atlantic view: rotation [30, 0] puts lon=-30 at screen center,
// roughly splitting the Americas and Europe/Africa.
const INITIAL_ROTATION: [number, number] = [30, 0];
const INITIAL_SCALE = 1;

export default function MapPage() {
  const pins = getPins();

  const worldFeatures = feature(
    worldTopo as unknown as Topology<{ countries: GeometryCollection }>,
    (worldTopo as unknown as Topology<{ countries: GeometryCollection }>)
      .objects.countries,
  ) as unknown as ExtendedFeatureCollection;

  const stateFeatures = feature(
    statesTopo as unknown as Topology<{ states: GeometryCollection }>,
    (statesTopo as unknown as Topology<{ states: GeometryCollection }>).objects
      .states,
  ) as unknown as ExtendedFeatureCollection;

  const initialProjection = createGlobeProjection({
    width: GLOBE_WIDTH,
    height: GLOBE_HEIGHT,
    scale: INITIAL_SCALE,
    rotation: INITIAL_ROTATION,
  });
  const initialCountryPaths = pathsFromGeojson(
    worldFeatures,
    initialProjection,
  );

  return (
    <MapGlobe
      pins={pins}
      worldFeatures={worldFeatures}
      stateFeatures={stateFeatures}
      initialRotation={INITIAL_ROTATION}
      initialScale={INITIAL_SCALE}
      initialCountryPaths={initialCountryPaths}
    />
  );
}
