"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClippingHome } from "@/components/clipping/ClippingHome";
import { ClipLibrary } from "@/components/clipping/ClipLibrary";
import { ClipProjectView } from "@/components/clipping/ClipProjectView";

// One route, three views: the link field + "Or choose" grid, a project's
// Choose / Edit / Download steps, and every clip the user has made
// (?view=all, or one video's clips with &video=). The open project lives in ?project= so a reload or a shared
// tab lands back on it.
export function ClippingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project");
  // `clip` opens the project with that moment picked (from a video's page in Your clips).
  const openProject = (id: string, clipId?: string) =>
    router.push(`/clipping?project=${id}${clipId ? `&clip=${encodeURIComponent(clipId)}` : ""}`);

  if (projectId) {
    return (
      <ClipProjectView
        key={projectId}
        projectId={projectId}
        initialClipId={params.get("clip")}
        onBack={() => router.push("/clipping")}
      />
    );
  }
  if (params.get("view") === "all") {
    return (
      <ClipLibrary
        videoId={params.get("video")}
        onOpenVideo={(id) => router.push(id ? `/clipping?view=all&video=${id}` : "/clipping?view=all")}
        onBack={() => router.push("/clipping")}
        onOpenProject={openProject}
      />
    );
  }
  return <ClippingHome onOpenProject={openProject} />;
}
