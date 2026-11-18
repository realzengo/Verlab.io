import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { getAdminPulse } from "@/lib/server/admin-pulse";
import { serverError } from "@/lib/server/api-error";

/** The sidebar status card's data. Admins only; polled while a tab is open. */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminEmailOrNull())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await getAdminPulse(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError("admin/pulse", error, "Couldn't check the app's status.");
  }
}
