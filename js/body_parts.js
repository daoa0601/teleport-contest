// body_parts.js — Current-form anatomy projections used by source messages.
// C ref: polyself.c mbodypart().  Keep each exported body part tied to the
// corresponding source table rather than deriving one part from another.

import { game } from './gstate.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SYMBOL, SPECIAL_PM,
} from './monster_data.js';
import { AT_CLAW } from './monster_attack_types.js';

const M1_HUMANOID = 0x00020000;
const M1_SLITHY = 0x00080000;

const S_BLOB = 2;
const S_COCKATRICE = 3;
const S_DOG = 4;
const S_EYE = 5;
const S_FELINE = 6;
const S_JELLY = 10;
const S_RODENT = 18;
const S_SPIDER = 19;
const S_UNICORN = 21;
const S_VORTEX = 22;
const S_WORM = 23;
const S_LIGHT = 25;
const S_CENTAUR = 29;
const S_ELEMENTAL = 31;
const S_FUNGUS = 32;
const S_PUDDING = 42;
const S_YETI = 51;
const S_EEL = 57;

const PM_ROTHE = 81;
const PM_KI_RIN = 124;
const PM_RAVEN = 128;
const PM_OWLBEAR = 235;
const PM_HUMAN = 260;
const PM_JELLYFISH = 316;
const PM_KRAKEN = 321;
const PM_STONE_GOLEM = 257;
const PM_AMOROUS_DEMON = 290;
const HUMANOIDS_WITH_HANDS = new Set([
    53, // human
    39, // mummy
    52, // zombie
    27, // angel
    14, // nymph
    12, // leprechaun
    43, // quantum mechanic
    48, // vampire
    15, // orc
    34, // giant
]);

function humanoidHasClaws(mnum) {
    return (MONSTER_ATTACKS[mnum] || []).some(
        ([attackType]) => attackType === AT_CLAW,
    ) && !HUMANOIDS_WITH_HANDS.has(MONSTER_SYMBOL[mnum])
        && mnum !== PM_STONE_GOLEM
        && mnum !== PM_AMOROUS_DEMON;
}

export function monsterArmName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const flags = MONSTER_FLAGS1[mnum] ?? 0;

    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR) return 'foreleg';
    if (symbol === S_YETI) return 'arm';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN) return 'tentacle';
    if (flags & M1_HUMANOID) return 'arm';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN) return 'wing';
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN || mnum === PM_ROTHE) return 'foreleg';
    if (symbol === S_LIGHT) return 'ray';
    if (symbol === S_EEL) return 'fin';
    if (symbol === S_WORM) return 'anterior segment';
    if (symbol === S_SPIDER) return 'pedipalp';
    if (flags & M1_SLITHY) return 'vestigial limb';
    if (symbol === S_EYE) return 'appendage';
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'pseudopod';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL) return 'region';
    if (symbol === S_FUNGUS) return 'mycelium';
    return 'forelimb';
}

export function monsterFootName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const flags = MONSTER_FLAGS1[mnum] ?? 0;

    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR) return 'rear paw';
    if (symbol === S_YETI) return 'foot';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN) return 'tentacle';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN) return 'foot';
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN || mnum === PM_ROTHE) return 'rear hoof';
    if (symbol === S_LIGHT) return 'beam';
    if (symbol === S_EEL) return 'anal fin';
    if (symbol === S_WORM) return 'posterior segment';
    if (symbol === S_SPIDER) return 'claw';
    if (flags & M1_SLITHY) return 'rear region';
    if (symbol === S_EYE) return 'lower appendage';
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'pseudopod root';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'lower current';
    if (symbol === S_FUNGUS) return 'root';
    if (flags & M1_HUMANOID) return 'foot';
    return 'rear claw';
}

export function monsterHandName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const flags = MONSTER_FLAGS1[mnum] ?? 0;

    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR) return 'paw';
    if (symbol === S_YETI) return 'hand';
    if ((flags & M1_HUMANOID) && humanoidHasClaws(mnum)) return 'claw';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN) return 'tentacle';
    if (flags & M1_HUMANOID) return 'hand';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN) return 'wing';
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN || mnum === PM_ROTHE) return 'forehoof';
    if (symbol === S_LIGHT) return 'ray';
    if (symbol === S_EEL) return 'pectoral fin';
    if (symbol === S_WORM) return 'segment';
    if (symbol === S_SPIDER) return 'pedipalp';
    if (flags & M1_SLITHY) return 'scale gap';
    if (symbol === S_EYE) return 'tentacle';
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'grasp';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL) return 'swirl';
    if (symbol === S_FUNGUS) return 'strand';
    return 'foreclaw';
}

export function monsterHeadName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'cerebral area';
    if (symbol === S_EYE || symbol === S_LIGHT) return 'body';
    if (symbol === S_FUNGUS) return 'cap area';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'central core';
    if (symbol === S_WORM) return 'anterior segment';
    if (symbol === S_SPIDER) return 'cephalothorax';
    return 'head';
}

function currentHeroMonsterNumber(state) {
    if (Number.isInteger(state.u?.umonnum)) return state.u.umonnum;
    if (Number.isInteger(state.u?.umonster)) return state.u.umonster;
    if (Number.isInteger(state.urole?.mnum))
        return SPECIAL_PM + 1 + state.urole.mnum;
    return PM_HUMAN;
}

export function heroArmName(state = game) {
    return monsterArmName(currentHeroMonsterNumber(state));
}

export function heroFootName(state = game) {
    return monsterFootName(currentHeroMonsterNumber(state));
}

export function heroHandName(state = game) {
    return monsterHandName(currentHeroMonsterNumber(state));
}

export function heroHeadName(state = game) {
    return monsterHeadName(currentHeroMonsterNumber(state));
}
