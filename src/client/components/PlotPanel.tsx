/**
 * PlotPanel.tsx — Right-side detail panel for a selected plot.
 *
 * Shows tabbed data for all backend functions:
 *  - ข้อมูลแปลง  (plot info / properties)
 *  - บันทึกการเจริญเติบโต  (growth logs)
 *  - ต้นไม้  (tree profiles)
 *  - รูปภาพ  (image gallery)
 *  - ระยะห่าง  (spacing logs)
 */
import { useState, useEffect, useCallback } from "react";
import type {
  PlotProperties,
  GrowthLog,
  TreeProfile,
  PlotImage,
  SpacingLog,
  ApiResponse,
} from "../../shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "info" | "growth" | "trees" | "images" | "spacing";

interface PlotPanelProps {
  plotCode: string;
  properties: PlotProperties;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlotPanel({ plotCode, properties, onClose }: PlotPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [growthLogs, setGrowthLogs] = useState<GrowthLog[]>([]);
  const [trees, setTrees] = useState<TreeProfile[]>([]);
  const [images, setImages] = useState<PlotImage[]>([]);
  const [spacingLogs, setSpacingLogs] = useState<SpacingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Reset tab when plot changes
  useEffect(() => {
    setActiveTab("info");
    setGrowthLogs([]);
    setTrees([]);
    setImages([]);
    setSpacingLogs([]);
    setError(null);
  }, [plotCode]);

  const fetchGrowthLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/growth-logs?plot_code=${encodeURIComponent(plotCode)}`);
      const json: ApiResponse<GrowthLog[]> = await res.json();
      if (json.ok) setGrowthLogs(json.data);
      else setError(json.error);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [plotCode]);

  const fetchTrees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trees?plot_code=${encodeURIComponent(plotCode)}`);
      const json: ApiResponse<TreeProfile[]> = await res.json();
      if (json.ok) setTrees(json.data);
      else setError(json.error);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [plotCode]);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/images?plot_code=${encodeURIComponent(plotCode)}`);
      const json: ApiResponse<PlotImage[]> = await res.json();
      if (json.ok) setImages(json.data);
      else setError(json.error);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [plotCode]);

  const fetchSpacing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spacing-logs?plot_code=${encodeURIComponent(plotCode)}`);
      const json: ApiResponse<SpacingLog[]> = await res.json();
      if (json.ok) setSpacingLogs(json.data);
      else setError(json.error);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [plotCode]);

  useEffect(() => {
    if (activeTab === "growth") fetchGrowthLogs();
    else if (activeTab === "trees") fetchTrees();
    else if (activeTab === "images") fetchImages();
    else if (activeTab === "spacing") fetchSpacing();
  }, [activeTab, fetchGrowthLogs, fetchTrees, fetchImages, fetchSpacing]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "info", label: "แปลง", icon: "📋" },
    { id: "growth", label: "การเจริญเติบโต", icon: "🌱" },
    { id: "trees", label: "ต้นไม้", icon: "🌳" },
    { id: "images", label: "รูปภาพ", icon: "🖼" },
    { id: "spacing", label: "ระยะห่าง", icon: "📏" },
  ];

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="ขยายรูปภาพ"
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold bg-black/50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
            onClick={() => setLightboxUrl(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Panel */}
      <aside className="flex flex-col w-80 flex-shrink-0 border-l border-gray-100 bg-white overflow-hidden">
        {/* Panel header */}
        <div className="flex-none flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">
              {properties.farmerName ?? properties.plotCode}
            </p>
            <p className="text-xs text-gray-400">{properties.plotCode}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
            aria-label="ปิดรายละเอียด"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-none flex gap-0 border-b border-gray-100 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === t.id
                  ? "border-green-500 text-green-700 bg-green-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-500 text-xs text-center py-6">{error}</p>
          ) : (
            <>
              {activeTab === "info" && <InfoTab properties={properties} />}
              {activeTab === "growth" && <GrowthTab logs={growthLogs} />}
              {activeTab === "trees" && <TreesTab trees={trees} />}
              {activeTab === "images" && (
                <ImagesTab images={images} onImageClick={setLightboxUrl} />
              )}
              {activeTab === "spacing" && <SpacingTab logs={spacingLogs} />}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Info tab
// ---------------------------------------------------------------------------

function InfoTab({ properties: p }: { properties: PlotProperties }) {
  const rows: [string, string][] = [
    ["รหัสแปลง", p.plotCode],
    ["เจ้าของแปลง", p.farmerName ?? "—"],
    ["กลุ่มเกษตรกร", p.groupNumber ?? "—"],
    ["พื้นที่ (ไร่)", p.areaRai != null ? `${p.areaRai} ไร่` : "—"],
    ["พื้นที่ (ตร.ม.)", p.areaSqm != null ? `${p.areaSqm.toLocaleString()} ตร.ม.` : "—"],
    ["ตำบล", p.tambon ?? "—"],
    ["ความสูงเฉลี่ย", p.elevMean != null ? `${p.elevMean} ม.เหนือน้ำทะเล` : "—"],
  ];

  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
          <span className="text-gray-400 text-xs w-32 flex-shrink-0">{label}</span>
          <span className="text-gray-800 text-xs font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Growth logs tab
// ---------------------------------------------------------------------------

function GrowthTab({ logs }: { logs: GrowthLog[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return <EmptyState label="ยังไม่มีบันทึกการเจริญเติบโต" />;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2">{logs.length} รายการ</p>
      {logs.map((log) => (
        <div key={log.logId} className="rounded-lg border border-gray-100 overflow-hidden">
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors"
            onClick={() => setExpandedId(expandedId === log.logId ? null : log.logId)}
          >
            <span className="flex-1 min-w-0">
              <span className="text-xs font-medium text-gray-800 block truncate">
                {log.treeCode}
              </span>
              <span className="text-xs text-gray-400">
                {log.speciesName ?? log.speciesGroup ?? "—"} · {log.surveyDate ?? "ไม่ระบุวันที่"}
              </span>
            </span>
            <span className="text-gray-300 text-xs">{expandedId === log.logId ? "▲" : "▼"}</span>
          </button>

          {expandedId === log.logId && (
            <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100 space-y-1 pt-2">
              {log.heightM != null && <LogRow label="ความสูง" value={`${log.heightM} ม.`} />}
              {log.dbhCm != null && <LogRow label="DBH" value={`${log.dbhCm} ซม.`} />}
              {log.bambooCulms != null && <LogRow label="ลำไผ่" value={`${log.bambooCulms} ลำ`} />}
              {log.bananaTotal != null && <LogRow label="กล้วย (ทั้งหมด)" value={`${log.bananaTotal}`} />}
              {log.yieldBunches != null && <LogRow label="เครือกล้วย" value={`${log.yieldBunches}`} />}
              {log.status && <LogRow label="สถานะ" value={log.status} />}
              {log.flowering && <LogRow label="การออกดอก" value={log.flowering} />}
              {log.recorder && <LogRow label="ผู้บันทึก" value={log.recorder} />}
              {log.lastEditedBy && log.lastEditedBy !== log.recorder && (
                <LogRow
                  label="แก้ไขล่าสุดโดย"
                  value={`${log.lastEditedBy} · ${formatTimestamp(log.timestamp)}`}
                  highlight
                />
              )}
              {log.note && <LogRow label="หมายเหตุ" value={log.note} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LogRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 text-xs w-28 flex-shrink-0">{label}</span>
      <span className={`text-xs ${highlight ? "text-amber-600 font-medium" : "text-gray-700"}`}>
        {value}
      </span>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// Trees tab
// ---------------------------------------------------------------------------

function TreesTab({ trees }: { trees: TreeProfile[] }) {
  if (trees.length === 0) {
    return <EmptyState label="ยังไม่มีข้อมูลต้นไม้" />;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2">{trees.length} ต้น</p>
      {trees.map((tree) => (
        <div
          key={tree.treeCode}
          className="rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs font-medium text-gray-800">{tree.treeCode}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {tree.speciesName ?? tree.speciesGroup ?? "—"}
            {tree.tagLabel ? ` · ${tree.tagLabel}` : ""}
          </p>
          {(tree.lat != null || tree.utmX != null) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {tree.lat != null
                ? `${tree.lat.toFixed(5)}, ${(tree.lng ?? 0).toFixed(5)}`
                : `UTM: ${tree.utmX}, ${tree.utmY}`}
            </p>
          )}
          {(tree.rowMain || tree.rowSub) && (
            <p className="text-xs text-gray-400">
              แถว: {tree.rowMain ?? "—"}{tree.rowSub ? ` / ${tree.rowSub}` : ""}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Images tab
// ---------------------------------------------------------------------------

function ImagesTab({
  images,
  onImageClick,
}: {
  images: PlotImage[];
  onImageClick: (url: string) => void;
}) {
  if (images.length === 0) {
    return <EmptyState label="ยังไม่มีรูปภาพ" />;
  }

  // Group by imageType
  const grouped = images.reduce<Record<string, PlotImage[]>>((acc, img) => {
    const key = img.imageType ?? "ทั่วไป";
    if (!acc[key]) acc[key] = [];
    acc[key].push(img);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    plan_pre_1: "แผนผังก่อนปลูก",
    plan_post_1: "แผนผังหลังปลูก",
    gallery: "แกลเลอรี",
    ทั่วไป: "ทั่วไป",
  };

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, imgs]) => (
        <div key={type}>
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            {typeLabels[type] ?? type}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {imgs.map((img) => (
              <button
                key={img.imageId}
                type="button"
                onClick={() => onImageClick(img.url)}
                className="group relative rounded-lg overflow-hidden border border-gray-100 hover:border-green-300 transition-colors aspect-square bg-gray-100"
                title={img.description ?? img.imageId}
              >
                <img
                  src={img.url}
                  alt={img.description ?? img.imageType ?? "ภาพแปลง"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'%3E%3Cpath d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 14H6l2.5-3.21 1.79 2.15L13 12.5l5 4.5z'/%3E%3C/svg%3E";
                  }}
                />
                {img.description && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spacing tab
// ---------------------------------------------------------------------------

function SpacingTab({ logs }: { logs: SpacingLog[] }) {
  if (logs.length === 0) {
    return <EmptyState label="ยังไม่มีข้อมูลระยะห่าง" />;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2">{logs.length} การสำรวจ</p>
      {logs.map((log) => (
        <div
          key={log.spacingId}
          className="rounded-lg border border-gray-100 px-3 py-3 space-y-1 hover:bg-gray-50 transition-colors"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-800">
              {log.date ?? log.spacingId}
            </span>
            {log.treeCount != null && (
              <span className="text-[10px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 font-medium">
                {log.treeCount} ต้น
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {log.avgSpacing != null && (
              <SpacingMetric label="เฉลี่ย" value={`${log.avgSpacing} ม.`} />
            )}
            {log.minSpacing != null && (
              <SpacingMetric label="ต่ำสุด" value={`${log.minSpacing} ม.`} />
            )}
            {log.maxSpacing != null && (
              <SpacingMetric label="สูงสุด" value={`${log.maxSpacing} ม.`} />
            )}
          </div>
          {log.note && <p className="text-xs text-gray-400 mt-1">{log.note}</p>}
        </div>
      ))}
    </div>
  );
}

function SpacingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-xs font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-3xl mb-2">📭</span>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

export default PlotPanel;
