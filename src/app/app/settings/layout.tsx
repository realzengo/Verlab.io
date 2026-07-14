"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Plan & billing", href: "/app/settings" },
  { label: "Developer API", href: "/app/settings/api" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Settings</h2>
      </div>

      <div className="inline-flex w-fit items-center gap-1 rounded-full border border-hairline bg-surface p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                active ? "bg-primary text-white" : "text-body hover:text-heading"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
