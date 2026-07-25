export function BendCandidateSkeleton() {
  return (
    <div className="flex h-56 flex-col overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-accent" />
        <div className="h-5 w-1/3 animate-pulse rounded-full bg-accent" />
        <div className="mt-2 flex flex-col gap-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-accent" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent" />
          <div className="h-3 w-4/6 animate-pulse rounded-full bg-accent" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-hairline bg-app/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-accent" />
          <div className="h-8 w-16 animate-pulse rounded-lg bg-accent" />
        </div>
        <div className="h-8 w-20 animate-pulse rounded-lg bg-accent" />
      </div>
    </div>
  );
}
