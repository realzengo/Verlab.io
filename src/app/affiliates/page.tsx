import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { AffiliatePage } from "@/components/landing/AffiliatePage";

export const metadata: Metadata = {
  title: "Affiliates — Clypa",
  description: "The Clypa affiliate program is coming soon. Join the waitlist for early access.",
};

export default function Affiliates() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <AffiliatePage />
      </main>
      <Footer />
    </div>
  );
}
