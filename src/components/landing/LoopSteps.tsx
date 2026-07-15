import { ClipboardList, Compass, PenSquare, Wand2 } from "lucide-react";

const STEPS = [
  { title: "Find a viral faceless niche", description: "Niche Finder surfaces proven niches with real momentum.", icon: Compass },
  { title: "Understand why it works", description: "Transcripts + SOP Builder reverse-engineer the script structure.", icon: ClipboardList },
  { title: "Bend it into your niche", description: "Clypa maps the winning formula onto your own topic.", icon: Wand2 },
  { title: "Produce ready-to-film scripts", description: "Script Maker turns the bent SOP into finished scripts.", icon: PenSquare },
];

export function LoopSteps() {
  return (
    <section id="workflow" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Workflow to go viral</span>
        <h2 className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          The loop
        </h2>
        <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">Four steps, repeatable for every new niche you want to bend.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="rounded-card border border-hairline bg-surface p-4 shadow-card sm:p-[22px]">
            <div className="mb-4 flex h-[90px] items-center justify-center rounded-2xl border border-accent-line bg-accent sm:mb-[18px] sm:h-[110px]">
              <step.icon className="h-9 w-9 text-primary" strokeWidth={1.8} />
            </div>
            <div className="inline-flex items-center gap-2 text-[15px] font-bold text-heading">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
                {i + 1}
              </span>
              {step.title}
            </div>
            <p className="mt-2 text-sm leading-[1.55] text-subtle">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
