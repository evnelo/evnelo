import Link from "next/link";
import { Hourglass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";

export const metadata = { title: "Waitlist", robots: "noindex" };

export default function OfferExpiredPage() {
  return (
    <NarrowPage
      icon={<Hourglass />}
      eyebrow="Waitlist"
      title="This spot is no longer reserved"
      description="The offer expired or was already used. You are still on the waitlist: if another spot opens, the host can offer it to you again."
    >
      <Link href="/discover" className={buttonVariants({ variant: "outline", size: "lg" })}>Browse public events</Link>
    </NarrowPage>
  );
}
