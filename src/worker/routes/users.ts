/**
 * users.ts — API routes for user profile management.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   getUser      → GET  /api/users/:userId
 *   getUsersList → GET  /api/users (approved users only)
 *   updateUser   → PUT  /api/users/:userId
 *   approveUser  → PUT  /api/users/:userId/approve
 *
 * Authentication is handled by Clerk. These routes manage the extended
 * profile data (role, approval status, position, organization) stored in
 * the `profiles` table, which is seeded by the Clerk webhook on user.created.
 *
 * Note: login / register are handled entirely by Clerk — not migrated here.
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { profiles } from "../../db/schema";
import type { Env } from "../../db/db";

export const usersRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/users  — list approved users (mirrors getUsersList)
// ---------------------------------------------------------------------------
usersRouter.get("/", async (c) => {
  const db = createDb(c.env);

  const rows = await db
    .select({
      email: profiles.email,
      fullname: profiles.fullname,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.approved, true))
    .orderBy(profiles.email);

  return c.json({ ok: true, data: rows });
});

// ---------------------------------------------------------------------------
// GET /api/users/:userId  — get a single profile (mirrors getUser)
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
// PUT /api/users/:userId  — update profile fields (mirrors updateUser)
// Accepts: fullname, position, organization, role, approved
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

  const patch: Partial<typeof profiles.$inferInsert> = {};
  if (body.fullname !== undefined) patch.fullname = body.fullname as string;
  if (body.fullName !== undefined) patch.fullname = body.fullName as string;
  if (body.position !== undefined) patch.position = body.position as string;
  if (body.organization !== undefined) patch.organization = body.organization as string;
  if (body.affiliation !== undefined) patch.organization = body.affiliation as string;
  if (body.role !== undefined) patch.role = body.role as string;
  if (body.approved !== undefined) patch.approved = Boolean(body.approved);

  await db.update(profiles).set(patch).where(eq(profiles.userId, userId));

  return c.json({ ok: true, message: "อัปเดตข้อมูลสำเร็จ" });
});

// ---------------------------------------------------------------------------
// PUT /api/users/:userId/approve  — approve user and optionally set role
// Mirrors the approveUser function from v1.0.1.
// ---------------------------------------------------------------------------
usersRouter.put("/:userId/approve", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ role?: string }>().catch(() => ({}));
  const db = createDb(c.env);

  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (existing.length === 0) {
    return c.json({ ok: false, error: "User not found", status: 404 }, 404);
  }

  const patch: Partial<typeof profiles.$inferInsert> = { approved: true };
  if (body.role) patch.role = body.role;

  await db.update(profiles).set(patch).where(eq(profiles.userId, userId));

  return c.json({ ok: true, message: "อนุมัติบัญชีสำเร็จ" });
});
