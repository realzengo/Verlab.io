export function BendCandidateSkeleton() {
  return (
    <div className="flex h-56 flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <div className="h-4 w-2/3 animate-pulse rounded-full bg-accent" />
      <div className="h-5 w-1/3 animate-pulse rounded-full bg-accent" />
      <div className="mt-2 flex flex-col gap-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-accent" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent" />
        <div className="h-3 w-4/6 animate-pulse rounded-full bg-accent" />
      </div>
    </div>
  );
}
