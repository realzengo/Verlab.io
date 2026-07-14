import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CtaBand() {
  return (
    <section className="px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-card-lg bg-primary px-6 py-14 text-white shadow-blue">
        <h2 className="text-[28px] font-bold tracking-[-0.8px] sm:text-[40px]">
          Start bending viral niches today
        </h2>
        <p className="mt-3 text-[17px] text-white/80">
          Free to try — 5 transcripts a day, no card. Upgrade any time from $10/mo.
        </p>
        <Button href="/app" icon={Sparkles} size="lg" variant="white" className="mt-6">
          Get started free
        </Button>
      </div>
    </section>
  );
}
