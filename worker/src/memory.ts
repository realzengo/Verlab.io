import { readFile } from "node:fs/promises";

// The container's own memory use, from cgroup v2 (what the OOM killer acts
// on; a process's RSS misses Chrome's other processes). Null outside Linux.

const CGROUP = "/sys/fs/cgroup";

export async function cgroupMemory(): Promise<{ current: number; max: number | null } | null> {
  try {
    const current = Number((await readFile(`${CGROUP}/memory.current`, "utf8")).trim());
    const rawMax = (await readFile(`${CGROUP}/memory.max`, "utf8")).trim();
    return { current, max: rawMax === "max" ? null : Number(rawMax) };
  } catch {
    return null;
  }
}

/** How many times the kernel has OOM-killed a process in this container. */
export async function oomKills(): Promise<number | null> {
  try {
    const events = await readFile(`${CGROUP}/memory.events`, "utf8");
    return Number(/oom_kill (\d+)/.exec(events)?.[1] ?? 0);
  } catch {
    return null;
  }
}

/** Samples memory.current until stopped; returns the peak in bytes (null outside Linux). */
export function sampleMemoryPeak(everyMs = 100): { stop: () => number | null } {
  let peak: number | null = null;
  const timer = setInterval(() => {
    void cgroupMemory().then((memory) => {
      if (memory) peak = Math.max(peak ?? 0, memory.current);
    });
  }, everyMs);
  return {
    stop: () => {
      clearInterval(timer);
      return peak;
    },
  };
}
