import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import type { ClipMoment } from "@/lib/clips";
import { latestRenderJobs, toRenderJobs } from "@/lib/server/clips/jobs";

// The user's server renders still under way, across projects, with what the
// app needs to show them (project title and thumbnail, the clip): a render
// keeps going on the worker after the tab closes, and Your clips picks it up
// again from here.

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  try {
    const rows = await latestRenderJobs(admin, { userId: user.id, liveOnly: true });
    const projectIds = [...new Set(rows.map((row) => row.project_id))];
    const { data: projects } = projectIds.length
      ? await supabase
          .from("clip_projects")
          .select("id, title, thumbnail_url, clips")
          .in("id", projectIds)
          .returns<{ id: string; title: string; thumbnail_url: string | null; clips: ClipMoment[] | null }[]>()
      : { data: [] };
    const byId = new Map((projects ?? []).map((project) => [project.id, project]));
    const jobs = (await toRenderJobs(admin, rows)).flatMap((job) => {
      const project = byId.get(job.projectId);
      const clip = project?.clips?.find((c) => c.id === job.clipId);
      if (!project || !clip) return [];
      const { cut: _cut, ...moment } = clip as ClipMoment & { cut?: unknown };
      void _cut;
      return [{ ...job, project: { title: project.title, thumbnailUrl: project.thumbnail_url }, clip: moment }];
    });
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return serverError("clips/renders/active", error, "Could not load your renders");
  }
}

export const GET = withApiLogging("/api/clips/renders", handleGET);
