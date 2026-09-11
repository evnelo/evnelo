import { Lock } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/dashboard/page-chrome";

export default function NoAccessPage() {
  return (
    <div>
      <PageHeader title="No access" description="Roles decide what each person in an organization can open." />
      <EmptyState
        className="mt-10"
        icon={Lock}
        title="This area isn't yours to open"
        description="Your role in this organization doesn't allow that. Ask an owner or admin to change it."
      />
    </div>
  );
}
