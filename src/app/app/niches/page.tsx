import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

// Locked/not-yet-released per product decision -- real implementation (data
// fetching + <NicheFinder>) is preserved in git history, not deleted.
export default function NichesPage() {
  return (
    <div className="mt-4 flex flex-col gap-6 sm:mt-6 sm:gap-10">
      <EmptyState
        icon={Compass}
        title="Niche Finder is coming soon"
        description="This tool isn't available yet. Check back soon."
        action={{ label: "Back to dashboard", href: "/app" }}
      />
    </div>
  );
}
