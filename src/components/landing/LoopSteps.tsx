import { ClipboardList, Compass, PenSquare, Wand2 } from "lucide-react";

const STEPS = [
  { label: "Find", title: "Find a viral faceless niche", description: "Niche Finder surfaces proven niches with real momentum.", icon: Compass },
  { label: "Understand", title: "Understand why it works", description: "Transcripts + SOP Builder reverse-engineer the script structure.", icon: ClipboardList },
  { label: "Bend", title: "Bend it into your niche", description: "Clypa maps the winning formula onto your own topic.", icon: Wand2 },
  { label: "Produce", title: "Produce ready-to-film scripts", description: "Script Maker turns the bent SOP into finished scripts.", icon: PenSquare },
];

export function LoopSteps() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-semibold text-heading sm:text-3xl">The loop</h2>
        <p className="mt-3 text-sm text-body sm:text-base">
          Four steps, repeatable for every new niche you want to bend.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.label} className="relative rounded-card border border-hairline bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-chip bg-accent">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-body">0{i + 1}</span>
            </div>
            <span className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-primary">
              {step.label}
            </span>
            <h3 className="mt-1 text-sm font-semibold text-heading">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
