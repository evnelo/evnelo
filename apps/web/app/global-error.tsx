"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

/** Last-resort boundary: replaces the root layout, so it renders its own html and body. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "6rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
        <p style={{ color: "#666", marginTop: "0.75rem" }}>Evnelo could not load this page.{error.digest ? ` Reference ${error.digest}.` : ""}</p>
        <button onClick={reset} style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", cursor: "pointer" }}>Try again</button>
      </body>
    </html>
  );
}
