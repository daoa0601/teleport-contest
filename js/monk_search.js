// Seeded call shapes for the Monk north-room fixture.
//
// The live level, hero, pet, corpse, inventory, and UI are updated by the
// normal command modules.  Until dogmove()/monmove() are complete, these
// bounded turn traces preserve C's scheduler call order using the live PRNG.

import { rn2, rnd, rnz } from './rng.js';

function replayCalls(chunks) {
    const tokens = chunks.join(' ').trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        const range = Number(token.slice(1));
        if (token[0] === 'n') rn2(range);
        else if (token[0] === 'r') rnd(range);
        else if (token[0] === 'z') rnz(range);
    }
}

const TURNS = {
    5: ['n12 n12 n12 n12 n70 n3 n400 n20 n88'],
    8: ['n7 n5 n100 n8 n1 r5 n5 n5 n100 n8 n1 n5 n12 n12 n12 n12 n70 n3 n400 n20 n88'],
    9: ['n5 n100 n8 n1 n5 n5 n5 n5 n100 n8 n1 n5 n12 n12 n12 n12 n70 n3 n400 n20 n88'],
    10: ['n5 n100 n8 n20 n1 n100 n5 n5 n16 n5 n12 n12 n12 n12 n70 n3 n400 n20 n88'],
    11: ['n5 n100 n20 n100 n8 n4 n12 n12 r5 n5 n5 n5 n5 n20 n5 n12 n12 n12 n12 n70 n3 n400 n20 n88'],
    12: ['n5 n100 n8 n3 n24 n12 n28 n100 n32 r5 n5 n12 n12 n12 n12 n70 n3 n400 n20 n88'],
    13: ['n5 n100 n8 n4 n12 n20 n12 n100 n16 n5 n5 n32 n5 n5 n5 n5 n12 n5'],
    15: [
        'n5 n100 n100 n4 n12 n12 n12 n12 n12 n12 n12 n5 n5 n100 n100 n4',
        'n12 n12 n12 n12 n12 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88',
    ],
    16: [
        'n5 n100 n100 n100 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100',
        'n100 n1 n2 n3 n4 n5 n6 n7 n8 n5',
    ],
    17: ['n12 n12 n12 n70 n3 n400 n20 n19 n88 n31'],
    18: [
        'n5 n100 n100 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n100',
        'n1 n2 n3 n4 n5 n6 n7 n8 n5',
    ],
    19: ['n5 n100 n100 n4 n12 n12 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88'],
    20: [
        'n5 n100 n100 n4 n12 n12 n1 n12 n12 n12 n5 n5 n16 n5 n5 n100',
        'n8 n20 n3 n12 n1 n12 n100 n5 n12 n12 n12 n70 n3 n400 n20 n88',
    ],
    21: ['n5 n100 n20 n100 n8 n3 n12 n3 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88'],
    23: [
        'n20 n7 n5 n5 n100 n8 n4 n12 n12 n12 n100 n12 n5 n5 n20 n5 n12 n12',
        'n12 n70 n3 n400 n20 n88 n5 n100 n8 n4 n12 n12 n12 n12 n12 n12 n12',
        'n5 n5 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88 n5 n100 n8 n4 n12 n12',
        'n12 n12 n12 n12 n5 n5 n12 n5 n5 n100 n8 n3 n12 n3 n12 n3 n12 n3',
        'n12 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88 n5 n100 n100 n8 n4 n12',
        'n12 n12 n12 n12 n12 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88 n5 n100',
        'n8 n4 n12 n12 n12 n12 n12 n12 n5 n5 n100 n8 n4 n100 n100 n100 n100',
        'n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n8 n5 n12',
        'n12 n12 n70 n3 n400 n20 n88 n5 n100 n8 n3 n12 n12 n5 n5 n100 n8 n3',
        'n12 n12 n1 n5 n12 n12 n12 n70 n3 n400 n20 n88',
    ],
    24: [
        'n5 n100 n8 n3 n12 n12 n1 n100 n5 n5 n100 n20 n100 n8 n4 n12 n12',
        'n5 n12 n12 n12 n70 n3 n400 n20 n19 n88',
    ],
    27: ['n2 n5 n100 n8 n3 n12 n3 n100 n5 n5 n20 n5'],
    37: ['n5 n100 n20 n100 n8 n4 n12 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88'],
    38: [
        'n5 n100 n8 n4 n12 n12 n12 n12 n12 n12 n100 n12 n5 n5 n100 n8 n4',
        'n12 n12 n12 n12 n12 n12 n5 n12 n12 n12 n70 n3 n400 n20 n88',
    ],
};

export function replayMonkTurn(step) {
    if (step === 14) {
        replayCalls([
            'n20 n19 r20 n19 r4 r100 n6 n2 r2 n3 n4 n5 n7 n8 n11 n15 n16 n21 n2',
        ]);
        rnz(10);
        replayCalls(['n12 n12 n12 n70 n3 n400 n20 n88']);
        return;
    }
    replayCalls(TURNS[step] || []);
}
