import Link from "next/link";
import { Fragment } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Compass,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Lightbulb,
  MessagesSquare,
  Radar,
  Repeat,
  Search,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { APP_URL } from "@/lib/constants";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">{children}</span>;
}

function FormulaCard({ result, operands }: { result: string; operands: string[] }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <span className="text-xs font-semibold uppercase tracking-[1.2px] text-subtle">The formula</span>

      <span className="rounded-full border border-accent-line bg-accent px-6 py-3 text-xl font-bold text-primary sm:px-7 sm:py-3.5 sm:text-2xl">
        {result}
      </span>

      <div className="flex items-center gap-3 text-subtle">
        <span className="h-px w-8 bg-hairline sm:w-12" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app text-sm font-bold">
          =
        </span>
        <span className="h-px w-8 bg-hairline sm:w-12" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
        {operands.map((operand, i) => (
          <div key={operand} className="flex items-center gap-3">
            {i > 0 && (
              <span className="text-base font-bold text-subtle" aria-hidden>
                +
              </span>
            )}
            <span className="whitespace-nowrap rounded-2xl border border-hairline bg-surface px-5 py-3 text-base font-bold text-heading shadow-card sm:text-lg">
              {operand}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  center = true,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3.5 font-display text-[26px] font-bold leading-[1.15] tracking-[-0.8px] text-slate sm:text-[42px]">
        {title}
      </h2>
      {description && <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">{description}</p>}
    </div>
  );
}

const TITLE_FORMULAS = [
  "Your Life As Every Rank/Level Of ___",
  "___ Lies/Myths You Still Believe",
  "Every Major Mistake That ___ Made",
];

const THUMBNAIL_FORMULAS = [
  { combo: "Subject + Unexpected Object", note: "Two familiar things collide into one strange image." },
  { combo: "Villain + Visual Metaphor", note: "A face plus a symbol that hints at the story (strings, cages, arrows)." },
  { combo: "Split-Screen Contrast", note: "Before/after, then/now, or good/evil placed side by side." },
];

const SHORTS_SKELETON = ["Script", "Hook", "Editing style", "Music", "CTA"];
const LONGFORM_SKELETON = [
  "Title",
  "Thumbnail",
  "Script",
  "Hook",
  "Re-hooks",
  "Beat-by-beat structure",
  "CTAs",
  "Editing style",
  "Voice over",
];

const IDEATION_METHODS = [
  {
    icon: Bot,
    title: "AI Ideation",
    description:
      "Take the transcript of a video that went viral for a competitor and hand it to an AI assistant with a direction, not just a topic dump.",
    detail: '"Here\'s the viral video of my competitor: {transcript}. Find me 15 similar ideas that all share the same {trigger} viral hook."',
    cta: "Run this through MCP Connect",
    href: `${APP_URL}/mcp`,
  },
  {
    icon: Search,
    title: "Doom-Scroll With Intent",
    description:
      "Open an incognito tab, search a keyword from your niche, filter by most popular and by last week, and watch what's blowing up across formats. On Shorts, scroll for 15 focused minutes and only engage with your niche so the algorithm stays trained.",
    cta: "Bring what you find into Transcript Extractor",
    href: `${APP_URL}/transcripts`,
  },
  {
    icon: Repeat,
    title: "Format Your Own Hits",
    description:
      "Your best-performing video is a proven format, not a one-off. Turn its exact structure into a template and reuse it. One creator's single 34M-view video became a repeatable format that pulled in another 76M views.",
    cta: "Find your top performer in Video Library",
    href: `${APP_URL}/library`,
  },
  {
    icon: MessagesSquare,
    title: "Talk It Out",
    description:
      "Say your ideas out loud to friends, your team, or your community before you touch a script. Random in-person brainstorming consistently outperforms sitting alone with a blank page.",
  },
];

const BEND_STEPS = [
  {
    icon: Compass,
    title: "Bend the niche, get the framework",
    description:
      "Run Niche Bending on a competitor channel. It reads their top videos and generates an SOP, a full breakdown with the hook playbook, a beat-by-beat script structure, and the named storytelling frameworks they run on.",
    cta: "Open Niche Bending",
    href: `${APP_URL}/bend`,
  },
  {
    icon: Search,
    title: "Pull their transcript",
    description:
      "Drop the specific video that went viral into Transcript Extractor for a timestamped, line-by-line transcript of exactly how they executed the framework.",
    cta: "Open Transcript Extractor",
    href: `${APP_URL}/transcripts`,
  },
  {
    icon: Wand2,
    title: "Feed both into the Script Generator",
    description:
      "Drop the SOP and the transcript into the Script Generator's two reference slots. It reverse-engineers the formula, hook structure, pacing, beats, tone. Then it maps your idea onto it for you.",
    cta: "Open Script Generator",
    href: `${APP_URL}/scripts`,
  },
  {
    icon: Radar,
    title: "Re-run it on every new outlier",
    description:
      "There's no dashboard to babysit. The moment a competitor posts something that pops, send the link back through Transcript Extractor and Niche Bending and bend it while it's still hot.",
  },
];

const PIPELINE_STEPS = [
  {
    icon: Compass,
    title: "Create a Niche Bend",
    description: "Decide what your channel is about: Format + Market.",
    cta: "Niche Bending",
    href: `${APP_URL}/bend`,
  },
  {
    icon: Radar,
    title: "Research competitors",
    description: "Find who already proved demand in your space.",
    cta: "Transcript Extractor",
    href: `${APP_URL}/transcripts`,
  },
  {
    icon: Lightbulb,
    title: "Find unique ideas",
    description: "Ideas with viral proof, untouched by your framework.",
    cta: "MCP Connect",
    href: `${APP_URL}/mcp`,
  },
  {
    icon: FileText,
    title: "Write the scripts",
    description: "Bend each idea into a proven storytelling framework.",
    cta: "Script Generator",
    href: `${APP_URL}/scripts`,
  },
];

export function ScriptBendingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-28 text-center sm:px-6 lg:px-8 md:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 -z-10 h-64 w-1/2 -translate-x-1/4 -translate-y-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 -z-10 h-64 w-1/2 translate-x-1/4 -translate-y-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />

        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-card md:mb-8">
          <Sparkles className="h-3.5 w-3.5" />
          The Verlab Method
        </span>

        <h1 className="max-w-3xl font-display text-[30px] font-bold leading-[1.1] tracking-[-1px] text-heading sm:text-[56px] sm:leading-[1.05] sm:tracking-[-1.5px]">
          Two questions decide whether a channel blows up
        </h1>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-body sm:text-base">
          <span className="font-semibold text-heading">What is your channel about?</span>{" "}
          That&rsquo;s Niche Bending.{" "}
          <span className="font-semibold text-heading">What do you post?</span>{" "}
          That&rsquo;s Script Bending. Together they&rsquo;re the difference between reinventing the wheel, stealing
          someone else&rsquo;s, and building a faster one on purpose.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button href={`${APP_URL}/bend`} icon={ArrowRight} iconPosition="right" size="lg">
            Try Niche Bending
          </Button>
          <Button href={`${APP_URL}/scripts`} variant="secondary" size="lg">
            Try the Script Generator
          </Button>
        </div>
      </section>

      {/* Part 1 — Niche Bending */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>Part 1</Eyebrow>
            <h2 className="mt-3.5 font-display text-[26px] font-bold leading-[1.15] tracking-[-0.8px] text-slate sm:text-[38px]">
              What is Niche Bending?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-body sm:text-base">
              Niche Bending answers the first question every channel needs to answer:{" "}
              <span className="font-semibold text-heading">what is this channel actually about?</span>{" "}
              Instead of inventing a category from nothing or copying a competitor outright, you bend two existing,
              proven ingredients into something that hasn&rsquo;t been done together yet.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5">
              {["Create profitable niches", "Differentiate yourself from everyone else in the space", "Find a Blue Ocean instead of copying a Red one"].map(
                (item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-heading">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>

          <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-10">
            <FormulaCard result="Niche" operands={["Format", "Market"]} />
            <p className="text-sm leading-relaxed text-subtle">
              The <span className="font-semibold text-heading">Format</span>{" "}
              is how you tell the story (animation, commentary, documentary). The{" "}
              <span className="font-semibold text-heading">Market</span>{" "}
              is who and what it&rsquo;s about (history, fitness, true crime). Change either one and you get a
              different niche entirely.
            </p>
            <Button href={`${APP_URL}/bend`} variant="text" icon={ArrowRight} iconPosition="right">
              Try Niche Bending
            </Button>
          </Card>
        </div>
      </section>

      {/* Part 2 — Script Bending */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <SectionHeading
          eyebrow="Part 2"
          title="What is Script Bending?"
          description="Once your channel knows what it's about, Script Bending answers the question you'll face every single day: what do I actually post?"
        />

        <Card className="mx-auto mt-10 flex flex-col items-center gap-6 p-8 text-center sm:mt-12 sm:p-10">
          <FormulaCard result="Viral Script" operands={["Unique Idea", "Proven Storytelling Framework"]} />
          <Button href={`${APP_URL}/scripts`} variant="text" icon={ArrowRight} iconPosition="right">
            Try the Script Generator
          </Button>
        </Card>

        {/* Idea -> Framework -> Bend visual */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 items-center gap-4 sm:mt-12 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-3">
          <div className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-surface p-6 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app text-subtle">
              <Lightbulb className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-bold text-heading">Raw idea</span>
            <span className="text-xs text-subtle">No structure yet</span>
          </div>

          <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-subtle sm:block" />

          <div className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-surface p-6 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app text-subtle">
              <LayoutGrid className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-bold text-heading">Storytelling framework</span>
            <span className="text-xs text-subtle">The proven skeleton</span>
          </div>

          <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-subtle sm:block" />

          <div className="flex flex-col items-center gap-3 rounded-card border border-accent-line bg-accent p-6 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
              <Wand2 className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-bold text-heading">Script Bend</span>
            <span className="text-xs text-subtle">Ready to publish</span>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-subtle">
          The framework gives your idea a fresh shape the audience already responds to, proof of demand. The idea is
          what makes it yours.
        </p>

        {/* A hook, bent */}
        <div className="mx-auto mt-12 max-w-5xl sm:mt-16">
          <p className="text-center text-sm font-bold uppercase tracking-[1.2px] text-subtle">A hook, bent</p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-hairline bg-surface p-5 shadow-card">
              <span className="text-[11px] font-bold uppercase tracking-wide text-subtle">Original hook</span>
              <p className="mt-3 text-sm leading-relaxed text-heading">
                &ldquo;From flying private jets to dying broke, this is every U.S. president&rsquo;s wealth
                explained.&rdquo;
              </p>
            </div>
            <div className="rounded-card border border-dashed border-hairline bg-app p-5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-subtle">Framework</span>
              <p className="mt-3 text-sm leading-relaxed text-subtle">
                &ldquo;From {"{extreme A}"} to {"{extreme B}"}, this is every {"{group}"}&rsquo;s {"{topic}"}{" "}
                explained.&rdquo;
              </p>
            </div>
            <div className="rounded-card border border-accent-line bg-accent p-5 shadow-card">
              <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Bent hook</span>
              <p className="mt-3 text-sm leading-relaxed text-heading">
                &ldquo;From sleeping in garages to running trillion-dollar companies, this is every tech
                founder&rsquo;s net worth explained.&rdquo;
              </p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Button href={`${APP_URL}/scripts`} variant="text" icon={ArrowRight} iconPosition="right">
              Bend your own hook in the Script Generator
            </Button>
          </div>
        </div>
      </section>

      {/* 3 levels */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <SectionHeading
          eyebrow="Where To Apply It"
          title="Script Bending happens on 3 levels"
          description="Before you sit down to write anything, you dissect what's already working, on every level, not just the words."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
          <Card hoverLift className="flex flex-col gap-0">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
              <Type className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
            </div>
            <h3 className="font-ui text-[19px] font-semibold tracking-[-0.2px] text-heading">Title Level</h3>
            <p className="mt-2 text-sm leading-[1.6] text-subtle">
              Proven title structures work across almost any topic. Swap the blank and the formula still lands.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {TITLE_FORMULAS.map((f) => (
                <li key={f} className="rounded-xl border border-hairline bg-app px-3 py-2 text-xs font-medium text-heading">
                  {f}
                </li>
              ))}
            </ul>
          </Card>

          <Card hoverLift className="flex flex-col gap-0">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
              <ImageIcon className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
            </div>
            <h3 className="font-ui text-[19px] font-semibold tracking-[-0.2px] text-heading">Thumbnail Level</h3>
            <p className="mt-2 text-sm leading-[1.6] text-subtle">
              Two familiar elements combined into a formula you can reuse with a new subject every time.
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {THUMBNAIL_FORMULAS.map((f) => (
                <li key={f.combo} className="rounded-xl border border-hairline bg-app px-3 py-2">
                  <span className="text-xs font-bold text-heading">{f.combo}</span>
                  <p className="mt-0.5 text-[11px] leading-snug text-subtle">{f.note}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card hoverLift className="flex flex-col gap-0">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
              <FileText className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
            </div>
            <h3 className="font-ui text-[19px] font-semibold tracking-[-0.2px] text-heading">Script Structure Level</h3>
            <p className="mt-2 text-sm leading-[1.6] text-subtle">
              The deepest level: the actual skeleton of the video, beat by beat.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-heading">Shorts</span>
                <ul className="mt-1.5 flex flex-col gap-1 text-subtle">
                  {SHORTS_SKELETON.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-bold text-heading">Long form</span>
                <ul className="mt-1.5 flex flex-col gap-1 text-subtle">
                  {LONGFORM_SKELETON.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Finding unique ideas */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <SectionHeading
          eyebrow="Ideation"
          title="How to find unique ideas"
          description="Four ways to keep a running list of ideas that already have proof of demand behind them."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
          {IDEATION_METHODS.map((method) => (
            <Card key={method.title} hoverLift className="flex flex-col gap-0">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
                <method.icon className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
              </div>
              <h3 className="font-ui text-[19px] font-semibold tracking-[-0.2px] text-heading">{method.title}</h3>
              <p className="mt-2 text-sm leading-[1.6] text-subtle">{method.description}</p>
              {method.detail && (
                <p className="mt-3 rounded-xl border border-hairline bg-app px-3.5 py-2.5 text-xs italic leading-relaxed text-subtle">
                  {method.detail}
                </p>
              )}
              {method.cta && method.href && (
                <Button href={method.href} variant="text" icon={ArrowRight} iconPosition="right" className="mt-4 self-start">
                  {method.cta}
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* How to actually script bend */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <SectionHeading
          eyebrow="Execution"
          title="How to actually script bend"
          description="Not theory. The four Verlab tools that do each step, in order."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
          {BEND_STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col rounded-card border border-hairline bg-surface p-6 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-accent">
                  <step.icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
                </span>
                <h3 className="font-ui text-[17px] font-semibold tracking-[-0.2px] text-heading">{step.title}</h3>
              </div>
              <p className="text-sm leading-[1.6] text-subtle">{step.description}</p>
              {step.cta && step.href && (
                <Button href={step.href} variant="text" icon={ArrowRight} iconPosition="right" className="mt-4 self-start">
                  {step.cta}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <SectionHeading eyebrow="Putting It Together" title="The full pipeline, start to finish" />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:mt-12 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center sm:gap-4">
          {PIPELINE_STEPS.map((step, i) => (
            <Fragment key={step.title}>
              <div className="flex h-full flex-col items-center gap-3 rounded-card border border-hairline bg-surface p-6 text-center shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-primary">
                  <step.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="text-sm font-bold text-heading">{step.title}</span>
                <span className="text-xs leading-relaxed text-subtle">{step.description}</span>
                <Link
                  href={step.href}
                  className="mt-1 text-[11px] font-bold uppercase tracking-wide text-primary hover:underline"
                >
                  {step.cta} →
                </Link>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-subtle sm:block" />
              )}
            </Fragment>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-card-lg bg-primary px-5 py-10 text-white shadow-blue sm:px-6 sm:py-14">
          <h2 className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[40px]">
            Stop reinventing the wheel
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">
            Verlab runs this exact system for you. Find your niche, break down what&rsquo;s working, and generate
            scripts bent from proven frameworks in minutes.
          </p>
          <div className="mt-6 flex justify-center">
            <Button href={APP_URL} icon={ArrowRight} iconPosition="right" size="lg" variant="white">
              Try Verlab
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
