"use client";

import { Printer } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** "Print or save as PDF": the page's print stylesheet hides everything but the document. */
export function PrintButton({ children, ...props }: ButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} {...props}>
      <Printer aria-hidden /> {children}
    </Button>
  );
}
