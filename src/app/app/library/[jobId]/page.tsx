"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pollStatus, setBendSaved } from "@/lib/api/niche-bend";
import type { NicheBendSopResult } from "@/lib/types";
import { StepSop } from "@/components/features/niche-bend/StepSop";

export default function LibraryItemPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const router = useRouter();

  const [sop, setSop] = useState<NicheBendSopResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pollStatus(jobId)
      .then((status) => {
        if (cancelled) return;
        if (!status.sop) {
          setError("This bend doesn't have a saved SOP.");
          return;
        }
        setSop(status.sop);
        setSaved(status.saved);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this SOP. It may have been deleted.");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const handleToggleSaved = async () => {
    const nextSaved = !saved;
    setSavingToggle(true);
    try {
      const status = await setBendSaved(jobId, nextSaved);
      setSaved(status.saved);
    } finally {
      setSavingToggle(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Link
        href="/app/library"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-body hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </Link>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!error && !sop && (
        <div className="h-[400px] animate-pulse rounded-card border border-hairline bg-surface" />
      )}

      {sop && (
        <StepSop
          sop={sop}
          onReset={() => router.push("/app/bend")}
          saved={saved}
          savingToggle={savingToggle}
          onToggleSaved={handleToggleSaved}
        />
      )}
    </div>
  );
}
