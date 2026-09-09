import type { Metadata } from "next";
import { Compass, Download, FileText, Image as ImageIcon, Subtitles, UserSearch } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VerifiedBadge } from "@/components/landing/VerifiedBadge";
import { Faq } from "@/components/landing/Faq";
import { McpHero } from "@/components/mcp/McpHero";
import { MCP_FAQ_ITEMS } from "@/lib/mock/faq";

export const metadata: Metadata = {
  title: "MCP, Verlab AI",
  description:
    "Connect Verlab to Claude and ChatGPT over MCP. Find niches, analyze creators, and generate scripts straight from your assistant.",
};

const CAPABILITIES = [
  {
    icon: Compass,
    title: "Find niches",
    description: "Surface faceless niches blowing up right now, with growth data pulled straight into chat.",
  },
  {
    icon: UserSearch,
    title: "Analyze creators",
    description: "Reverse-engineer a channel's real strategy from its actual transcripts, not just view counts.",
  },
  {
    icon: FileText,
    title: "Generate scripts",
    description: "Turn a niche or reference video into a ready-to-record script without leaving the chat.",
  },
  {
    icon: ImageIcon,
    title: "Generate images",
    description: "Create thumbnails and visuals on the fly for whatever you're scripting.",
  },
  {
    icon: Subtitles,
    title: "Extract transcripts",
    description: "Pull a clean transcript from any video to study, translate, or repurpose.",
  },
  {
    icon: Download,
    title: "Download videos",
    description: "Save reference videos straight from a link, no browser extension needed.",
  },
];

export default function McpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Nav />
      <main className="flex-1">
        <McpHero />

        <section className="w-full bg-app py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <VerifiedBadge label="Tools" className="mb-5 sm:mb-6" />
              <h2 className="font-display text-[28px] font-bold leading-[1.1] tracking-tight text-heading sm:text-3xl md:text-[40px]">
                Everything Verlab does, now callable from chat
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-body sm:text-base">
                Every tool below is a call your assistant can make on your behalf, using your Verlab account.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="premium-hover-border flex flex-col items-start rounded-2xl border border-hairline bg-surface p-6 text-left transition-transform duration-300 hover:-translate-y-1"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5b82ff] to-primary text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-heading sm:text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-body">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Faq items={MCP_FAQ_ITEMS} heading="MCP questions" backgroundClassName="bg-white" />
      </main>
      <Footer backgroundClassName="bg-white" />
    </div>
  );
}
