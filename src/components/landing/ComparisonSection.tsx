import { cn } from "@/lib/utils";

const OTHER_TOOLS_ITEMS = [
  "Staring at a blank page",
  "Writing scripts from scratch (that flop)",
  "Digging for ideas for hours",
  "Copying viral videos by hand",
  "Posting whenever you get around to it",
  "Growth that feels like guessing",
];

const VERLAB_ITEMS = [
  "Viral-ready scripts in minutes",
  "Hooks & retention built into every draft",
  "Trending ideas pulled from your niche automatically",
  "Any viral video, rewritten in your style instantly",
  "A full content pipeline, always stocked",
  "More scripts → more posts → predictable views",
];

/** Three intersecting dashed circles with solid dots marking the intersections.
 * Shared by both cards; `dotClassName` swaps the dot color/glow between states. */
function IntersectingCirclesPattern({ dotClassName }: { dotClassName: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className="h-full w-full text-slate-300"
      aria-hidden
    >
      <circle cx="260" cy="120" r="110" stroke="currentColor" strokeDasharray="4 4" />
      <circle cx="320" cy="260" r="110" stroke="currentColor" strokeDasharray="4 4" />
      <circle cx="180" cy="300" r="110" stroke="currentColor" strokeDasharray="4 4" />

      <circle cx="292" cy="207" r="5" className={dotClassName} />
      <circle cx="222" cy="223" r="5" className={dotClassName} />
      <circle cx="262" cy="330" r="5" className={dotClassName} />
      <circle cx="337" cy="163" r="5" className={dotClassName} />
      <circle cx="196" cy="196" r="5" className={dotClassName} />
    </svg>
  );
}

function ComparisonListItem({
  icon,
  children,
  textClassName,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  textClassName: string;
}) {
  return (
    <li className="flex items-center gap-3">
      {icon}
      <span className={textClassName}>{children}</span>
    </li>
  );
}

export function ComparisonSection() {
  return (
    <section className="w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-blue-50/30 px-4 pb-2 pt-10">
      <div className="text-center">
        <h2 className="text-5xl font-black uppercase tracking-tight text-slate-900 md:text-6xl">
          Before vs After Verlab
        </h2>
        <p className="mt-4 text-lg text-slate-500">
          Verlab doesn&apos;t replace your voice. It multiplies it.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Card 1: Other Tools */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-10 shadow-sm md:p-14">
          <div className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-2/3 opacity-40">
            <IntersectingCirclesPattern dotClassName="fill-slate-400 stroke-none" />
          </div>

          <h3 className="mb-8 font-serif text-xl italic text-slate-700">Other Tools</h3>

          <ul className="flex flex-col gap-6">
            {OTHER_TOOLS_ITEMS.map((item) => (
              <ComparisonListItem
                key={item}
                textClassName="font-medium text-slate-600"
                icon={
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">
                    ✕
                  </span>
                }
              >
                {item}
              </ComparisonListItem>
            ))}
          </ul>
        </div>

        {/* Card 2: With Verlab */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] md:p-14">
          <div className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-2/3 opacity-40">
            <IntersectingCirclesPattern dotClassName="fill-blue-500 stroke-none drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>

          <div className="mb-8 flex items-center gap-2">
            <span className="font-serif text-xl italic text-slate-700">With</span>
            <span className="text-2xl font-black text-slate-900">VERLAB</span>
          </div>

          <ul className="flex flex-col gap-6">
            {VERLAB_ITEMS.map((item) => (
              <ComparisonListItem
                key={item}
                textClassName="font-semibold text-slate-900"
                icon={
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-500/30">
                    ✓
                  </span>
                }
              >
                {item}
              </ComparisonListItem>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-16 text-center">
        <button
          type="button"
          className={cn(
            "rounded-full bg-blue-600 px-10 py-4 text-lg font-semibold text-white",
            "transition-all hover:scale-105 hover:bg-blue-700",
          )}
        >
          Try Verlab Now
        </button>
      </div>
    </section>
  );
}
