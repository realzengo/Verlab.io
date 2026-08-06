import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 pt-2 lg:flex-row">
      <Skeleton className="h-[600px] flex-1 rounded-2xl" />
      <Skeleton className="h-[600px] w-full rounded-2xl lg:w-[360px] lg:shrink-0" />
    </div>
  );
}
