import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/500.css";
import "@fontsource/open-sauce-one/600.css";
import "@fontsource/open-sauce-one/700.css";
import "@fontsource/open-sauce-one/800.css";
import "@fontsource/open-sauce-one/900.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var path = window.location.pathname;
    var isAppRoute = path.indexOf("/app") === 0 || path.indexOf("/admin") === 0;
    if (!isAppRoute) return;
    var stored = localStorage.getItem("verlab-theme");
    document.documentElement.classList.toggle("dark", stored === "dark");
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Verlab — Bend any viral niche into your own",
  description:
    "Verlab finds the faceless niches blowing up on TikTok, reverse-engineers why they work, and bends them into a repeatable system for your channel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
