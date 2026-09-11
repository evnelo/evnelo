"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";
import { reportClientError } from "@/lib/report-client-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <NarrowPage
      brand
      align="center"
      icon={<TriangleAlert />}
      title="Something went wrong"
      description={
        <>
          The page hit an error. Trying again usually works; if it keeps happening, the host has been notified.
          {error.digest && <span className="mt-2 block font-mono text-xs">Reference {error.digest}</span>}
        </>
      }
    >
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>Try again</Button>
        <Button asChild variant="outline" size="lg"><a href="/">Go home</a></Button>
      </div>
    </NarrowPage>
  );
}
