"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = React.ComponentProps<typeof Button> & {
  action: (formData: FormData) => void | Promise<void>;
  confirm: string;
  fields?: Record<string, string>;
};

/** A form-submitting button that asks first. Works without JS as a plain submit. */
export function ConfirmButton({ action, confirm, fields, children, ...rest }: Props) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton {...rest}>{children}</SubmitButton>
    </form>
  );
}
