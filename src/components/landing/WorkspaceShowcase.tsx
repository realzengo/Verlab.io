import { ClipboardList, Compass, Library, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Niche Bending", icon: Wand2, active: true },
  { label: "Niche Finder", icon: Compass, active: false },
  { label: "SOP Builder", icon: ClipboardList, active: false },
  { label: "Library", icon: Library, active: false },
];

export function WorkspaceShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-5 pb-[90px] sm:px-6 lg:px-8">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <h2 className="text-[32px] font-semibold leading-[1.08] tracking-[-1px] text-slate sm:text-[45px]">
          Full control from one clean workspace.
          <br />
          Feels like magic.
        </h2>
        <p className="mt-3.5 text-[17px] text-body">
          Bend niches, build SOPs, and write scripts in a single web app.
        </p>
      </div>

      <div className="grid min-h-[420px] grid-cols-1 overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-card md:grid-cols-[230px_1fr]">
        <div className="border-b border-hairline bg-app p-[18px] md:border-b-0 md:border-r">
          {TABS.map((tab) => (
            <div
              key={tab.label}
              className={cn(
                "mb-1 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-body",
                tab.active && "bg-accent font-semibold text-primary"
              )}
            >
              <tab.icon className="h-4 w-4" strokeWidth={1.8} />
              {tab.label}
            </div>
          ))}

          <div className="mt-3.5 rounded-xl border border-hairline bg-surface p-3">
            <h5 className="text-[13px] font-bold text-heading">Momentum tracking</h5>
            <p className="mt-1 text-[11.5px] leading-[1.5] text-subtle">
              Every niche ranked live, so you know what&rsquo;s worth bending.
            </p>
          </div>
          <div className="mt-3.5 rounded-xl border border-hairline bg-surface p-3">
            <h5 className="text-[13px] font-bold text-heading">Cloud library</h5>
            <p className="mt-1 text-[11.5px] leading-[1.5] text-subtle">
              Every bent SOP and script saved to searchable folders.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-b from-surface to-app p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-body">Medical Malpractice → Corporate Fraud — bend preview</span>
            <span className="rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-white shadow-blue">
              Bend it
            </span>
          </div>

          <div className="relative mx-auto aspect-[16/9] max-w-lg overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 shadow-[0_10px_30px_rgba(2,6,23,0.28)]">
            <span className="absolute left-3 top-3 rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
              ● Hook · 0:03
            </span>
            <div className="absolute left-1/2 top-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 text-center text-[19px] font-extrabold leading-[1.15] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.5)]">
              The trade that erased <span className="text-[#ffe600]">a nation&rsquo;s pension fund</span>
            </div>
          </div>

          <div className="mt-[18px] rounded-xl border border-hairline bg-surface p-3">
            <div className="relative mb-2 h-3.5 w-full rounded-md bg-accent">
              <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
            </div>
            <div className="relative mb-2 h-3.5 w-[78%] rounded-md bg-accent-line" />
            <div className="h-3.5 w-[60%] rounded-md bg-app" />
          </div>
        </div>
      </div>
    </section>
  );
}
