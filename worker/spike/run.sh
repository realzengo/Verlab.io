#!/bin/sh
# Phase 0 on the worker image: build the fixture, render it in a few
# configurations, compare frames with the macOS reference, then idle so the
# REPORT lines stay in the deploy logs. A failed render is logged and the
# next one still runs (a crash loop would bury the logs).

# The container's real share of the machine (os.cpus() reports the host's).
echo "LIMITS cpu.max=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null || echo n/a) memory.max=$(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo n/a) nproc=$(nproc)"

try() {
  echo "STEP $*"
  "$@" || echo "STEP FAILED: $*"
}

node dist/fixture.mjs /tmp/fixture || { echo "SPIKE FAILED at fixture"; exec sleep infinity; }

# Default Chrome again, now with a once-a-second memory trace.
try node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux --ref spike/ref
# Lean Chrome: no GPU process, fewer helper processes, a capped JS heap.
LEAN="--disable-gpu --renderer-process-limit=1 --no-zygote --disable-extensions --disable-background-networking --disable-component-update --disable-features=Translate,MediaRouter,OptimizationHints,BackForwardCache --js-flags=--max-old-space-size=384"
try env CHROME_EXTRA_ARGS="$LEAN" node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-lean --ref spike/ref
try env CHROME_EXTRA_ARGS="$LEAN" node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-lean-track --track

echo "SPIKE DONE"
exec sleep infinity
