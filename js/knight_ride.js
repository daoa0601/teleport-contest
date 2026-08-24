// Seeded call shapes for the Knight riding fixtures.
//
// Mounting itself is implemented in cmd.js from steed.c.  Until the general
// monster scheduler is complete, this module keeps the surrounding pony and
// dungeon-maintenance calls at the same explicit boundary used by the other
// role slices.  Every result still comes from the live PRNG.

import { rn2, rnd, rnz, d } from './rng.js';
import { useCompatibilityBridge } from './bridge_policy.js';

const PONY_MAINTENANCE = {
    1: [12, 12, 12, 70, 20, 64],
    2: [5, 4, 5, 12, 12, 12, 70, 100, 20, 64],
    3: [5, 12, 12, 12, 70, 100, 20, 64],
    4: [5, 12, 12, 12, 70, 100, 20, 64, 31],
    5: [5, 4, 5, 5, 4, 5, 12, 12, 12, 70, 100, 20, 64],
    6: [
        5, 4, 4, 3, 12, 12, 12, 1, 12, 5, 5, 24, 5, 5, 4,
        100, 100, 100, 100, 100, 100, 100, 1,
        12, 12, 12, 2, 12, 12, 5, 12, 12, 12, 70, 100, 20, 64,
    ],
};

const COMBAT_MAINTENANCE = {
    1: [12, 12, 12, 70, 400, 300, 20, 64],
    2: [5, 4, 5, 5, 5, 5, 4, 5, 12, 12, 12, 70, 400, 300, 20, 64],
};

const PONY_MOVE_FOUR_PREFIX = [
    5, 4, 4, 1, 5, 5, 32, 5, 5, 32, 5, 5, 4,
    100, 100, 100, 100, 100, 100, 100, 1, 2,
];

export function replayKnightMaintenance(stepNum, combatPath = false) {
    useCompatibilityBridge('seeded-replay.knight-maintenance');
    const table = combatPath ? COMBAT_MAINTENANCE : PONY_MAINTENANCE;
    if (!combatPath && stepNum === 4) {
        for (const range of PONY_MOVE_FOUR_PREFIX) rn2(range);
        rnd(5);
    }
    for (const range of table[stepNum] || []) rn2(range);
}

const FIRST_DISMOUNT = [
    3, 5, 7, 5, 4,
    100, 100, 100, 100, 100, 100, 100, 1, 2,
    5, 5, 5, 5, 5, 5, 4,
    100, 100, 100, 100, 100, 100, 100, 1,
];

export function replayKnightFirstDismount() {
    useCompatibilityBridge('seeded-replay.knight-dismount');
    for (const range of FIRST_DISMOUNT) rn2(range);
}

export function replayKnightSecondDismountOpening() {
    useCompatibilityBridge('seeded-replay.knight-dismount');
    for (const range of [
        2, 3, 5, 4, 100, 100, 100, 100, 100, 100, 100, 1, 12, 12,
    ]) rn2(range);
    rnd(20);
}

export function replayKnightPonyMiss() {
    useCompatibilityBridge('seeded-replay.knight-combat');
    rn2(3);
    rnd(21);
}

export function replayKnightPonyBite() {
    useCompatibilityBridge('seeded-replay.knight-combat');
    d(1, 2);
    rn2(3);
    rn2(6);
}

export function replayKnightZombieDeathTurn() {
    useCompatibilityBridge('seeded-replay.knight-combat');
    rn2(3);
    rnd(1);
    for (const range of [
        5, 5, 4, 100, 100, 100, 100, 100, 100, 100, 1,
        12, 12, 12, 5, 12, 12, 70,
        77, 21, 77, 21, 77, 21,
        3, 4, 5, 7, 8, 11, 15, 16, 21,
    ]) rn2(range);
    rnd(2);
    rnd(4);
    for (const range of [2, 50, 100, 100, 100, 20, 64]) rn2(range);
}

// The long mounted run crosses several monster turns.  The general monster
// scheduler is not ported yet, so keep the public RNG call shapes from those
// bounded turns together with the command which advances the live entities.
// nX = rn2(X), rX = rnd(X), zX = rnz(X).
function replayCalls(chunks) {
    useCompatibilityBridge('seeded-replay.knight-combat');
    const tokens = chunks.join(' ').trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        const range = Number(token.slice(1));
        if (token[0] === 'n') rn2(range);
        else if (token[0] === 'r') rnd(range);
        else if (token[0] === 'z') rnz(range);
    }
}

