"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

// Shown when a crash takes down the whole page. It replaces the root layout,
// so it gets none of globals.css: everything it needs is inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error, { digest: error.digest, boundary: "global-error" });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px 16px",
          boxSizing: "border-box",
          background: "#ffffff",
          color: "#111827",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        <title>Something went wrong · Verlab</title>
        <main style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Something went wrong</h1>
          <p style={{ margin: "10px 0 24px", fontSize: 15, lineHeight: 1.5, color: "#525866" }}>
            This page hit an error. We&apos;ve been notified. Try again, or head back home.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                height: 40,
                padding: "0 18px",
                border: 0,
                borderRadius: 10,
                background: "#335cff",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A full page load on purpose: the app's router is what crashed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                height: 40,
                padding: "0 18px",
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 10,
                border: "1px solid rgba(17, 24, 39, 0.14)",
                color: "#111827",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
          {error.digest ? (
            <p style={{ margin: "20px 0 0", fontSize: 12, color: "#9ca3af", fontFamily: "ui-monospace, monospace" }}>
              Error ID {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
