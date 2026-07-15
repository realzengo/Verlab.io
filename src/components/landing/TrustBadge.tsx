import { Star } from "lucide-react";

export function TrustBadge() {
  return (
    <div className="mb-6 inline-flex items-center justify-center rounded-full border border-hairline bg-surface px-2.5 py-1 md:mb-8">
      <span className="inline-flex items-center">
        <span className="inline-flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-2.5 w-2.5 fill-star text-star" />
          ))}
        </span>
        <span className="ml-1 text-[11px] font-bold text-heading">4.8</span>
      </span>

      <div className="mx-2 h-3 w-px bg-hairline" />

      <span className="text-[11px] text-subtle">
        <span className="font-semibold text-heading">500+</span> five-star reviews
      </span>

      <div className="mx-2 hidden h-3 w-px bg-hairline sm:block" />

      <span className="hidden text-[11px] text-subtle sm:block">
        Trusted by <span className="font-semibold text-primary">100K+</span> creators
      </span>
    </div>
  );
}
