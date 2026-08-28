import type { Metadata } from "next";
import { AdminLayoutClient } from "./AdminLayoutClient";

// Admin is gated behind login and an email allowlist -- nothing here
// should ever appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
