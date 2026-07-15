import { NICHES, SCRIPTS } from "@/lib/mock-data";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LoopSteps } from "@/components/landing/LoopSteps";
import { WorkspaceShowcase } from "@/components/landing/WorkspaceShowcase";
import { NicheBendingSpotlight } from "@/components/landing/NicheBendingSpotlight";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { FeatureRow } from "@/components/landing/FeatureRow";
import { Testimonials } from "@/components/landing/Testimonials";
import { CtaBand } from "@/components/landing/CtaBand";
import { PricingSection } from "@/components/landing/PricingSection";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { NicheCard } from "@/components/features/NicheCard";
import { ScriptView } from "@/components/features/ScriptView";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <Hero />
        <LoopSteps />
        <WorkspaceShowcase />
        <NicheBendingSpotlight />
        <FeatureGrid />

        <FeatureRow
          eyebrow="Niche Finder"
          title="Find the faceless niches blowing up right now"
          description="Every niche is ranked by a live momentum score, so you know which ones are worth bending before you invest the time."
          bullets={[
            "Momentum score updated from real trending data",
            "Sample videos so you can see the format instantly",
            "One click to send a niche straight into Niche Bending",
          ]}
          preview={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {NICHES.slice(0, 2).map((niche) => (
                <NicheCard key={niche.id} niche={niche} />
              ))}
            </div>
          }
          ctaLabel="Explore Niche Finder"
          ctaHref="/app/niches"
        />

        <FeatureRow
          reverse
          eyebrow="Script Maker"
          title="Turn a bent SOP into a ready-to-film script"
          description="Pick a bent SOP, a reference transcript, and a topic — Clypa writes the hook, body, and CTA in the proven structure."
          bullets={[
            "Hook / body / CTA broken out clearly",
            "Regenerate instantly if it's not quite right",
            "Export to TXT, PDF, or XML for your editor",
          ]}
          preview={<ScriptView script={SCRIPTS[0]} />}
          ctaLabel="Explore Script Maker"
          ctaHref="/app/scripts"
        />

        <Testimonials />
        <CtaBand />
        <PricingSection />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
