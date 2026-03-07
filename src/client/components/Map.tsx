/**
 * Map.tsx — MapLibre GL JS map component with COG/R2 raster support.
 *
 * Features:
 *  - Renders an interactive map centred on Mae Chaem, Thailand.
 *  - Loads a vector GeoJSON layer of agroforestry plots from the API.
 *  - Adds a Cloud-Optimized GeoTIFF (COG) raster source served from
 *    Cloudflare R2 via the /api/r2/tiles proxy endpoint.
 *  - Highlights a plot on hover and shows a popup with plot details.
 *  - Fully typed; no any-casting in the public interface.
 */
import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJsonFeatureCollection, PlotProperties } from "../../shared/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mae Chaem district centre (longitude, latitude) */
const MAE_CHAEM_CENTER: [number, number] = [98.1675, 18.5722];
const DEFAULT_ZOOM = 11;

/** COG key in R2 (relative to the bucket root) */
const COG_R2_KEY = "landcover/maechaem_landcover_2024.tif";
/** Public base URL for the tile proxy — adjust for your Pages domain */
const COG_TILE_PROXY_BASE = "/api/r2/tiles";

// Layer / source IDs
const PLOTS_SOURCE_ID = "plots";
const PLOTS_FILL_LAYER = "plots-fill";
const PLOTS_OUTLINE_LAYER = "plots-outline";
const PLOTS_HIGHLIGHT_LAYER = "plots-highlight";
const COG_SOURCE_ID = "cog-raster";
const COG_LAYER_ID = "cog-raster-layer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapProps {
  /** GeoJSON FeatureCollection returned by GET /api/plots */
  plotsData?: GeoJsonFeatureCollection<PlotProperties> | null;
  /** Called when the user clicks a plot */
  onPlotClick?: (plotId: number, properties: PlotProperties) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Map({ plotsData, onPlotClick, className = "" }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // ----- Initialise map once -----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Free OpenFreeMap style — no API key required, good for development.
      // Swap to a Mapbox / MapTiler style for production.
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: MAE_CHAEM_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    // Navigation controls (zoom + compass)
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Scale bar
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // ------------------------------------------------------------------
      // 1. COG raster source from Cloudflare R2 (via tile proxy)
      // ------------------------------------------------------------------
      map.addSource(COG_SOURCE_ID, {
        type: "raster",
        // TileJSON-style URL: the proxy endpoint handles HTTP range requests
        // that MapLibre uses to read individual COG tiles efficiently.
        tiles: [`${COG_TILE_PROXY_BASE}/${COG_R2_KEY}`],
        tileSize: 256,
        attribution: "© Mae Chaem Agroforestry Project",
      });

      map.addLayer({
        id: COG_LAYER_ID,
        type: "raster",
        source: COG_SOURCE_ID,
        paint: {
          "raster-opacity": 0.6,
          "raster-fade-duration": 300,
        },
      });

      // ------------------------------------------------------------------
      // 2. Plots vector source (GeoJSON)
      // ------------------------------------------------------------------
      map.addSource(PLOTS_SOURCE_ID, {
        type: "geojson",
        // Start with an empty collection; data is set via the plotsData prop.
        data: { type: "FeatureCollection", features: [] },
      });

      // Semi-transparent fill
      map.addLayer({
        id: PLOTS_FILL_LAYER,
        type: "fill",
        source: PLOTS_SOURCE_ID,
        paint: {
          "fill-color": [
            "match",
            ["get", "systemType"],
            "home_garden", "#22c55e",
            "mixed_fruit", "#f59e0b",
            "timber_bamboo", "#3b82f6",
            "teak_monoculture", "#8b5cf6",
            /* default */ "#6b7280",
          ],
          "fill-opacity": 0.5,
        },
      });

      // Outline
      map.addLayer({
        id: PLOTS_OUTLINE_LAYER,
        type: "line",
        source: PLOTS_SOURCE_ID,
        paint: {
          "line-color": "#fff",
          "line-width": 1,
          "line-opacity": 0.8,
        },
      });

      // Hover highlight layer (initially empty)
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
          "fill-opacity": 0.25,
        },
      });

      // ------------------------------------------------------------------
      // 3. Interactivity — hover popup
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

        // Update highlight source — MapLibreFeature implements the GeoJSON spec
        // so a direct cast is safe here; the intermediate 'unknown' is required
        // because MapLibre's internal Feature type diverges from @types/geojson.
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

      // Click — fire onPlotClick callback
      map.on("click", PLOTS_FILL_LAYER, (e) => {
        if (!e.features?.length || !onPlotClick) return;
        const props = e.features[0]?.properties as PlotProperties;
        if (props) onPlotClick(props.id, props);
      });
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
    if (!map || !map.isStyleLoaded() || !plotsData) return;

    const source = map.getSource(PLOTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(plotsData as unknown as GeoJSON.FeatureCollection);
    }
  }, [plotsData]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-xl overflow-hidden ${className}`}
      aria-label="Mae Chaem agroforestry map"
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a single MapLibre map feature into a GeoJSON FeatureCollection
 * that can be passed to `GeoJSONSource.setData()`.
 *
 * MapLibre's internal `MapGeoJSONFeature` type carries extra rendering fields
 * that differ from the plain `GeoJSON.Feature` type in @types/geojson.
 * This adapter strips those extra fields to produce a spec-compliant Feature.
 */
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

function buildPopupHtml(props: PlotProperties): string {
  const rows = [
    ["Plot", props.plotCode],
    ["Village", props.village ?? "—"],
    ["Owner", props.ownerName ?? "—"],
    ["System", props.systemType ?? "—"],
    ["Area", props.areaRai != null ? `${props.areaRai.toFixed(2)} rai` : "—"],
  ]
    .map(
      ([label, value]) =>
        `<tr><td class="pr-2 text-gray-400 text-xs">${label}</td>` +
        `<td class="text-white text-xs font-medium">${value}</td></tr>`
    )
    .join("");

  return `
    <div class="bg-gray-900 rounded-lg p-3 shadow-xl min-w-[180px]">
      <table class="w-full border-collapse">${rows}</table>
    </div>
  `;
}

// Named export + default for flexibility
export default Map;
