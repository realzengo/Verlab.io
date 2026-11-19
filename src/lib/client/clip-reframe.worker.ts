// A face tracking worker: reads its share of a clip's frames (or pins its
// share of the cuts) for analyzeReframe, off the editor's thread. See
// clip-reframe.ts for the pool that runs these.

import {
  getVision,
  pinCuts,
  readFrames,
  type ReframeWorkerReply,
  type ReframeWorkerRequest,
} from "@/lib/client/clip-reframe";

const reply = (message: ReframeWorkerReply, transfer: Transferable[] = []) => postMessage(message, { transfer });

addEventListener("message", async (event: MessageEvent<ReframeWorkerRequest>) => {
  const request = event.data;
  const { id } = request;
  try {
    if (request.kind === "warm") {
      // Loads the models now; a failure here shows again (and is reported) on the first real request.
      await getVision().catch(() => {});
    } else if (request.kind === "read") {
      const result = await readFrames(request.blob, request.stamps, request.firstIndex, () =>
        reply({ id, kind: "frame" })
      );
      const frames = result?.reads.flatMap((read) => (read.luma ? [read.luma.buffer] : [])) ?? [];
      reply({ id, kind: "done", result }, frames);
    } else {
      reply({ id, kind: "done", result: await pinCuts(request.blob, request.pins) });
    }
  } catch (error) {
    reply({ id, kind: "error", message: error instanceof Error ? error.message : String(error) });
  }
});

// Listening now: the pool sends work only after this.
reply({ id: 0, kind: "ready" });
