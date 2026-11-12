"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClippingHome } from "@/components/clipping/ClippingHome";
import { ClipLibrary } from "@/components/clipping/ClipLibrary";
import { ClipProjectView } from "@/components/clipping/ClipProjectView";

// One route, three views: the link field + "Or choose" grid, a project's
// Choose / Edit / Download steps, and every clip the user has made
// (?view=all). The open project lives in ?project= so a reload or a shared
// tab lands back on it.
export function ClippingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project");
  const openProject = (id: string) => router.push(`/clipping?project=${id}`);

  if (projectId) {
    return <ClipProjectView projectId={projectId} onBack={() => router.push("/clipping")} />;
  }
  if (params.get("view") === "all") {
    return <ClipLibrary onBack={() => router.push("/clipping")} onOpenProject={openProject} />;
  }
  return <ClippingHome onOpenProject={openProject} />;
}
