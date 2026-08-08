import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { ScriptBendingPage } from "@/components/landing/ScriptBendingPage";

export const metadata: Metadata = {
  title: "Niche Bending & Script Bending — Verlab AI",
  description:
    "Learn the system behind viral channels: how Niche Bending defines what your channel is about, and how Script Bending turns proven storytelling frameworks into scripts nobody else is running.",
};

export default function ScriptBending() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <ScriptBendingPage />
      </main>
      <Footer />
    </div>
  );
}
