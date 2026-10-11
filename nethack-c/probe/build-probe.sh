#!/bin/bash
# build-probe.sh — Build a diagnostic copy of the recorder.
#
# The probe binary is the built recorder plus state-digest.patch, compiled
# with clang source-based coverage. It records the same sessions as the
# recorder (same random calls, screens, cursors) and can also write:
#   NETHACK_STATELOG=path      one canonical game-state line per input boundary
#   LLVM_PROFILE_FILE=dir/%p.profraw   per-process C coverage counters
#
# It never modifies nethack-c/recorder. Run build-recorder.sh first.
# Output: .cache/probe-recorder/install/games/lib/nethackdir/nethack

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RECORDER="$REPO_ROOT/nethack-c/recorder"
PROBE="$REPO_ROOT/.cache/probe-recorder"

[ -x "$RECORDER/src/nethack" ] || { echo "[FAIL] build nethack-c/recorder first" >&2; exit 1; }
mkdir -p "$PROBE"
rsync -a --delete --exclude='install' "$RECORDER/" "$PROBE/tree/"
( cd "$PROBE/tree" && patch -s -p1 < "$SCRIPT_DIR/state-digest.patch" )
cd "$PROBE/tree/src"
rm -f ./*.o nethack
export SOURCE_DATE_EPOCH="${TELEPORT_BUILD_EPOCH:-1777723200}"
make -j"$(getconf _NPROCESSORS_ONLN)" SYSCFLAGS="${LUA_SYSCFLAGS:--DLUA_USE_MACOSX}" \
    CC="clang -fprofile-instr-generate -fcoverage-mapping" nethack > "$PROBE/build.log"
rsync -a --delete "$RECORDER/install/" "$PROBE/install/"
cp nethack "$PROBE/install/games/lib/nethackdir/nethack"
echo "[ok] probe recorder: $PROBE/install/games/lib/nethackdir/nethack"
