"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SuccessCheck } from "@/components/success-check";

const PIECES = 20;

/**
 * The last step of the registration dialog: a check that draws itself, a short burst of
 * brand-coloured confetti when tickets were issued (not for "request sent"), then the outcome
 * copy and the way to the order page rise in behind it, 80ms apart. It owns the dialog's title
 * and description while shown. CSS only; reduced motion collapses everything.
 */
export function SuccessStep({ title, message, orderUrl, celebrate }: { title: string; message: string; orderUrl?: string | null; celebrate: boolean }) {
  const t = useTranslations("event");
  return (
    <div className="relative flex flex-col items-center px-2 pb-2 pt-6 text-center">
      {celebrate && (
        <div aria-hidden className="confetti pointer-events-none absolute inset-x-0 top-0 h-40">
          {Array.from({ length: PIECES }, (_, i) => {
            // deterministic spread: fanned across the width, staggered, each piece its own tumble
            const dx = (i - (PIECES - 1) / 2) * 26 + (((i * 7) % 5) - 2) * 8;
            const dy = -(80 + ((i * 13) % 4) * 26);
            return <i key={i} style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--rot": `${(i * 67) % 360 + 180}deg`, "--delay": `${220 + ((i * 11) % 7) * 35}ms` } as React.CSSProperties} />;
          })}
        </div>
      )}
      <SuccessCheck className="size-16 bg-success text-success-foreground" iconSize={32} />
      <DialogTitle className="display animate-rise mt-5 text-2xl" style={{ "--stagger": 2 } as React.CSSProperties}>{title}</DialogTitle>
      <DialogDescription className="animate-rise mt-2 max-w-sm text-sm text-muted-foreground" style={{ "--stagger": 4 } as React.CSSProperties}>{message}</DialogDescription>
      {/* one action: the order page is the destination; the X in the corner is the way back */}
      {orderUrl ? (
        <Button asChild variant="event" size="lg" className="animate-rise mt-6" style={{ "--stagger": 6 } as React.CSSProperties}>
          <a href={orderUrl}>{t("success.viewTickets")}</a>
        </Button>
      ) : (
        <DialogClose asChild>
          <Button variant="outline" size="lg" className="animate-rise mt-6" style={{ "--stagger": 6 } as React.CSSProperties}>{t("success.done")}</Button>
        </DialogClose>
      )}
    </div>
  );
}
