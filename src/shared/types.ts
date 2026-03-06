/**
 * Shared TypeScript types used by both the client and the worker.
 *
 * Keeping these in a shared module ensures the API contract is enforced
 * at compile time across the entire codebase.
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

/** Properties carried on each GeoJSON Feature for an agroforestry plot. */
export interface PlotProperties {
  id: number;
  plotCode: string;
  village: string | null;
  ownerName: string | null;
  areaRai: number | null;
  areaHa: number | null;
  systemType: string | null;
  dominantSpecies: string | null;
  establishedYear: number | null;
}

/** Full plot detail returned from the `/api/plots/:id` endpoint. */
export interface PlotDetail extends PlotProperties {
  geometry: GeoJsonGeometry;
  createdAt: string;
  updatedAt: string;
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
