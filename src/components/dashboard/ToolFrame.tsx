import type { ReactNode } from "react";

// Order mirrors the app's primary tool surfaces (sidebar items + the Tools
// grid) -- the active dot below a given page is just this page's index here.
const TOOL_ORDER = [
  "Niche Finder",
  "Niche Bending",
  "Image Generator",
  "Video Generator",
  "Scriptwriter",
  "Transcript Extractor",
  "Downloader",
  "Voiceover",
] as const;

export type ToolFrameTitle = (typeof TOOL_ORDER)[number];

export function ToolFrame({
  title,
  description,
  className,
  children,
}: {
  title: ToolFrameTitle;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  const activeIndex = TOOL_ORDER.indexOf(title);

  return (
    <div className={className}>
      <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-6 md:p-8">
        {children}

        <div className="mt-8 flex justify-center gap-1">
          {TOOL_ORDER.map((tool, i) => (
            <span
              key={tool}
              className={`h-1 rounded-full transition-all ${
                i === activeIndex ? "w-4 bg-primary" : "w-1 bg-hairline"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-7 text-center">
        <h2 className="text-lg font-bold tracking-tight text-heading">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[420px] text-sm leading-relaxed text-body">
          {description}
        </p>
      </div>
    </div>
  );
}
