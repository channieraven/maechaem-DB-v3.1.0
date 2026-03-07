/**
 * App.tsx — Root application component.
 *
 * Handles Clerk authentication state:
 *  - Shows a loading spinner while Clerk initialises.
 *  - Shows the sign-in page for unauthenticated users.
 *  - Renders the Dashboard for authenticated users.
 *
 * Clerk components used here are loaded from the @clerk/clerk-js package
 * which is 100% edge-compatible — no Node.js APIs are used.
 */
import { useEffect, useState } from "react";
import { Dashboard } from "./client/pages/Dashboard";

type AuthState = "loading" | "signed-in" | "signed-out";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    // Read the publishable key injected by Vite from the environment.
    // Set VITE_CLERK_PUBLISHABLE_KEY in your .env / Pages env vars.
    const publishableKey = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] as string | undefined;

    if (!publishableKey) {
      // No Clerk key configured — skip auth and go straight to dashboard.
      // Useful for local development without a Clerk account.
      console.warn(
        "[Mae Chaem GIS] VITE_CLERK_PUBLISHABLE_KEY is not set. " +
          "Authentication is disabled."
      );
      setAuthState("signed-in");
      return;
    }

    let mounted = true;

    async function initClerk() {
      try {
        // Dynamically import clerk-js to keep the initial bundle small.
        const { Clerk } = await import("@clerk/clerk-js");
        const clerk = new Clerk(publishableKey!);
        await clerk.load();

        if (!mounted) return;

        if (clerk.user) {
          setAuthState("signed-in");
        } else {
          setAuthState("signed-out");
          // Open the Clerk hosted sign-in flow in a modal.
          clerk.openSignIn({
            afterSignInUrl: window.location.href,
          });

          // Listen for sign-in completion.
          clerk.addListener(({ user }: { user?: unknown }) => {
            if (user) {
              setAuthState("signed-in");
            }
          });
        }
      } catch (err) {
        console.error("[Mae Chaem GIS] Clerk init failed:", err);
        // Fall through to the dashboard on auth failure — tighten in production.
        if (mounted) setAuthState("signed-in");
      }
    }

    initClerk();
    return () => {
      mounted = false;
    };
  }, []);

  if (authState === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  if (authState === "signed-out") {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">กำลังเปิดหน้าเข้าสู่ระบบ…</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}

export default App;
