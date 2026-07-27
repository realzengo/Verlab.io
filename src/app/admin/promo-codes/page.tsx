import { getPromoCodes } from "@/lib/server/admin-queries";
import { PromoCodesManager } from "@/components/admin/PromoCodesManager";

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  const codes = await getPromoCodes();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <PromoCodesManager initialCodes={codes} />
    </div>
  );
}
