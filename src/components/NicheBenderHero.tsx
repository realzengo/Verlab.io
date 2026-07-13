"use client";

import { useState, type FormEvent } from "react";
import { Inter } from "next/font/google";
import { ArrowLeft, CheckCircle2, Coins, Lock, Search } from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-inter",
});

type BendCard = {
  id: string;
  creator: string;
  initials: string;
  structures: number;
  niche: string;
  bullets: string[];
  locked?: boolean;
};

const BEND_WALL: BendCard[] = [
  {
    id: "crayon-capital",
    creator: "Crayon Capital",
    initials: "CC",
    structures: 3,
    niche: "Medical Malpractice",
    bullets: [
      "The $2.3M mistake surgeons hope you never learn about",
      "Why this common ER shortcut kills 40 people a year",
      "The consent form loophole hospitals don't want you reading",
    ],
  },
  {
    id: "bens-breakdown",
    creator: "Ben's Business Breakdown",
    initials: "BB",
    structures: 4,
    niche: "Corporate Espionage",
    bullets: [
      "The intern who leaked a decade of trade secrets",
      "How a rival's mole sat in on every board meeting",
      "The patent filing that exposed the whole scheme",
    ],
    locked: true,
  },
  {
    id: "the-finance-guy",
    creator: "The Finance Guy",
    initials: "FG",
    structures: 2,
    niche: "Financial Collapse",
    bullets: [
      "The trade that erased a nation's pension fund",
      "Every warning sign regulators chose to ignore",
      "How one bad bet took down a 150-year-old bank",
    ],
  },
];

const RESULT_COLUMNS: { title: string; hooks: string[] }[] = [
  {
    title: "Corporate Empires",
    hooks: [
      "Every Way Billion-Dollar Companies Destroyed Themselves",
      "The Boardroom Decision That Bankrupted an Empire",
      "How One Email Ended a 100-Year Company",
    ],
  },
  {
    title: "Military Disasters",
    hooks: [
      "The Battle Plan That Doomed 40,000 Soldiers",
      "Every Way Generals Have Sent Armies to Slaughter",
      "The Radio Silence That Lost an Entire War",
    ],
  },
  {
    title: "Financial Collapse",
    hooks: [
      "The Trade That Erased a Nation's Savings",
      "Every Warning Sign Investors Ignored Before the Crash",
      "How One Bank's Bet Took Down the Economy",
    ],
  },
];

const AVATAR_COLORS = [
  { bg: "#eef0ff", fg: "#335cff" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#dcfce7", fg: "#15803d" },
];

function deriveName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "this creator";

  let value = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const handleMatch = value.match(/@([a-zA-Z0-9._-]+)/);

  if (handleMatch) {
    value = handleMatch[1];
  } else {
    const segments = value.split("/").filter(Boolean);
    value = segments.length > 1 ? segments[1] : segments[0] ?? value;
  }

  value = value.replace(/^@/, "");

  const words = value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(" ") || "this creator";
}

function SocialProofBadge({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#0b0f19] shadow-[0_1px_2px_rgba(11,15,25,0.04)]">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function BendWallCard({ card, index }: { card: BendCard; index: number }) {
  const avatar = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <div className="relative flex flex-col gap-4 rounded-[20px] border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,25,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(11,15,25,0.08)]">
      {card.locked && (
        <div className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full border border-[#fde68a] bg-[#fef3c7] px-2.5 py-1 text-[11px] font-semibold text-[#b45309] shadow-sm">
          <Lock className="h-3 w-3" strokeWidth={2.5} />
          Claimed niches stay private
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: avatar.bg, color: avatar.fg }}
          >
            {card.initials}
          </div>
          <span className="text-sm font-semibold text-[#0b0f19]">
            {card.creator}
          </span>
        </div>
        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          +{card.structures}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
          Bent to
        </span>
        <span className="text-base font-semibold text-[#335cff]">
          {card.niche}
        </span>
      </div>

      <ul className="flex flex-col gap-2 border-t border-[#e5e7eb] pt-3">
        {card.bullets.map((bullet, i) => (
          <li
            key={i}
            className="select-none text-sm leading-snug text-[#6b7280] blur-[3px]"
          >
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NicheBenderHero() {
  const [query, setQuery] = useState("");
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSubmittedName(deriveName(query));
  };

  const handleReset = () => {
    setSubmittedName(null);
    setQuery("");
  };

  return (
    <div
      className={`${inter.variable} w-full bg-white`}
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .bend-panel {
            animation: bend-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
            transform-origin: top center;
          }
        }
        @keyframes bend-in {
          0% {
            opacity: 0;
            transform: perspective(1000px) rotateX(6deg) translateY(14px);
          }
          100% {
            opacity: 1;
            transform: perspective(1000px) rotateX(0deg) translateY(0);
          }
        }
      `}</style>

      <section className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-[#0b0f19] sm:text-5xl md:text-6xl">
          just niche bend it
        </h1>
        <p className="mt-4 max-w-lg text-base font-medium text-[#335cff] sm:text-lg">
          paste a TikTok link, channel, or handle and we&rsquo;ll bend it for
          you
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <SocialProofBadge
            icon={
              <CheckCircle2
                className="h-3.5 w-3.5 text-green-600"
                strokeWidth={2.5}
              />
            }
          >
            2,847 bends completed
          </SocialProofBadge>
          <SocialProofBadge
            icon={
              <Coins className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
            }
          >
            $1.2M in creator earnings
          </SocialProofBadge>
          <SocialProofBadge
            icon={
              <Lock className="h-3.5 w-3.5 text-[#335cff]" strokeWidth={2.5} />
            }
          >
            Claimed niches stay private
          </SocialProofBadge>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex w-full max-w-2xl items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white p-1.5 shadow-[0_2px_8px_rgba(11,15,25,0.06)] focus-within:ring-2 focus-within:ring-[#335cff]/30"
        >
          <div className="flex flex-1 items-center gap-2 pl-3.5">
            <Search className="h-4.5 w-4.5 shrink-0 text-[#6b7280]" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a creator or paste a link..."
              aria-label="Search a creator or paste a link"
              className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#0b0f19] placeholder:text-[#6b7280] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-[#335cff] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2947d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335cff] focus-visible:ring-offset-2"
          >
            Bend it
          </button>
        </form>

        <div className="mt-16 w-full" style={{ perspective: "1000px" }}>
          {submittedName === null ? (
            <div key="wall" className="bend-panel flex flex-col gap-5">
              <div className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Real niche bends
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {BEND_WALL.map((card, i) => (
                  <BendWallCard key={card.id} card={card} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <div key="results" className="bend-panel flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3">
                <h2 className="text-xl font-semibold text-[#0b0f19] sm:text-2xl">
                  Niche bends for {submittedName}
                </h2>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#6b7280] transition-colors hover:border-[#335cff]/40 hover:text-[#335cff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Bend another link
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 text-left md:grid-cols-3">
                {RESULT_COLUMNS.map((column) => (
                  <div
                    key={column.title}
                    className="flex flex-col gap-3 rounded-[20px] border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,25,0.04)]"
                  >
                    <span className="text-sm font-semibold text-[#335cff]">
                      {column.title}
                    </span>
                    <ul className="flex flex-col gap-2.5">
                      {column.hooks.map((hook, i) => (
                        <li
                          key={i}
                          className="rounded-2xl bg-[#eef0ff] px-3.5 py-2.5 text-sm leading-snug text-[#0b0f19]"
                        >
                          <span className="mr-1.5 font-semibold text-[#335cff]">
                            &rarr;
                          </span>
                          {hook}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
