import type { Metadata } from "next";
import Image from "next/image";
import { Check } from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { PlasticLinkButton } from "@/components/ui/plastic-link-button";

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

      <PlasticLinkButton
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 w-full py-3.5 text-base"
      >
        Join Discord
      </PlasticLinkButton>
    </div>
  );
}
