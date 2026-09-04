import type { Metadata } from "next";
import Image from "next/image";
import { Check } from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";

export const metadata: Metadata = {
  title: "Discord, Verlab AI",
  description: "Join the Verlab Discord to connect with other creators, get help fast, and see what we're shipping.",
};

const DISCORD_INVITE_URL = "https://discord.gg/AQBb4v6Ctp";

const GUILD_NAME = "Verlab";
const MEMBER_COUNT = 385;
const ONLINE_COUNT = 43;

const CHECKLIST = [
  "Priority support from the Verlab team",
  "Network with experienced short-form creators",
  "Shape the product with direct feedback to our team",
];

const AVATARS = [
  "/discord/avatar-4.jpg",
  "/discord/avatar-1.jpg",
  "/discord/avatar-5.jpg",
  "/discord/avatar-2.jpg",
  "/discord/avatar-3.jpg",
];

export default function DiscordPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-md flex-col items-center justify-center py-8">
      <h1 className="flex items-center gap-2.5 text-center text-3xl font-bold tracking-tight text-heading sm:text-4xl">
        Join our
        <DiscordIcon className="h-7 w-7 shrink-0 text-[#5865F2] dark:text-white sm:h-8 sm:w-8" />
        Discord
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm text-body sm:text-base">
        Connect with fellow creators, get help fast, and see what everyone is shipping.
      </p>

      <div className="mt-8 w-full rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-accent">
            <Image src="/discord/verlab-logo.png" alt={GUILD_NAME} width={48} height={48} className="h-full w-full object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-heading">{GUILD_NAME}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {ONLINE_COUNT.toLocaleString()} online
              </span>
            </div>
            <p className="text-xs text-subtle">{MEMBER_COUNT.toLocaleString()} members</p>
          </div>

          <div className="hidden shrink-0 -space-x-2 sm:flex">
            {AVATARS.map((src) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-surface"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full flex-col gap-3">
        {CHECKLIST.map((text) => (
          <div key={text} className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-tint text-success">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm text-body">{text}</span>
          </div>
        ))}
      </div>

      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative isolate mt-8 inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] px-11 py-3.5 text-base font-bold text-white shadow-[0_4px_0_0_#1a37c4,0_10px_24px_-8px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_4px_0_0_#1a37c4,0_12px_28px_-8px_rgba(28,63,214,0.55),inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,0_4px_10px_-6px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_50%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
        />
        <span className="relative">Join Discord</span>
      </a>
    </div>
  );
}
