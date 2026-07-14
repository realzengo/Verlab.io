"use client";

import { useState, type FormEvent } from "react";
import { Bookmark, Lock, RefreshCcw, Search } from "lucide-react";

interface WallCard {
  id: string;
  creator: string;
  initials: string;
  delta: string;
  niche: string;
  bullets: string[];
  locked?: boolean;
}

const WALL_CARDS: WallCard[] = [
  {
    id: "crayon-capital",
    creator: "Crayon Capital",
    initials: "CC",
    delta: "+3",
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
    delta: "+4",
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
    delta: "+2",
    niche: "Financial Collapse",
    bullets: [
      "The trade that erased a nation's pension fund",
      "Every warning sign regulators chose to ignore",
      "How one bad bet took down a 150-year-old bank",
    ],
  },
];

interface ResultColumn {
  title: string;
  hooks: string[];
}

const RESULT_COLUMNS: ResultColumn[] = [
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

function deriveName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "this creator";

  let value = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const handleMatch = value.match(/@([a-zA-Z0-9._-]+)/);

  if (handleMatch) {
    value = handleMatch[1];
  } else {
    const segments = value.split("/").filter(Boolean);
    value = segments.length > 1 ? segments[1] : (segments[0] ?? value);
  }

  value = value.replace(/^@/, "");

  const words = value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(" ") || "this creator";
}

function BendWallCard({ card }: { card: WallCard }) {
  if (card.locked) {
    return (
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-yellow-400 bg-white p-5">
        <div aria-hidden className="pointer-events-none select-none blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef0ff] text-xs font-semibold text-[#335cff]">
                {card.initials}
              </div>
              <span className="text-sm font-semibold text-[#335cff]">{card.creator}</span>
            </div>
            <span className="text-xs font-semibold text-green-600">{card.delta}</span>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Bent to:</span>
            <p className="mt-1 text-base font-bold text-[#0b0f19]">{card.niche}</p>
          </div>
          <div className="mt-4 flex flex-col gap-1.5 border-t border-dashed border-[#e5e7eb] pt-3">
            {card.bullets.map((bullet, i) => (
              <p key={i} className="text-sm leading-snug text-[#6b7280]">
                {bullet}
              </p>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md">
            <Lock className="h-6 w-6 text-yellow-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef0ff] text-xs font-semibold text-[#335cff]">
            {card.initials}
          </div>
          <span className="text-sm font-semibold text-[#335cff]">{card.creator}</span>
        </div>
        <span className="text-xs font-semibold text-green-600">{card.delta}</span>
      </div>

      <div className="mt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Bent to:</span>
        <p className="mt-1 text-base font-bold text-[#0b0f19]">{card.niche}</p>
      </div>

      <div className="mt-4 flex flex-col gap-1.5 border-t border-dashed border-[#e5e7eb] pt-3">
        {card.bullets.map((bullet, i) => (
          <p key={i} className="select-none text-sm leading-snug text-gray-300 blur-sm">
            {bullet}
          </p>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ column }: { column: ResultColumn }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-dashed border-[#e5e7eb] bg-white p-5 transition-colors duration-200 hover:border-[#335cff] hover:bg-[#eef0ff]">
      <div className="transition-opacity duration-200 group-hover:pointer-events-none group-hover:opacity-0">
        <h3 className="text-base font-bold text-[#0b0f19]">{column.title}</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {column.hooks.map((hook, i) => (
            <li key={i} className="flex gap-1.5 text-sm leading-snug text-[#6b7280]">
              <span className="shrink-0 font-semibold text-[#335cff]">&rarr;</span>
              {hook}
            </li>
          ))}
        </ul>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-8 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <button type="button" className="flex flex-col items-center gap-1.5 text-[#335cff]">
          <Bookmark className="h-5 w-5" />
          <span className="text-xs font-semibold">Save</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1.5 text-[#335cff]">
          <RefreshCcw className="h-5 w-5" />
          <span className="text-xs font-semibold">Regenerate</span>
        </button>
      </div>
    </div>
  );
}

export default function InteractiveNicheBender() {
  const [query, setQuery] = useState("");
  const [isBending, setIsBending] = useState(false);
  const [creatorName, setCreatorName] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatorName(deriveName(query));
    setIsBending(true);
  };

  return (
    <div className="w-full bg-white">
      <div className="border-y border-dashed border-[#e5e7eb] py-10">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-lg border-2 border-dashed border-[#335cff] bg-white px-4 py-2.5"
        >
          <Search className="h-5 w-5 shrink-0 text-[#6b7280]" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search up a channel or paste the link"
            aria-label="Search up a channel or paste the link"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#0b0f19] placeholder:text-[#6b7280] outline-none focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[#335cff] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2947d1]"
          >
            Bend it
          </button>
        </form>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {!isBending ? (
          <>
            <h2 className="text-xl font-bold text-[#0b0f19]">Bend Wall</h2>
            <p className="mt-1 text-sm text-[#6b7280]">Real niche bends from real users</p>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              {WALL_CARDS.map((card) => (
                <BendWallCard key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-left text-xl font-bold text-[#0b0f19]">
              Niche bends for {creatorName}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              {RESULT_COLUMNS.map((column) => (
                <ResultCard key={column.title} column={column} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
