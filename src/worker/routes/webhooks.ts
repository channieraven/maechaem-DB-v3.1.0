/**
 * webhooks.ts — Clerk webhook handler (migrated from v3.0.0).
 *
 * Listens for Clerk events and syncs data to the database.
 *
 * Required environment variables:
 *   CLERK_WEBHOOK_SECRET — signing secret from the Clerk Dashboard
 *                          (Webhooks → your endpoint → Signing Secret)
 *
 * Supported events:
 *   user.created — inserts user_id + primary email into the `profiles` table.
 *
 * Prerequisites — run this SQL once against your database:
 *   CREATE TABLE IF NOT EXISTS profiles (
 *     id         SERIAL PRIMARY KEY,
 *     user_id    TEXT NOT NULL UNIQUE,
 *     email      TEXT NOT NULL,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */
import { Hono } from "hono";
import { Webhook } from "svix";
import { sql } from "drizzle-orm";
import { createDb } from "../../db/db";
import type { Env } from "../../db/db";

export const webhooksRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailAddress {
  email_address: string;
  id: string;
}

interface UserCreatedData {
  id: string;
  email_addresses: EmailAddress[];
  primary_email_address_id: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: UserCreatedData;
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/clerk
// Verifies Clerk webhook signature and handles user.created events.
// ---------------------------------------------------------------------------
webhooksRouter.post("/clerk", async (c) => {
  const webhookSecret = c.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing environment variable: CLERK_WEBHOOK_SECRET");
    return c.json({ error: "Server misconfiguration" }, 500);
  }

  // Retrieve the raw body and Svix signature headers for verification.
  const body = await c.req.text();
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing Svix headers" }, 400);
  }

  // Verify the webhook payload using the Svix library.
  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  // Handle the user.created event.
  if (event.type === "user.created") {
    const { id: userId, email_addresses, primary_email_address_id } = event.data;

    // Find the primary email address from the list.
    const primaryEmail = email_addresses.find(
      (e) => e.id === primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("Could not find primary email for user:", userId);
      return c.json({ error: "Primary email not found" }, 422);
    }

    try {
      const db = createDb(c.env);
      // Insert with extended columns (role defaults to "pending", approved to false).
      await db.execute(sql`
        INSERT INTO profiles (user_id, email, role, approved)
        VALUES (${userId}, ${primaryEmail.email_address}, 'pending', false)
        ON CONFLICT (user_id) DO NOTHING
      `);
      console.log(`Profile created for user: ${userId}`);
    } catch (err) {
      console.error("Database insert failed:", err);
      return c.json({ error: "Database error" }, 500);
    }
  }

  return c.json({ received: true }, 200);
});
