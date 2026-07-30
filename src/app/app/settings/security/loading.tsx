import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-11 w-full rounded-xl" />
      ))}
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
  );
}
