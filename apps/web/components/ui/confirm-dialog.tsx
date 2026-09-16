"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  /** What the person is about to do, usually the button's own label ("Erase", "Refund $27.00"). */
  title: React.ReactNode;
  /** The consequence, one or two sentences. */
  description?: React.ReactNode;
  /** Label of the confirming button; defaults to the title. */
  confirmLabel?: React.ReactNode;
  /** Red confirm button and a warning mark; use for anything that cannot be undone or costs money. */
  destructive?: boolean;
};

/**
 * The confirmation dialog behind every destructive action in the dashboard. Prefer `useConfirm`,
 * which turns it into `if (await confirm({ … }))`, a drop-in for the browser confirm.
 */
export function ConfirmDialog({ open, options, onConfirm, onCancel }: { open: boolean; options: ConfirmOptions | null; onConfirm: () => void; onCancel: () => void }) {
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex gap-4">
          {options?.destructive && (
            <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xl">{options?.title}</DialogTitle>
            {options?.description && <DialogDescription className="mt-2 text-sm leading-relaxed text-foreground/80">{options.description}</DialogDescription>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>{tc("actions.back")}</Button>
          <Button variant={options?.destructive ? "destructive" : "default"} onClick={onConfirm}>{options?.confirmLabel ?? options?.title}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * `const { confirm, dialog } = useConfirm()`: render `dialog` once in the component, then
 * `if (await confirm({ title, description, destructive: true })) …`. Resolves false when the
 * dialog is dismissed by any means.
 */
export function useConfirm() {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null); // kept while closing so the text does not blank out
  const resolver = React.useRef<((ok: boolean) => void) | null>(null);

  const settle = React.useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = React.useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // a second request supersedes a pending one
    resolver.current = resolve;
    setOptions(next);
    setOpen(true);
  }), []);

  const dialog = <ConfirmDialog open={open} options={options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />;
  return { confirm, dialog };
}
