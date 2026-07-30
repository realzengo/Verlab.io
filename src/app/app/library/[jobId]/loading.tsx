import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Skeleton className="h-5 w-32 rounded-full" />
      <Skeleton className="h-[400px] rounded-card" />
    </div>
  );
}
