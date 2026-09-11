import Link from "next/link";
import { MailX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";

export const metadata = { title: "Invitation", robots: "noindex" };

export default function InviteExpiredPage() {
  return (
    <NarrowPage
      icon={<MailX />}
      eyebrow="Invitation"
      title="This invitation is no longer valid"
      description="It may have expired or been used the maximum number of times. Ask the host for a new link."
    >
      <Link href="/discover" className={buttonVariants({ variant: "outline", size: "lg" })}>Browse public events</Link>
    </NarrowPage>
  );
}
