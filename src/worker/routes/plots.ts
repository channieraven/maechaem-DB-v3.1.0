/**
 * plots.ts — API route for agroforestry plot data.
 *
 * Endpoints:
 *   GET /api/plots          → GeoJSON FeatureCollection of all plots
 *   GET /api/plots/:id      → Full detail for a single plot
 *
 * Queries the `plot_boundary_plan` table (migrated from v3.0.0) which uses
 * PostGIS geometry. ST_AsGeoJSON converts the PostGIS geom to GeoJSON.
 *
 * Responses are automatically cached at Cloudflare's edge using the
 * Cache-Control header so repeated requests don't hit the database.
 */
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb } from "../../db/db";
import type { Env } from "../../db/db";
import type {
  GeoJsonFeatureCollection,
  GeoJsonFeature,
  GeoJsonGeometry,
  PlotProperties,
  PlotDetail,
} from "../../shared/types";

export const plotsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/plots
// Returns a GeoJSON FeatureCollection of all plots with PostGIS geometry.
// ---------------------------------------------------------------------------
plotsRouter.get("/", async (c) => {
  const db = createDb(c.env);

  try {
    const rows = await db.execute(sql`
      SELECT
        id,
        farmer_name,
        plot_code,
        group_number,
        area_rai,
        area_sqm,
        tambon,
        elev_mean,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM plot_boundary_plan
      WHERE geom IS NOT NULL
      ORDER BY plot_code
    `);

    const features: GeoJsonFeature<PlotProperties>[] = rows.map((row) => ({
      type: "Feature",
      id: row.id as number,
      geometry: row.geometry as GeoJsonGeometry,
      properties: {
        id: row.id as number,
        plotCode: row.plot_code as string,
        farmerName: (row.farmer_name as string | null) ?? null,
        groupNumber: (row.group_number as string | null) ?? null,
        areaRai: row.area_rai != null ? Number(row.area_rai) : null,
        areaSqm: row.area_sqm != null ? Number(row.area_sqm) : null,
        tambon: (row.tambon as string | null) ?? null,
        elevMean: row.elev_mean != null ? Number(row.elev_mean) : null,
      },
    }));

    const collection: GeoJsonFeatureCollection<PlotProperties> = {
      type: "FeatureCollection",
      features,
    };

    c.header("Cache-Control", "public, max-age=60, s-maxage=300");
    return c.json({ ok: true, data: collection });
  } catch (err) {
    console.error("GET /api/plots error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดข้อมูลแปลงได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/plots/:id
// Returns full detail (including geometry) for a single plot.
// ---------------------------------------------------------------------------
plotsRouter.get("/:id", async (c) => {
  const rawId = c.req.param("id");
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return c.json({ ok: false, error: "Invalid plot ID", status: 400 }, 400);
  }

  const db = createDb(c.env);

  try {
    const rows = await db.execute(sql`
      SELECT
        id,
        farmer_name,
        plot_code,
        group_number,
        area_rai,
        area_sqm,
        tambon,
        elev_mean,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM plot_boundary_plan
      WHERE id = ${id}
        AND geom IS NOT NULL
    `);

    const row = rows[0];
    if (!row) {
      return c.json({ ok: false, error: "Plot not found", status: 404 }, 404);
    }

    const detail: PlotDetail = {
      id: row.id as number,
      plotCode: row.plot_code as string,
      farmerName: (row.farmer_name as string | null) ?? null,
      groupNumber: (row.group_number as string | null) ?? null,
      areaRai: row.area_rai != null ? Number(row.area_rai) : null,
      areaSqm: row.area_sqm != null ? Number(row.area_sqm) : null,
      tambon: (row.tambon as string | null) ?? null,
      elevMean: row.elev_mean != null ? Number(row.elev_mean) : null,
      geometry: row.geometry as GeoJsonGeometry,
    };

    c.header("Cache-Control", "public, max-age=60, s-maxage=300");
    return c.json({ ok: true, data: detail });
  } catch (err) {
    console.error("GET /api/plots/:id error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดข้อมูลแปลงได้", status: 500 },
      500
    );
  }
});