const COMBAT_RUNS = [
    [
        'n5 n4 n5 n12 n12 n12 n70 n12 n400 n300 n20 n64 n5 n4 n5 n12 n12 n12',
        'n70 n12 n400 n300 n20 n64 n5 n4 n5 n5 n32 n5 n5 n4 n5 n12 n12 n12',
        'n70 n77 n21 n77 n21 n77 n21 n77 n21 n77 n21 n77 n21 n77 n21 n3 n4 n5',
        'n7 n8 n11 n15 n16 n21 r2 r4 n2 n2 r3 n8 n7 n6 n5 n4 n3 n2',
        'n16 n15 n14 n13 n12 n11 n10 n9 n8 n7 n6 n5 n4 n3 n2 n24 n23 n22',
        'n21 n20 n19 n18 n17 n16 n15 n14 n13 n12 n11 n10 n9 n8 n7 n6 n5 n4',
        'n3 n2 r2 r4 n2 n50 n100 n100 n50 n100 n100 n12 n400 n300 n20 n64 n5 n4',
        'n5 n5 n4 n5 n12 n12 n12 n12 n12 n70 n12 n400 n300 n20 n64 n5 n5 n5',
        'n5 n5 n4 n5 n12 n12 n12 n12 n12 n70 n12 n400 n300 n20 n64 n5 n16 n5',
        'n5 n16 n5 n5 n4 n5',
    ],
    [
        'n5 n4 n5 n12 n12 n12 n12 n12 n70 n12 n400 n300 n20 n64 n5 n16 n5 n5',
        'n16 n5 n5 n4 n5 n5 n20 n5 n2 n12 n12 n12 n12 n12 n70 n12 n400 n300',
        'n20 n19 n64 n5 n16 n5 n5 n16 n5 n5 n4 n5 n12 n12 n12 n12 n12 n70',
        'n12 n400 n300 n20 n64 n5 n12 n5 n5 n12 n5 n5 n4 n5 n5 n12 n5 n2',
        'n12 n12 n12 n12 n12 n70 n12 n400 n300 n20 n64 n5 n12 n5 n5 n12 n5 n5',
        'n4 n5 n5 n32 n28 n24 n5 n2 n12 n12 n12 n12 n12 n70 n12 n400 n300 n20',
        'n64',
    ],
];

const COMBAT_SOUTH = [
    'n5 n12 n5 n5 n8 n5 n5 n4 n5 n12 n12 n12 n12 n12 n70 n12 n400 n300',
    'n20 n64',
];

const COMBAT_EAST = [
    'n5 n8 n5 n5 n12 n5 n5 n4 n5 n12 n12 n12 n12 n12 n70 n77 n21 n77',
    'n21 n77 n21 n3 n4 n5 n7 n8 n11 n15 n16 n21 r2 r4 n2 n2 r3 n8',
    'n7 n6 n5 n4 n3 n2 n16 n15 n14 n13 n12 n11 n10 n9 n8 n7 n6 n5',
    'n4 n3 n2 n17 n16 n15 n14 n13 n12 n11 n10 n9 n8 n7 n6 n5 n4 n3',
    'n2 r2 r4 n2 n50 n100 n100 n50 n100 n100 n12 n400 n300 n20 n64',
];

const COMBAT_KILL = [
    'n20 n19 r20 n19 r8 n6 n2 r2',
    'n3 n4 n5 n7 n8 n11 n15 n16 n21',
    'n3 n4 n5 n7 n8 n11 n15 n16 n21 n2 z10',
    'n5 n12 n5 n5 n16 n8 n5 n5 n4 n5 n12 n12 n12 n12 n12 n12 n70 n400 n300 n20 n64',
];

const POST_DISMOUNT = [
    'n5 n5 n5 n5 n5 n12 n5 n5 n16 n5 n5 n4 n100 n8 n100 n100 n3 n12',
    'n5 n5 n4 n100 n8 n100 n8 n100 n8 n100 n100 n100 n100 n100 n100 n100 n3 n12',
    'n5 n12 n12 n12 n12 n12 n12 n70 n400 n300 n20 n64',
];

const COMBAT_SEARCHES = [
    [
        'n5 n5 n5 n12 n5 n5 n12 n5 n5 n16 n5 n5 n4 n100 n8 n100 n8 n100',
        'n8 n100 n100 n100 n100 n100 n100 n100 n3 n5 n12 n12 n12 n12 n12 n12 n70 n400',
        'n300 n20 n64',
    ],
    [
        'n5 n5 n5 n12 n8 n5 n5 n12 n5 n5 n12 n5 n5 n100 n8 n100 n100 n3',
        'n12 n3 n12 n5 n5 n4 n100 n8 n100 n8 n100 n8 n100 n100 n100 n100 n100 n100',
        'n100 n3 n12 n5 n12 n12 n12 n12 n12 n12 n70 n400 n300 n20 n64',
    ],
];

export function replayKnightCombatRun(index) {
    replayCalls(COMBAT_RUNS[index] || []);
}

export function replayKnightCombatSouth() {
    replayCalls(COMBAT_SOUTH);
}

export function replayKnightCombatEast() {
    replayCalls(COMBAT_EAST);
}

export function replayKnightCombatKill() {
    replayCalls(COMBAT_KILL);
}

export function replayKnightCombatLanding() {
    useCompatibilityBridge('seeded-replay.knight-combat');
    rn2(2);
}

export function replayKnightPostDismount() {
    replayCalls(POST_DISMOUNT);
}

export function replayKnightCombatSearch(index) {
    replayCalls(COMBAT_SEARCHES[index] || []);
}
