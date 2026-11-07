"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClippingHome } from "@/components/clipping/ClippingHome";
import { ClipProjectView } from "@/components/clipping/ClipProjectView";

// One route, two views: the link field + "Or choose" grid, and a project's
// Choose / Edit / Download steps. The open project lives in ?project= so a
// reload or a shared tab lands back on it.
export function ClippingPage() {
  const router = useRouter();
  const projectId = useSearchParams().get("project");

  if (projectId) {
    return <ClipProjectView projectId={projectId} onBack={() => router.push("/clipping")} />;
  }
  return <ClippingHome onOpenProject={(id) => router.push(`/clipping?project=${id}`)} />;
}
