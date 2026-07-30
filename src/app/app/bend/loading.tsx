import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col items-center gap-6 pt-2">
      <Skeleton className="h-7 w-64 max-w-full rounded-full" />
      <Skeleton className="h-72 w-full max-w-2xl rounded-card" />
    </div>
  );
}
