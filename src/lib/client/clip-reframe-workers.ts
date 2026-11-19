// The app's face tracking workers. Turbopack sees `new Worker(new URL(...))`
// written inline like this and bundles the script as a (classic) worker with
// its own chunk loading. The render worker's page (built with esbuild) doesn't
// pass a factory, so its tracking stays on the page.

import type { ReframeWorkerFactory } from "@/lib/client/clip-reframe";

export const makeReframeWorker: ReframeWorkerFactory = () =>
  new Worker(new URL("./clip-reframe.worker.ts", import.meta.url));
