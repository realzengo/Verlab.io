import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pt-2 lg:flex-row">
      <Skeleton className="h-96 w-full rounded-2xl lg:w-80 lg:shrink-0" />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
