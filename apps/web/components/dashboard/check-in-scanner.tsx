"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Search, Undo2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseTicketToken } from "@/lib/ticket-token";

/**
 * Door scanner. Camera frames are decoded with jsQR; a decoded ticket is checked in through
 * POST /api/checkin/{event}. The manifest (every confirmed ticket with a hash of its token) is
 * kept in memory and refreshed every 30s: it powers the search list and lets the phone keep
 * validating scans without signal, queueing check-ins to replay once it is back online.
 */

type ManifestTicket = { id: string; h: string; n: string; e: string; t: string; g: string | null; c: string | null };
type Stats = { checkedIn: number; confirmed: number };
type Recent = { ticketId: string; at: string; method: string; name: string; ticketTypeName: string };
type Manifest = { generatedAt: string; stats: Stats; recent: Recent[]; tickets: ManifestTicket[] };
type Outcome = "ok" | "already" | "not_found" | "revoked" | "not_confirmed" | "wrong_event" | "offline_ok" | "offline_unknown" | "error";
type Result = { outcome: Outcome; name?: string; ticketType?: string; hostName?: string | null; checkedInAt?: string | null; ticketId?: string; at: number };
type Queued = { ticketId: string; at: string };

const OUTCOME: Record<Outcome, { title: string; tone: "ok" | "warn" | "bad" }> = {
  ok: { title: "Checked in", tone: "ok" },
  offline_ok: { title: "Checked in (offline, will sync)", tone: "ok" },
  already: { title: "Already checked in", tone: "warn" },
  not_confirmed: { title: "Registration not confirmed", tone: "bad" },
  revoked: { title: "Ticket cancelled or refunded", tone: "bad" },
  wrong_event: { title: "Ticket is for another event", tone: "bad" },
  not_found: { title: "Not a valid ticket", tone: "bad" },
  offline_unknown: { title: "Unknown ticket (offline)", tone: "bad" },
  error: { title: "Could not check in", tone: "bad" },
};

/** Sunlight legibility: a filled banner, not a tint. The band repeats the verdict as pure colour. */
const TONE: Record<"ok" | "warn" | "bad", { panel: string; band: string; button: string }> = {
  ok: { panel: "bg-lime text-ink", band: "bg-ink", button: "border-ink/30 bg-ink/5 text-ink hover:bg-ink/10" },
  warn: { panel: "bg-[#FFD666] text-ink", band: "bg-[#8A6100]", button: "border-ink/30 bg-ink/5 text-ink hover:bg-ink/10" },
  bad: { panel: "bg-[#8E1E14] text-white", band: "bg-[#FF9C8A]", button: "border-white/40 bg-white/10 text-white hover:bg-white/20" },
};

const queueKey = (eventId: string) => `evnelo-checkin-queue-${eventId}`;
const manifestKey = (eventId: string) => `evnelo-checkin-manifest-${eventId}`;
const readJson = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const time = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "");

