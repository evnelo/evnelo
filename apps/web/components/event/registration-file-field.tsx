"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Capability = { enabled: boolean; maxBytes: number; contentTypes: string[] };
type Policy = { url: string; fields: Record<string, string>; key: string; maxBytes: number; contentTypes: string[] };

// One probe per page, shared by every file field on the form.
let capability: Promise<Capability> | undefined;
const uploadCapability = () => (capability ??= fetch("/api/uploads/registration")
  .then((response) => response.json() as Promise<Capability>)
  .catch(() => ({ enabled: false, maxBytes: 0, contentTypes: [] })));

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * Anonymous upload for a registration `file` answer: ask the server for a presigned POST, send the
 * file straight to the bucket, and hand the resulting **object key** back to the form. The file is
 * private — nobody but the organizers can read it, and only through an authenticated download route.
 */
export function RegistrationFileField({ eventId, inputId, onChange }: { eventId: string; inputId: string; onChange: (key: string) => void }) {
  const [support, setSupport] = useState<Capability>();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ name: string }>();
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void uploadCapability().then(setSupport); }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setError(undefined);
    setUploading(true);
    try {
      const presign = await fetch("/api/uploads/registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, contentType: file.type, size: file.size }),
      });
      const policy = await presign.json() as Policy & { error?: string };
      if (!presign.ok) return setError(policy.error ?? "That file could not be uploaded.");

      const body = new FormData();
      for (const [name, value] of Object.entries(policy.fields)) body.append(name, value);
      body.append("file", file);
      const stored = await fetch(policy.url, { method: "POST", body });
      if (!stored.ok) return setError("The upload was rejected. Try a different file.");

      setUploaded({ name: file.name });
      onChange(policy.key);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  if (support && !support.enabled) {
    return <p className="mt-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">File uploads are unavailable on this site. Ask the organizer how to send this.</p>;
  }

  return (
    <div className="mt-1.5">
      <input
        ref={inputRef} id={inputId} type="file" className="hidden"
        accept={support?.contentTypes.join(",") ?? "application/pdf,image/jpeg,image/png,image/webp"}
        onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }}
      />
      {uploaded ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{uploaded.name}</span>
          <button
            type="button" aria-label="Remove file" className="text-muted-foreground hover:text-foreground"
            onClick={() => { setUploaded(undefined); onChange(""); }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={uploading || !support} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
          {uploading ? "Uploading…" : "Choose a file"}
        </Button>
      )}
      <p className="mt-1 text-xs text-muted-foreground">PDF, JPEG, PNG or WebP{support ? ` · max ${megabytes(support.maxBytes)}` : ""}. Only the organizers can open it.</p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
