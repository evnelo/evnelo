import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

/** Label + control + help/error, the unit every dashboard form is built from. */
export function Field({ label, htmlFor, help, error, optional, className, children }: { label: React.ReactNode; htmlFor?: string; help?: React.ReactNode; error?: string | null; optional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (success) return <p role="status" className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-sm text-accent-foreground">{success}</p>;
  return null;
}
