"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const CloseContext = React.createContext<() => void>(() => {});

/**
 * The "Actions" cell of a dashboard table: one ⋯ button, every row action in a menu. Items are
 * links, server-action forms (with an optional confirm) or client handlers; keep the primary
 * action first and destructive ones last, after a separator.
 */
export function RowActions({ label, children, pending }: { label?: string; children: React.ReactNode; pending?: boolean }) {
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  // Radix closes on the item's click and React unmounts the item synchronously, before the
  // browser runs the click's default action, so a submit button or link inside would do nothing.
  // Items that rely on that default action prevent Radix's close and call this instead: the
  // menu closes on the next tick, after the form has submitted or the navigation has started.
  const closeLater = React.useCallback(() => { setTimeout(() => setOpen(false), 0); }, []);
  return (
    <CloseContext.Provider value={closeLater}>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="size-8 px-0 text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground" pending={pending} aria-label={label ?? tc("actions.more")}>
            {!pending && <Ellipsis aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
      </DropdownMenu>
    </CloseContext.Provider>
  );
}

export const RowActionsSeparator = DropdownMenuSeparator;

type Common = { children: React.ReactNode; icon?: React.ReactNode; destructive?: boolean; disabled?: boolean };
type LinkItem = Common & { href: string; newTab?: boolean };
type FormItem = Common & { action: (formData: FormData) => void | Promise<void>; fields?: Record<string, string>; confirm?: string };
type ClickItem = Common & { onSelect: () => void; confirm?: string };

export function RowAction(props: LinkItem | FormItem | ClickItem) {
  const { children, icon, destructive, disabled } = props;
  const closeLater = React.useContext(CloseContext);
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
    // The confirm runs in onSubmit, before the request, exactly like ConfirmButton.
    return (
      <form action={props.action} onSubmit={(e) => { if (props.confirm && !window.confirm(props.confirm)) e.preventDefault(); }}>
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
      onSelect={() => { if (props.confirm && !window.confirm(props.confirm)) return; props.onSelect(); }}
    >
      {body}
    </DropdownMenuItem>
  );
}
