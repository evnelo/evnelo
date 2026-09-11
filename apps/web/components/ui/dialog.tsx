"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

/**
 * Centered panel on desktop; on small screens it becomes a bottom sheet with a grab handle so
 * long forms (registration) feel native. Motion is CSS keyframes keyed off Radix's data-state.
 */
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(23_23_15/0.45)] backdrop-blur-[2px] data-[state=open]:animate-fade" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 bg-card text-card-foreground shadow-lift focus:outline-none",
          // mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t p-5 pt-3 data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          // desktop: centered panel
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6 sm:data-[state=open]:animate-panel-in sm:data-[state=closed]:animate-panel-out",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
        {children}
        <DialogPrimitive.Close className="press absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DialogContent.displayName = "DialogContent";

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn("display pr-8 text-2xl", className)} {...props} />,
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />,
);
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
