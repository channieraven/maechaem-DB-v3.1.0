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
// User / Profile  (migrated from v1.0.1 users sheet)
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: number;
  userId: string;
  email: string;
  fullname: string | null;
  position: string | null;
  organization: string | null;
  role: string;
  approved: boolean;
  createdAt: string;
}

/** Subset returned by the public "approved users" list endpoint */
export interface AppUser {
  email: string;
  fullname: string | null;
  role: string;
}

// ---------------------------------------------------------------------------
// Tree profile  (migrated from v1.0.1 trees_profile sheet)
// ---------------------------------------------------------------------------

export interface TreeProfile {
  id: number;
  treeCode: string;
  tagLabel: string | null;
  plotCode: string;
  speciesCode: string | null;
  speciesGroup: string | null;
  speciesName: string | null;
  treeNumber: number | null;
  rowMain: string | null;
  rowSub: string | null;
  utmX: number | null;
  utmY: number | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Growth log  (migrated from v1.0.1 growth_logs sheet)
// ---------------------------------------------------------------------------

export interface GrowthLog {
  id: number;
  logId: string;
  treeCode: string;
  tagLabel: string | null;
  plotCode: string;
  speciesCode: string | null;
  speciesGroup: string | null;
  speciesName: string | null;
  treeNumber: number | null;
  rowMain: string | null;
  rowSub: string | null;
  heightM: number | null;
  status: string | null;
  flowering: string | null;
  note: string | null;
  recorder: string | null;
  surveyDate: string | null;
  dbhCm: number | null;
  bambooCulms: number | null;
  dbh1Cm: number | null;
  dbh2Cm: number | null;
  dbh3Cm: number | null;
  bananaTotal: number | null;
  banana1yr: number | null;
  yieldBunches: number | null;
  yieldHands: number | null;
  pricePerHand: number | null;
  targetSheet: string;
  timestamp: string;
  lastEditedBy: string | null;
}

// ---------------------------------------------------------------------------
// Plot image  (migrated from v1.0.1 plot_images sheet)
// ---------------------------------------------------------------------------

export interface PlotImage {
  id: number;
  imageId: string;
  plotCode: string;
  imageType: string | null;
  galleryCategory: string | null;
  url: string;
  description: string | null;
  uploader: string | null;
  date: string | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Spacing log  (migrated from v1.0.1 spacing_logs sheet)
// ---------------------------------------------------------------------------

export interface SpacingLog {
  id: number;
  spacingId: string;
  plotCode: string;
  avgSpacing: number | null;
  minSpacing: number | null;
  maxSpacing: number | null;
  treeCount: number | null;
  note: string | null;
  date: string | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Comment  (migrated from v1.0.1 comments sheet)
// ---------------------------------------------------------------------------

export interface Comment {
  id: number;
  commentId: string;
  logId: string | null;
  treeCode: string | null;
  plotCode: string | null;
  content: string;
  authorEmail: string | null;
  authorName: string | null;
  mentions: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notification  (migrated from v1.0.1 notifications sheet)
// ---------------------------------------------------------------------------

export interface Notification {
  id: number;
  notificationId: string;
  userEmail: string;
  commentId: string | null;
  logId: string | null;
  treeCode: string | null;
  plotCode: string | null;
  message: string | null;
  authorName: string | null;
  createdAt: string;
  isRead: boolean;
}

// ---------------------------------------------------------------------------
// CSV Import
// ---------------------------------------------------------------------------

/** A single row parsed from the uploaded CSV before import. */
export interface ImportPreviewRow {
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

/** Summary result returned by the import endpoint. */
export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
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
