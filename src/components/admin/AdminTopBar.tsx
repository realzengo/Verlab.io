"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { ADMIN_NAV } from "@/lib/mock/nav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UserAvatar } from "@/components/admin/UserAvatar";

function pageTitle(pathname: string): string {
  if (pathname === "/admin") return "Overview";
  return ADMIN_NAV.find((nav) => nav.href !== "/admin" && pathname.startsWith(nav.href))?.label ?? "Admin";
}

const PILL =
  "flex h-9 shrink-0 items-center rounded-full bg-surface text-[13px] shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.04)] transition-colors dark:bg-white/[0.06] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]";

/**
 * The top of the page column: where you are on the left, search, theme and
 * who you're signed in as on the right. The page's own h1 lives in its
 * PageHeader (visually hidden); this title is what the eye reads.
 */
export function AdminTopBar({
  onMenuClick,
  onOpenSearch,
  email,
}: {
  onMenuClick: () => void;
  onOpenSearch: () => void;
  email: string;
}) {
  const pathname = usePathname();
  const name = email ? email.split("@")[0] : "Admin";

  return (
    <header className="flex h-[72px] items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-(--admin-fill-strong) hover:text-heading md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-heading">{pageTitle(pathname)}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search the admin"
          aria-keyshortcuts="Meta+K Control+K"
          className={`${PILL} w-9 justify-center text-subtle hover:text-heading sm:w-auto sm:gap-2 sm:pl-3 sm:pr-1.5`}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden h-6 items-center rounded-full bg-(--admin-fill-strong) px-2 font-sans text-[11px] font-medium text-subtle sm:flex">
            ⌘K
          </kbd>
        </button>
        <ThemeToggle className="h-9 w-9 border-0 bg-surface shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.04)] dark:bg-white/[0.06] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />
        <span className={`${PILL} hidden gap-2.5 pl-3.5 pr-1 font-medium text-heading sm:flex`} title={email || undefined}>
          <span className="max-w-[160px] truncate">{name}</span>
          <UserAvatar name={email || "Admin"} you size="sm" />
        </span>
      </div>
    </header>
  );
}
