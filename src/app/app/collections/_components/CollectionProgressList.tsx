import type { Collection } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Collection["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  complete: "Complete",
  failed: "Failed",
};

const STATUS_VARIANT: Record<Collection["status"], "default" | "success"> = {
  queued: "default",
  processing: "default",
  complete: "success",
  failed: "default",
};

export function CollectionProgressList({ collections }: { collections: Collection[] }) {
  return (
    <div className="flex flex-col gap-3">
      {collections.map((collection) => (
        <Card key={collection.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-heading">{collection.name}</p>
              <p className="text-xs text-body">{collection.itemCount} items</p>
            </div>
            <Badge variant={STATUS_VARIANT[collection.status]}>{STATUS_LABEL[collection.status]}</Badge>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-app">
            <div
              className={cn("h-full rounded-full", collection.status === "failed" ? "bg-red-400" : "bg-primary")}
              style={{ width: `${collection.progress}%` }}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
