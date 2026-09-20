"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** On phones, cover the whole screen instead of rising as a bottom sheet (long flows such as checkout). Desktop is unchanged. */
  fullScreen?: boolean;
};

/**
 * Centered panel on desktop; on small screens it becomes a bottom sheet with a grab handle so
 * long forms feel native, or with `fullScreen` a panel covering the whole screen (registration).
 * Both phone variants are sized by `position: fixed` edges, never by vh units: iOS Safari resizes
 * fixed elements as its toolbars collapse and expand, while 100vh stays the toolbar-less height
 * and 100dvh lags and repaints as the bars move. Motion is CSS keyframes keyed off Radix's
 * data-state: the panel opens in 250ms and closes in 150ms, the sheet 400/350, the overlay fades with them.
 */
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, fullScreen = false, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(23_23_15/0.45)] backdrop-blur-[2px] data-[state=open]:animate-fade data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 overflow-y-auto overscroll-contain bg-card text-card-foreground shadow-lift focus:outline-none data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          // mobile: bottom sheet, or the whole screen
          fullScreen ? "inset-0 p-5" : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t p-5 pt-3",
          // desktop: centered panel
          "sm:inset-x-auto sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6 sm:data-[state=open]:animate-panel-in sm:data-[state=closed]:animate-panel-out",
          className,
        )}
        {...props}
      >
        {!fullScreen && <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />}
        {children}
        <DialogPrimitive.Close className="press absolute end-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">{useTranslations("common")("actions.close")}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DialogContent.displayName = "DialogContent";

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn("display pe-8 text-2xl", className)} {...props} />,
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />,
);
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
