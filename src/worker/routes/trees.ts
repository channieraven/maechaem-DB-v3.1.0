/**
 * trees.ts — API routes for tree profile / coordinate data.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   addTreeProfile → POST /api/trees  (upsert by tree_code)
 *
 * Endpoints:
 *   GET  /api/trees                    → all tree profiles (filter by ?plot_code=xxx)
 *   GET  /api/trees/:treeCode          → single tree profile
 *   POST /api/trees                    → create or update a tree profile
 *   DELETE /api/trees/:treeCode        → delete a tree profile
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { treesProfile } from "../../db/schema";
import type { Env } from "../../db/db";

export const treesRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/trees[?plot_code=xxx]
// ---------------------------------------------------------------------------
treesRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const plotCode = c.req.query("plot_code");

  try {
    const rows = plotCode
      ? await db
          .select()
          .from(treesProfile)
          .where(eq(treesProfile.plotCode, plotCode))
          .orderBy(treesProfile.treeCode)
      : await db.select().from(treesProfile).orderBy(treesProfile.treeCode);

    return c.json({ ok: true, data: rows });
  } catch (err) {
    console.error("GET /api/trees error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดข้อมูลต้นไม้ได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/trees/:treeCode
// ---------------------------------------------------------------------------
treesRouter.get("/:treeCode", async (c) => {
  const treeCode = c.req.param("treeCode");
  const db = createDb(c.env);

  try {
    const rows = await db
      .select()
      .from(treesProfile)
      .where(eq(treesProfile.treeCode, treeCode));

    if (!rows[0]) {
      return c.json({ ok: false, error: "Tree not found", status: 404 }, 404);
    }

    return c.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("GET /api/trees/:treeCode error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดข้อมูลต้นไม้ได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/trees  — upsert by tree_code (mirrors addTreeProfile)
// ---------------------------------------------------------------------------
treesRouter.post("/", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body", status: 400 }, 400);
  }
  const db = createDb(c.env);

  const treeCode = body.tree_code as string;
  if (!treeCode) {
    return c.json({ ok: false, error: "tree_code is required", status: 400 }, 400);
  }

  const values = {
    treeCode,
    tagLabel: (body.tag_label as string | null) ?? null,
    plotCode: (body.plot_code as string) ?? "",
    speciesCode: (body.species_code as string | null) ?? null,
    speciesGroup: (body.species_group as string | null) ?? null,
    speciesName: (body.species_name as string | null) ?? null,
    treeNumber: body.tree_number != null ? Number(body.tree_number) : null,
    rowMain: (body.row_main as string | null) ?? null,
    rowSub: (body.row_sub as string | null) ?? null,
    utmX: body.utm_x != null ? Number(body.utm_x) : null,
    utmY: body.utm_y != null ? Number(body.utm_y) : null,
    lat: body.lat != null ? Number(body.lat) : null,
    lng: body.lng != null ? Number(body.lng) : null,
    note: (body.note as string | null) ?? null,
    updatedAt: new Date(),
  };

  try {
    const existing = await db
      .select({ id: treesProfile.id })
      .from(treesProfile)
      .where(eq(treesProfile.treeCode, treeCode));

    if (existing.length > 0) {
      await db
        .update(treesProfile)
        .set(values)
        .where(eq(treesProfile.treeCode, treeCode));
      return c.json({ ok: true, action: "updated", treeCode });
    }

    await db.insert(treesProfile).values(values);
    return c.json({ ok: true, action: "appended", treeCode }, 201);
  } catch (err) {
    console.error("POST /api/trees error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถบันทึกข้อมูลต้นไม้ได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/trees/:treeCode
// ---------------------------------------------------------------------------
treesRouter.delete("/:treeCode", async (c) => {
  const treeCode = c.req.param("treeCode");
  const db = createDb(c.env);

  try {
    const result = await db
      .delete(treesProfile)
      .where(eq(treesProfile.treeCode, treeCode))
      .returning({ id: treesProfile.id });

    if (result.length === 0) {
      return c.json({ ok: false, error: "Tree not found", status: 404 }, 404);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/trees/:treeCode error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถลบข้อมูลต้นไม้ได้", status: 500 },
      500
    );
  }
});
