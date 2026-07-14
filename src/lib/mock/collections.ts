import type { Collection } from "@/lib/types";

export const COLLECTIONS: Collection[] = [
  {
    id: "col-1",
    name: "Crayon Capital — Full archive",
    sourceUrl: "https://www.tiktok.com/@crayoncapital/collection/malpractice-7312345",
    itemCount: 42,
    status: "complete",
    progress: 100,
    createdAt: "2026-05-20T09:00:00.000Z",
  },
  {
    id: "col-2",
    name: "Ben's Business Breakdown — Espionage series",
    sourceUrl: "https://www.tiktok.com/@bensbusinessbreakdown/collection/espionage-7298765",
    itemCount: 50,
    status: "processing",
    progress: 64,
    createdAt: "2026-06-14T10:15:00.000Z",
  },
  {
    id: "col-3",
    name: "The Finance Guy — Collapse case studies",
    sourceUrl: "https://www.tiktok.com/@thefinanceguy/collection/collapse-7301122",
    itemCount: 18,
    status: "queued",
    progress: 0,
    createdAt: "2026-06-16T18:40:00.000Z",
  },
];
