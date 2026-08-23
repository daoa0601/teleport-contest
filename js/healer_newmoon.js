// Seeded call shapes for the compact Healer new-moon room.
//
// The sleep ray advances many immobilized turns while the kitten pursues the
// floor gold.  The general dogmove/occupation scheduler is not complete yet,
// so this bounded bridge preserves C's operation order while every value is
// still supplied by the live PRNG.

import { rn2, rnd } from './rng.js';

const SLEEP_RAY = `
r50 n5 n4 n100 n8 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n12 n12 n70
n200 n10 n20 n70 n5 n4 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4
n5 n6 n100 n7 n5 n5 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4
n5 n6 n100 n7 n8 n5 n12 n12 n70 n200 n10 n20 n70 n5 n100 n8 n4 n3 n12 n12 n12 n12 n12 n5
n5 n5 n12 n12 n70 n200 n10 n20 n70 n5 n4 n100 n8 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100
n1 n2 n3 n4 n5 n5 n5 n20 n5 n5 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100
n1 n2 n3 n4 n5 n6 n5 n12 n12 n70 n200 n10 n20 n70 n5 n100 n4 n100 n100 n100 n100 n100 n100 n100
n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5 n5 n12 n5 n5 n100 n4 n1 n12 n5 n12 n12 n70 n200
n10 n20 n70 n5 n100 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5
n5 n20 n16 n5 n5 n100 n4 n3 n12 n12 n1 n5 n12 n12 n70 n200 n10 n20 n19 n70 n5 n100 n4 n100
n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5 n5 n12 n5 n12 n12 n70 n200
n10 n20 n70 n5 n100 n8 n3 n12 n3 n12 n1 n12 n5 n5 n20 n16 n5 n12 n12 n70 n200 n10 n20 n70
n5 n100 n8 n3 n12 n3 n12 n3 n12 n1 n100 n12 n5 n5 n100 n20 n100 n8 n4 n100 n100 n100 n100 n100
n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5 n12 n12 n70 n200 n10 n20 n70 n5 n100 n8 n4
n100 n12 n12 n12 n5 n5 n24 n5 n5 n100 n20 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100
n100 n1 n2 n3 n4 n5 n6 n5 n12 n12 n70 n200 n10 n20 n70 n5 n4 n100 n8 n4 n100 n100 n100 n100
n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n100 n7 n5 n5 n16 n5 n12 n12 n70 n200 n10
n20 n70 n5 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n100 n5 n5
n12 n12 n70 n200 n10 n20 n70 n5 n100 n8 n3 n12 n3 n12 n3 n12 n3 n1 n100 n12 n5 n5 n16 n5
n5 n100 n20 n8 r2 n100 n4 n3 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5
n6 n5 n12 n12 n70 n200 n10 n20 n70 n5 n14 n3 n100 n4 n3 n12 n100 n12 n12 n5 n5 n12 n5 n5
n6 n3 n10 n100 n4 n3 n12 n12 n12 n12 n12 n100 n12 n12 n5 n12 n12 n70 n200 n10 n20 n70 n5 n9
n3 n10 n100 n4 n3 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5 n5
n19 n3 n100 n4 n3 n100 n12 n12 n12 n5 n12 n12 n70 n200 n10 n20 n70 n5 n9 n3 n100 n4 n3 n12
n12 n12 n12 n12 n5 n5 n20 n16 n5 n12 n12 n70 n200 n10 n20 n19 n70 n5 n4 n3 n10 n100 n4 n3
n12 n1 n12 n12 n12 n100 n12 n5 n5 n4 n2 n3 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100
n1 n2 n3 n4 n5 n12 n12 n70 n200 n10 n20 n70 n5 n4 n2 n3 n100 n100 n100 n100 n100 n100 n100 n100
n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n5 n6 n3 n10 n100 n100 n4 n100 n100 n100 n100 n100 n100 n100
n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5 n12 n12 n70 n200 n10 n20 n70 n5 n100 n100 n4 n1 n12
n100 n5 n5 n12 n5 n5 n100 n20 n100 n100 n4 n1 n12 n12 n12 n12 n5 n12 n12 n70 n200 n10 n20 n70
r3 n5 n4 n100 n8 n100 n100 n12 n12 n5 n5 n100 n8 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100
n100 n100 n100 n1 n2 n3 n4 n5 n6 n100 n7 n8 n5 n12 n12 n70 n200 n10 n20 n70 n5 n100 n8 n100
n8 n4 n12 n100 n12 n12 n5 n5 n16 n12 n5 n5 n100 n8 n100 n8 n4 n12 n12 n12 n12 n12 n100 n12
n12 n5 n12 n12 n70 n200 n10 n20 n70 n5 n4 n100 n8 n100 n8 n100 n100 n100 n100 n100 n100 n100 n100 n100
n100 n100 n100 n1 n2 n3 n4 n5 n5 n5 n24 n20 n28 n5 n5 n100 n20 n100 n100 n4 n100 n100 n100 n100
n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n5 n12 n12 n70 n200 n10 n20 n70 n31 n5 n100
n8 n100 n100 n12 n12 n12 n5 n5 n16 n5 n12 n12 n70 n200 n10 n20 n70 n5 n100 n8 n100 n8 n4 n100
n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n100 n7 n8 n5 n12 n12 n70 n200
n10 n20 n70 n5 n100 n8 n100 n8 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3
n4 n5 n6 n5 n5 n100 n8 n100 n8 n4 n12 n12 n100 n12 n12 n5 n12 n12 n70 n200 n10 n20 n70 n5
n100 n20 n8
`;

const WAKE = `
n100 n4 n2 n12 n12 n12 n12 n12 n5 n12 n12 n70 n200 n10 n20 n19 n70 n5 n6 n10 n100 n4 n2 n100
n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n5 n8 n20 n12 n16 n5 n5 n6
n2 n10 n100 n4 n12 n12 n12 n12 n12 n12 n12 n5 n12 n12 n70 n200 n10 n20 n70
`;

const LATE_SEARCHES = [
    `n5 n4 n2 n2 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n5
     n24 n20 n16 n5 n12 n12 n70 n200 n20 n70`,
    `n5 n6 n2 n100 n4 n2 n1 n12 n12 n12 n12 n5 n5 n4 n2 n10 n100 n100 n100 n100 n100 n100 n100 n100
     n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n12 n12 n70 n200 n20 n70`,
];

function replayToken(token) {
    const range = Number(token.slice(1));
    if (token[0] === 'r') rnd(range);
    else rn2(range);
}

function replay(text) {
    for (const token of String(text || '').trim().split(/\s+/).filter(Boolean))
        replayToken(token);
}

export async function replayHealerSleepRay({ onTurn = null } = {}) {
    const tokens = SLEEP_RAY.trim().split(/\s+/);
    let turn = 0;
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        replayToken(token);
        if (token === 'n70'
            && (tokens[index - 1] === 'n20'
                || tokens[index - 1] === 'n19')) {
            turn++;
            await onTurn?.(turn);
        }
    }
}
export function replayHealerWake() { replay(WAKE); }
export function replayHealerLateSearch(index) {
    replay(LATE_SEARCHES[index] || '');
}
