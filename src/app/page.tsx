import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { VerlabProcess } from "@/components/landing/VerlabProcess";
import { WorkspaceShowcase } from "@/components/landing/WorkspaceShowcase";
import { AnimatedFeatureSection } from "@/components/landing/AnimatedFeatureSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Testimonials } from "@/components/landing/Testimonials";
import { CtaBand } from "@/components/landing/CtaBand";
import { Faq } from "@/components/landing/Faq";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <Hero />
        <VerlabProcess />
        <WorkspaceShowcase />
        <AnimatedFeatureSection />
        <FeatureGrid />

        <Testimonials />
        <ComparisonSection />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
