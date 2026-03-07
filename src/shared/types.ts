/**
 * Shared TypeScript types used by both the client and the worker.
 *
 * Keeping these in a shared module ensures the API contract is enforced
 * at compile time across the entire codebase.
 *
 * Field names reflect the actual `plot_boundary_plan` table columns,
 * mapped to camelCase for TypeScript convention.
 */

// ---------------------------------------------------------------------------
// GeoJSON primitives (lightweight — avoids pulling in @types/geojson on edge)
// ---------------------------------------------------------------------------

export interface GeoJsonCoordinate extends Array<number> {}

export type GeoJsonGeometry =
  | { type: "Point"; coordinates: GeoJsonCoordinate }
  | { type: "LineString"; coordinates: GeoJsonCoordinate[] }
  | { type: "Polygon"; coordinates: GeoJsonCoordinate[][] }
  | { type: "MultiPolygon"; coordinates: GeoJsonCoordinate[][][] };

export interface GeoJsonFeature<P = PlotProperties> {
  type: "Feature";
  id?: string | number;
  geometry: GeoJsonGeometry;
  properties: P;
}

export interface GeoJsonFeatureCollection<P = PlotProperties> {
  type: "FeatureCollection";
  features: GeoJsonFeature<P>[];
}

// ---------------------------------------------------------------------------
// Domain types — Plot
// ---------------------------------------------------------------------------

/**
 * Properties carried on each GeoJSON Feature for an agroforestry plot.
 * Maps to the `plot_boundary_plan` table columns (migrated from v3.0.0).
 */
export interface PlotProperties {
  id: number;
  /** plot_code — unique plot identifier */
  plotCode: string;
  /** farmer_name — name of the farmer / plot owner */
  farmerName: string | null;
  /** group_number — farmer group assignment */
  groupNumber: string | null;
  /** area_rai — area in Thai rai units */
  areaRai: number | null;
  /** area_sqm — area in square metres */
  areaSqm: number | null;
  /** tambon — Thai subdistrict */
  tambon: string | null;
  /** elev_mean — mean elevation in metres above sea level */
  elevMean: number | null;
}

/** Full plot detail returned from the `/api/plots/:id` endpoint. */
export interface PlotDetail extends PlotProperties {
  geometry: GeoJsonGeometry;
}

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  status: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
