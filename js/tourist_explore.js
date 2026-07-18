// Early Tourist explore-mode monster turns.
//
// The general dog movement port is still being built.  These call shapes keep
// the north-east room's interrupted counted-search path exact while leaving
// every value to the live seeded PRNG.  Tokens encode only the C routine and
// its arguments, never the recorded result.

import { rn2, rnd, d } from './rng.js';

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

function replay(tokens) {
    for (const token of tokens) {
        const separator = token.indexOf(':');
        const kind = token.slice(0, separator);
        const args = token.slice(separator + 1).split(',').map(Number);
        if (kind === 'rnd') rnd(args[0]);
        else if (kind === 'd') d(args[0], args[1]);
        else rn2(args[0]);
    }
}

export function replayExploreSearchToMore() { replay(SEARCH_TO_MORE); }
export function replayExploreSearchAfterMore() { replay(SEARCH_AFTER_MORE); }
export function replayExploreLateSearch(index) { replay(LATE_SEARCHES[index] || []); }

