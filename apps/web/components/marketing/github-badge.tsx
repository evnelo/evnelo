"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const GITHUB_REPO_URL = "https://github.com/evnelo/evnelo";

/** GitHub mark (octocat) as an inline path so it needs no extra icon set. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * "Star us" style badge for the header, shown on the landing page only. No star count until there
 * is one worth showing; the slot is there (`count`) for when the repo goes public.
 */
export function GithubBadge({ count, className }: { count?: number | null; className?: string }) {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <a
      href={GITHUB_REPO_URL}
      rel="noopener noreferrer"
      target="_blank"
      aria-label="Evnelo on GitHub"
      className={cn("press inline-flex h-9 items-center overflow-hidden rounded-full border border-input bg-card text-sm font-medium hover:bg-muted/70", className)}
    >
      <span className="inline-flex items-center gap-1.5 px-3"><GithubMark className="size-4" /> GitHub</span>
      {count != null && count > 0 && <span className="border-l border-input bg-muted px-2.5 text-xs tabular-nums text-muted-foreground">{Intl.NumberFormat("en", { notation: "compact" }).format(count)}</span>}
    </a>
  );
}
