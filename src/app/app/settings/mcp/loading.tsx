import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-[76px] w-full rounded-2xl" />
    </div>
  );
}
