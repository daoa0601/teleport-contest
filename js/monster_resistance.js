// Monster resistance checks shared by attacks and item effects.
// C refs: zap.c resist() and mondata.c Resists_Elem().

import {
    W_ARM, W_WEP,
} from './const.js';
import { ARTIFACT_DATA } from './artifact_data.js';
import {
    MONSTER_FLAGS2, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_RESISTS,
    monsterIsVampireShifter,
} from './monster_data.js';
import {
    BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES,
} from './object_data.js';
import { rn2 } from './rng.js';

const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_DISINTEGRATION = 0x08;
const MR_ELECTRIC = 0x10;
const MR_ACID = 0x40;
const MR_POISON = 0x20;
const MR_STONE = 0x80;
const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_DEMON = 0x00000100;
const PM_DEATH = 311;
const PM_BLACK_DRAGON = MONSTER_NAME.indexOf('black dragon');
const ARTIFACT_BY_ID = new Map(
    ARTIFACT_DATA.map(artifact => [artifact.id, artifact]),
);
function artifactForObject(object) {
    return ARTIFACT_BY_ID.get(object?.oartifact) || null;
}

function monsterInventory(monster) {
    return monster?.minvent || monster?.inventory || [];
}

function monsterWeapon(monster) {
    return monster?.mw || monsterInventory(monster).find(object =>
        object?.wielded || ((object?.owornmask ?? 0) & W_WEP));
}

function monsterWearsOneOf(monster, objectTypes, mask) {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        objectTypes.includes(object?.otyp)
        && !!((object?.owornmask ?? 0) & mask));
}

export function monsterResistanceBits(monster) {
    return (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
}

export function monsterHasFireResistance(monster) {
    if ((monsterResistanceBits(monster) & MR_FIRE)
        || monster?.fireResistance
        || monster?.fire_resistance
        || monster?.defendedFire) return true;
    if (artifactForObject(monsterWeapon(monster))?.defense === 'fire')
        return true;

    return monsterInventory(monster).some(object =>
        artifactForObject(object)?.carriedDefense === 'fire');
}

export function monsterHasColdResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_COLD)
        || !!monster?.coldResistance
        || !!monster?.cold_resistance
        || !!monster?.defendedCold;
}

export function monsterHasShockResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_ELECTRIC)
        || !!monster?.shockResistance
        || !!monster?.shock_resistance
        || !!monster?.defendedShock;
}

export function monsterHasDisintegrationResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_DISINTEGRATION)
        || !!monster.defendedDisintegration
        || monsterWearsOneOf(monster,
            [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES], W_ARM);
}

export function monsterHasDrainResistance(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return !!(flags & (M2_UNDEAD | M2_WERE | M2_DEMON))
        || monster?.mnum === PM_DEATH
        || monsterIsVampireShifter(monster)
        || monster?.mnum === PM_BLACK_DRAGON
        || monsterWearsOneOf(monster, [
            BLACK_DRAGON_SCALE_MAIL,
            BLACK_DRAGON_SCALES,
        ], W_ARM)
        || !!monster?.drainResistance
        || !!monster?.drain_resistance;
}

export function monsterHasAcidResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_ACID)
        || !!monster?.acidResistance || !!monster?.acid_resistance;
}

export function monsterHasPoisonResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_POISON)
        || !!monster?.poisonResistance
        || !!monster?.poison_resistance;
}

export function monsterHasStoneResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_STONE)
        || !!monster?.stoneResistance
        || !!monster?.stone_resistance;
}

export function monsterResistsEffect(
    monster, attackLevel, random = rn2,
) {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50) defenseLevel = 50;
    else if (defenseLevel < 1) defenseLevel = 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}
