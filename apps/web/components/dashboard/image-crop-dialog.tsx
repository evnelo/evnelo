"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cover art is rendered at 16:7 everywhere, so that is the only ratio we offer. */
export const COVER_ASPECT = 16 / 7;
const OUTPUT_WIDTH = 1600;
const MAX_ZOOM = 3;

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/**
 * Drag-to-position + zoom crop, rendered to a canvas before upload so the bucket only ever holds
 * the framed image. Deliberately dependency-free: it is two transforms and one drawImage.
 */
export function ImageCropDialog({ file, onCancel, onCropped }: { file: File; onCancel: () => void; onCropped: (file: File) => void }) {
  const [src, setSrc] = useState<string>();
  const [image, setImage] = useState<HTMLImageElement>();
  const [frame, setFrame] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; start: Point; origin: Point } | undefined>(undefined);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const element = new Image();
    element.onload = () => setImage(element);
    element.onerror = () => setError("That image could not be opened.");
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    setFrame({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /** Scale that makes the image cover the frame, multiplied by the zoom slider. */
  const scale = image && frame.width
    ? Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight) * zoom
    : 1;

  const clamp = useCallback((next: Point, currentScale: number): Point => {
    if (!image || !frame.width) return next;
    const maxX = Math.max(0, (image.naturalWidth * currentScale - frame.width) / 2);
    const maxY = Math.max(0, (image.naturalHeight * currentScale - frame.height) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
  }, [image, frame]);

  useEffect(() => { setOffset((current) => clamp(current, scale)); }, [scale, clamp]);

  const apply = async () => {
    if (!image || !frame.width) return;
    setBusy(true);
    try {
      const sourceWidth = frame.width / scale;
      const sourceHeight = frame.height / scale;
      const sourceX = image.naturalWidth / 2 - offset.x / scale - sourceWidth / 2;
      const sourceY = image.naturalHeight / 2 - offset.y / scale - sourceHeight / 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(Math.min(OUTPUT_WIDTH, sourceWidth)));
      canvas.height = Math.max(1, Math.round(canvas.width / COVER_ASPECT));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("unsupported");
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("unsupported");
      onCropped(new File([blob], "cover.webp", { type: "image/webp" }));
    } catch {
      setError("This browser could not render the crop. Upload the image as it is instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Frame the cover image" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl space-y-4 rounded-lg border bg-card p-4 shadow-lg">
        <div>
          <p className="text-sm font-medium">Frame the cover</p>
          <p className="text-xs text-muted-foreground">Drag to position and zoom to fill. Saved at 16:7, the ratio event pages use.</p>
        </div>
        <div
          ref={frameRef}
          className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-md bg-muted active:cursor-grabbing"
          style={{ aspectRatio: "16 / 7" }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: offset };
          }}
          onPointerMove={(event) => {
            const state = drag.current;
            if (!state || state.pointerId !== event.pointerId) return;
            setOffset(clamp({ x: state.origin.x + event.clientX - state.start.x, y: state.origin.y + event.clientY - state.start.y }, scale));
          }}
          onPointerUp={() => { drag.current = undefined; }}
          onPointerCancel={() => { drag.current = undefined; }}
        >
          {src && image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: `${image.naturalWidth * scale}px`,
                height: `${image.naturalHeight * scale}px`,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          )}
        </div>
        <label className="flex items-center gap-3 text-sm">
          Zoom
          <input
            type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1 flex-1 cursor-pointer accent-[var(--primary)]"
            aria-label="Zoom"
          />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={() => void apply()} disabled={!image || busy}>{busy ? <Loader2 className="animate-spin" /> : null} Use this crop</Button>
        </div>
      </div>
    </div>
  );
}
