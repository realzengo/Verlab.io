const TESTIMONIALS = [
  {
    name: "Maya R.",
    role: "Faceless Reddit channel",
    quote:
      "I paste the top videos in my niche and Clypa hands me a bent SOP in seconds. My research time collapsed.",
    gradient: "linear-gradient(135deg,#c7d2fe,#a5b4fc)",
  },
  {
    name: "Jonathan K.",
    role: "Clipping agency",
    quote: "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
    gradient: "linear-gradient(135deg,#fbcfe8,#f9a8d4)",
  },
  {
    name: "Deni O.",
    role: "Motivation Shorts",
    quote: "The MCP is the killer feature — I run everything from inside Claude without leaving my workflow.",
    gradient: "linear-gradient(135deg,#bbf7d0,#86efac)",
  },
];

export function Testimonials() {
  return (
    <section className="border-y border-hairline bg-gradient-to-b from-app to-surface">
      <div className="mx-auto max-w-6xl px-4 py-[90px] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-[32px] font-semibold leading-[1.05] tracking-[-1px] text-slate sm:text-[45px]">
            Built for creators who bend at scale
          </h2>
          <p className="mt-3.5 text-[17px] text-body">
            Faceless channels, agencies and solo clippers use Clypa to reverse-engineer what&rsquo;s already
            working.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-card-sm border border-hairline bg-surface p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="h-[38px] w-[38px] shrink-0 rounded-full" style={{ background: t.gradient }} />
                <div>
                  <b className="block text-sm font-semibold text-heading">{t.name}</b>
                  <span className="text-xs text-subtle">{t.role}</span>
                </div>
              </div>
              <p className="text-sm leading-[1.6] text-body">&ldquo;{t.quote}&rdquo;</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Testimonials shown are placeholders for launch.</p>
      </div>
    </section>
  );
}
