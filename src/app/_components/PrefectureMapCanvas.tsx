"use client";

import type { FeatureCollection, Geometry } from "geojson";
import { useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, WMSTileLayer, useMap } from "react-leaflet";

export interface MapSearchBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

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
  onBoundsChange?: (bounds: MapSearchBounds) => void;
}


export function PrefectureMapCanvas({
  geojson,
  onPick,
  onBoundsChange,
}: PrefectureMapCanvasProps) {
  return (
    <MapContainer
      center={[36.2048, 138.2529]}
      zoom={6}
      className="h-full w-full"
      scrollWheelZoom
    >
      <MapBoundsObserver onBoundsChange={onBoundsChange} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <WMSTileLayer
        url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?TIME=2016-01-01"
        layers="VIIRS_Black_Marble"
        format="image/jpeg"
        transparent={false}
        version="1.1.1"
        attribution='Nighttime imagery: <a href="https://earthdata.nasa.gov/gibs">NASA ESDIS GIBS</a>'
        opacity={0.5}
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

function MapBoundsObserver({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: MapSearchBounds) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!onBoundsChange) {
      return;
    }

    const reportBounds = () => {
      const leafletBounds = map.getBounds();
      onBoundsChange({
        minLatitude: leafletBounds.getSouth(),
        maxLatitude: leafletBounds.getNorth(),
        minLongitude: leafletBounds.getWest(),
        maxLongitude: leafletBounds.getEast(),
      });
    };

    reportBounds();
    map.on("moveend", reportBounds);

    return () => {
      map.off("moveend", reportBounds);
    };
  }, [map, onBoundsChange]);

  return null;
}
