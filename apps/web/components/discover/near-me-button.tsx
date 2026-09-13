"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Crosshair, LoaderCircle } from "lucide-react";
import { DEFAULT_RADIUS_KM } from "@evnelo/core";
import { Button } from "@/components/ui/button";

/**
 * The one piece of discovery that needs the browser: geolocation. It writes `lat`/`lng` (and the
 * visitor's time zone, so date presets line up) into the URL and lets the server do the search,
 * which keeps the result shareable. Denial is not a dead end: the city filter still works.
 */
export function NearMeButton({ query, active }: { query: string; active: boolean }) {
  const t = useTranslations("public.discover.search");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(t("unsupported"));
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const params = new URLSearchParams(query);
        params.set("lat", coords.latitude.toFixed(4));
        params.set("lng", coords.longitude.toFixed(4));
        if (!params.has("radius")) params.set("radius", String(DEFAULT_RADIUS_KM));
        params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
        params.delete("offset");
        startTransition(() => router.push(`/discover?${params.toString()}`));
      },
      () => {
        setLocating(false);
        setError(t("blocked"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const busy = locating || pending;
  return (
    <div className="flex flex-col items-center gap-1">
      <Button type="button" variant={active ? "default" : "outline"} size="pill" className="h-11 px-5" onClick={locate} disabled={busy} aria-pressed={active}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Crosshair />}
        {active ? t("nearYou") : t("nearMe")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
