/**
 * Dashboard.tsx — Main GIS dashboard page.
 *
 * Migrated from v3.0.0:
 *  - Two-panel layout: persistent left sidebar (plot list) + map
 *  - Sidebar click triggers flyTo animation on the map
 *  - Active plot tracking and highlight state
 *  - Thai language header labels
 *
 * Retained from v3.1.0:
 *  - Fetches plot GeoJSON from the Hono API on mount
 *  - Loading overlay and error banner
 */
import { useState, useEffect, useCallback } from "react";
import { Map } from "../components/Map";
import { Sidebar } from "../components/Sidebar";
import type {
  GeoJsonFeatureCollection,
  PlotProperties,
  GeoJsonGeometry,
  ApiResponse,
} from "../../shared/types";
import type { FlyToTarget } from "../components/Map";

// ---------------------------------------------------------------------------
// Geometry centre helper (migrated from v3.0.0 DashboardClient)
// ---------------------------------------------------------------------------

function getGeometryCenter(geometry: GeoJsonGeometry): FlyToTarget | null {
  let coords: number[][] = [];

  if (geometry.type === "Polygon") {
    coords = geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    coords = (geometry.coordinates as number[][][][]).flatMap((poly) => poly[0]);
  } else {
    return null;
  }

  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return {
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    zoom: 15,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Dashboard() {
  const [plotsData, setPlotsData] =
    useState<GeoJsonFeatureCollection<PlotProperties> | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----- Fetch plot GeoJSON on mount -----
  useEffect(() => {
    let cancelled = false;

    async function fetchPlots() {
      try {
        const res = await fetch("/api/plots");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const json: ApiResponse<GeoJsonFeatureCollection<PlotProperties>> =
          await res.json();

        if (!json.ok) {
          throw new Error(json.error);
        }

        if (!cancelled) {
          setPlotsData(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลแปลงได้");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPlots();
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- Sidebar plot click → compute centre → flyTo -----
  const handleSidebarPlotClick = useCallback(
    (index: number) => {
      const feature = plotsData?.features[index];
      if (!feature?.geometry) return;
      const center = getGeometryCenter(feature.geometry);
      if (!center) return;
      setActiveIndex(index);
      setFlyToTarget({ ...center });
    },
    [plotsData]
  );

  // ----- Map plot click → set active index -----
  const handleMapPlotClick = useCallback(
    (_id: number, properties: PlotProperties) => {
      if (!plotsData) return;
      const index = plotsData.features.findIndex(
        (f) => f.properties.plotCode === properties.plotCode
      );
      if (index !== -1) setActiveIndex(index);
    },
    [plotsData]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* ── Top bar ── */}
      <header className="flex-none flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shadow-lg z-20">
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-green-400"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M17 8C8 10 5.9 16.17 3.82 19.09L5.71 21c1-1.23 2.53-2.06 5.79-2.28C14.07 18.5 17 16 17 8z" />
          </svg>
          <span className="font-bold text-base tracking-tight">
            🌳 Mae Chaem Agroforestry DB
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm text-gray-400">
          {loading ? (
            <span className="animate-pulse">กำลังโหลดข้อมูลแผนที่...</span>
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            <span>{plotsData?.features.length ?? 0} แปลง</span>
          )}
        </div>
      </header>

      {/* ── Main content: sidebar + map ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — all-plots list */}
        <Sidebar
          plots={plotsData}
          activeIndex={activeIndex}
          onPlotClick={handleSidebarPlotClick}
        />

        {/* Map area */}
        <main className="flex-1 relative overflow-hidden p-4">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-300">กำลังโหลดข้อมูลแผนที่...</p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && !loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 bg-red-900/90 backdrop-blur-sm text-red-100 text-sm rounded-lg shadow-lg border border-red-700 max-w-sm text-center">
              ⚠ {error}
            </div>
          )}

          <Map
            plotsData={plotsData}
            onPlotClick={handleMapPlotClick}
            flyToTarget={flyToTarget}
            className="w-full h-full"
          />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
