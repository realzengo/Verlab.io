"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavEntry {
  label: string;
  href: string;
}

const TABS: NavEntry[] = [
  { label: "Account", href: "/app/settings" },
  { label: "Subscription", href: "/app/settings/subscription" },
  { label: "Credit History", href: "/app/settings/credits" },
  { label: "Payment Method", href: "/app/settings/payment-method" },
  { label: "Password & Security", href: "/app/settings/security" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="bg-app text-heading">
      <div className="w-full pt-6 px-4 pb-12 sm:pt-10 sm:px-6 sm:pb-16 md:px-8">
        <Link href="/app" className="text-xl font-medium flex items-center gap-2 mb-4 sm:text-2xl sm:mb-6">
          <ArrowLeft className="h-5 w-5" />
          Settings
        </Link>

        <nav className="border-b border-hairline mb-6 flex gap-4 overflow-x-auto sm:mb-8 sm:gap-6">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap text-sm pb-2 px-1 transition-colors",
                  active
                    ? "border-b-2 border-primary text-heading font-medium"
                    : "text-subtle hover:text-heading"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
