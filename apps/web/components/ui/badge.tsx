import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      success: "border-transparent bg-accent text-accent-foreground",
      warning: "border-transparent bg-[#fbf1d6] text-[#6b4b00]",
      destructive: "border-transparent bg-[#f7e1dc] text-[#7a2413]",
      muted: "border-transparent bg-muted text-muted-foreground",
      /** rotated inked stamp for SOLD OUT / FREE / CANCELLED; use sparingly */
      stamp: "stamp rounded-sm border-2 bg-transparent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
