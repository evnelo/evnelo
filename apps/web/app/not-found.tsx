import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <NarrowPage
      brand
      align="center"
      icon={<Compass />}
      eyebrow="404"
      title="There's nothing here"
      description="The link may be old, the event may have been taken down, or the address has a typo."
    >
      <Link href="/discover" className={buttonVariants({ size: "lg" })}>Browse public events</Link>
    </NarrowPage>
  );
}
