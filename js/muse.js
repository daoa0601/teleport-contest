// muse.js - items generated for monsters to use.
// C refs: muse.c rnd_offensive_item(), rnd_defensive_item(), rnd_misc_item().

import { game } from './gstate.js';
import { objectIsHardHelmet } from './armor.js';
import { rn2 } from './rng.js';
import { W_ARMH } from './const.js';
import {
    MONSTER_ATTACKS, MONSTER_DIFFICULTY, MONSTER_FLAGS1,
    MONSTER_SYMBOL, monsterIsKop, monsterIsNonliving,
} from './monster_data.js';
import { AT_EXPL } from './monster_attack_types.js';
import {
    AMULET_OF_LIFE_SAVING,
    POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_EXTRA_HEALING,
    POT_FULL_HEALING, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY,
    POT_PARALYSIS, POT_POLYMORPH, POT_SICKNESS, POT_SLEEPING, POT_SPEED,
    SCR_CREATE_MONSTER, SCR_EARTH, SCR_TELEPORTATION,
    WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_FIRE,
    WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_POLYMORPH,
    WAN_SLEEP, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION,
} from './object_data.js';
import { monsterTeleportRestricted } from './teleport_rules.js';

const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const M1_UNSOLID = 0x00100000;
const S_GHOST = 54;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_PESTILENCE = 312;

function rejectsRandomItem(monster) {
    const mndx = monster?.mnum;
    const flags = MONSTER_FLAGS1[mndx] ?? 0;
    const symbol = MONSTER_SYMBOL[mndx];
    return !!(flags & (M1_ANIMAL | M1_MINDLESS))
        || (MONSTER_ATTACKS[mndx] || []).some(attack => attack[0] === AT_EXPL)
        || symbol === S_GHOST || monsterIsKop(mndx);
}

function wornHelmet(monster) {
    const inventory = monster?.minvent || monster?.inventory || [];
    return inventory.find(object =>
        ((object.owornmask ?? 0) & W_ARMH) !== 0
        || object.wornSlot === 'helmet') || null;
}

export function randomOffensiveMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster)) return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty > 7 && !rn2(35)) return WAN_DEATH;

    switch (rn2(9 - Number(difficulty < 4) + 4 * Number(difficulty > 6))) {
    case 0: {
        const flags = MONSTER_FLAGS1[mndx] ?? 0;
        if (objectIsHardHelmet(wornHelmet(monster))
            || (flags & (M1_AMORPHOUS | M1_WALLWALK | M1_UNSOLID))
            || MONSTER_SYMBOL[mndx] === S_GHOST) return SCR_EARTH;
        return WAN_STRIKING;
    }
    case 1:
        return WAN_STRIKING;
    case 2:
        return POT_ACID;
    case 3:
        return POT_CONFUSION;
    case 4:
        return POT_BLINDNESS;
    case 5:
        return POT_SLEEPING;
    case 6:
        return POT_PARALYSIS;
    case 7:
    case 8:
        return WAN_MAGIC_MISSILE;
    case 9:
        return WAN_SLEEP;
    case 10:
        return WAN_FIRE;
    case 11:
        return WAN_COLD;
    default:
        return WAN_LIGHTNING;
    }
}

export function randomDefensiveMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster)) return 0;
    const mndx = monster.mnum;
    const symbol = MONSTER_SYMBOL[mndx];
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    let teleportTries = 0;

    for (;;) {
        switch (rn2(8 + Number(difficulty > 3) + Number(difficulty > 6)
            + Number(difficulty > 8))) {
        case 6:
        case 9:
            if (monsterTeleportRestricted(monster, game)
                && ++teleportTries < 2) continue;
            if (!rn2(3)) return WAN_TELEPORTATION;
            return SCR_TELEPORTATION;
        case 0:
        case 1:
            return SCR_TELEPORTATION;
        case 8:
        case 10:
            if (!rn2(3)) return WAN_CREATE_MONSTER;
            return SCR_CREATE_MONSTER;
        case 2:
            return SCR_CREATE_MONSTER;
        case 3:
            return POT_HEALING;
        case 4:
            return POT_EXTRA_HEALING;
        case 5:
            return mndx === PM_PESTILENCE
                ? POT_SICKNESS : POT_FULL_HEALING;
        case 7:
            if (game.level?.flags?.sokoban_rules && rn2(4)) continue;
            if (symbol === 5 || symbol === 25
                || monster.isshk || monster.isgd || monster.ispriest) return 0;
            return WAN_DIGGING;
        }
    }
}

export function randomMiscMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster)) return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty < 6 && !rn2(30))
        return rn2(6) ? POT_POLYMORPH : WAN_POLYMORPH;

    const vampireShifter = monster.cham === PM_VAMPIRE
        || monster.cham === PM_VAMPIRE_LEADER;
    if (!rn2(40) && !monsterIsNonliving(mndx) && !vampireShifter)
        return AMULET_OF_LIFE_SAVING;

    switch (rn2(3)) {
    case 0:
        if (monster.isgd) return 0;
        return rn2(6) ? POT_SPEED : WAN_SPEED_MONSTER;
    case 1: {
        const seesInvisible = !!(game.u?.seeInvisible
            || game.u?.see_invisible
            || (game.u?.seeInvisibleTurns ?? 0) > 0);
        if (monster.mpeaceful && !seesInvisible) return 0;
        return rn2(6) ? POT_INVISIBILITY : WAN_MAKE_INVISIBLE;
    }
    default:
        return POT_GAIN_LEVEL;
    }
}
