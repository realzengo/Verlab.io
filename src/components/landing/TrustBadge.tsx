import { Star } from "lucide-react";

export function TrustBadge() {
  return (
    <div className="mb-5 inline-flex items-center justify-center rounded-full border border-hairline bg-surface px-2 py-0.5 sm:px-2.5 sm:py-1 md:mb-8">
      <span className="inline-flex items-center">
        <span className="inline-flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-2 w-2 fill-star text-star sm:h-2.5 sm:w-2.5" />
          ))}
        </span>
        <span className="ml-1 text-[10px] font-bold text-heading sm:ml-1.5 sm:text-xs">4.8</span>
      </span>

      <div className="mx-1.5 h-2.5 w-px bg-hairline sm:mx-2 sm:h-3" />

      <span className="text-[10px] text-subtle sm:text-xs">
        <span className="font-semibold text-heading">500+</span> five-star reviews
      </span>

      <div className="mx-1.5 hidden h-2.5 w-px bg-hairline sm:mx-2 sm:block sm:h-3" />

      <span className="hidden text-[10px] text-subtle sm:block sm:text-xs">
        Trusted by <span className="font-semibold text-primary">100K+</span> creators
      </span>
    </div>
  );
}
