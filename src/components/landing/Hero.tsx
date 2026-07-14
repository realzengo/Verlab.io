import { ArrowRight, TrendingUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24 lg:px-8">
      <Badge>Niche bending, powered by AI</Badge>

      <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-heading sm:text-5xl md:text-6xl">
        Bend any viral niche into your own — and get the scripts to run it.
      </h1>

      <p className="mt-5 max-w-xl text-base leading-relaxed text-body sm:text-lg">
        Clypa finds the faceless niches blowing up on TikTok, reverse-engineers why they work, and
        bends them into a repeatable system for your channel.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href="/app" size="lg" icon={ArrowRight} iconPosition="right">
          Get started free
        </Button>
        <Button href="#niche-bending" variant="secondary" size="lg">
          See how bending works
        </Button>
      </div>

      <div className="mt-16 flex w-full max-w-3xl flex-col items-center gap-4 rounded-card border border-hairline bg-white p-6 shadow-card sm:flex-row sm:justify-center sm:gap-6">
        <div className="w-full max-w-[220px] rounded-card-sm border border-hairline bg-app p-4 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Source niche</span>
          <p className="mt-1.5 text-sm font-semibold text-heading">Medical Malpractice</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-600">
            <TrendingUp className="h-3.5 w-3.5" />
            94 momentum
          </span>
        </div>

        <div className="flex h-10 w-10 shrink-0 rotate-90 items-center justify-center rounded-full bg-primary text-white sm:rotate-0">
          <Wand2 className="h-4 w-4" />
        </div>

        <div className="w-full max-w-[220px] rounded-card-sm border border-primary bg-accent p-4 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Your niche</span>
          <p className="mt-1.5 text-sm font-semibold text-heading">Corporate Fraud</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Same formula, new topic</span>
        </div>
      </div>
    </section>
  );
}
