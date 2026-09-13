import type { SocialLink } from "@evnelo/db";
import { Globe, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Platform names are brands and stay as they are; only the generic ones are translated.
const brandLabels: Partial<Record<SocialLink["platform"], string>> = {
  x: "X", linkedin: "LinkedIn", instagram: "Instagram", youtube: "YouTube", discord: "Discord",
  bluesky: "Bluesky", threads: "Threads", tiktok: "TikTok", mastodon: "Mastodon",
};

/** Works in server and client components alike: `useTranslations` is synchronous in both. */
export function SocialLinks({ links, className = "" }: { links: SocialLink[]; className?: string }) {
  const t = useTranslations("event");
  if (!links.length) return null;
  const label = (platform: SocialLink["platform"]) => brandLabels[platform] ?? (platform === "website" ? t("social.website") : t("social.other"));
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm", className)}>
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-8 items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {l.platform === "website" ? <Globe className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
            {label(l.platform)}
          </a>
        </li>
      ))}
    </ul>
  );
}
