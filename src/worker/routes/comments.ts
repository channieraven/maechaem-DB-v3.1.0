/**
 * comments.ts — API routes for growth-log comments and notifications.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   addComment           → POST /api/comments
 *   getCommentsByLogId   → GET  /api/comments?log_id=xxx
 *   createNotification   → called internally when a comment is posted
 *
 * Endpoints:
 *   GET  /api/comments?log_id=xxx   → comments for a specific growth log
 *   POST /api/comments              → add a comment (also creates notifications)
 *   DELETE /api/comments/:commentId → delete a comment
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { comments, notifications } from "../../db/schema";
import type { Env } from "../../db/db";

export const commentsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/comments?log_id=xxx
// ---------------------------------------------------------------------------
commentsRouter.get("/", async (c) => {
  const logId = c.req.query("log_id");
  if (!logId) {
    return c.json({ ok: false, error: "log_id query parameter is required", status: 400 }, 400);
  }

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.logId, logId))
    .orderBy(comments.createdAt);

  // Parse mentions JSON string back to an array for each row
  const data = rows.map((r) => ({
    ...r,
    mentions: (() => {
      try {
        return JSON.parse(r.mentions ?? "[]");
      } catch {
        return [];
      }
    })(),
  }));

  return c.json({ ok: true, data });
});

// ---------------------------------------------------------------------------
// POST /api/comments  (mirrors addComment + createNotification)
// ---------------------------------------------------------------------------
commentsRouter.post("/", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const db = createDb(c.env);

  const commentId = `CMT_${Date.now()}`;
  const mentionsArr: string[] = Array.isArray(body.mentions)
    ? (body.mentions as string[])
    : [];

  await db.insert(comments).values({
    commentId,
    logId: (body.log_id as string | null) ?? null,
    treeCode: (body.tree_code as string | null) ?? null,
    plotCode: (body.plot_code as string | null) ?? null,
    content: (body.content as string) ?? "",
    authorEmail: (body.author_email as string | null) ?? null,
    authorName: (body.author_name as string | null) ?? null,
    mentions: JSON.stringify(mentionsArr),
    createdAt: new Date(),
  });

  // Build notification recipients: mentioned users + recorder (if different from author)
  const notifyEmails = new Set<string>(mentionsArr);
  const recorderEmail = body.recorder_email as string | undefined;
  const authorEmail = body.author_email as string | undefined;
  if (recorderEmail && recorderEmail !== authorEmail) {
    notifyEmails.add(recorderEmail);
  }

  const authorName = (body.author_name as string) ?? "";
  const treeCode = (body.tree_code as string) ?? "";
  const content = (body.content as string) ?? "";
  const logId = (body.log_id as string) ?? "";
  const plotCode = (body.plot_code as string) ?? "";

  const message =
    authorName +
    " แสดงความคิดเห็นเกี่ยวกับ " +
    treeCode +
    ": " +
    content.substring(0, 60) +
    (content.length > 60 ? "..." : "");

  if (notifyEmails.size > 0) {
    const notifRows = [...notifyEmails].map((email) => ({
      notificationId: `NTF_${Date.now()}_${email}`,
      userEmail: email,
      commentId,
      logId: logId || null,
      treeCode: treeCode || null,
      plotCode: plotCode || null,
      message,
      authorName,
      createdAt: new Date(),
      isRead: false,
    }));
    await db.insert(notifications).values(notifRows);
  }

  return c.json({ ok: true, id: commentId }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /api/comments/:commentId
// ---------------------------------------------------------------------------
commentsRouter.delete("/:commentId", async (c) => {
  const commentId = c.req.param("commentId");
  const db = createDb(c.env);

  const result = await db
    .delete(comments)
    .where(eq(comments.commentId, commentId))
    .returning({ id: comments.id });

  if (result.length === 0) {
    return c.json({ ok: false, error: "Comment not found", status: 404 }, 404);
  }

  return c.json({ ok: true });
});
