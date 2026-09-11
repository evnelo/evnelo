"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin Pulse bar along the top edge while a client-side navigation is in flight, in the spirit of
 * YouTube's. Starts on a same-origin link click (or back/forward), trickles towards 90%, and
 * completes when the pathname or query actually changes. Navigations triggered from code do not
 * start it; a click whose handler cancels navigation is cleared by the give-up timer.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [width, setWidth] = useState(0);
  const loading = useRef(false);

  useEffect(() => {
    function start() {
      if (loading.current) return;
      loading.current = true;
      setWidth(8);
      setPhase("loading");
    }
    function onClick(e: MouseEvent) {
      // capture phase: Next's Link handler runs later and calls preventDefault, so that flag cannot be consulted here
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // hash or reload
      start();
    }
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("popstate", onPop); };
  }, []);

  // the route changed: finish whatever is in flight
  useEffect(() => {
    if (!loading.current) return;
    loading.current = false;
    setWidth(100);
    setPhase("done");
    const t = window.setTimeout(() => { setPhase("idle"); setWidth(0); }, 450);
    return () => window.clearTimeout(t);
  }, [pathname, search]);

  // trickle while loading; give up after a while so a cancelled navigation does not leave it hanging
  useEffect(() => {
    if (phase !== "loading") return;
    const tick = window.setInterval(() => setWidth((w) => Math.min(90, w + (90 - w) * 0.12)), 180);
    const giveUp = window.setTimeout(() => { loading.current = false; setPhase("idle"); setWidth(0); }, 8_000);
    return () => { window.clearInterval(tick); window.clearTimeout(giveUp); };
  }, [phase]);

  return (
    <div className="nav-progress" data-phase={phase} aria-hidden>
      <div className="nav-progress-bar" style={{ width: `${width}%` }} />
    </div>
  );
}
