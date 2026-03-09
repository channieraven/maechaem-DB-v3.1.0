/**
 * growth-logs.ts — API routes for tree growth log data.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   addGrowthLog  → POST /api/growth-logs  (upsert by log_id)
 *
 * Endpoints:
 *   GET  /api/growth-logs              → all growth logs (optionally filter by plot_code)
 *   GET  /api/growth-logs/:logId       → single log entry
 *   POST /api/growth-logs              → create or update a growth log
 *   POST /api/growth-logs/import       → bulk import from CSV (requires auth)
 *   PUT  /api/growth-logs/:logId       → edit a single log entry (requires auth)
 *   DELETE /api/growth-logs/:logId     → delete a growth log entry
 */
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../../db/db";
import { growthLogs } from "../../db/schema";
import type { Env } from "../../db/db";

export const growthLogsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/growth-logs[?plot_code=xxx&target_sheet=xxx]
// ---------------------------------------------------------------------------
growthLogsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const plotCode = c.req.query("plot_code");
  const targetSheet = c.req.query("target_sheet");

  try {
    let rows;
    if (plotCode && targetSheet) {
      rows = await db
        .select()
        .from(growthLogs)
        .where(
          sql`${growthLogs.plotCode} = ${plotCode} AND ${growthLogs.targetSheet} = ${targetSheet}`
        )
        .orderBy(growthLogs.timestamp);
    } else if (plotCode) {
      rows = await db
        .select()
        .from(growthLogs)
        .where(eq(growthLogs.plotCode, plotCode))
        .orderBy(growthLogs.timestamp);
    } else if (targetSheet) {
      rows = await db
        .select()
        .from(growthLogs)
        .where(eq(growthLogs.targetSheet, targetSheet))
        .orderBy(growthLogs.timestamp);
    } else {
      rows = await db.select().from(growthLogs).orderBy(growthLogs.timestamp);
    }

    return c.json({ ok: true, data: rows });
  } catch (err) {
    console.error("GET /api/growth-logs error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดบันทึกการเจริญเติบโตได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/growth-logs/import
// Bulk import from CSV upload (multipart/form-data).
// Fields: file (.txt/.csv), survey_date (string), plot_code (optional)
// Caller email is read from the x-user-email header (set by auth middleware).
// ---------------------------------------------------------------------------
growthLogsRouter.post("/import", async (c) => {
  const editorEmail = (c.get("userEmail") as string | undefined) ?? "unknown";

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ ok: false, error: "Invalid form data", status: 400 }, 400);
  }

  const file = formData.get("file") as File | null;
  const surveyDate = (formData.get("survey_date") as string | null) ?? "";
  const plotCodeOverride = (formData.get("plot_code") as string | null) ?? null;

  if (!file) {
    return c.json({ ok: false, error: "No file uploaded", status: 400 }, 400);
  }
  if (!surveyDate) {
    return c.json({ ok: false, error: "survey_date is required", status: 400 }, 400);
  }

  const text = await file.text();
  const parseResult = parseCsvText(text);

  if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
    return c.json(
      { ok: false, error: parseResult.errors.join("; "), status: 400 },
      400
    );
  }

  const db = createDb(c.env);
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [...parseResult.errors];

  for (const row of parseResult.rows) {
    if (!row.treeCode) {
      errors.push(`ข้ามแถว: ไม่มีรหัสต้นไม้ (${row.tagLabel ?? "ไม่ระบุ"})`);
      continue;
    }

    // Derive plot code: first 3 chars of tree code (e.g. "P05A20001" → "P05")
    const plotCode =
      plotCodeOverride ?? derivePlotCode(row.treeCode);
    const logId = `${row.treeCode}_${surveyDate.replace(/[^0-9A-Za-z-]/g, "")}`;

    const values = {
      logId,
      treeCode: row.treeCode,
      tagLabel: row.tagLabel,
      plotCode,
      speciesName: row.speciesName,
      treeNumber: row.treeNumber,
      heightM: row.heightM,
      dbhCm: row.dbhCm,
      bambooCulms: row.bambooCulms,
      dbh1Cm: row.bambooDiamCm,
      flowering: row.flowering,
      note: buildNote(row.plantingSpacing, row.note),
      recorder: editorEmail,
      surveyDate,
      targetSheet: "growth_logs" as const,
      timestamp: new Date(),
      lastEditedBy: editorEmail,
    };

    try {
      const existing = await db
        .select({ id: growthLogs.id })
        .from(growthLogs)
        .where(eq(growthLogs.logId, logId));

      if (existing.length > 0) {
        await db
          .update(growthLogs)
          .set(values)
          .where(eq(growthLogs.logId, logId));
        updated++;
      } else {
        await db.insert(growthLogs).values(values);
        inserted++;
      }
    } catch (err) {
      errors.push(
        `${row.treeCode}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return c.json({ ok: true, data: { inserted, updated, skipped: 0, errors, importedBy: editorEmail } });
});

// ---------------------------------------------------------------------------
// GET /api/growth-logs/:logId
// ---------------------------------------------------------------------------
growthLogsRouter.get("/:logId", async (c) => {
  const logId = c.req.param("logId");
  const db = createDb(c.env);

  try {
    const rows = await db
      .select()
      .from(growthLogs)
      .where(eq(growthLogs.logId, logId));

    if (!rows[0]) {
      return c.json({ ok: false, error: "Growth log not found", status: 404 }, 404);
    }

    return c.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("GET /api/growth-logs/:logId error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดบันทึกการเจริญเติบโตได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/growth-logs  — create or update (upsert by log_id)
// Mirrors the v1.0.1 addGrowthLog() behaviour: if log_id exists → update,
// otherwise → insert with a generated log_id.
// ---------------------------------------------------------------------------
growthLogsRouter.post("/", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body", status: 400 }, 400);
  }
  const db = createDb(c.env);

  const logId = (body.log_id as string | undefined) ?? `LOG_${Date.now()}`;
  const targetSheet =
    (body.target_sheet as string | undefined) ?? "growth_logs";

  const values = {
    logId,
    treeCode: (body.tree_code as string) ?? "",
    tagLabel: (body.tag_label as string | null) ?? null,
    plotCode: (body.plot_code as string) ?? "",
    speciesCode: (body.species_code as string | null) ?? null,
    speciesGroup: (body.species_group as string | null) ?? null,
    speciesName: (body.species_name as string | null) ?? null,
    treeNumber: body.tree_number != null ? Number(body.tree_number) : null,
    rowMain: (body.row_main as string | null) ?? null,
    rowSub: (body.row_sub as string | null) ?? null,
    heightM: body.height_m != null ? Number(body.height_m) : null,
    status: (body.status as string | null) ?? null,
    flowering: (body.flowering as string | null) ?? null,
    note: (body.note as string | null) ?? null,
    recorder: (body.recorder as string | null) ?? null,
    surveyDate: (body.survey_date as string | null) ?? null,
    dbhCm: body.dbh_cm != null ? Number(body.dbh_cm) : null,
    bambooCulms: body.bamboo_culms != null ? Number(body.bamboo_culms) : null,
    dbh1Cm: body.dbh_1_cm != null ? Number(body.dbh_1_cm) : null,
    dbh2Cm: body.dbh_2_cm != null ? Number(body.dbh_2_cm) : null,
    dbh3Cm: body.dbh_3_cm != null ? Number(body.dbh_3_cm) : null,
    bananaTotal: body.banana_total != null ? Number(body.banana_total) : null,
    banana1yr: body.banana_1yr != null ? Number(body.banana_1yr) : null,
    yieldBunches: body.yield_bunches != null ? Number(body.yield_bunches) : null,
    yieldHands: body.yield_hands != null ? Number(body.yield_hands) : null,
    pricePerHand: body.price_per_hand != null ? Number(body.price_per_hand) : null,
    targetSheet,
    timestamp: new Date(),
  };

  try {
    // Check if a record with this log_id already exists
    const existing = await db
      .select({ id: growthLogs.id })
      .from(growthLogs)
      .where(eq(growthLogs.logId, logId));

    if (existing.length > 0) {
      await db
        .update(growthLogs)
        .set(values)
        .where(eq(growthLogs.logId, logId));
      return c.json({ ok: true, action: "updated", logId });
    }

    await db.insert(growthLogs).values(values);
    return c.json({ ok: true, action: "appended", logId }, 201);
  } catch (err) {
    console.error("POST /api/growth-logs error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถบันทึกข้อมูลการเจริญเติบโตได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/growth-logs/:logId  — edit a single log entry with user tracking.
// Caller email is read from the x-user-email header (set by auth middleware).
// ---------------------------------------------------------------------------
growthLogsRouter.put("/:logId", async (c) => {
  const logId = c.req.param("logId");
  const editorEmail = (c.get("userEmail") as string | undefined) ?? "unknown";
  const db = createDb(c.env);

  try {
    const existing = await db
      .select({ id: growthLogs.id })
      .from(growthLogs)
      .where(eq(growthLogs.logId, logId));

    if (existing.length === 0) {
      return c.json({ ok: false, error: "Growth log not found", status: 404 }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json({ ok: false, error: "Invalid JSON body", status: 400 }, 400);
    }

    const patch: Partial<typeof growthLogs.$inferInsert> = {
      timestamp: new Date(),
      lastEditedBy: editorEmail,
    };

    if (body.height_m !== undefined)
      patch.heightM = body.height_m != null ? Number(body.height_m) : null;
    if (body.dbh_cm !== undefined)
      patch.dbhCm = body.dbh_cm != null ? Number(body.dbh_cm) : null;
    if (body.bamboo_culms !== undefined)
      patch.bambooCulms = body.bamboo_culms != null ? Number(body.bamboo_culms) : null;
    if (body.dbh_1_cm !== undefined)
      patch.dbh1Cm = body.dbh_1_cm != null ? Number(body.dbh_1_cm) : null;
    if (body.flowering !== undefined)
      patch.flowering = (body.flowering as string | null) ?? null;
    if (body.note !== undefined)
      patch.note = (body.note as string | null) ?? null;
    if (body.status !== undefined)
      patch.status = (body.status as string | null) ?? null;
    if (body.survey_date !== undefined)
      patch.surveyDate = (body.survey_date as string | null) ?? null;
    if (body.recorder !== undefined)
      patch.recorder = (body.recorder as string | null) ?? null;

    await db.update(growthLogs).set(patch).where(eq(growthLogs.logId, logId));

    return c.json({ ok: true, action: "updated", logId, lastEditedBy: editorEmail });
  } catch (err) {
    console.error("PUT /api/growth-logs/:logId error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถแก้ไขบันทึกการเจริญเติบโตได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/growth-logs/:logId
// ---------------------------------------------------------------------------
growthLogsRouter.delete("/:logId", async (c) => {
  const logId = c.req.param("logId");
  const db = createDb(c.env);

  try {
    const result = await db
      .delete(growthLogs)
      .where(eq(growthLogs.logId, logId))
      .returning({ id: growthLogs.id });

    if (result.length === 0) {
      return c.json({ ok: false, error: "Growth log not found", status: 404 }, 404);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/growth-logs/:logId error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถลบบันทึกการเจริญเติบโตได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract plot code from tree code. "P05A20001" → "P05" */
function derivePlotCode(treeCode: string): string {
  const m = treeCode.match(/^(P\d{2})/i);
  return m?.[1]?.toUpperCase() ?? treeCode.slice(0, 3);
}

/** Combine planting spacing and free-form note into a single note string. */
function buildNote(spacing: string | null, note: string | null): string | null {
  const parts: string[] = [];
  if (spacing) parts.push(`ระยะปลูก: ${spacing}`);
  if (note) parts.push(note);
  return parts.length > 0 ? parts.join(" | ") : null;
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

interface CsvRow {
  treeNumber: number | null;
  tagLabel: string | null;
  treeCode: string;
  speciesName: string | null;
  plantingSpacing: string | null;
  dbhCm: number | null;
  bambooCulms: number | null;
  bambooDiamCm: number | null;
  heightM: number | null;
  flowering: string | null;
  note: string | null;
}

interface ParseResult {
  rows: CsvRow[];
  errors: string[];
}

/**
 * Parse the CSV text (Thai-column tree measurement format) into row objects.
 *
 * Expected header (column names in Thai):
 *   ต้นที่,เลขแท็กต้นไม้,เลขรหัสต้นไม้,ชนิดพันธุ์,ระยะปลูก,
 *   ความโตที่ระดับคอราก_ซม,ไผ่_จำนวนลำ,ไผ่_ความโต_ซม,
 *   ความสูง_ม,การติดดอกออกผล,หมายเหตุ
 */
function parseCsvText(text: string): ParseResult {
  const errors: string[] = [];
  const rows: CsvRow[] = [];

  // Normalise line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    errors.push("ไฟล์ CSV ต้องมีอย่างน้อย 2 บรรทัด (header + ข้อมูล)");
    return { rows, errors };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    errors.push("ไม่พบ header row");
    return { rows, errors };
  }
  const headers = splitCsvLine(headerLine).map((h) => h.trim());

  // Column index lookup (case-insensitive, trimmed)
  function idx(name: string): number {
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
    errors.push(
      "ไม่พบคอลัมน์ 'เลขรหัสต้นไม้' ในไฟล์ — ตรวจสอบ header row"
    );
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;

    const cols = splitCsvLine(line);
    const get = (ci: number): string =>
      ci >= 0 ? (cols[ci] ?? "").trim() : "";
    const getNum = (ci: number): number | null => {
      const v = get(ci);
      if (!v) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    const treeCode = get(COL.treeCode);
    if (!treeCode) {
      errors.push(`แถว ${i + 1}: ไม่มีรหัสต้นไม้ — ข้ามแถว`);
      continue;
    }

    rows.push({
      treeNumber:
        COL.treeNumber >= 0
          ? (() => {
              const v = get(COL.treeNumber);
              const n = parseInt(v, 10);
              return isNaN(n) ? null : n;
            })()
          : null,
      tagLabel: get(COL.tagLabel) || null,
      treeCode,
      speciesName: get(COL.speciesName) || null,
      plantingSpacing: get(COL.spacing) || null,
      dbhCm: getNum(COL.dbhCm),
      bambooCulms:
        COL.bambooCulms >= 0
          ? (() => {
              const v = get(COL.bambooCulms);
              const n = parseInt(v, 10);
              return isNaN(n) ? null : n;
            })()
          : null,
      bambooDiamCm: getNum(COL.bambooDiam),
      heightM: getNum(COL.heightM),
      flowering: get(COL.flowering) || null,
      note: get(COL.note) || null,
    });
  }

  return { rows, errors };
}

/**
 * Split a single CSV line respecting quoted fields.
 * Handles simple quoting — does not handle escaped quotes inside quoted fields.
 */
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
