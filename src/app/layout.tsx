import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
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
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { PostHogPageView } from "@/components/analytics/PostHogPageView";
import { IdentifyUser } from "@/components/analytics/IdentifyUser";
import "./globals.css";

// Mirrors isThemedRoute() in ThemeProvider.tsx -- keep the two in sync.
// Can't import UNTHEMED_APP_HOST_PREFIXES here since this runs as an
// inline <script>, not a module, so the list is duplicated below.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var path = window.location.pathname;
    var unthemed = ["/login","/signup","/checkout","/oauth","/auth","/api","/legal","/pricing","/affiliates","/script-bending","/dev-preview-script-modal","/.well-known"];
    var host = window.location.hostname;
    var isAppRoute = path.indexOf("/app") === 0 || path.indexOf("/admin") === 0 ||
      ((host === "app.verlab.io" || host === "app.localhost") && !unthemed.some(function (p) { return path === p || path.indexOf(p + "/") === 0; }));
    if (!isAppRoute) return;
    var stored = localStorage.getItem("verlab-theme");
    document.documentElement.classList.toggle("dark", stored === "dark");
  } catch (e) {}
})();
`;

// Whop Pixel (biz_bJ95zQxyY6r7mX) -- verbatim per https://docs.whop.com/developer/ads/pixel, do not edit.
const WHOP_PIXEL_SCRIPT = `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_bJ95zQxyY6r7mX");whop.track("page");`;

const title = "Verlab AI";
const description =
  "Verlab finds the faceless niches blowing up on TikTok, reverse-engineers why they work, and bends them into a repeatable system for your channel.";

export const metadata: Metadata = {
  metadataBase: new URL("https://verlab.io"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://verlab.io",
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

// interactiveWidget: "resizes-content" makes mobile browsers actually shrink
// the layout viewport when the on-screen keyboard opens (and restore it on
// close), instead of the newer "overlays-content" default -- which leaves
// dvh-based fixed panels (like ScriptEditorModal's chat input) stranded mid-
// screen with dead space below once the keyboard dismisses.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${GeistSans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="whop-pixel" strategy="beforeInteractive">
          {WHOP_PIXEL_SCRIPT}
        </Script>
        <PostHogProvider>
          <PostHogPageView />
          <IdentifyUser />
          <ThemeProvider>{children}</ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
