/**
 * Sidebar.tsx — All-plots list sidebar (migrated from v3.0.0 DashboardClient).
 *
 * Displays a scrollable list of all plots. Clicking a plot fires onPlotClick,
 * which triggers a flyTo animation on the map. The active plot is highlighted.
 * Labels are in Thai to match v3.0.0.
 */
import type { GeoJsonFeatureCollection, PlotProperties } from "../../shared/types";

interface SidebarProps {
  plots: GeoJsonFeatureCollection<PlotProperties> | null;
  activeIndex: number | null;
  onPlotClick: (index: number) => void;
}

export function Sidebar({ plots, activeIndex, onPlotClick }: SidebarProps) {
  const features = plots?.features ?? [];

  return (
    <aside className="hidden md:flex w-64 flex-col gap-3 border-r border-gray-100 bg-gray-50 p-4 overflow-y-auto flex-shrink-0">
      <h2 className="font-semibold text-gray-700 text-sm">
        ข้อมูลแปลง ({features.length} แปลง)
      </h2>

      {features.length === 0 ? (
        <p className="text-xs text-gray-400">ไม่พบข้อมูลแปลง</p>
      ) : (
        <ul className="space-y-1.5">
          {features.map((feature, index) => {
            const p = feature.properties;
            const isActive = activeIndex === index;

            return (
              <li key={p.plotCode ?? index}>
                <button
                  type="button"
                  onClick={() => onPlotClick(index)}
                  className={`w-full text-left rounded-lg p-3 text-sm transition-colors ${
                    isActive
                      ? "bg-green-50 ring-1 ring-green-400"
                      : "bg-white hover:bg-green-50 border border-gray-100"
                  }`}
                >
                  <p
                    className={`font-medium truncate ${
                      isActive ? "text-green-700" : "text-gray-800"
                    }`}
                  >
                    {p.farmerName ?? p.plotCode ?? `แปลง ${index + 1}`}
                  </p>
                  {p.plotCode != null && (
                    <p className="text-gray-400 text-xs mt-0.5">รหัส: {p.plotCode}</p>
                  )}
                  {p.areaRai != null && (
                    <p className="text-gray-400 text-xs">{p.areaRai} ไร่</p>
                  )}
                  {p.elevMean != null && (
                    <p className="text-gray-400 text-xs">{p.elevMean} ม.</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default Sidebar;
