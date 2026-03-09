/**
 * App.tsx — Root application component.
 *
 * Handles Clerk authentication state using @clerk/react (migrated from v3.0.0):
 *  - Wraps the app in ClerkProvider when a publishable key is configured.
 *  - Shows a sign-in button for unauthenticated users (SignedOut).
 *  - Renders the Dashboard for authenticated users (SignedIn).
 *  - Falls back to rendering the Dashboard directly when no key is set
 *    (local development without a Clerk account).
 */
import { ClerkProvider, SignedIn, SignedOut, SignInButton } from "@clerk/react";
import { Dashboard } from "./client/pages/Dashboard";

export function App() {
  const publishableKey = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] as string | undefined;

  if (!publishableKey) {
    // No Clerk key configured — skip auth and go straight to dashboard.
    // Useful for local development without a Clerk account.
    console.warn(
      "[Mae Chaem GIS] VITE_CLERK_PUBLISHABLE_KEY is not set. " +
        "Authentication is disabled."
    );
    return <Dashboard />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SignedIn>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <div className="flex items-center justify-center h-screen bg-white text-gray-900">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6 text-green-600"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M17 8C8 10 5.9 16.17 3.82 19.09L5.71 21c1-1.23 2.53-2.06 5.79-2.28C14.07 18.5 17 16 17 8z" />
              </svg>
              <span className="font-semibold text-gray-800 text-lg tracking-tight">
                Mae Chaem Agroforestry DB
              </span>
            </div>
            <SignInButton mode="modal">
              <button className="rounded-full bg-green-700 px-8 py-3 text-base font-semibold text-white hover:bg-green-800 transition-colors shadow">
                เข้าสู่ระบบ
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
    </ClerkProvider>
  );
}

export default App;
