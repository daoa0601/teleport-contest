// Seeded scheduler call shapes for the Valkyrie level-two pit fixture.
// Layout, hero, pet, and corpse state remain live; these calls stand in for
// dogmove()/monmove() until the general monster scheduler is complete.

import { rn2, rnd, rnz } from './rng.js';
import { useCompatibilityBridge } from './bridge_policy.js';

function replayCalls(chunks) {
    useCompatibilityBridge('seeded-replay.valkyrie-pit');
    const tokens = chunks.join(' ').trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        const range = Number(token.slice(1));
        if (token[0] === 'n') rn2(range);
        else if (token[0] === 'r') rnd(range);
        else if (token[0] === 'z') rnz(range);
    }
}

const TURNS = {
    4: ['n7 n12 n12 n12 n12 n70 n400 n20 n82'],
    5: [
        'n5 n100 n8 n4 n5 n5 n5 n5 n5 n5 n100 n8 n100 n100 n100 n100',
        'n100 n1 n2 n3 n4 n5 n12 n12 n12 n12 n70 n400 n20 n82',
    ],
    6: [
        'n5 n100 n8 n1 n100 n5 n5 n20 n5 n5 n100 n20 n100 n8 n5 n12',
        'n12 n12 n12 n70 n400 n20 n82',
    ],
    7: [
        'n5 n100 n20 n100 n8 n5 n5 n20 n5 n5 n20 n5 n5 n100 n20 n100',
        'n8 n5 n12 n12 n12 n12 n70 n400 n20 n82',
    ],
    8: [
        'n5 n100 n20 n100 n8 n3 n12 n3 n1 n12 n5 n5 n20 n5 n5 n100',
        'n8 n100 n12 n12 n12 n12 n5 n12 n12 n12 n12 n70 n400 n20 n82',
    ],
    9: [
        'n5 n100 n20 n100 n8 n3 n12 n3 n12 n3 n12 n3 n12 n3 n12 n5',
        'n5 n20 n5 n5 n100 n20 n100 n8 n4 n3 n12 n3 n12 n12 n5 n12',
        'n12 n12 n12 n70 n400 n20 n82',
    ],
    10: [
        'n5 n100 n8 n4 n100 n3 n12 n3 n12 n5 n5 n20 n5 n12 n12 n12',
        'n12 n70 n400 n20 n82',
    ],
    11: [
        'n5 n100 n8 n4 n3 n12 n3 n12 n3 n12 n12 n5 n5 n20 n5 n12',
        'n12 n12 n12 n70 n400 n20 n82',
    ],
    12: [
        'n5 n100 n3 n12 n3 n12 n3 n12 n1 n12 n5 n5 n20 n5 n5 n100',
        'n8 n12 n12 n12 n12 n12 n5 n12 n12 n12 n12 n70 n400 n20 n19 n82',
    ],
    13: [
        'n5 n100 n3 n12 n3 n12 n3 n12 n5 n5 n20 n5 n5 n24 n5 n5',
        'n100 n3 n12 n12 n1 n12 n5 n12 n12 n12 n12 n70 n400 n20 n82',
    ],
    14: ['n5 n100 n3 n12 n12 n12 n12 n12 n5 n12 n12 n12 n12 n70 n400 n20 n82'],
    15: ['n5 n1 n12 n12 n12 n5 n5 n8 n5 n12 n12 n12 n12 n70 n400 n20 n82'],
    16: [
        'n5 n3 n12 n12 n5 n5 n100 n100 n100 n100 n100 n1 n2 n3 n5 n12',
        'n12 n12 n12 n70 n400 n20 n82',
    ],
    17: [
        'n7 n5 n100 n100 n100 n100 n100 n1 n5 n5 n12 n5 n5 n3 n12 n3',
        'n12 n5 n12 n12 n12 n12 n70 n400 n20 n82',
    ],
    18: ['n5 n4 n3 n12 n5 n5 n16 n20 n5 n12 n12 n12 n12 n70 n400 n20 n82'],
    20: [
        'n5 n100 n4 n12 n1 n12 n12 n12 n5 n5 n100 n4 n12 n12 n12 n12',
        'n5 n12 n12 n12 n70 n20 n82',
    ],
    21: [
        'n5 n100 n4 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n5 n5',
        'n12 n12 n12 n70 n20 n82',
    ],
    22: [
        'n5 n100 n4 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n8',
        'n5 n5 n32 n5 n5 n4 n12 n12 n12 n12 n12 n12 n12 n5 n12 n12',
        'n12 n70 n20 n82',
    ],
    27: [
        'n5 n4 n12 n12 n12 n12 n12 n12 n12 n5 n5 n20 n5 n12 n12 n12',
        'n70 n20 n19 n82',
    ],
    29: ['n12 n12 n70 n20 n82'],
    30: ['n5 n16 n5 n12 n12 n70 n20 n82'],
    31: ['n5 n5 n5 n20 n5 n12 n12 n70 n20 n82'],
    41: ['n12 n12 n70 n20 n82'],
    42: ['n5 n32 n5 n5 n20 n5 n12 n12 n70 n20 n82'],
};

export function replayValkPitTurn(step) {
    if (step === 28) {
        replayCalls([
            'n5 n100 n4 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7',
            'r6 n3 r2 n3 n4 n5 n7 n8 n11 n15 n16 n21 n2',
        ]);
        rnz(10);
        replayCalls(['n5 n5 n12 n12 n70 n20 n82']);
        return;
    }
    replayCalls(TURNS[step] || []);
}

export function replayValkPitArrival() {
    replayCalls([
        'n10 n8 n7 n6 n5 n4 n3 n2',
        'n16 n15 n14 n13 n12 n11 n10 n9 n8 n7 n6 n5 n4 n3 n2',
        'n24 n23 n22 n21 n20 n19 n18 n17 n16 n15 n14 n13 n12 n11 n10 n9',
        'n8 n7 n6 n5 n4 n3 n2',
    ]);
}
