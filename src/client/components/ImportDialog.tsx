/**
 * ImportDialog.tsx — Modal dialog for uploading a tree measurement CSV file.
 *
 * Flow:
 *  1. User selects a .txt / .csv file from their device.
 *  2. The file is parsed client-side and a preview table is shown.
 *  3. User sets a survey date (month/year) and optionally a plot code override.
 *  4. Clicking "นำเข้าข้อมูล" sends the file + metadata to POST /api/growth-logs/import.
 *  5. Results (inserted / updated / errors) are displayed.
 */
import { useState, useRef, useCallback } from "react";
import type { ImportPreviewRow, ImportResult, ApiResponse } from "../../shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportDialogProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// CSV parser (client-side preview)
// ---------------------------------------------------------------------------

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsvPreview(text: string): {
  rows: ImportPreviewRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: ImportPreviewRow[] = [];

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    errors.push("ไฟล์ต้องมีอย่างน้อย 2 บรรทัด (header + ข้อมูล)");
    return { rows, errors };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    errors.push("ไม่พบ header row");
    return { rows, errors };
  }
  const headers = splitCsvLine(headerLine).map((h) => h.trim());

  function idx(name: string) {
    return headers.findIndex((h) => h === name);
  }

  const COL = {
    treeNumber: idx("ต้นที่"),
    tagLabel: idx("เลขแท็กต้นไม้"),
    treeCode: idx("เลขรหัสต้นไม้"),
    speciesName: idx("ชนิดพันธุ์"),
    spacing: idx("ระยะปลูก"),
    dbhCm: idx("ความโตที่ระดับคอราก_ซม"),
    bambooCulms: idx("ไผ่_จำนวนลำ"),
    bambooDiam: idx("ไผ่_ความโต_ซม"),
    heightM: idx("ความสูง_ม"),
    flowering: idx("การติดดอกออกผล"),
    note: idx("หมายเหตุ"),
  };

  if (COL.treeCode === -1) {
    errors.push("ไม่พบคอลัมน์ 'เลขรหัสต้นไม้' — ตรวจสอบ header row ของไฟล์");
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;

    const cols = splitCsvLine(line);
    const get = (ci: number) => (ci >= 0 ? (cols[ci] ?? "").trim() : "");
    const getNum = (ci: number): number | null => {
      const v = get(ci);
      if (!v) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const getInt = (ci: number): number | null => {
      const v = get(ci);
      if (!v) return null;
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    };

    const treeCode = get(COL.treeCode);
    if (!treeCode) {
      errors.push(`แถว ${i + 1}: ไม่มีรหัสต้นไม้ — ข้ามแถว`);
      continue;
    }

    rows.push({
      treeNumber: getInt(COL.treeNumber),
      tagLabel: get(COL.tagLabel) || null,
      treeCode,
      speciesName: get(COL.speciesName) || null,
      plantingSpacing: get(COL.spacing) || null,
      dbhCm: getNum(COL.dbhCm),
      bambooCulms: getInt(COL.bambooCulms),
      bambooDiamCm: getNum(COL.bambooDiam),
      heightM: getNum(COL.heightM),
      flowering: get(COL.flowering) || null,
      note: get(COL.note) || null,
    });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportDialog({ onClose }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [surveyDate, setSurveyDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [plotCodeOverride, setPlotCodeOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) return;
      setFile(f);
      setResult(null);
      setSubmitError(null);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const { rows, errors } = parseCsvPreview(text);
        setPreview(rows);
        setParseErrors(errors);
      };
      reader.readAsText(f, "utf-8");
    },
    []
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      fileInputRef.current.files = dt.files;
    }
    setFile(f);
    setResult(null);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { rows, errors } = parseCsvPreview(text);
      setPreview(rows);
      setParseErrors(errors);
    };
    reader.readAsText(f, "utf-8");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file || preview.length === 0) return;
    if (!surveyDate) {
      setSubmitError("กรุณาระบุวันที่สำรวจ");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("survey_date", surveyDate);
      if (plotCodeOverride.trim()) {
        form.append("plot_code", plotCodeOverride.trim());
      }

      const res = await fetch("/api/growth-logs/import", {
        method: "POST",
        body: form,
        credentials: "include",
      });

      const json: ApiResponse<ImportResult> = await res.json();
      if (json.ok) {
        setResult(json.data);
      } else {
        setSubmitError(json.error ?? "นำเข้าข้อมูลไม่สำเร็จ");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }, [file, preview.length, surveyDate, plotCodeOverride]);

  const canSubmit =
    file !== null && preview.length > 0 && !submitting && result === null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">
              📤 นำเข้าข้อมูลต้นไม้ (CSV)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              อัพโหลดไฟล์ .txt หรือ .csv ที่มีข้อมูลการวัดต้นไม้
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl"
            aria-label="ปิด"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file
                ? "border-green-400 bg-green-50"
                : "border-gray-200 hover:border-green-400 hover:bg-green-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">📄</span>
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {preview.length} แถวข้อมูล · คลิกเพื่อเปลี่ยนไฟล์
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">📂</span>
                <p className="text-sm text-gray-500">
                  ลากไฟล์มาวาง หรือ{" "}
                  <span className="text-green-700 font-medium">คลิกเพื่อเลือกไฟล์</span>
                </p>
                <p className="text-xs text-gray-400">รองรับ .txt และ .csv</p>
              </div>
            )}
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">⚠ คำเตือน</p>
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600">
                  {e}
                </p>
              ))}
            </div>
          )}

          {/* Metadata */}
          {file && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  วันที่สำรวจ (เดือน/ปี) <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  รหัสแปลง (ไม่บังคับ — ดึงจากรหัสต้นไม้อัตโนมัติ)
                </label>
                <input
                  type="text"
                  value={plotCodeOverride}
                  onChange={(e) => setPlotCodeOverride(e.target.value)}
                  placeholder="เช่น P05"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                ตัวอย่างข้อมูล ({preview.length} แถว)
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">
                        รหัสต้นไม้
                      </th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">
                        แท็ก
                      </th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">
                        ชนิดพันธุ์
                      </th>
                      <th className="px-2 py-1.5 text-right text-gray-500 font-medium whitespace-nowrap">
                        ความโต (ซม.)
                      </th>
                      <th className="px-2 py-1.5 text-right text-gray-500 font-medium whitespace-nowrap">
                        ลำไผ่
                      </th>
                      <th className="px-2 py-1.5 text-right text-gray-500 font-medium whitespace-nowrap">
                        ความสูง (ม.)
                      </th>
                      <th className="px-2 py-1.5 text-center text-gray-500 font-medium whitespace-nowrap">
                        ดอก/ผล
                      </th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">
                        หมายเหตุ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-2 py-1.5 text-gray-800 font-mono font-medium whitespace-nowrap">
                          {row.treeCode}
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap max-w-[120px] truncate">
                          {row.tagLabel ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                          {row.speciesName ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-700">
                          {row.dbhCm ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-700">
                          {row.bambooCulms ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-700">
                          {row.heightM ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center text-gray-700">
                          {row.flowering ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 max-w-[120px] truncate">
                          {row.note ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-2 py-2 text-center text-xs text-gray-400"
                        >
                          … และอีก {preview.length - 50} แถว (แสดง 50 แถวแรก)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs text-red-600">❌ {submitError}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-green-800">
                ✅ นำเข้าข้อมูลสำเร็จ
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-green-100 p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{result.inserted}</p>
                  <p className="text-xs text-gray-500">เพิ่มใหม่</p>
                </div>
                <div className="bg-white rounded-lg border border-green-100 p-3 text-center">
                  <p className="text-lg font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-gray-500">อัปเดต</p>
                </div>
                <div className="bg-white rounded-lg border border-green-100 p-3 text-center">
                  <p className="text-lg font-bold text-gray-500">{result.skipped}</p>
                  <p className="text-xs text-gray-500">ข้าม</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs font-medium text-amber-700">⚠ ข้อผิดพลาดบางแถว:</p>
                  {result.errors.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-xs text-amber-600">
                      {e}
                    </p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-xs text-gray-400">
                      … และอีก {result.errors.length - 10} ข้อผิดพลาด
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            {preview.length > 0
              ? `${preview.length} แถวพร้อมนำเข้า`
              : "ยังไม่ได้เลือกไฟล์"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {result ? "ปิด" : "ยกเลิก"}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังนำเข้า…
                  </>
                ) : (
                  "📥 นำเข้าข้อมูล"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;
