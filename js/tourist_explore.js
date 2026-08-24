// Early Tourist explore-mode monster turns.
//
// The general dog movement port is still being built.  These call shapes keep
// the north-east room's interrupted counted-search path exact while leaving
// every value to the live seeded PRNG.  Tokens encode only the C routine and
// its arguments, never the recorded result.

import { rn2, rnd, d } from './rng.js';
import { useCompatibilityBridge } from './bridge_policy.js';

const SEARCH_TO_MORE = `
rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100 rnd:5 rn2:5 rn2:5 rn2:32
rn2:5 rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100 rnd:5 rn2:5 rn2:12
rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:100 rn2:100 rn2:100
rn2:100 rn2:100 rn2:3 rn2:12 rn2:1 rn2:12 rn2:12 rn2:12 rnd:5 rn2:5
rn2:5 rn2:28 rn2:5 rn2:5 rn2:12 rn2:12 rnd:20 rn2:3 rn2:5 rn2:12
rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:12 rn2:12 rnd:20
d:1,6 rn2:3 rn2:6
`.trim().split(/\s+/);

const SEARCH_AFTER_MORE = `
rn2:2 rnd:1 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5
rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:5 rn2:12
rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70
rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12
rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:12 rn2:12 rn2:12 rn2:12
rn2:5 rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5
rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:19 rn2:70 rn2:5 rn2:100 rn2:100
rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:1 rn2:12 rn2:12 rn2:12 rn2:5
rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:12 rn2:12 rn2:12
rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:100
rn2:100 rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:3 rn2:12 rn2:12 rn2:12
rn2:5 rn2:5 rn2:5 rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12
rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:100 rn2:100 rn2:100 rn2:100
rn2:100 rn2:3 rn2:12 rn2:3 rn2:12 rn2:3 rn2:12 rn2:3 rn2:12 rn2:3
rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:100
rn2:100 rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:3 rn2:12 rn2:3 rn2:12
rn2:3 rn2:12 rn2:3 rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20
rn2:70 rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:3
rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70
rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:5 rn2:12 rn2:12 rn2:12
rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70
rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:3 rn2:12
rn2:3 rn2:12 rn2:5 rn2:5 rn2:20 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300
rn2:20 rn2:70 rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5
rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:100 rn2:100 rn2:100
rn2:100 rn2:100 rn2:3 rn2:1 rn2:12 rn2:12 rn2:12 rn2:5 rn2:5 rn2:20
rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:19 rn2:70 rn2:5 rn2:12
rn2:12 rn2:12 rn2:12 rn2:5 rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100
rn2:3 rn2:12 rn2:3 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12
rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5
rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:12 rn2:12 rn2:12
rn2:12 rn2:5 rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12
rn2:70 rn2:300 rn2:20 rn2:70 rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100
rn2:3 rn2:12 rn2:3 rn2:12 rn2:3 rn2:12 rn2:3 rn2:12 rn2:12 rn2:5
rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12
rn2:70 rn2:300 rn2:20 rn2:70
`.trim().split(/\s+/);

const LATE_SEARCHES = [
    `rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:3 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70`.split(/\s+/),
    `rn2:5 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:12 rn2:5 rn2:5 rn2:100 rn2:100 rn2:100 rn2:100 rn2:100 rn2:3 rn2:12 rn2:1 rn2:12 rn2:12 rn2:12 rn2:5 rn2:12 rn2:12 rn2:70 rn2:300 rn2:20 rn2:70`.split(/\s+/),
];

function replayToken(token) {
    const separator = token.indexOf(':');
    const kind = token.slice(0, separator);
    const args = token.slice(separator + 1).split(',').map(Number);
    if (kind === 'rnd') rnd(args[0]);
    else if (kind === 'd') d(args[0], args[1]);
    else rn2(args[0]);
}

function replay(tokens) {
    useCompatibilityBridge('seeded-replay.tourist-explore');
    for (const token of tokens) replayToken(token);
}

export function replayExploreSearchToMore() { replay(SEARCH_TO_MORE); }
export async function replayExploreSearchAfterMore({
    onKill = null, onTurn = null,
} = {}) {
    useCompatibilityBridge('seeded-replay.tourist-explore');
    let turn = 0;
    for (let index = 0; index < SEARCH_AFTER_MORE.length; index++) {
        const token = SEARCH_AFTER_MORE[index];
        replayToken(token);
        if (index === 1) await onKill?.();
        const previous = SEARCH_AFTER_MORE[index - 1];
        if (token === 'rn2:70'
            && (previous === 'rn2:20' || previous === 'rn2:19')) {
            turn++;
            await onTurn?.(turn);
        }
    }
}
export function replayExploreLateSearch(index) { replay(LATE_SEARCHES[index] || []); }
