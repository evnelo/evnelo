"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Radix dropdown menu with the transitions.dev "menu dropdown" motion: it grows from the trigger
 * corner (Radix supplies the transform origin), 250ms in at 0.97 → 1, 150ms out to 0.99, keyed
 * off data-state so the closing animation keeps the content mounted until it ends.
 */
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  ({ className, sideOffset = 6, collisionPadding = 8, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 min-w-[11rem] overflow-hidden rounded-xl border border-border/80 bg-card p-1 text-card-foreground shadow-lift",
          "origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  ),
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const itemClass =
  "relative flex w-full cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-[var(--duration-quick)] data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }>(
  ({ className, destructive, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(itemClass, destructive && "text-destructive data-[highlighted]:bg-destructive/8 [&_svg]:text-destructive", className)}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Label>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>>(
  ({ className, ...props }, ref) => <DropdownMenuPrimitive.Label ref={ref} className={cn("px-2.5 pb-1 pt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground", className)} {...props} />,
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>>(
  ({ className, ...props }, ref) => <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border/80", className)} {...props} />,
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup };
