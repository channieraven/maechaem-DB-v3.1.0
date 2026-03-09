/**
 * plots.ts — API route for agroforestry plot data.
 *
 * Endpoints:
 *   GET /api/plots          → GeoJSON FeatureCollection of all plots
 *   GET /api/plots/:id      → Full detail for a single plot
 *
 * Queries the `plot_boundary_plan` table which stores geometry as a native
 * PostGIS geometry(Geometry,4326) column.  ST_AsGeoJSON() is used in the
 * SELECT to return the geometry as a GeoJSON text string.
 *
 * Responses are automatically cached at Cloudflare's edge using the
 * Cache-Control header so repeated requests don't hit the database.
 */
import { Hono } from "hono";
import { eq, isNotNull, sql } from "drizzle-orm";
import { createDb } from "../../db/db";
import { plotBoundaryPlan } from "../../db/schema";
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
// Returns a GeoJSON FeatureCollection of all plots.
// ST_AsGeoJSON() converts the PostGIS geometry column to a GeoJSON string.
// ---------------------------------------------------------------------------
plotsRouter.get("/", async (c) => {
  const db = createDb(c.env);

  try {
    const rows = await db
      .select({
        id: plotBoundaryPlan.id,
        plotCode: plotBoundaryPlan.plotCode,
        farmerName: plotBoundaryPlan.farmerName,
        groupNumber: plotBoundaryPlan.groupNumber,
        areaRai: plotBoundaryPlan.areaRai,
        areaSqm: plotBoundaryPlan.areaSqm,
        tambon: plotBoundaryPlan.tambon,
        elevMean: plotBoundaryPlan.elevMean,
        geom: sql<string>`ST_AsGeoJSON(${plotBoundaryPlan.geom})`,
      })
      .from(plotBoundaryPlan)
      .where(isNotNull(plotBoundaryPlan.geom))
      .orderBy(plotBoundaryPlan.plotCode);

    const features: GeoJsonFeature<PlotProperties>[] = [];
    for (const row of rows) {
      let geometry: GeoJsonGeometry | null = null;
      try {
        geometry = JSON.parse(row.geom ?? "null") as GeoJsonGeometry | null;
      } catch (parseErr) {
        console.warn(`Skipping plot ID ${row.id}: invalid geometry —`, parseErr);
        continue;
      }
      if (!geometry) continue;

      features.push({
        type: "Feature",
        id: row.id,
        geometry,
        properties: {
          id: row.id,
          plotCode: row.plotCode,
          farmerName: row.farmerName ?? null,
          groupNumber: row.groupNumber ?? null,
          areaRai: row.areaRai ?? null,
          areaSqm: row.areaSqm ?? null,
          tambon: row.tambon ?? null,
          elevMean: row.elevMean ?? null,
        },
      });
    }

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
// ST_AsGeoJSON() converts the PostGIS geometry column to a GeoJSON string.
// ---------------------------------------------------------------------------
plotsRouter.get("/:id", async (c) => {
  const rawId = c.req.param("id");
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return c.json({ ok: false, error: "Invalid plot ID", status: 400 }, 400);
  }

  const db = createDb(c.env);

  try {
    const rows = await db
      .select({
        id: plotBoundaryPlan.id,
        plotCode: plotBoundaryPlan.plotCode,
        farmerName: plotBoundaryPlan.farmerName,
        groupNumber: plotBoundaryPlan.groupNumber,
        areaRai: plotBoundaryPlan.areaRai,
        areaSqm: plotBoundaryPlan.areaSqm,
        tambon: plotBoundaryPlan.tambon,
        elevMean: plotBoundaryPlan.elevMean,
        geom: sql<string>`ST_AsGeoJSON(${plotBoundaryPlan.geom})`,
      })
      .from(plotBoundaryPlan)
      .where(eq(plotBoundaryPlan.id, id));

    const row = rows[0];
    if (!row || !row.geom) {
      return c.json({ ok: false, error: "Plot not found", status: 404 }, 404);
    }

    let geometry: GeoJsonGeometry;
    try {
      geometry = JSON.parse(row.geom) as GeoJsonGeometry;
    } catch (parseErr) {
      console.error(`Failed to parse geometry for plot ID ${id}:`, parseErr);
      return c.json({ ok: false, error: "Invalid plot geometry", status: 500 }, 500);
    }

    const detail: PlotDetail = {
      id: row.id,
      plotCode: row.plotCode,
      farmerName: row.farmerName ?? null,
      groupNumber: row.groupNumber ?? null,
      areaRai: row.areaRai ?? null,
      areaSqm: row.areaSqm ?? null,
      tambon: row.tambon ?? null,
      elevMean: row.elevMean ?? null,
      geometry,
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
