import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { PricingSection } from "@/components/landing/PricingSection";

export const metadata: Metadata = {
  title: "Pricing — Clypa",
  description: "Simple pricing that pays for itself in 24 hours. Reverse-engineer viral videos into your own scripts.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}
