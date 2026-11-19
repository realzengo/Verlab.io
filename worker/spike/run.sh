#!/bin/sh
# Phase 0 on the worker image: build the fixture, render it with and without
# pause removal, compare frames with the macOS reference, then idle so the
# report stays in the deploy logs.
set -e
node dist/fixture.mjs /tmp/fixture
node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux --ref spike/ref
node dist/spike.mjs --fixture /tmp/fixture --out /tmp/out --label linux-pauses --pauses
echo "SPIKE DONE"
exec sleep infinity
