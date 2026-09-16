"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirm, type ConfirmOptions } from "@/components/ui/confirm-dialog";

const RowContext = React.createContext<{ closeLater: () => void; confirm: (o: ConfirmOptions) => Promise<boolean> }>({ closeLater: () => {}, confirm: async () => true });

/**
 * The "Actions" cell of a dashboard table: one ⋯ button, every row action in a menu. Items are
 * links, server-action forms (with an optional confirm) or client handlers; keep the primary
 * action first and destructive ones last, after a separator. Confirms open the shared
 * confirmation dialog, never the browser's.
 */
export function RowActions({ label, children, pending }: { label?: string; children: React.ReactNode; pending?: boolean }) {
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const { confirm, dialog } = useConfirm();
  // Radix closes on the item's click and React unmounts the item synchronously, before the
  // browser runs the click's default action, so a submit button or link inside would do nothing.
  // Items that rely on that default action prevent Radix's close and call this instead: the
  // menu closes on the next tick, after the form has submitted or the navigation has started.
  const closeLater = React.useCallback(() => { setTimeout(() => setOpen(false), 0); }, []);
  const ctx = React.useMemo(() => ({ closeLater, confirm }), [closeLater, confirm]);
  return (
    <RowContext.Provider value={ctx}>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="size-8 px-0 text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground" pending={pending} aria-label={label ?? tc("actions.more")}>
            {!pending && <Ellipsis aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </RowContext.Provider>
  );
}

export const RowActionsSeparator = DropdownMenuSeparator;

type Common = { children: React.ReactNode; icon?: React.ReactNode; destructive?: boolean; disabled?: boolean };
type LinkItem = Common & { href: string; newTab?: boolean };
type FormItem = Common & { action: (formData: FormData) => void | Promise<void>; fields?: Record<string, string>; confirm?: string };
type ClickItem = Common & { onSelect: () => void; confirm?: string };

export function RowAction(props: LinkItem | FormItem | ClickItem) {
  const { children, icon, destructive, disabled } = props;
  const { closeLater, confirm } = React.useContext(RowContext);
  const body = <>{icon}<span className="truncate">{children}</span></>;
  const keepOpenThenClose = (e: Event) => { e.preventDefault(); closeLater(); };

  if ("href" in props) {
    return (
      <DropdownMenuItem asChild destructive={destructive} disabled={disabled} onSelect={keepOpenThenClose}>
        <a href={props.href} {...(props.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{body}</a>
      </DropdownMenuItem>
    );
  }

  if ("action" in props) {
    // With a confirm, the submit is held and the dialog asks. By the time the person agrees the
    // menu, and this form with it, is gone, so the action is called with the captured form data
    // rather than by submitting the form again.
    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      if (!props.confirm) return;
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      if (await confirm({ title: children, description: props.confirm, destructive })) React.startTransition(() => { void props.action(data); });
    };
    return (
      <form action={props.action} onSubmit={onSubmit}>
        {props.fields && Object.entries(props.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <DropdownMenuItem asChild destructive={destructive} disabled={disabled} onSelect={keepOpenThenClose}>
          <button type="submit">{body}</button>
        </DropdownMenuItem>
      </form>
    );
  }

  return (
    <DropdownMenuItem
      destructive={destructive}
      disabled={disabled}
      onSelect={async () => { if (props.confirm && !(await confirm({ title: children, description: props.confirm, destructive }))) return; props.onSelect(); }}
    >
      {body}
    </DropdownMenuItem>
  );
}
