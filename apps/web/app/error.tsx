"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-client-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="display text-3xl">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted-foreground">The page hit an error. Trying again usually works; if it keeps happening, the host has been notified.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline"><a href="/">Go home</a></Button>
      </div>
    </div>
  );
}
