import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Niche } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_COLOR = { up: "text-success", down: "text-danger", flat: "text-body" };

interface NicheCardProps {
  niche: Niche;
  variant?: "default" | "compact" | "preview";
  selected?: boolean;
  onSelect?: (niche: Niche) => void;
  onBend?: (niche: Niche) => void;
  bendHref?: string;
}

export function NicheCard({ niche, variant = "default", selected, onSelect, onBend, bendHref }: NicheCardProps) {
  const TrendIcon = TREND_ICON[niche.momentumTrend];

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(niche)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-card-sm border px-4 py-3 text-left transition-colors",
          selected ? "border-primary bg-accent" : "border-hairline bg-surface hover:border-primary/40"
        )}
      >
        <div>
          <p className="text-sm font-semibold text-heading">{niche.name}</p>
          <p className="text-xs text-body">{niche.category}</p>
        </div>
        <span className={cn("flex items-center gap-1 text-xs font-semibold", TREND_COLOR[niche.momentumTrend])}>
          <TrendIcon className="h-3.5 w-3.5" />
          {niche.momentumScore}
        </span>
      </button>
    );
  }

  return (
    <Card hoverLift className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge>{niche.category}</Badge>
          <h3 className="mt-2.5 text-base font-semibold text-heading">{niche.name}</h3>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 text-sm font-semibold", TREND_COLOR[niche.momentumTrend])}>
          <TrendIcon className="h-4 w-4" />
          {niche.momentumScore}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-body">{niche.description}</p>

      {variant === "default" && niche.sampleVideos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {niche.sampleVideos.slice(0, 3).map((video) => (
            <div
              key={video.id}
              className="flex aspect-[9/16] flex-col justify-end rounded-lg bg-app p-2"
            >
              <span className="line-clamp-3 text-[10px] leading-tight text-body">{video.title}</span>
              <span className="mt-1 text-[10px] font-semibold text-primary">{video.views} views</span>
            </div>
          ))}
        </div>
      )}

      {bendHref ? (
        <Button href={bendHref} size="sm" className="mt-auto self-start">
          Bend this niche
        </Button>
      ) : (
        onBend && (
          <Button size="sm" onClick={() => onBend(niche)} className="mt-auto self-start">
            Bend this niche
          </Button>
        )
      )}
    </Card>
  );
}
