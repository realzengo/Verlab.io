"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowUpCircle, ChevronDown, CircleDollarSign, LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "";
}

function avatarUrl(user: User | null): string | null {
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  return meta?.avatar_url ?? meta?.picture ?? null;
}

const NAV_LINKS = [
  { label: "Upgrade", href: "/pricing", icon: ArrowUpCircle },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Earn with clippie", href: "/affiliates", icon: CircleDollarSign },
];

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const name = displayName(user);
  const email = user?.email ?? "";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-hairline bg-surface p-1 pl-1 pr-1 sm:pr-3"
      >
        <Avatar name={name} src={avatarUrl(user)} size="sm" className="h-6 w-6 sm:h-7 sm:w-7" />
        <ChevronDown className="h-3.5 w-3.5 text-body" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-hairline bg-surface shadow-card-hover overflow-hidden z-50">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} src={avatarUrl(user)} size="md" />
              <div className="min-w-0">
                <p className="text-heading font-semibold text-sm">{name}</p>
                <p className="text-subtle text-xs truncate">{email}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-hairline mt-3">
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-heading text-sm font-medium"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-hairline">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-heading text-sm font-medium"
            >
              <LogOut className="w-4 h-4 text-danger" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
