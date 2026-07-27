import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LoopSteps } from "@/components/landing/LoopSteps";
import { WorkspaceShowcase } from "@/components/landing/WorkspaceShowcase";
import { AnimatedFeatureSection } from "@/components/landing/AnimatedFeatureSection";
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
        <LoopSteps />
        <WorkspaceShowcase />
        <AnimatedFeatureSection />
        <FeatureGrid />

        <Testimonials />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
