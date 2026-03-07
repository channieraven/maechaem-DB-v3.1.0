/**
 * Sidebar.tsx — Plot detail sidebar component.
 *
 * Displays summary statistics and details for the selected plot.
 * Appears as a slide-in panel on the right side of the dashboard.
 */
import type { PlotProperties } from "../../shared/types";

interface SidebarProps {
  plot: PlotProperties | null;
  onClose: () => void;
}

export function Sidebar({ plot, onClose }: SidebarProps) {
  if (!plot) return null;

  return (
    <aside className="absolute top-4 right-4 z-10 w-72 bg-gray-900/95 backdrop-blur-sm text-white rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-forest-800 border-b border-forest-700">
        <h2 className="font-semibold text-sm truncate">{plot.plotCode}</h2>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-white transition-colors ml-2 flex-shrink-0"
          aria-label="Close panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <dl className="divide-y divide-gray-800">
        <DetailRow label="Village" value={plot.village} />
        <DetailRow label="Owner" value={plot.ownerName} />
        <DetailRow label="System Type" value={formatSystemType(plot.systemType)} />
        <DetailRow label="Dominant Species" value={plot.dominantSpecies} />
        <DetailRow
          label="Area"
          value={
            plot.areaRai != null
              ? `${plot.areaRai.toFixed(2)} rai (${(plot.areaRai * 0.16).toFixed(3)} ha)`
              : null
          }
        />
        <DetailRow
          label="Established"
          value={plot.establishedYear?.toString() ?? null}
        />
      </dl>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="px-4 py-2.5 flex justify-between gap-2">
      <dt className="text-xs text-gray-400 flex-shrink-0">{label}</dt>
      <dd className="text-xs text-right font-medium text-gray-100 truncate">
        {value ?? <span className="text-gray-500 font-normal">—</span>}
      </dd>
    </div>
  );
}

function formatSystemType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default Sidebar;
