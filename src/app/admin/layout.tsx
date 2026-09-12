import type { Metadata } from "next";
// Inter stands in for NotionInter -- a single family carries the whole admin
// shell, from 26px headings down to 12px eyebrows. Imported here rather than
// in the root layout so the marketing site and user dashboard don't pay for a
// font they never use.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { AdminLayoutClient } from "./AdminLayoutClient";

// Admin is gated behind login and an email allowlist -- nothing here
// should ever appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
