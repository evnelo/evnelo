import type { SocialLink } from "@evnelo/db";
import { Globe, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const labels: Record<SocialLink["platform"], string> = {
  website: "Website", x: "X", linkedin: "LinkedIn", instagram: "Instagram", youtube: "YouTube", discord: "Discord",
  bluesky: "Bluesky", threads: "Threads", tiktok: "TikTok", mastodon: "Mastodon", other: "Link",
};

export function SocialLinks({ links, className = "" }: { links: SocialLink[]; className?: string }) {
  if (!links.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm", className)}>
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-8 items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {l.platform === "website" ? <Globe className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
            {labels[l.platform]}
          </a>
        </li>
      ))}
    </ul>
  );
}
