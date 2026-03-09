/**
 * Map.tsx — MapLibre GL JS map component.
 *
 * Migrated from v3.0.0:
 *  - Google Satellite Hybrid basemap (satellite imagery + road labels)
 *  - Solid green polygon fill (matching v3.0.0 AgroforestryMap)
 *  - Thai-language popup labels (เจ้าของแปลง, รหัสแปลง, ฯลฯ)
 *  - flyToTarget prop for sidebar-driven map navigation
 */
import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MaplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker?url";
import type { GeoJsonFeatureCollection, PlotProperties } from "../../shared/types";

setWorkerUrl(MaplibreWorkerUrl);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mae Chaem district centre (longitude, latitude) */
const MAE_CHAEM_CENTER: [number, number] = [98.39, 18.53];
const DEFAULT_ZOOM = 11;

// Layer / source IDs
const PLOTS_SOURCE_ID = "plots";
const PLOTS_FILL_LAYER = "plots-fill";
const PLOTS_OUTLINE_LAYER = "plots-outline";
const PLOTS_HIGHLIGHT_LAYER = "plots-highlight";

// Google Satellite Hybrid map style (satellite imagery + road labels, no API key required)
const SATELLITE_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"],
      tileSize: 256,
      maxzoom: 22,
    },
  },
  layers: [
    {
      id: "satellite-tiles",
      type: "raster",
      source: "satellite",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlyToTarget {
  longitude: number;
  latitude: number;
  zoom?: number;
  /** Bounding box [[west, south], [east, north]] — when set, fitBounds is used instead of flyTo */
  bounds?: [[number, number], [number, number]];
}

interface MapProps {
  /** GeoJSON FeatureCollection returned by GET /api/plots */
  plotsData?: GeoJsonFeatureCollection<PlotProperties> | null;
  /** Called when the user clicks a plot */
  onPlotClick?: (plotId: number, properties: PlotProperties) => void;
  /** When set, the map flies to this location (e.g. triggered by sidebar click) */
  flyToTarget?: FlyToTarget | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Map({ plotsData, onPlotClick, flyToTarget, className = "" }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // ----- Initialise map once -----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_MAP_STYLE,
      center: MAE_CHAEM_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // ------------------------------------------------------------------
      // 1. Plots vector source (GeoJSON) — solid green fill (from v3.0.0)
      // ------------------------------------------------------------------
      map.addSource(PLOTS_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: PLOTS_FILL_LAYER,
        type: "fill",
        source: PLOTS_SOURCE_ID,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: PLOTS_OUTLINE_LAYER,
        type: "line",
        source: PLOTS_SOURCE_ID,
        paint: {
          "line-color": "#166534",
          "line-width": 1.5,
          "line-opacity": 1,
        },
      });

      // Hover highlight layer
      map.addSource(`${PLOTS_SOURCE_ID}-highlight`, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: PLOTS_HIGHLIGHT_LAYER,
        type: "fill",
        source: `${PLOTS_SOURCE_ID}-highlight`,
        paint: {
          "fill-color": "#fff",
          "fill-opacity": 0.2,
        },
      });

      // ------------------------------------------------------------------
      // 2. Interactivity — hover popup with Thai labels (from v3.0.0)
      // ------------------------------------------------------------------
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "maechaem-popup",
      });
      popupRef.current = popup;

      map.on("mousemove", PLOTS_FILL_LAYER, (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";

        const feature = e.features[0];
        if (!feature) return;
        const props = feature.properties as PlotProperties;

        (
          map.getSource(`${PLOTS_SOURCE_ID}-highlight`) as maplibregl.GeoJSONSource
        ).setData(toFeatureCollection(feature));

        popup
          .setLngLat(e.lngLat)
          .setHTML(buildPopupHtml(props))
          .addTo(map);
      });

      map.on("mouseleave", PLOTS_FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
        (
          map.getSource(`${PLOTS_SOURCE_ID}-highlight`) as maplibregl.GeoJSONSource
        ).setData({ type: "FeatureCollection", features: [] });
      });

      map.on("click", PLOTS_FILL_LAYER, (e) => {
        if (!e.features?.length || !onPlotClick) return;
        const props = e.features[0]?.properties as PlotProperties;
        if (props) onPlotClick(props.id, props);
      });
      setIsMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Update plots source when data changes -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !plotsData) return;

    const source = map.getSource(PLOTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(plotsData as unknown as GeoJSON.FeatureCollection);
    }
  }, [plotsData, isMapLoaded]);

  // ----- Fly to / fit bounds when sidebar plot is clicked -----
  const handleFlyTo = useCallback((target: FlyToTarget) => {
    const map = mapRef.current;
    if (!map) return;
    if (target.bounds) {
      map.fitBounds(target.bounds, { padding: 60, duration: 1000 });
    } else {
      map.flyTo({
        center: [target.longitude, target.latitude],
        zoom: target.zoom ?? 15,
        duration: 1500,
      });
    }
  }, []);

  useEffect(() => {
    if (flyToTarget) {
      handleFlyTo(flyToTarget);
    }
  }, [flyToTarget, handleFlyTo]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-xl overflow-hidden shadow-sm ${className}`}
      aria-label="Mae Chaem agroforestry map"
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFeatureCollection(
  feature: maplibregl.MapGeoJSONFeature
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: feature.id,
        geometry: feature.geometry as GeoJSON.Geometry,
        properties: feature.properties,
      },
    ],
  };
}

/** Thai-language popup HTML — minimal white theme. */
function buildPopupHtml(props: PlotProperties): string {
  const rows: [string, string][] = [
    ["เจ้าของแปลง", props.farmerName ?? "—"],
    ["รหัสแปลง", props.plotCode ?? "—"],
    ["ขนาดพื้นที่", props.areaRai != null ? `${props.areaRai} ไร่` : "—"],
    ["ตำบล", props.tambon ?? "—"],
  ];

  if (props.elevMean != null) {
    rows.push(["ความสูงเฉลี่ย", `${props.elevMean} ม.เหนือระดับน้ำทะเล`]);
  }

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td class="pr-3 text-gray-400 text-xs whitespace-nowrap font-normal">${label}</td>` +
        `<td class="text-gray-800 text-xs font-medium">${value}</td>` +
        `</tr>`
    )
    .join("");

  return `
    <div class="bg-white rounded-xl p-3 shadow-lg border border-gray-100 min-w-[200px]" style="font-family:'Sarabun',sans-serif">
      <table class="w-full border-collapse">${rowsHtml}</table>
    </div>
  `;
}

export default Map;
