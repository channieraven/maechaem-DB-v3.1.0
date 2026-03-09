/**
 * clerk.ts — Clerk authentication middleware for Cloudflare Edge.
 *
 * This middleware:
 *  1. Reads the Clerk session token from the Authorization header or
 *     the __session cookie (Clerk's standard approach).
 *  2. Verifies the JWT using Clerk's backend SDK (no network call needed
 *     — the JWT is verified locally using the public key embedded in
 *     Clerk's JWKS, cached after the first request).
 *  3. Attaches the authenticated `userId` to the Hono context so downstream
 *     route handlers can access it via `c.get("userId")`.
 *  4. Returns 401 Unauthorized for unauthenticated requests to protected routes.
 *
 * Usage:
 * ```ts
 * // Protect all routes under /api/protected/*
 * app.use("/api/protected/*", clerkAuthMiddleware());
 *
 * // Access user ID in a protected route:
 * app.get("/api/protected/me", (c) => {
 *   const userId = c.get("userId");
 *   return c.json({ userId });
 * });
 * ```
 */
import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../../db/db";

// Extend Hono's context variables map so TypeScript knows about `userId`.
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    /** Primary email of the authenticated user — populated by index.ts middleware. */
    userEmail: string;
  }
}

/**
 * Returns a Hono middleware that enforces Clerk authentication.
 *
 * Protected routes MUST have a valid Clerk session token in:
 *  - `Authorization: Bearer <token>` header, OR
 *  - `__session` cookie (set by Clerk's frontend SDK)
 */
export function clerkAuthMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    // Extract token from Authorization header or __session cookie.
    const authHeader = c.req.header("Authorization");
    const sessionToken =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : getCookie(c.req.raw, "__session");

    if (!sessionToken) {
      return c.json(
        { ok: false, error: "Authentication required", status: 401 },
        401
      );
    }

    try {
      // verifyToken validates the JWT signature and expiry locally using
      // the Clerk JWKS endpoint (result is cached by the Clerk SDK).
      const payload = await verifyToken(sessionToken, {
        secretKey: c.env.CLERK_SECRET_KEY,
        // Allow a 60-second clock skew tolerance.
        clockSkewInMs: 60_000,
      });

      // Attach the verified userId to the context for downstream handlers.
      c.set("userId", payload.sub);
      await next();
    } catch (error) {
      console.error("[Clerk Auth] Token verification failed:", error);
      return c.json(
        { ok: false, error: "Invalid or expired session", status: 401 },
        401
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal cookie parser — extracts a named cookie from a Request.
 * Avoids pulling in a full cookie library for this single-purpose use.
 */
function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [key, ...vals] = part.trim().split("=");
    if (key?.trim() === name) {
      return vals.join("=").trim();
    }
  }
  return undefined;
}
