import { ScrollAnimationPauser } from "@/components/ScrollAnimationPauser";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { VideoMarqueeSection } from "@/components/landing/VideoMarqueeSection";
import { ToolsMarqueeSection } from "@/components/landing/ToolsMarqueeSection";
import { VerlabProcess } from "@/components/landing/VerlabProcess";
import { AnimatedFeatureSection } from "@/components/landing/AnimatedFeatureSection";
import { Testimonials } from "@/components/landing/Testimonials";
import { CtaBand } from "@/components/landing/CtaBand";
import { Faq } from "@/components/landing/Faq";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <ScrollAnimationPauser />
      <Nav />
      <main className="flex-1">
        <Hero />
        <VideoMarqueeSection />
        <VerlabProcess />
        <AnimatedFeatureSection />
        <ToolsMarqueeSection />

        <Testimonials />
        <ComparisonSection />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
