"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Coins, Lock } from "lucide-react";
import { BEND_RESULTS } from "@/lib/mock-data";
import { LinkInput } from "@/components/ui/LinkInput";
import { SopView } from "@/components/features/SopView";
import { cn } from "@/lib/utils";

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

function SocialProofBadge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-heading shadow-card">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function BendWallCard({ card, index }: { card: BendCard; index: number }) {
  const avatar = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <div className="relative flex flex-col gap-4 rounded-card border border-hairline bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
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
          <span className="text-sm font-semibold text-heading">{card.creator}</span>
        </div>
        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          +{card.structures}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Bent to</span>
        <span className="text-base font-semibold text-primary">{card.niche}</span>
      </div>

      <ul className="flex flex-col gap-2 border-t border-hairline pt-3">
        {card.bullets.map((bullet, i) => (
          <li key={i} className="select-none text-sm leading-snug text-body blur-[3px]">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NicheBendingSpotlight() {
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

  const teaserResult = BEND_RESULTS[0];

  return (
    <section id="niche-bending" className="w-full bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-20 pt-12 text-center sm:px-6 lg:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Niche Bending</span>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-heading sm:text-5xl">
          just niche bend it
        </h2>
        <p className="mt-4 max-w-lg text-base font-medium text-primary sm:text-lg">
          paste a TikTok link, channel, or handle and we&rsquo;ll bend it for you
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <SocialProofBadge icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" strokeWidth={2.5} />}>
            2,847 bends completed
          </SocialProofBadge>
          <SocialProofBadge icon={<Coins className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />}>
            $1.2M in creator earnings
          </SocialProofBadge>
          <SocialProofBadge icon={<Lock className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}>
            Claimed niches stay private
          </SocialProofBadge>
        </div>

        <LinkInput
          value={query}
          onChange={setQuery}
          onSubmit={handleSubmit}
          placeholder="Search a creator or paste a link..."
          submitLabel="Bend it"
          className="mt-10 max-w-2xl"
        />

        <div className="mt-16 w-full" style={{ perspective: "1000px" }}>
          {submittedName === null ? (
            <div key="wall" className="animate-bend-in flex flex-col gap-5">
              <div className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-body">Real niche bends</h3>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {BEND_WALL.map((card, i) => (
                  <BendWallCard key={card.id} card={card} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <div key="results" className="animate-bend-in flex flex-col gap-8">
              <div className="flex flex-col items-center gap-3">
                <h3 className="text-xl font-semibold text-heading sm:text-2xl">
                  Niche bends for {submittedName}
                </h3>
                <button
                  type="button"
                  onClick={handleReset}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-body transition-colors hover:border-primary/40 hover:text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  Bend another link
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 text-left md:grid-cols-3">
                {RESULT_COLUMNS.map((column) => (
                  <div key={column.title} className="flex flex-col gap-3 rounded-card border border-hairline bg-white p-5 shadow-card">
                    <span className="text-sm font-semibold text-primary">{column.title}</span>
                    <ul className="flex flex-col gap-2.5">
                      {column.hooks.map((hook, i) => (
                        <li key={i} className="rounded-2xl bg-accent px-3.5 py-2.5 text-sm leading-snug text-heading">
                          <span className="mr-1.5 font-semibold text-primary">&rarr;</span>
                          {hook}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-body">
                  Sample SOP for {submittedName}
                </span>
                <div className="mt-3">
                  <SopView sop={teaserResult.sop} variant="compact" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
