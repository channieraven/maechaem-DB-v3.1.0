/**
 * images.ts — API routes for plot image management.
 *
 * Migrated from v1.0.1 Google Apps Script functions:
 *   saveImageToSheet    → POST   /api/images
 *   updateImageInSheet  → PUT    /api/images/:imageId
 *   deleteImage         → DELETE /api/images/:imageId
 *
 * Endpoints:
 *   GET    /api/images[?plot_code=xxx]  → list images
 *   POST   /api/images                  → upload / record an image
 *   PUT    /api/images/:imageId         → update description
 *   DELETE /api/images/:imageId         → delete image record
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/db";
import { plotImages } from "../../db/schema";
import type { Env } from "../../db/db";

export const imagesRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /api/images[?plot_code=xxx]
// ---------------------------------------------------------------------------
imagesRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const plotCode = c.req.query("plot_code");

  try {
    const rows = plotCode
      ? await db
          .select()
          .from(plotImages)
          .where(eq(plotImages.plotCode, plotCode))
          .orderBy(plotImages.timestamp)
      : await db.select().from(plotImages).orderBy(plotImages.timestamp);

    return c.json({ ok: true, data: rows });
  } catch (err) {
    console.error("GET /api/images error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถโหลดรูปภาพได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/images  — save image record (mirrors saveImageToSheet)
// The URL may be a Cloudinary/CDN URL or a base64 data URI.
// ---------------------------------------------------------------------------
imagesRouter.post("/", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body", status: 400 }, 400);
  }
  const db = createDb(c.env);

  const url = (body.url as string | undefined) ?? (body.image_base64 as string | undefined);
  if (!url) {
    return c.json({ ok: false, error: "No image URL provided", status: 400 }, 400);
  }

  const imageId = `IMG_${Date.now()}`;
  const values = {
    imageId,
    plotCode: (body.plot_code as string) ?? "",
    imageType: (body.image_type as string | null) ?? null,
    galleryCategory: (body.gallery_category as string | null) ?? null,
    url,
    description: (body.description as string | null) ?? null,
    uploader: (body.uploader as string | null) ?? null,
    date: (body.date as string | null) ?? null,
    timestamp: new Date(),
  };

  try {
    await db.insert(plotImages).values(values);
    return c.json({ ok: true, id: imageId, url }, 201);
  } catch (err) {
    console.error("POST /api/images error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถบันทึกรูปภาพได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/images/:imageId  — update description (mirrors updateImageInSheet)
// ---------------------------------------------------------------------------
imagesRouter.put("/:imageId", async (c) => {
  const imageId = c.req.param("imageId");
  let body: { description?: string };
  try {
    body = await c.req.json<{ description?: string }>();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body", status: 400 }, 400);
  }
  const db = createDb(c.env);

  try {
    const existing = await db
      .select({ id: plotImages.id })
      .from(plotImages)
      .where(eq(plotImages.imageId, imageId));

    if (existing.length === 0) {
      return c.json({ ok: false, error: "Image not found", status: 404 }, 404);
    }

    await db
      .update(plotImages)
      .set({ description: body.description ?? null })
      .where(eq(plotImages.imageId, imageId));

    return c.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/images/:imageId error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถอัปเดตรูปภาพได้", status: 500 },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/images/:imageId  (mirrors deleteImage)
// ---------------------------------------------------------------------------
imagesRouter.delete("/:imageId", async (c) => {
  const imageId = c.req.param("imageId");
  const db = createDb(c.env);

  try {
    const result = await db
      .delete(plotImages)
      .where(eq(plotImages.imageId, imageId))
      .returning({ id: plotImages.id });

    if (result.length === 0) {
      return c.json({ ok: false, error: "Image not found", status: 404 }, 404);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/images/:imageId error:", err);
    return c.json(
      { ok: false, error: "ไม่สามารถลบรูปภาพได้", status: 500 },
      500
    );
  }
});
