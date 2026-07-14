import { Loader2, Wand2 } from "lucide-react";

export function BendMappingVisual({ sourceNiche, targetNiche }: { sourceNiche: string; targetNiche: string }) {
  return (
    <div className="animate-bend-in flex flex-col items-center gap-6 rounded-card border border-hairline bg-white p-10 text-center">
      <div className="flex items-center gap-4">
        <div className="rounded-card-sm border border-hairline bg-app px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Source</span>
          <p className="text-sm font-semibold text-heading">{sourceNiche}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Wand2 className="h-4 w-4" />
        </div>
        <div className="rounded-card-sm border border-primary bg-accent px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Target</span>
          <p className="text-sm font-semibold text-heading">{targetNiche}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-body">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Mapping the winning structure across niches...
      </div>
    </div>
  );
}
