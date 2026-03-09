/**
 * notifications.ts — API routes for in-app user notifications.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   markNotificationRead      → PUT /api/notifications/:notificationId/read
 *   markAllNotificationsRead  → PUT /api/notifications/read-all
 *
 * Endpoints:
 *   GET /api/notifications?user_email=xxx          → unread notifications for a user
 *   PUT /api/notifications/:notificationId/read    → mark one notification as read
 *   PUT /api/notifications/read-all?user_email=xxx → mark all as read for a user
 */
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { notifications } from "../../db/schema";
import type { Env } from "../../db/db";

export const notificationsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/notifications?user_email=xxx
// ---------------------------------------------------------------------------
notificationsRouter.get("/", async (c) => {
  const userEmail = c.req.query("user_email");
  if (!userEmail) {
    return c.json(
      { ok: false, error: "user_email query parameter is required", status: 400 },
      400
    );
  }

  try {
    const db = createDb(c.env);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userEmail, userEmail))
      .orderBy(notifications.createdAt);

    return c.json({ ok: true, data: rows });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดการแจ้งเตือนได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all?user_email=xxx  (mirrors markAllNotificationsRead)
// Must be registered BEFORE /:notificationId to avoid param shadowing.
// ---------------------------------------------------------------------------
notificationsRouter.put("/read-all", async (c) => {
  const userEmail = c.req.query("user_email");
  if (!userEmail) {
    return c.json(
      { ok: false, error: "user_email query parameter is required", status: 400 },
      400
    );
  }

  try {
    const db = createDb(c.env);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userEmail, userEmail));

    return c.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/notifications/read-all error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถอัปเดตการแจ้งเตือนได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/:notificationId/read  (mirrors markNotificationRead)
// ---------------------------------------------------------------------------
notificationsRouter.put("/:notificationId/read", async (c) => {
  const notificationId = c.req.param("notificationId");

  try {
    const db = createDb(c.env);
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.notificationId, notificationId))
      .returning({ id: notifications.id });

    if (result.length === 0) {
      return c.json({ ok: false, error: "Notification not found", status: 404 }, 404);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/notifications/:id/read error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถอัปเดตการแจ้งเตือนได้", status: 500 },
      500
    );
  }
});
