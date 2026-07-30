import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pt-8 sm:pt-12">
      <div className="mb-6 flex justify-center">
        <Skeleton className="h-6 w-72 max-w-full rounded-full" />
      </div>
      <div className="mb-8 grid grid-cols-3 gap-2 sm:mb-12 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl sm:h-16 sm:w-40 sm:rounded-2xl" />
        ))}
      </div>
      <div className="grid justify-center gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),340px))]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
