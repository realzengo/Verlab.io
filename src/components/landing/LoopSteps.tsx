import { ClipboardList, Compass, PenSquare, Wand2 } from "lucide-react";

const STEPS = [
  { title: "Find a viral faceless niche", description: "Niche Finder surfaces proven niches with real momentum.", icon: Compass },
  { title: "Understand why it works", description: "Transcripts + SOP Builder reverse-engineer the script structure.", icon: ClipboardList },
  { title: "Bend it into your niche", description: "Clypa maps the winning formula onto your own topic.", icon: Wand2 },
  { title: "Produce ready-to-film scripts", description: "Script Maker turns the bent SOP into finished scripts.", icon: PenSquare },
];

export function LoopSteps() {
  return (
    <section id="workflow" className="mx-auto max-w-6xl px-4 py-[90px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Workflow to go viral</span>
        <h2 className="mt-3.5 text-[32px] font-semibold leading-[1.05] tracking-[-1px] text-slate sm:text-[45px]">
          The loop
        </h2>
        <p className="mt-3.5 text-[17px] text-body">Four steps, repeatable for every new niche you want to bend.</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="rounded-card border border-hairline bg-surface p-[22px] shadow-card">
            <div className="mb-[18px] flex h-[110px] items-center justify-center rounded-2xl border border-accent-line bg-accent">
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
