"use client";

import type { FeatureCollection, Geometry } from "geojson";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";

type PrefectureProperties = {
  prefecture?: string;
};

type PrefectureFeatureCollection = FeatureCollection<
  Geometry,
  PrefectureProperties
>;

interface PrefectureMapCanvasProps {
  geojson: PrefectureFeatureCollection;
  onPick: (prefecture: string) => void;
}

export function PrefectureMapCanvas({
  geojson,
  onPick,
}: PrefectureMapCanvasProps) {
  return (
    <MapContainer
      center={[36.2048, 138.2529]}
      zoom={5}
      className="h-72 w-full rounded-2xl border border-slate-200"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        data={geojson}
        eventHandlers={{
          click: (event) => {
            const feature = event.layer.feature as {
              properties?: PrefectureProperties;
            };
            const prefecture = feature.properties?.prefecture;
            if (typeof prefecture === "string" && prefecture.length > 0) {
              onPick(prefecture);
            }
          },
        }}
      />
    </MapContainer>
  );
}
