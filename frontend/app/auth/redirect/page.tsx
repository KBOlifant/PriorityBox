"use client";

import { useEffect } from "react";

/**
 * Landing page for Microsoft's sign-in popup. It hands the response back to the
 * main window and closes itself. Register `<origin>/auth/redirect` as a
 * "Single-page application" redirect URI in the Entra app registration.
 */
export default function AuthRedirectPage() {
  useEffect(() => {
    void import("@azure/msal-browser/redirect-bridge").then((m) =>
      m.broadcastResponseToMainFrame(),
    );
  }, []);

  return (
    <main className="grid min-h-screen place-items-center text-[13px] text-muted">
      Completing sign-in…
    </main>
  );
}
