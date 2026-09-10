"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Cover/logo picker. With S3 configured: presign → POST the file straight to the bucket →
 * confirm with the server, which returns the URL to store. Without S3: a plain URL field.
 */
export function ImageUploadField({ label, value, onChange, aspect = "video", uploadsEnabled }: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: "video" | "square";
  uploadsEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      const presign = await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentType: file.type, size: file.size }) });
      const target = (await presign.json()) as { url?: string; fields?: Record<string, string>; publicUrl?: string; error?: string };
      if (!presign.ok || !target.url || !target.fields || !target.publicUrl) return setError(target.error ?? "Upload failed.");
      const body = new FormData();
      for (const [k, v] of Object.entries(target.fields)) body.set(k, v);
      body.set("file", file); // must be last for S3 POST policies
      const put = await fetch(target.url, { method: "POST", body });
      if (!put.ok) return setError("The storage bucket rejected the upload. Check its CORS and policy settings.");
      const confirm = await fetch("/api/uploads", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: target.publicUrl }) });
      const result = (await confirm.json()) as { url?: string; error?: string };
      if (!confirm.ok || !result.url) return setError(result.error ?? "Upload failed.");
      onChange(result.url);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {uploadsEnabled && <span className="text-xs text-muted-foreground">JPEG, PNG or WebP · max 5 MB</span>}
      </div>
      <div className={`relative overflow-hidden rounded-lg border border-dashed bg-muted/30 ${aspect === "video" ? "aspect-video" : "aspect-square max-w-40"}`}>
        {value ? <img src={value} alt="" className="size-full object-cover" /> : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-6" />
            <span>No image yet</span>
          </div>
        )}
      </div>
      {uploadsEnabled ? (
        <>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
            </Button>
            {value && <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}><Trash2 /> Remove</Button>}
          </div>
        </>
      ) : (
        <Input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… (image uploads need S3 configured)" aria-label={`${label} URL`} />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
