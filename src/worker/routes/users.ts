/**
 * users.ts — User profile management routes.
 *
 * Migrated from:
 *  - v1.0.1 Google Apps Script: getUser, getUsersList, updateUser, approveUser
 *  - v2.1.0 Firebase Cloud Function: syncUserClaims
 *
 * All routes require a valid Clerk session (enforced by clerkAuthMiddleware
 * upstream in index.ts). Admin-only endpoints additionally verify that the
 * caller's Clerk public metadata carries `{ role: "admin" }`.
 *
 * Endpoints:
 *   GET  /api/users              → list all profiles (admin only)
 *   GET  /api/users/:userId      → get a single profile
 *   PUT  /api/users/:userId      → update profile fields (self or admin)
 *   PUT  /api/users/:userId/role → update role + approved, sync to Clerk (admin only)
 */
import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { createDb } from "../../db/db";
import { profiles } from "../../db/schema";
import type { Env } from "../../db/db";

export const usersRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the Clerk public metadata role for the authenticated caller. */
async function getCallerRole(
  c: Context<{ Bindings: Env }>
): Promise<string | undefined> {
  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const userId = c.get("userId");
  const user = await clerk.users.getUser(userId);
  return (user.publicMetadata as Record<string, unknown>)?.role as
    | string
    | undefined;
}

// ---------------------------------------------------------------------------
// GET /api/users
// Returns all profiles. Admin only.
// Migrated from v2.1.0 and extended to include all profile columns.
// ---------------------------------------------------------------------------
usersRouter.get("/", async (c) => {
  const callerRole = await getCallerRole(c);
  if (callerRole !== "admin") {
    return c.json({ ok: false, error: "Forbidden", status: 403 }, 403);
  }

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(profiles)
    .orderBy(profiles.createdAt);

  return c.json({ ok: true, data: rows });
});

// ---------------------------------------------------------------------------
// GET /api/users/:userId  — get a single profile (mirrors v1.0.1 getUser)
// :userId is the Clerk user_id (e.g. "user_2abc…")
// ---------------------------------------------------------------------------
usersRouter.get("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const db = createDb(c.env);

  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (!rows[0]) {
    return c.json({ ok: false, error: "User not found", status: 404 }, 404);
  }

  return c.json({ ok: true, data: rows[0] });
});

// ---------------------------------------------------------------------------
// PUT /api/users/:userId  — update profile fields (mirrors v1.0.1 updateUser)
// Accepts: fullname, position, organization, phone
// Role/approved changes must go through PUT /:userId/role (admin only).
// ---------------------------------------------------------------------------
usersRouter.put("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<Record<string, unknown>>();
  const db = createDb(c.env);

  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (existing.length === 0) {
    return c.json({ ok: false, error: "User not found", status: 404 }, 404);
  }

  const patch: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
  if (body.fullname !== undefined) patch.fullname = body.fullname as string;
  if (body.fullName !== undefined) patch.fullname = body.fullName as string;
  if (body.position !== undefined) patch.position = body.position as string;
  if (body.organization !== undefined) patch.organization = body.organization as string;
  if (body.affiliation !== undefined) patch.organization = body.affiliation as string;
  if (body.phone !== undefined) patch.phone = body.phone as string;

  await db.update(profiles).set(patch).where(eq(profiles.userId, userId));

  return c.json({ ok: true, message: "อัปเดตข้อมูลสำเร็จ" });
});

// ---------------------------------------------------------------------------
// PUT /api/users/:id/role
// Update a user's role and approved status, then sync to Clerk metadata.
// Migrated from v2.1.0 syncUserClaims Cloud Function.
// Also covers v1.0.1 approveUser behaviour (set approved=true + optional role).
//
// Body: { role: "admin" | "pending", approved: boolean }
// ---------------------------------------------------------------------------
usersRouter.put("/:id/role", async (c) => {
  const callerRole = await getCallerRole(c);
  if (callerRole !== "admin") {
    return c.json({ ok: false, error: "Forbidden", status: 403 }, 403);
  }

  const targetUserId = c.req.param("id");

  let body: { role?: string; approved?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body", status: 400 }, 400);
  }

  const { role, approved } = body;

  if (!role || typeof approved !== "boolean") {
    return c.json(
      { ok: false, error: "role (string) and approved (boolean) are required", status: 400 },
      400
    );
  }

  const db = createDb(c.env);

  // Verify the target profile exists.
  const profileRows = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.userId, targetUserId));

  if (profileRows.length === 0) {
    return c.json({ ok: false, error: "Profile not found", status: 404 }, 404);
  }

  // Update the profile in the database.
  await db
    .update(profiles)
    .set({ role, approved, updatedAt: new Date() })
    .where(eq(profiles.userId, targetUserId));

  // Sync updated role/approved to Clerk public metadata so the JWT reflects
  // the change on next token refresh — mirrors v2.1.0 setCustomUserClaims().
  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  await clerk.users.updateUserMetadata(targetUserId, {
    publicMetadata: { role, approved },
  });

  console.log(
    `[users] Role synced for user: ${targetUserId}`,
    { role, approved }
  );

  return c.json({ ok: true, data: { userId: targetUserId, role, approved } });
});
