/**
 * users.ts — Admin user-management routes.
 *
 * Migrated from v2.1.0 Firebase Cloud Function `syncUserClaims`.
 *
 * All routes require:
 *  1. A valid Clerk session (enforced by clerkAuthMiddleware upstream).
 *  2. The caller's Clerk public metadata to carry `{ role: "admin" }`.
 *
 * Endpoints:
 *   GET  /api/users           → list all profiles (admin only)
 *   PUT  /api/users/:id/role  → update a user's role + approved flag and sync
 *                               to Clerk public metadata (mirrors syncUserClaims)
 */
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { createDb } from "../../db/db";
import type { Env } from "../../db/db";

export const usersRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the Clerk public metadata role for the authenticated caller. */
async function getCallerRole(
  c: Parameters<Parameters<typeof usersRouter.use>[1]>[0]
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
// ---------------------------------------------------------------------------
usersRouter.get("/", async (c) => {
  const callerRole = await getCallerRole(c);
  if (callerRole !== "admin") {
    return c.json({ ok: false, error: "Forbidden", status: 403 }, 403);
  }

  const db = createDb(c.env);
  const rows = await db.execute(sql`
    SELECT id, user_id, email, fullname, role, approved,
           position, organization, phone, created_at, updated_at
    FROM profiles
    ORDER BY created_at ASC
  `);

  return c.json({ ok: true, data: rows });
});

// ---------------------------------------------------------------------------
// PUT /api/users/:id/role
// Update a user's role and approved status, then sync to Clerk metadata.
// Migrated from v2.1.0 syncUserClaims Cloud Function.
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
  const profileRows = await db.execute(sql`
    SELECT user_id FROM profiles WHERE user_id = ${targetUserId}
  `);

  if (profileRows.length === 0) {
    return c.json({ ok: false, error: "Profile not found", status: 404 }, 404);
  }

  // Update the profile in the database.
  await db.execute(sql`
    UPDATE profiles
    SET role = ${role}, approved = ${approved}, updated_at = NOW()
    WHERE user_id = ${targetUserId}
  `);

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
