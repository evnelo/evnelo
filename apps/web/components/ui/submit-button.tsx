"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button for `<form action={serverAction}>`: shows the spinner and refuses further clicks
 * while the action runs, without the page needing any client state of its own.
 */
export function SubmitButton({ pending, ...props }: ButtonProps) {
  const status = useFormStatus();
  return <Button type="submit" {...props} pending={pending || status.pending} />;
}
