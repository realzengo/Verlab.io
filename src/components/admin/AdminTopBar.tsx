"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import { ADMIN_NAV, ADMIN_NAV_SECTIONS } from "@/lib/mock/nav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function crumbs(pathname: string): { section: string | null; page: string } {
  if (pathname === "/admin") return { section: null, page: "Overview" };
  const item = ADMIN_NAV.find((nav) => nav.href !== "/admin" && pathname.startsWith(nav.href));
  const section = ADMIN_NAV_SECTIONS.find((s) => s.items.some((i) => i.href === item?.href));
  return { section: section?.label ?? null, page: item?.label ?? "Admin" };
}

export function AdminTopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { section, page } = crumbs(pathname);

  return (
    // Location only: the page's own header carries its title and actions.
    <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-hairline bg-app/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 shrink-0 rounded-md p-1.5 text-body transition-colors hover:bg-(--admin-fill) hover:text-heading md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link href="/admin" className="shrink-0 text-subtle transition-colors hover:text-heading">
            Admin
          </Link>
          {section && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle/70" aria-hidden="true" />
              <span className="hidden shrink-0 text-subtle sm:inline">{section}</span>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-subtle/70 sm:inline" aria-hidden="true" />
            </>
          )}
          {!section && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle/70" aria-hidden="true" />}
          <span aria-current="page" className="truncate font-medium text-heading">
            {page}
          </span>
        </nav>
      </div>

      <ThemeToggle />
    </div>
  );
}
