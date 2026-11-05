"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { TopUpModal } from "@/components/TopUpModal";
import { settingsButton } from "@/components/settings/SettingsSection";

export function TopUpButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={settingsButton("primary")}>
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        Top up
      </button>
      <TopUpModal isOpen={isOpen} onClose={() => setIsOpen(false)} onRedeemed={() => router.refresh()} />
    </>
  );
}
