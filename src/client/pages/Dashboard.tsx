/**
 * Dashboard.tsx — Main GIS dashboard page.
 *
 * Responsibilities:
 *  - Fetches plot GeoJSON from the API on mount.
 *  - Renders the Map with the fetched data.
 *  - Manages the selected-plot state and shows the Sidebar.
 *  - Displays a loading skeleton and error banner.
 */
import { useState, useEffect, useCallback } from "react";
import { Map } from "../components/Map";
import { Sidebar } from "../components/Sidebar";
import type {
  GeoJsonFeatureCollection,
  PlotProperties,
  ApiResponse,
} from "../../shared/types";

export function Dashboard() {
  const [plotsData, setPlotsData] =
    useState<GeoJsonFeatureCollection<PlotProperties> | null>(null);
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
          setError(err instanceof Error ? err.message : "Failed to load plot data");
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

  const handlePlotClick = useCallback(
    (_id: number, properties: PlotProperties) => {
      setSelectedPlot(properties);
    },
    []
  );

  const handleSidebarClose = useCallback(() => {
    setSelectedPlot(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* ── Top bar ── */}
      <header className="flex-none flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shadow-lg z-20">
        <div className="flex items-center gap-2">
          {/* Forest leaf icon */}
          <svg
            className="w-6 h-6 text-forest-400"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M17 8C8 10 5.9 16.17 3.82 19.09L5.71 21c1-1.23 2.53-2.06 5.79-2.28C14.07 18.5 17 16 17 8z" />
          </svg>
          <span className="font-bold text-base tracking-tight">
            Mae Chaem Agroforestry GIS
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm text-gray-400">
          {loading ? (
            <span className="animate-pulse">Loading plots…</span>
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            <span>
              {plotsData?.features.length ?? 0} plots loaded
            </span>
          )}

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            {LEGEND_ITEMS.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Map area ── */}
      <main className="flex-1 relative overflow-hidden">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-forest-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-300">Loading map data…</p>
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
          onPlotClick={handlePlotClick}
          className="w-full h-full"
        />

        {/* Plot detail sidebar */}
        <Sidebar plot={selectedPlot} onClose={handleSidebarClose} />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend data
// ---------------------------------------------------------------------------

const LEGEND_ITEMS = [
  { label: "Home garden", color: "#22c55e" },
  { label: "Mixed fruit", color: "#f59e0b" },
  { label: "Timber/bamboo", color: "#3b82f6" },
  { label: "Teak", color: "#8b5cf6" },
  { label: "Other", color: "#6b7280" },
];

export default Dashboard;
