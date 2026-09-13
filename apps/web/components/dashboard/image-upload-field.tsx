"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Crop, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// only pulled in when someone actually crops a cover
const ImageCropDialog = dynamic(() => import("./image-crop-dialog").then((m) => m.ImageCropDialog), { ssr: false });

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** "video" is the 16:7 cover, "square" a logo, "avatar"/"thumb" compact 48px previews. */
  aspect?: "video" | "square" | "avatar" | "thumb";
  uploadsEnabled: boolean;
  /** Offer the 16:7 crop step before uploading. Covers only. */
  croppable?: boolean;
  id?: string;
};

/**
 * Cover/logo/avatar picker. With S3 configured: presign → POST the file straight to the bucket →
 * confirm with the server, which returns the URL to store. Without S3: a plain URL field.
 */
export function ImageUploadField({ label, value, onChange, aspect = "video", uploadsEnabled, croppable = false, id }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingCrop, setPendingCrop] = useState<File>();
  const compact = aspect === "avatar" || aspect === "thumb";
  const round = aspect === "avatar";
  const fieldId = id ?? `image-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      const presign = await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentType: file.type, size: file.size }) });
      const target = (await presign.json()) as { url?: string; fields?: Record<string, string>; publicUrl?: string; error?: string };
      if (!presign.ok || !target.url || !target.fields || !target.publicUrl) return setError(target.error ?? t("imageUpload.uploadFailed"));
      const body = new FormData();
      for (const [k, v] of Object.entries(target.fields)) body.set(k, v);
      body.set("file", file); // must be last for S3 POST policies
      const put = await fetch(target.url, { method: "POST", body });
      if (!put.ok) return setError(t("imageUpload.bucketRejected"));
      const confirm = await fetch("/api/uploads", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: target.publicUrl }) });
      const result = (await confirm.json()) as { url?: string; error?: string };
      if (!confirm.ok || !result.url) return setError(result.error ?? t("imageUpload.uploadFailed"));
      onChange(result.url);
    } catch {
      setError(t("imageUpload.connectionFailed"));
    } finally {
      setUploading(false);
    }
  };

  const choose = (file?: File) => {
    if (!file) return;
    setError(undefined);
    if (croppable) return setPendingCrop(file);
    void upload(file);
  };

  const preview = value
    ? <img src={value} alt="" className={`size-full object-cover ${round ? "rounded-full" : ""}`} />
    : (
      <div className="flex size-full flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground">
        <ImagePlus className={compact ? "size-4" : "size-6"} />
        {!compact && <span className="text-sm">{t("imageUpload.noImage")}</span>}
      </div>
    );

  const controls = uploadsEnabled ? (
    <>
      <input ref={inputRef} id={fieldId} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : croppable ? <Crop /> : <ImagePlus />}
          {uploading ? t("imageUpload.uploading") : value ? (compact ? t("imageUpload.replace") : t("imageUpload.replaceImage")) : compact ? t("imageUpload.upload") : t("imageUpload.uploadImage")}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}><Trash2 /> {tc("actions.remove")}</Button>}
      </div>
    </>
  ) : (
    <Input id={fieldId} type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("imageUpload.urlPlaceholder")} aria-label={t("imageUpload.urlLabel", { label })} />
  );

  const dialog = pendingCrop && (
    <ImageCropDialog
      file={pendingCrop}
      onCancel={() => setPendingCrop(undefined)}
      onCropped={(cropped) => { setPendingCrop(undefined); void upload(cropped); }}
    />
  );

  if (compact) {
    return (
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <div className={`size-12 shrink-0 overflow-hidden border border-dashed bg-muted/30 ${round ? "rounded-full" : "rounded-md"}`}>{preview}</div>
          <div className="min-w-0 flex-1">{controls}</div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {dialog}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {uploadsEnabled && <span className="text-xs text-muted-foreground">{t("imageUpload.formats")}</span>}
      </div>
      <div className={`relative overflow-hidden rounded-lg border border-dashed bg-muted/30 ${aspect === "video" ? "aspect-[16/7]" : "aspect-square max-w-40"}`}>
        {preview}
      </div>
      {controls}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {dialog}
    </div>
  );
}
