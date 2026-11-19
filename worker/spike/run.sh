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

# Chrome's defaults: on a machine without a GPU it emulates one (SwiftShader).
try node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux --ref spike/ref
# No GPU process at all: canvas rasters on the CPU in the page's own process.
try env CHROME_EXTRA_ARGS=--disable-gpu node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-nogpu --ref spike/ref
try env CHROME_EXTRA_ARGS=--disable-gpu node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-nogpu-pauses --pauses
# Face tracking (MediaPipe): the step that was ~5x slower than encoding on a Mac.
try env CHROME_EXTRA_ARGS=--disable-gpu node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-nogpu-track --track

echo "SPIKE DONE"
exec sleep infinity
