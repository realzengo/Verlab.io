#!/bin/sh
# Phase 0 on the worker image: build the fixture, render it with and without
# pause removal, compare frames with the macOS reference, then idle so the
# report stays in the deploy logs. A failed step is logged, never a crash
# loop (the container would restart and bury the logs).

# The container's real share of the machine (os.cpus() reports the host's).
echo "LIMITS cpu.max=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null || echo n/a) memory.max=$(cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo n/a) nproc=$(nproc) mem_total_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)"

step() {
  echo "STEP $*"
  "$@" || { echo "SPIKE FAILED at: $*"; exec sleep infinity; }
}

step node dist/fixture.mjs /tmp/fixture
step node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux --ref spike/ref
step node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-pauses --pauses
# Face tracking (MediaPipe): the step that was ~5x slower than encoding on a Mac.
step node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-track --track
echo "LIMITS peak memory.peak=$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo n/a)"
echo "SPIKE DONE"
exec sleep infinity
