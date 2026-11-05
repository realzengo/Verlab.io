"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { settingsButton } from "@/components/settings/SettingsSection";

export function RefreshHistoryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 1200);
    });
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      className={settingsButton()}
    >
      <RefreshCw className={`h-4 w-4 text-subtle ${isPending || justRefreshed ? "animate-spin" : ""}`} strokeWidth={1.75} />
      Refresh
    </button>
  );
}
