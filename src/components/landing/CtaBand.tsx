import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CtaBand() {
  return (
    <section className="px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-card-lg bg-primary px-5 py-10 text-white shadow-blue sm:px-6 sm:py-14">
        <h2 className="text-[26px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[40px]">
          Start bending viral niches today
        </h2>
        <p className="mt-3 text-base text-white/80 sm:text-[17px]">
          Free to try — 5 transcripts a day, no card. Upgrade any time from $10/mo.
        </p>
        <Button href="/app" icon={Sparkles} size="lg" variant="white" className="mt-6 w-full sm:w-auto">
          Get started free
        </Button>
      </div>
    </section>
  );
}
