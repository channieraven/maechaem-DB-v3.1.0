/**
 * plots.ts — API route for agroforestry plot data.
 *
 * Endpoints:
 *   GET /api/plots          → GeoJSON FeatureCollection of all plots
 *   GET /api/plots/:id      → Full detail for a single plot
 *
 * Responses are automatically cached at Cloudflare's edge using the
 * Cache-Control header so repeated requests don't hit the database.
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { plots } from "../../db/schema";
import type { Env } from "../../db/db";
import type {
  GeoJsonFeatureCollection,
  GeoJsonFeature,
  PlotProperties,
  PlotDetail,
} from "../../shared/types";

export const plotsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/plots
// Returns a GeoJSON FeatureCollection of all plots (geometries + properties).
// ---------------------------------------------------------------------------
plotsRouter.get("/", async (c) => {
  const db = createDb(c.env);

  const rows = await db
    .select()
    .from(plots)
    .orderBy(plots.plotCode);

  const features: GeoJsonFeature<PlotProperties>[] = rows.map((row) => ({
    type: "Feature",
    id: row.id,
    geometry: row.geometry as import("../../shared/types").GeoJsonGeometry,
    properties: {
      id: row.id,
      plotCode: row.plotCode,
      village: row.village ?? null,
      ownerName: row.ownerName ?? null,
      areaRai: row.areaRai ?? null,
      areaHa: row.areaHa ?? null,
      systemType: row.systemType ?? null,
      dominantSpecies: row.dominantSpecies ?? null,
      establishedYear: row.establishedYear ?? null,
    },
  }));

  const collection: GeoJsonFeatureCollection<PlotProperties> = {
    type: "FeatureCollection",
    features,
  };

  // Cache for 60 seconds at the edge (adjust as needed).
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");
  return c.json({ ok: true, data: collection });
});

// ---------------------------------------------------------------------------
// GET /api/plots/:id
// Returns full detail (including timestamps) for a single plot.
// ---------------------------------------------------------------------------
plotsRouter.get("/:id", async (c) => {
  const rawId = c.req.param("id");
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return c.json({ ok: false, error: "Invalid plot ID", status: 400 }, 400);
  }

  const db = createDb(c.env);
  const [row] = await db.select().from(plots).where(eq(plots.id, id));

  if (!row) {
    return c.json({ ok: false, error: "Plot not found", status: 404 }, 404);
  }

  const detail: PlotDetail = {
    id: row.id,
    plotCode: row.plotCode,
    village: row.village ?? null,
    ownerName: row.ownerName ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geometry: row.geometry as any,
    areaRai: row.areaRai ?? null,
    areaHa: row.areaHa ?? null,
    systemType: row.systemType ?? null,
    dominantSpecies: row.dominantSpecies ?? null,
    establishedYear: row.establishedYear ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  c.header("Cache-Control", "public, max-age=60, s-maxage=300");
  return c.json({ ok: true, data: detail });
});
