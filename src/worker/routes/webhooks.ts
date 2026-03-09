/**
 * webhooks.ts — Clerk webhook handler.
 *
 * Listens for Clerk events and syncs data to the database.
 * Migrated from v2.1.0 Firebase Cloud Function `createUserProfile`.
 *
 * Required environment variables:
 *   CLERK_WEBHOOK_SECRET — signing secret from the Clerk Dashboard
 *                          (Webhooks → your endpoint → Signing Secret)
 *   CLERK_SECRET_KEY     — Clerk backend secret for updating user metadata
 *
 * Supported events:
 *   user.created — inserts a profile row and applies bootstrap-admin logic:
 *     • First user ever → role="admin", approved=true
 *     • All subsequent  → role="pending", approved=false
 *     Clerk public metadata is updated so the JWT carries current role/approved.
 */
import { Hono } from "hono";
import { Webhook } from "svix";
import { count } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { createDb } from "../../db/db";
import { profiles } from "../../db/schema";
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
  first_name: string | null;
  last_name: string | null;
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
// Migrated from v2.1.0 `createUserProfile` Firebase Cloud Function.
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
  // Mirrors v2.1.0 createUserProfile: first registered user becomes admin.
  if (event.type === "user.created") {
    const {
      id: userId,
      first_name,
      last_name,
      email_addresses,
      primary_email_address_id,
    } = event.data;

    // Find the primary email address from the list.
    const primaryEmail = email_addresses.find(
      (e) => e.id === primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("Could not find primary email for user:", userId);
      return c.json({ error: "Primary email not found" }, 422);
    }

    const email = primaryEmail.email_address;
    const fullname =
      [first_name, last_name].filter(Boolean).join(" ") ||
      email.split("@")[0];

    try {
      const db = createDb(c.env);

      // Bootstrap-admin check: is this the very first profile?
      // Mirrors v2.1.0 `profilesSnapshot.empty` logic.
      const countResult = await db
        .select({ value: count() })
        .from(profiles);
      const profileCount = countResult[0]?.value ?? 0;
      const isFirstUser = profileCount === 0;

      const role = isFirstUser ? "admin" : "pending";
      const approved = isFirstUser;

      await db
        .insert(profiles)
        .values({ userId, email, fullname, role, approved })
        .onConflictDoNothing({ target: profiles.userId });

      console.log(
        `[webhooks] Profile created for user: ${userId}`,
        { role, approved, isFirstUser }
      );

      // Sync role/approved to Clerk public metadata so the JWT carries the
      // current values — mirrors v2.1.0 setCustomUserClaims().
      if (c.env.CLERK_SECRET_KEY) {
        const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: { role, approved },
        });
        console.log(`[webhooks] Clerk metadata updated for user: ${userId}`);
      }
    } catch (err) {
      console.error("Database insert or Clerk metadata update failed:", err);
      return c.json({ error: "Database error" }, 500);
    }
  }

  return c.json({ received: true }, 200);
});
