import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-app px-4 py-16 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] dark:opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-hairline) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 opacity-70 blur-3xl animate-blob-a dark:opacity-25" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-1/3 -z-10 h-72 w-72 translate-y-1/3 rounded-full bg-blue-400/10 opacity-60 blur-3xl animate-blob-b dark:opacity-20" />

      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-body shadow-card transition-colors hover:text-heading sm:left-8 sm:top-8"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to site
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <span className="relative block h-9 w-[145px]">
            <Image
              src="/logo-full-light.png"
              alt="Verlab Studio"
              fill
              className="object-contain dark:hidden"
              sizes="145px"
            />
            <Image
              src="/logo-full-dark.png"
              alt="Verlab Studio"
              fill
              className="hidden object-contain dark:block"
              sizes="145px"
            />
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
