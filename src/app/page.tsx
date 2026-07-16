import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { InteractiveDemo } from "@/components/landing/InteractiveDemo";
import { LoopSteps } from "@/components/landing/LoopSteps";
import { WorkspaceShowcase } from "@/components/landing/WorkspaceShowcase";
import { NicheBendingSpotlight } from "@/components/landing/NicheBendingSpotlight";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Testimonials } from "@/components/landing/Testimonials";
import { CtaBand } from "@/components/landing/CtaBand";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <Hero />
        <InteractiveDemo />
        <LoopSteps />
        <WorkspaceShowcase />
        <NicheBendingSpotlight />
        <FeatureGrid />

        <Testimonials />
        <CtaBand />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
