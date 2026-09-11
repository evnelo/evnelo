import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary font-semibold text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_90%,black)]",
        event: "bg-event font-semibold text-event-foreground hover:brightness-95",
        outline: "border border-input bg-transparent hover:bg-muted/70",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary)_90%,black)]",
        /** Ink button for strong secondary actions (brand: "dark button") */
        dark: "bg-ink font-semibold text-paper hover:bg-[color-mix(in_oklab,var(--evnelo-ink)_85%,white)]",
        ghost: "hover:bg-muted/80",
        link: "text-primary underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklab,var(--destructive)_92%,black)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-[0.5rem] px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-base",
        pill: "h-9 rounded-full px-4",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