export function CheckInScanner({ eventId, initial }: { eventId: string; initial: Manifest }) {
  const [manifest, setManifest] = useState<Manifest>(initial);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<"scan" | "search">("scan");
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState<"idle" | "on" | "denied" | "unsupported">("idle");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScan = useRef<{ token: string; hash: string; at: number }>({ token: "", hash: "", at: 0 });
  const queueRef = useRef<Queued[]>([]);
  const syncing = useRef(false);

  // persistence: cached manifest + offline queue survive a reload at the door
  useEffect(() => {
    const cached = readJson<Manifest | null>(manifestKey(eventId), null);
    if (cached && cached.generatedAt > initial.generatedAt) setManifest(cached);
    const q = readJson<Queued[]>(queueKey(eventId), []);
    queueRef.current = q; setQueue(q);
    setOnline(navigator.onLine);
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [eventId, initial.generatedAt]);
  useEffect(() => { try { localStorage.setItem(manifestKey(eventId), JSON.stringify(manifest)); } catch { /* storage full or disabled */ } }, [manifest, eventId]);
  const saveQueue = (q: Queued[]) => { queueRef.current = q; setQueue(q); localStorage.setItem(queueKey(eventId), JSON.stringify(q)); };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin/${eventId}/manifest`, { cache: "no-store" });
      if (!res.ok) return;
      setManifest((await res.json()) as Manifest);
      setOnline(true);
    } catch { setOnline(false); }
  }, [eventId]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const applyServer = (data: { stats?: Stats; recent?: Recent[] }) => setManifest((m) => ({ ...m, stats: data.stats ?? m.stats, recent: data.recent ?? m.recent }));
  // online: the server response carries authoritative stats; offline: adjust the counter locally
  const markLocal = (ticketId: string, checkedInAt: string | null, adjustStats = false) => setManifest((m) => {
    const wasIn = m.tickets.find((t) => t.id === ticketId)?.c;
    const delta = adjustStats ? (checkedInAt ? 1 : 0) - (wasIn ? 1 : 0) : 0;
    return { ...m, stats: { ...m.stats, checkedIn: m.stats.checkedIn + delta }, tickets: m.tickets.map((t) => (t.id === ticketId ? { ...t, c: checkedInAt } : t)) };
  });

  // replay queued offline check-ins
  const sync = useCallback(async () => {
    if (syncing.current || !queueRef.current.length) return;
    syncing.current = true;
    try {
      for (const item of [...queueRef.current]) {
        const res = await fetch(`/api/checkin/${eventId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticketId: item.ticketId, method: "scan" }) });
        if (!res.ok && res.status >= 500) break;
        if (res.status === 401 || res.status === 403) break;
        const data = (await res.json()) as { outcome: Outcome; stats?: Stats; recent?: Recent[] };
        applyServer(data);
        saveQueue(queueRef.current.filter((q) => q !== item));
      }
      setOnline(true);
    } catch { setOnline(false); } finally { syncing.current = false; }
  }, [eventId]);
  useEffect(() => { if (online) void sync().then(refresh); }, [online, sync, refresh]);

  const feedback = (tone: "ok" | "warn" | "bad") => { try { navigator.vibrate?.(tone === "ok" ? 80 : tone === "warn" ? [60, 60, 60] : [200, 80, 200]); } catch { /* unsupported */ } };
  const show = (r: Omit<Result, "at">) => { setResult({ ...r, at: Date.now() }); feedback(OUTCOME[r.outcome].tone); };

  const checkIn = useCallback(async (ref: { token?: string; ticketId?: string }, method: "scan" | "manual") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/checkin/${eventId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...ref, method }) });
      if (!res.ok) { const data = (await res.json().catch(() => ({}))) as { error?: string }; show({ outcome: "error", name: data.error }); return; }
      const data = (await res.json()) as { outcome: Outcome; attendee: { ticketId: string; name: string; ticketTypeName: string; hostName: string | null } | null; checkedInAt: string | null; stats: Stats; recent: Recent[] };
      setOnline(true);
      applyServer(data);
      if (data.attendee) markLocal(data.attendee.ticketId, data.outcome === "ok" || data.outcome === "already" ? data.checkedInAt : null);
      show({ outcome: data.outcome, name: data.attendee?.name, ticketType: data.attendee?.ticketTypeName, hostName: data.attendee?.hostName, checkedInAt: data.checkedInAt, ticketId: data.attendee?.ticketId });
    } catch {
      // no network: validate against the manifest and queue the check-in
      setOnline(false);
      const found = ref.ticketId ? manifest.tickets.find((t) => t.id === ref.ticketId) : manifest.tickets.find((t) => t.h === lastScan.current.hash);
      if (!found) { show({ outcome: "offline_unknown" }); return; }
      if (found.c) { show({ outcome: "already", name: found.n, ticketType: found.t, hostName: found.g, checkedInAt: found.c, ticketId: found.id }); return; }
      const at = new Date().toISOString();
      markLocal(found.id, at, true);
      saveQueue([...queueRef.current, { ticketId: found.id, at }]);
      show({ outcome: "offline_ok", name: found.n, ticketType: found.t, hostName: found.g, checkedInAt: at, ticketId: found.id });
    } finally { setBusy(false); }
  }, [eventId, manifest.tickets]);

  const onToken = useCallback(async (raw: string, method: "scan" | "manual") => {
    const token = parseTicketToken(raw);
    if (!token) { show({ outcome: "not_found" }); return; }
    const now = Date.now();
    if (method === "scan" && lastScan.current.token === token && now - lastScan.current.at < 4_000) return; // same code still in frame
    lastScan.current = { token, hash: await sha256Hex(token), at: now };
    await checkIn({ token }, method);
  }, [checkIn]);

  const undo = async (ticketId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/checkin/${eventId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticketId }) });
      if (res.ok) { applyServer((await res.json()) as { stats: Stats; recent: Recent[] }); markLocal(ticketId, null); setResult(null); }
    } catch { setOnline(false); } finally { setBusy(false); }
  };

  // camera + decode loop
  useEffect(() => {
    if (mode !== "scan") return;
    let stream: MediaStream | undefined; let raf = 0; let stopped = false;
    const video = videoRef.current;
    if (!video) return;
    if (!navigator.mediaDevices?.getUserMedia) { setCamera("unsupported"); return; }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let jsQR: typeof import("jsqr").default | undefined;
    let lastDecode = 0;
    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (!jsQR || now - lastDecode < 120 || video.readyState < 2) return;
      lastDecode = now;
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h || !ctx) return;
      const scale = Math.min(1, 640 / w);
      canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data) void onToken(code.data, "scan");
    };
    (async () => {
      try {
        jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        setCamera("on");
        raf = requestAnimationFrame(tick);
      } catch { setCamera("denied"); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); if (video) video.srcObject = null; };
  }, [mode, onToken]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return manifest.tickets.slice(0, 50);
    return manifest.tickets.filter((t) => t.n.toLowerCase().includes(q) || t.e.toLowerCase().includes(q)).slice(0, 50);
  }, [manifest.tickets, query]);

  const pct = manifest.stats.confirmed ? Math.round((manifest.stats.checkedIn / manifest.stats.confirmed) * 100) : 0;
  const tone = result ? OUTCOME[result.outcome].tone : null;

  return (
    <div className="space-y-4">
      {/* the counter: the one number someone on the door glances at between scans */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="eyebrow">Checked in</p>
            <p className="mt-1 flex items-baseline gap-2 font-display leading-none">
              <span className="text-5xl tabular-nums">{manifest.stats.checkedIn}</span>
              <span className="text-xl tabular-nums text-muted-foreground">/ {manifest.stats.confirmed}</span>
            </p>
          </div>
          <div className="flex shrink-0 rounded-full border border-border/80 bg-muted/50 p-1" role="group" aria-label="Check-in mode">
            <button
              type="button"
              onClick={() => setMode("scan")}
              aria-pressed={mode === "scan"}
              className={cn("press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm", mode === "scan" ? "bg-card font-medium text-foreground shadow-card" : "text-muted-foreground")}
            >
              <Camera className="size-4" /> Scan
            </button>
            <button
              type="button"
              onClick={() => setMode("search")}
              aria-pressed={mode === "search"}
              className={cn("press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm", mode === "search" ? "bg-card font-medium text-foreground shadow-card" : "text-muted-foreground")}
            >
              <Search className="size-4" /> Search
            </button>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{pct}% of confirmed tickets · updated {time(manifest.generatedAt)}{queue.length ? ` · ${queue.length} waiting to sync` : ""}</span>
          {!online && <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-1 font-medium text-warning-foreground"><WifiOff className="size-3.5" /> Offline: scans are saved and synced later</span>}
        </div>
      </div>

      {result && (
        <div role="status" aria-live="assertive" className={cn("overflow-hidden rounded-xl shadow-lift", TONE[tone ?? "bad"].panel)}>
          <div className={cn("h-2 w-full", TONE[tone ?? "bad"].band)} aria-hidden />
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">{OUTCOME[result.outcome].title}</p>
              {result.name && result.outcome !== "error" && (
                <p className="mt-1 font-display text-3xl leading-tight">
                  {result.name}
                </p>
              )}
              {result.hostName && <p className="text-sm opacity-80">Guest of {result.hostName}</p>}
              {result.ticketType && <p className="mt-1 text-base opacity-90">{result.ticketType}{result.outcome === "already" && result.checkedInAt ? ` · in at ${time(result.checkedInAt)}` : ""}</p>}
              {result.outcome === "error" && result.name && <p className="mt-1 text-sm opacity-80">{result.name}</p>}
            </div>
            {(result.outcome === "ok" || result.outcome === "already") && result.ticketId && (
              <Button variant="outline" className={cn("shrink-0", TONE[tone ?? "bad"].button)} disabled={busy || !online} onClick={() => undo(result.ticketId!)}><Undo2 className="size-4" /> Undo</Button>
            )}
          </div>
        </div>
      )}

      {mode === "scan" ? (
        <div className="space-y-3">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black sm:aspect-[4/3]">
            <video ref={videoRef} className="size-full object-cover" muted playsInline />
            {camera !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/90">
                <CameraOff className="size-7" strokeWidth={1.5} />
                {camera === "denied" ? "Camera access was blocked. Allow the camera for this site, or use Search to check people in by name." : camera === "unsupported" ? "This browser can't use the camera. Use Search, or paste a ticket link below." : "Starting camera…"}
              </div>
            )}
            {camera === "on" && (
              <>
                {/* dim everything outside the target square and mark its corners */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]">
                  {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
                    <span key={c} className={cn("absolute size-9 border-white", c)} />
                  ))}
                </div>
                <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm font-medium text-white drop-shadow">Point at the QR code on the ticket</p>
              </>
            )}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { void onToken(manual, "manual"); setManual(""); } }}>
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or paste a ticket link / code" aria-label="Ticket link or code" className="h-12 text-base" />
            <Button type="submit" variant="outline" className="h-12 shrink-0 px-5" pending={busy}>Check in</Button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search attendees" className="h-12 pl-11 text-base" />
          </div>
          <ul className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
            {matches.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No confirmed attendees match.</li>}
            {matches.map((t, i) => (
              <li key={t.id} className={cn("flex min-h-14 items-center justify-between gap-3 px-3 py-2", i > 0 && "hairline")}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.n}{t.g ? <span className="text-xs text-muted-foreground"> · guest of {t.g}</span> : null}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.t} · {t.e}{t.c ? ` · in at ${time(t.c)}` : ""}</p>
                </div>
                {t.c ? (
                  <Button size="sm" variant="ghost" className="h-10 shrink-0 px-3 text-muted-foreground" disabled={busy || !online} onClick={() => undo(t.id)}><Undo2 className="size-4" /> Undo</Button>
                ) : (
                  <Button className="h-10 w-28 shrink-0" pending={busy} onClick={() => checkIn({ ticketId: t.id }, "manual")}>Check in</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {manifest.recent.length > 0 && (
        <div>
          <h2 className="eyebrow">Recent</h2>
          <ul className="mt-2 overflow-hidden rounded-xl border border-border/80 bg-card text-sm shadow-card">
            {manifest.recent.slice(0, 10).map((r, i) => (
              <li key={`${r.ticketId}-${r.at}`} className={cn("flex min-h-12 items-center justify-between gap-3 px-3 py-2", i > 0 && "hairline")}>
                <span className="min-w-0 truncate">{r.name} <span className="text-muted-foreground">· {r.ticketTypeName} · {time(r.at)}{r.method === "manual" ? " · manual" : ""}</span></span>
                <button type="button" className="press shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 disabled:opacity-50" disabled={busy || !online} onClick={() => undo(r.ticketId)}>Undo</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
