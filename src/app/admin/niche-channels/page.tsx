import { getNicheChannelsForAdmin } from "@/lib/server/admin-queries";
import { NicheChannelsManager } from "@/components/admin/NicheChannelsManager";

export const dynamic = "force-dynamic";

export default async function AdminNicheChannelsPage() {
  const channels = await getNicheChannelsForAdmin();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <NicheChannelsManager initialChannels={channels} />
    </div>
  );
}
