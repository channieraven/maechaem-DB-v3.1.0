/**
 * spacing-logs.ts — API routes for inter-tree spacing survey data.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   addSpacingLog → POST /api/spacing-logs
 *
 * Endpoints:
 *   GET  /api/spacing-logs[?plot_code=xxx]  → list spacing logs
 *   POST /api/spacing-logs                  → record a new spacing survey
 *   DELETE /api/spacing-logs/:spacingId     → delete a spacing log
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { spacingLogs } from "../../db/schema";
import type { Env } from "../../db/db";

export const spacingLogsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/spacing-logs[?plot_code=xxx]
// ---------------------------------------------------------------------------
spacingLogsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const plotCode = c.req.query("plot_code");

  const rows = plotCode
    ? await db
        .select()
        .from(spacingLogs)
        .where(eq(spacingLogs.plotCode, plotCode))
        .orderBy(spacingLogs.timestamp)
    : await db.select().from(spacingLogs).orderBy(spacingLogs.timestamp);

  return c.json({ ok: true, data: rows });
});

// ---------------------------------------------------------------------------
// POST /api/spacing-logs  (mirrors addSpacingLog)
// ---------------------------------------------------------------------------
spacingLogsRouter.post("/", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const db = createDb(c.env);

  const spacingId = `SPC_${Date.now()}`;
  const values = {
    spacingId,
    plotCode: (body.plot_code as string) ?? "",
    avgSpacing: body.avg_spacing != null ? Number(body.avg_spacing) : null,
    minSpacing: body.min_spacing != null ? Number(body.min_spacing) : null,
    maxSpacing: body.max_spacing != null ? Number(body.max_spacing) : null,
    treeCount: body.tree_count != null ? Number(body.tree_count) : null,
    note: (body.note as string | null) ?? null,
    date: (body.date as string | null) ?? null,
    timestamp: new Date(),
  };

  await db.insert(spacingLogs).values(values);
  return c.json({ ok: true, id: spacingId }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /api/spacing-logs/:spacingId
// ---------------------------------------------------------------------------
spacingLogsRouter.delete("/:spacingId", async (c) => {
  const spacingId = c.req.param("spacingId");
  const db = createDb(c.env);

  const result = await db
    .delete(spacingLogs)
    .where(eq(spacingLogs.spacingId, spacingId))
    .returning({ id: spacingLogs.id });

  if (result.length === 0) {
    return c.json({ ok: false, error: "Spacing log not found", status: 404 }, 404);
  }

  return c.json({ ok: true });
});
