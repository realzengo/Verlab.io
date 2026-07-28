import { Star } from "lucide-react";

export function TrustBadge() {
  return (
    <div className="mt-12 mb-6 inline-flex items-center justify-center gap-1.5 sm:mt-0 sm:mb-12 sm:gap-2">
      <span className="inline-flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 drop-shadow-[0_1px_2px_rgba(250,204,21,0.4)] sm:h-4 sm:w-4"
          />
        ))}
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-blue-600 sm:hidden">
        100k+ Users
      </span>
      <span className="hidden text-xs font-bold uppercase tracking-wide text-blue-600 sm:inline sm:text-base">
        100k+ Users Worldwide
      </span>
    </div>
  );
}
