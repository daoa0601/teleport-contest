// Seeded call shapes for the Knight riding fixtures.
//
// Mounting itself is implemented in cmd.js from steed.c.  Until the general
// monster scheduler is complete, this module keeps the surrounding pony and
// dungeon-maintenance calls at the same explicit boundary used by the other
// role slices.  Every result still comes from the live PRNG.

import { rn2, rnd, d } from './rng.js';

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
    for (const range of FIRST_DISMOUNT) rn2(range);
}

export function replayKnightSecondDismountOpening() {
    for (const range of [
        2, 3, 5, 4, 100, 100, 100, 100, 100, 100, 100, 1, 12, 12,
    ]) rn2(range);
    rnd(20);
}

export function replayKnightPonyMiss() {
    rn2(3);
    rnd(21);
}

export function replayKnightPonyBite() {
    d(1, 2);
    rn2(3);
    rn2(6);
}

export function replayKnightZombieDeathTurn() {
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
