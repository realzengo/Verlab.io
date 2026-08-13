import Image from "next/image";
import { Compass, Home, Library, Plug, Search, Wand2, Wrench } from "lucide-react";

const MINI_NAV = [
  { label: "Home", icon: Home, active: false },
  { label: "Library", icon: Library, active: false },
  { label: "Niche Finder", icon: Compass, active: true },
  { label: "Niche Bending", icon: Wand2, active: false },
  { label: "Tools", icon: Wrench, active: false },
  { label: "MCP", icon: Plug, active: false },
];

const HERO_NICHE = {
  thumbnail: "/niche-thumb-1.png",
  title: "Stoic philosophy clips",
  stat: "1.2M avg views",
  growth: "+18%",
};

const FILMSTRIP = [
  "/niche-thumb-2.png",
  "/bend-thumb-1.png",
  "/bend-thumb-2.png",
  "/hook-thumb-1.png",
  "/hook-thumb-2.png",
];

export function AuthShowcasePanel() {
  return (
    <div className="relative w-full max-w-[640px]">
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_30px_80px_-25px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-zinc-900">
        <div className="flex h-[500px] xl:h-[560px]">
          {/* mini sidebar */}
          <div className="hidden w-[184px] shrink-0 flex-col border-r border-[#EEF0F8] bg-[#FBFAFF] p-5 sm:flex dark:border-white/5 dark:bg-black/40">
            <div className="mb-8 flex items-center gap-2 px-1">
              <span className="relative block h-6 w-6 shrink-0">
                <Image src="/logo-icon.png" alt="" fill className="object-contain" sizes="24px" />
              </span>
              <span className="text-[13.5px] font-bold text-heading">Verlab</span>
            </div>
            <nav className="flex flex-col gap-1.5">
              {MINI_NAV.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-[12.5px] font-semibold ${
                    item.active
                      ? "border-[#E0E4F2] bg-surface text-heading shadow-sm dark:border-white/10 dark:bg-white/5"
                      : "border-transparent text-[#8A93AC]"
                  }`}
                >
                  <item.icon
                    className={`h-3.5 w-3.5 shrink-0 ${item.active ? "text-primary" : "text-[#8A93AC]"}`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </nav>
          </div>

          {/* main content */}
          <div className="flex flex-1 flex-col overflow-hidden bg-white p-6 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cat-1-tint">
                <Compass className="h-[18px] w-[18px] text-cat-1" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-heading">Niche Finder</p>
                <p className="truncate text-[11.5px] text-subtle">
                  Non-competitive faceless niches, backed by real transcripts
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-hairline bg-app px-3.5 py-3 dark:bg-white/[0.03]">
              <Search className="h-3.5 w-3.5 shrink-0 text-subtle" />
              <span className="truncate text-[12.5px] text-subtle">
                Paste a TikTok or YouTube link&hellip;
              </span>
            </div>

            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-app">
                <Image
                  src={HERO_NICHE.thumbnail}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width: 1280px) 456px, 400px"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent p-4 pt-10">
                  <p className="truncate text-[14.5px] font-bold text-white">{HERO_NICHE.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="truncate text-[12px] text-white/80">{HERO_NICHE.stat}</span>
                    <span className="shrink-0 rounded-full bg-cat-5-tint px-2 py-0.5 text-[10.5px] font-semibold text-cat-5">
                      {HERO_NICHE.growth}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex shrink-0 gap-2">
                {FILMSTRIP.map((thumb, i) => (
                  <span
                    key={thumb}
                    className={`relative block h-14 flex-1 shrink-0 overflow-hidden rounded-lg bg-app ring-1 ${
                      i === 0 ? "ring-primary" : "ring-black/5 dark:ring-white/10"
                    }`}
                  >
                    <Image src={thumb} alt="" fill className="object-cover" sizes="80px" />
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === 0 ? "w-4 bg-primary" : "w-1 bg-[#E0E4F2] dark:bg-white/10"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 text-center">
        <h3 className="text-lg font-bold tracking-tight text-heading">Niche Finder</h3>
        <p className="mx-auto mt-1.5 max-w-[420px] text-sm leading-relaxed text-body">
          Discover non-competitive faceless niches backed by real transcripts
          &mdash; not vague metadata guesses.
        </p>
      </div>
    </div>
  );
}
