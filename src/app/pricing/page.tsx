import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { PricingSection } from "@/components/landing/PricingSection";
import { Faq } from "@/components/landing/Faq";
import { PRICING_FAQ_ITEMS } from "@/lib/mock/faq";

export const metadata: Metadata = {
  title: "Pricing, Verlab AI",
  description: "Simple pricing that pays for itself in 24 hours. Reverse-engineer viral videos into your own scripts.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <PricingSection showComparison={false} />
        <Faq items={PRICING_FAQ_ITEMS} heading="Pricing questions" backgroundClassName="bg-white" />
      </main>
      <Footer backgroundClassName="bg-white" />
    </div>
  );
}
