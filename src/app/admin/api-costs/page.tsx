import { getApiProviders } from "@/lib/server/admin-queries";
import { ApiProvidersTable } from "@/components/admin/ApiProvidersTable";

export const dynamic = "force-dynamic";

export default async function AdminApiCostsPage() {
  const providers = await getApiProviders();

  return (
    <div className="flex flex-col gap-6">
      <ApiProvidersTable initialProviders={providers} />

      <p className="text-xs text-subtle">
        Monthly cost is a figure you enter yourself from each provider&apos;s pricing page or invoice. None of these
        providers expose a live billing API, so nothing here is pulled automatically.
      </p>
    </div>
  );
}
