/**
 * Dashboard.tsx — Main GIS dashboard page.
 *
 * Layout: header | sidebar (plot list) | map | plot-detail panel
 *
 * New in v3.1.0 UX update:
 *  - PlotPanel slides in when a plot is selected (tabs: info, growth logs,
 *    trees, images, spacing logs)
 *  - NotificationBell in header (polls /api/notifications for the signed-in user)
 */
import { useState, useEffect, useCallback } from "react";
import { useUser, UserButton } from "@clerk/react";
import { Map } from "../components/Map";
import { Sidebar } from "../components/Sidebar";
import { PlotPanel } from "../components/PlotPanel";
import { NotificationBell } from "../components/NotificationBell";
import type {
  GeoJsonFeatureCollection,
  PlotProperties,
  GeoJsonGeometry,
  ApiResponse,
} from "../../shared/types";
import type { FlyToTarget } from "../components/Map";

// ---------------------------------------------------------------------------
// Geometry centre helper
// ---------------------------------------------------------------------------

function getGeometryCenter(geometry: GeoJsonGeometry): FlyToTarget | null {
  let coords: number[][] = [];

  if (geometry.type === "Polygon") {
    coords = geometry.coordinates[0] ?? [];
  } else if (geometry.type === "MultiPolygon") {
    coords = (geometry.coordinates as number[][][][]).flatMap((poly) => poly[0] ?? []);
  } else {
    return null;
  }

  const lngs = coords.map((c) => c[0] ?? 0);
  const lats = coords.map((c) => c[1] ?? 0);
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
  const { user } = useUser();
  const [plotsData, setPlotsData] =
    useState<GeoJsonFeatureCollection<PlotProperties> | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<PlotProperties | null>(null);
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

  // ----- Select a plot: fly to it, highlight sidebar, open detail panel -----
  const selectPlot = useCallback(
    (index: number) => {
      const feature = plotsData?.features[index];
      if (!feature) return;
      setActiveIndex(index);
      setSelectedPlot(feature.properties);
      if (feature.geometry) {
        const center = getGeometryCenter(feature.geometry);
        if (center) setFlyToTarget({ ...center });
      }
    },
    [plotsData]
  );

  // ----- Sidebar plot click -----
  const handleSidebarPlotClick = useCallback(
    (index: number) => selectPlot(index),
    [selectPlot]
  );

  // ----- Map plot click → find feature index → open panel -----
  const handleMapPlotClick = useCallback(
    (_id: number, properties: PlotProperties) => {
      if (!plotsData) return;
      const index = plotsData.features.findIndex(
        (f) => f.properties.plotCode === properties.plotCode
      );
      if (index !== -1) selectPlot(index);
    },
    [plotsData, selectPlot]
  );

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* ── Top bar ── */}
      <header className="flex-none flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-600"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M17 8C8 10 5.9 16.17 3.82 19.09L5.71 21c1-1.23 2.53-2.06 5.79-2.28C14.07 18.5 17 16 17 8z" />
          </svg>
          <span className="font-semibold text-gray-800 text-sm tracking-tight">
            Mae Chaem Agroforestry DB
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm text-gray-400">
          {loading ? (
            <span className="animate-pulse text-gray-400">กำลังโหลดข้อมูล…</span>
          ) : error ? (
            <span className="text-red-500 text-xs">{error}</span>
          ) : (
            <span className="text-gray-500 text-xs">
              {plotsData?.features.length ?? 0} แปลง
            </span>
          )}
          {userEmail && <NotificationBell userEmail={userEmail} />}
          <UserButton />
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — all-plots list */}
        <Sidebar
          plots={plotsData}
          activeIndex={activeIndex}
          onPlotClick={handleSidebarPlotClick}
        />

        {/* Map area */}
        <main className="flex-1 relative overflow-hidden p-3">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">กำลังโหลดข้อมูลแผนที่…</p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && !loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 bg-red-50 text-red-700 text-sm rounded-lg shadow border border-red-200 max-w-sm text-center">
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

        {/* Right detail panel — shown when a plot is selected */}
        {selectedPlot && (
          <PlotPanel
            plotCode={selectedPlot.plotCode}
            properties={selectedPlot}
            onClose={() => {
              setSelectedPlot(null);
              setActiveIndex(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
