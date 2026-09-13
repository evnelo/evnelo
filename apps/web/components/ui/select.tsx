import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native select styled like the input; enough for dashboard forms and works inside server-rendered forms. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn("flex h-9 w-full appearance-none rounded-lg border border-input bg-card px-3 pe-8 text-sm shadow-[inset_0_1px_1px_rgb(23_23_15/0.04)] transition-[box-shadow,border-color] duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>
));
Select.displayName = "Select";
