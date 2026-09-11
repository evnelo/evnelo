import Link from "next/link";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * The narrow editorial layout every auth, invite and status page shares: an optional icon in a
 * soft circle, an eyebrow, a serif title, one paragraph and one clear action underneath.
 * `brand` adds the wordmark for pages that render outside the public chrome (errors, 404).
 */
export function NarrowPage({
  title, eyebrow, description, icon, brand = false, align = "start", width = "md", className, children,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  brand?: boolean;
  align?: "start" | "center";
  width?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
}) {
  const centered = align === "center";
  return (
    <div className={cn("mx-auto px-4 py-16 sm:py-24", width === "sm" ? "max-w-sm" : "max-w-md", centered && "text-center", className)}>
      {brand && (
        <Link href="/" className={cn("press mb-10 inline-flex rounded-md", centered && "justify-center")}><Brand /></Link>
      )}
      <div className="animate-rise">
        {icon && (
          <div className={cn("mb-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-6", centered && "mx-auto")}>{icon}</div>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={cn("display text-4xl sm:text-5xl", eyebrow && "mt-2")}>{title}</h1>
        {description && <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}
