import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors one BendCandidateCard column: mono chip and angle, a two-line
// title, three example titles, then the action row.
export function BendCandidateSkeleton() {
  return (
    <div className="flex flex-col py-8 first:pt-0 last:pb-0 lg:px-8 lg:py-0 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-7 w-9 rounded-md" />
        <Skeleton className="h-3.5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-5 w-4/5 rounded-full" />
      <Skeleton className="mt-2.5 h-5 w-1/2 rounded-full" />
      <div className="mt-5 flex flex-col gap-3.5">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-5/6 rounded-full" />
        <Skeleton className="h-3.5 w-4/6 rounded-full" />
      </div>
      <div className="mt-6 flex items-center gap-2 lg:mt-auto lg:pt-8">
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-14 rounded-full" />
      </div>
    </div>
  );
}
