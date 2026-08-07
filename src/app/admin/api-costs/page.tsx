import { getApiProviders } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { ApiProvidersTable } from "@/components/admin/ApiProvidersTable";

export const dynamic = "force-dynamic";

export default async function AdminApiCostsPage() {
  const providers = await getApiProviders();

  const missingKeys = providers.filter((p) => p.envVar && !p.configured);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <p className="text-sm text-body">Every third-party API integrated in the product, and what it costs you per month.</p>

      {missingKeys.length > 0 && (
        <Card className="border-warning/30 bg-warning-tint">
          <p className="text-sm font-medium text-heading">
            {missingKeys.map((p) => p.name).join(", ")} {missingKeys.length === 1 ? "has" : "have"} no API key set on this
            deployment.
          </p>
          <p className="mt-1 text-xs text-body">
            Add the missing env var{missingKeys.length === 1 ? "" : "s"} (
            {missingKeys.map((p) => p.envVar).join(", ")}) to enable those integrations.
          </p>
        </Card>
      )}

      <ApiProvidersTable initialProviders={providers} />

      <p className="text-xs text-subtle">
        Monthly cost is a figure you enter yourself based on each provider&apos;s pricing page or invoice — none of these
        providers expose a live billing API, so nothing here is pulled automatically.
      </p>
    </div>
  );
}
