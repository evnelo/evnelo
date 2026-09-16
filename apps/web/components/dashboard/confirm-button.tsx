"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Props = React.ComponentProps<typeof Button> & {
  action: (formData: FormData) => void | Promise<void>;
  /** The consequence, shown in the confirmation dialog under the button's label. */
  confirm: string;
  fields?: Record<string, string>;
  /** Red confirm button and a warning mark. Defaults to true: this button exists for the dangerous actions. */
  destructive?: boolean;
};

/**
 * A form-submitting button that opens the confirmation dialog first. The submit is held, the
 * dialog asks, and the form is submitted again once the person agrees.
 */
export function ConfirmButton({ action, confirm: message, fields, destructive = true, children, ...rest }: Props) {
  const { confirm, dialog } = useConfirm();
  const formRef = React.useRef<HTMLFormElement>(null);
  const confirmed = React.useRef(false);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (confirmed.current) { confirmed.current = false; return; }
    e.preventDefault();
    if (await confirm({ title: children, description: message, destructive })) {
      confirmed.current = true;
      formRef.current?.requestSubmit();
    }
  };
  return (
    <form ref={formRef} action={action} onSubmit={onSubmit}>
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton {...rest}>{children}</SubmitButton>
      {dialog}
    </form>
  );
}
