"use client";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "t-check peer size-4 shrink-0 rounded-[5px] border border-input bg-card transition-[background-color,border-color] duration-(--duration-quick) ease-smooth-out data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* always mounted so the tick can draw in and retract (globals.css .t-check) */}
      <CheckboxPrimitive.Indicator forceMount className="flex items-center justify-center text-current">
        <Check className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
