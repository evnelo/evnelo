"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImageUploadField({ label, value, onChange, aspect = "video" }: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: "video" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    const data = new FormData();
    data.set("file", file);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: data });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) return setError(result.error ?? "Upload failed.");
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
        <span className="text-xs text-muted-foreground">JPEG, PNG or WebP · max 5 MB</span>
      </div>
      <div className={`relative overflow-hidden rounded-lg border border-dashed bg-muted/30 ${aspect === "video" ? "aspect-video" : "aspect-square max-w-40"}`}>
        {value ? <img src={value} alt="" className="size-full object-cover" /> : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-6" />
            <span>No image uploaded</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}><Trash2 /> Remove</Button>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
