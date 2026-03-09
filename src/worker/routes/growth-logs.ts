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
});

// ---------------------------------------------------------------------------
// GET /api/growth-logs/:logId
// ---------------------------------------------------------------------------
growthLogsRouter.get("/:logId", async (c) => {
  const logId = c.req.param("logId");
  const db = createDb(c.env);

  const rows = await db
    .select()
    .from(growthLogs)
    .where(eq(growthLogs.logId, logId));

  if (!rows[0]) {
    return c.json({ ok: false, error: "Growth log not found", status: 404 }, 404);
  }

  return c.json({ ok: true, data: rows[0] });
});

// ---------------------------------------------------------------------------
// POST /api/growth-logs  — create or update (upsert by log_id)
// Mirrors the v1.0.1 addGrowthLog() behaviour: if log_id exists → update,
// otherwise → insert with a generated log_id.
// ---------------------------------------------------------------------------
growthLogsRouter.post("/", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
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
});

// ---------------------------------------------------------------------------
// DELETE /api/growth-logs/:logId
// ---------------------------------------------------------------------------
growthLogsRouter.delete("/:logId", async (c) => {
  const logId = c.req.param("logId");
  const db = createDb(c.env);

  const result = await db
    .delete(growthLogs)
    .where(eq(growthLogs.logId, logId))
    .returning({ id: growthLogs.id });

  if (result.length === 0) {
    return c.json({ ok: false, error: "Growth log not found", status: 404 }, 404);
  }

  return c.json({ ok: true });
});
