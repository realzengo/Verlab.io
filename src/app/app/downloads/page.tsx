import { redirect } from "next/navigation";

// The video downloader has been retired -- see /api/downloads/create.
export default function DownloadsPage() {
  redirect("/app");
}
