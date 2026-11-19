import { getAllAnnouncements } from "@/lib/server/announcements";
import { AnnouncementsManager } from "@/components/admin/AnnouncementsManager";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const { announcements, tableMissing } = await getAllAnnouncements();

  return (
    <div className="flex flex-col gap-6">
      <AnnouncementsManager initialAnnouncements={announcements} tableMissing={tableMissing} />
    </div>
  );
}
