#!/usr/bin/env node
// state-replay.mjs — compare one session's game-state digests with C.
//
//   node --import scripts/lib/frozen-adapters.mjs scripts/lib/state-replay.mjs SESSION C_STATE_LOG
//   stdout: "__STATE_RESULT__" sentinel, then one bounded JSON line.
//
// The C log comes from the probe recorder (nethack-c/probe): one line per
// input boundary, "SEQ<TAB>digest", with SEQ restarting at 1 for each
// segment's process. Line SEQ=k describes step k-1 of that segment.
// Steps where either side is outside normal play are counted, not compared.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { normalizeSession } from '../../frozen/session_loader.mjs';
import { runSegment } from '../../js/jsmain.js';
import { createReplayStorage } from './replay-capture.mjs';
import { cursorsEqual, extractRngCalls, firstSliceDifference, isRngCall, screensVisuallyEqual } from './score-session.mjs';
import { decodeSession, errorMessage, itemAt } from './session-types.mjs';
import { digestDifference, stateDigest } from './state-digest.mjs';
// Split "SEQ\tdigest" lines into per-segment arrays indexed by step.
export function parseStateLog(text) {
    const segments = [];
    let current = null;
    for (const line of text.split('\n')) {
        if (!line)
            continue;
        const tab = line.indexOf('\t');
        const seq = Number(line.slice(0, tab));
        if (tab < 0 || !Number.isInteger(seq) || seq < 1)
            throw new Error('Malformed state log line');
        if (seq === 1 || !current) {
            current = [];
            segments.push(current);
        }
        current[seq - 1] = line.slice(tab + 1);
    }
    return segments;
}
export async function compareSessionState(sessionPath, statePath) {
    const segments = decodeSession(normalizeSession(JSON.parse(readFileSync(sessionPath, 'utf8')))).segments;
    const cStates = parseStateLog(readFileSync(statePath, 'utf8'));
    if (cStates.length !== segments.length)
        throw new Error(`State log has ${cStates.length} segments; session has ${segments.length}`);
    const storage = createReplayStorage();
    const result = { session: basename(sessionPath), compared: 0, phaseMismatches: 0,
        firstState: null, firstRng: null, firstScreen: null, error: null };
    for (const [si, seg] of segments.entries()) {
        const digests = [];
        const game = await runSegment({ seed: seg.seed, datetime: seg.datetime, nethackrc: seg.nethackrc,
            moves: seg.moves ?? '', storage, observeInput: state => { digests.push(stateDigest(state)); } })
            .catch((e) => errorMessage(e).slice(0, 300));
        if (typeof game === 'string') {
            result.error = game;
            return result;
        }
        const steps = seg.steps ?? [];
        const cSeg = itemAt(cStates, si);
        const jsSlices = game.getRngSlices().map(slice => slice.map(e => e.replace(/^\d+\s+/, '')).filter(isRngCall));
        const screens = game.getScreens(), cursors = game.getCursors();
        for (const [b, step] of steps.entries()) {
            const here = { segment: si, step: b };
            if (!result.firstRng && firstSliceDifference(extractRngCalls(step.rng), jsSlices[b] ?? []) !== null)
                result.firstRng = here;
            if (!result.firstScreen && step.screen
                && !(screensVisuallyEqual(screens[b] ?? '', step.screen) && cursorsEqual(step.cursor, cursors[b]))) {
                result.firstScreen = here;
            }
            if (result.firstState)
                continue;
            const c = cSeg[b], js = digests[b];
            if (c === undefined || js === undefined)
                continue;
            const difference = digestDifference(c, js);
            if (difference?.field === 'phase') {
                result.phaseMismatches++;
                continue;
            }
            if (c !== '-')
                result.compared++;
            if (difference)
                result.firstState = { ...here, ...difference };
        }
    }
    return result;
}
async function main() {
    const [sessionPath, statePath] = process.argv.slice(2);
    if (!sessionPath || !statePath || process.argv.length !== 4) {
        process.stderr.write('usage: state-replay.mjs SESSION C_STATE_LOG\n');
        process.exit(2);
    }
    let result;
    try {
        result = await compareSessionState(sessionPath, statePath);
    }
    catch (e) {
        result = { session: basename(sessionPath), compared: 0, phaseMismatches: 0, firstState: null,
            firstRng: null, firstScreen: null, error: errorMessage(e).slice(0, 300) };
    }
    console.log('__STATE_RESULT__');
    console.log(JSON.stringify(result));
    process.exit(0);
}
if (process.argv[1]?.endsWith('state-replay.mjs'))
    await main();
//# sourceMappingURL=state-replay.mjs.map