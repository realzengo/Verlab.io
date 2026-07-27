"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { TopUpModal } from "@/components/TopUpModal";

export function TopUpButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/15 bg-success/[0.07] py-1.5 pl-3 pr-2.5 text-xs font-semibold text-success transition-colors hover:border-success/30 hover:bg-success/10"
      >
        Top up
        <Plus className="h-3.5 w-3.5" />
      </button>
      <TopUpModal isOpen={isOpen} onClose={() => setIsOpen(false)} onRedeemed={() => router.refresh()} />
    </>
  );
}
