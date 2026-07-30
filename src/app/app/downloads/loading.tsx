import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center gap-4 px-4 py-6">
      <Skeleton className="h-8 w-56 rounded-full" />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}
