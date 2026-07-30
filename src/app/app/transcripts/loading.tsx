import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 pt-2 pb-12">
      <div>
        <Skeleton className="h-8 w-56 rounded-full" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full rounded-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
