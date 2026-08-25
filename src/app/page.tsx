import { ScrollAnimationPauser } from "@/components/ScrollAnimationPauser";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ToolsMarqueeSection } from "@/components/landing/ToolsMarqueeSection";
import { VerlabProcess } from "@/components/landing/VerlabProcess";
import { FeaturesGridSection } from "@/components/landing/FeaturesGridSection";
import { AnimatedFeatureSection } from "@/components/landing/AnimatedFeatureSection";
import { Testimonials } from "@/components/landing/Testimonials";
import { CtaBand } from "@/components/landing/CtaBand";
import { Faq } from "@/components/landing/Faq";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FC]">
      <ScrollAnimationPauser />
      <Nav />
      <main className="flex-1">
        <Hero />
        <VerlabProcess />
        <FeaturesGridSection />
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
