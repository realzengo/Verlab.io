import { ScrollAnimationPauser } from "@/components/ScrollAnimationPauser";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { VerlabProcess } from "@/components/landing/VerlabProcess";
import { ShowcaseGridSection } from "@/components/landing/ShowcaseGridSection";
import { FeaturesGridSection } from "@/components/landing/FeaturesGridSection";
import { AnimatedFeatureSection } from "@/components/landing/AnimatedFeatureSection";
import { TestimonialsGridSection } from "@/components/landing/TestimonialsGridSection";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ScrollAnimationPauser />
      <SmoothScroll />
      <Nav />
      <main className="flex-1">
        <Hero />
        <ShowcaseGridSection />
        <FeaturesGridSection />
        <AnimatedFeatureSection />

        <TestimonialsGridSection />
        <VerlabProcess />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
