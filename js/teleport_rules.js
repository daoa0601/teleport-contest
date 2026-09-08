// teleport_rules.js - teleport restrictions and legal destinations.
// C refs: teleport.c noteleport_level(), goodpos(), goodpos_onscary().

import { game } from './gstate.js';
import { collectNearbyCoords } from './u_init.js';
import { rn2 } from './rng.js';
import {
    ALTAR, D_CLOSED, D_LOCKED, DOOR, IS_LAVA, IS_POOL,
    WATER, W_NONPASSWALL, isok,
} from './const.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_SYMBOL, monsterIsCovetous,
} from './monster_data.js';
import { BOULDER, SCR_SCARE_MONSTER } from './object_data.js';
import { engravingAt } from './engrave.js';

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_NOEYES = 0x00001000;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_ROCKTHROW = 0x08000000;
const G_UNIQ = 0x1000;
const S_ANGEL = 27;
const S_DEMON = 56;
const S_EEL = 57;
const S_HUMAN = 53;
const S_VAMPIRE = 48;
const PM_FLOATING_EYE = 28;
const PM_FIRE_ELEMENTAL = 155;
const PM_MINOTAUR = 177;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const PM_SALAMANDER = 329;

function monsterIsDemonRuler(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return MONSTER_SYMBOL[monster?.mnum] === S_DEMON
        && !!(flags & (M2_LORD | M2_PRINCE));
}

function demonCourtBlocksTeleport(monster, state) {
    const inHell = !!state?.dungeons?.[state?.u?.uz?.dnum ?? -1]
        ?.flags?.hellish;
    if (!inHell || monsterIsDemonRuler(monster)) return false;
    return state?.level?.monsters?.some(candidate =>
        candidate !== monster && (candidate.mhp ?? 1) > 0
        && monsterIsDemonRuler(candidate)) ?? false;
}

export function monsterTeleportRestricted(monster, state = game) {
    if (demonCourtBlocksTeleport(monster, state)) return true;
    if (state?.level?.flags?.noteleport && !monsterIsCovetous(monster))
        return true;
    const stasisUntil = state?.level?.flags?.stasis_until;
    return Number.isFinite(stasisUntil)
        && stasisUntil >= (state?.moves ?? 1);
}

export function heroTeleportRestricted(state = game) {
    const currentForm = state?.u?.mtimedone
        ? state.u.umonnum : state?.u?.umonster;
    return monsterTeleportRestricted({ mnum: currentForm }, state);
}

function monsterAt(state, x, y) {
    return state.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0
        && ((monster.mx === x && monster.my === y)
            || monster.wormSegments?.some(segment =>
                segment.x === x && segment.y === y)));
}

export function monsterGoodPosition(
    mndx, x, y, avoidMonsterGenerationExclusions = false,
    checkScary = false, ignoreWater = false, state = game,
) {
    const location = state.level?.at?.(x, y);
    if (!location || !isok(x, y)) return false;
    if (state.u?.ux === x && state.u?.uy === y) return false;
    if (monsterAt(state, x, y)) return false;

    const flags1 = mndx == null ? 0 : MONSTER_FLAGS1[mndx] ?? 0;
    const flags2 = mndx == null ? 0 : MONSTER_FLAGS2[mndx] ?? 0;
    const symbol = mndx == null ? 0 : MONSTER_SYMBOL[mndx] ?? 0;
    if (mndx != null) {
        const inAir = !!(flags1 & M1_FLY) || symbol === 5 || symbol === 25;
        const swimmer = !!(flags1 & M1_SWIM);

        if (IS_POOL(location.typ) && !ignoreWater) {
            const waterWall = location.typ === WATER;
            return swimmer || (!state.level?.flags?.waterlevel
                && !waterWall && inAir);
        } else if (symbol === S_EEL && rn2(13) && !ignoreWater) {
            return false;
        } else if (IS_LAVA(location.typ)) {
            if (mndx === PM_FLOATING_EYE) return false;
            return inAir || mndx === PM_FIRE_ELEMENTAL
                || mndx === PM_SALAMANDER;
        }

        if ((flags1 & M1_WALLWALK)
            && !(location.wall_info & W_NONPASSWALL)) return true;
        if ((flags1 & M1_AMORPHOUS) && location.typ === DOOR
            && (location.doormask & (D_CLOSED | D_LOCKED))) return true;
        if (checkScary && monsterTypeScaredFromPosition(mndx, x, y, state))
            return false;
    }

    if (location.typ === DOOR
        && (location.doormask & (D_CLOSED | D_LOCKED))) return false;
    if (location.typ < DOOR && !(ignoreWater && IS_POOL(location.typ)))
        return false;
    const hasBoulder = state.level?.objects?.[x]?.[y]?.some(
        object => object.otyp === BOULDER,
    );
    if (hasBoulder && !(flags2 & M2_ROCKTHROW)) return false;
    if (avoidMonsterGenerationExclusions
        && state.level?.exclusionZones?.some(zone =>
            zone.type === 'monster-generation'
            && x >= zone.lx && x <= zone.hx
            && y >= zone.ly && y <= zone.hy)) return false;
    return true;
}

// C teleport.c:enexto()/enexto_core(). Search nearby first, then the rest
// of the map. Only ignore scary squares after both searches fail.
export function findNearbyMonsterPosition(mnum, x, y, {
    state = game, random = rn2, calls = null,
} = {}) {
    for (const checkScary of [true, false]) {
        const nearby = collectNearbyCoords(x, y, 3, random, calls);
        const fits = point => monsterGoodPosition(
            mnum, point.x, point.y, false, checkScary, false, state,
        );
        const close = nearby.find(fits);
        if (close) return close;
        const all = collectNearbyCoords(x, y, 0, random, calls);
        const distant = all.slice(nearby.length).find(fits);
        if (distant) return distant;
    }
    return null;
}

function monsterTypeScaredFromPosition(mndx, x, y, state) {
    const symbol = MONSTER_SYMBOL[mndx] ?? 0;
    if (symbol === S_HUMAN || symbol === S_ANGEL
        || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(mndx)
        || ((MONSTER_GENO[mndx] ?? 0) & G_UNIQ)) return false;
    const location = state.level?.at?.(x, y);
    if (location?.typ === ALTAR && symbol === S_VAMPIRE) return true;
    if (state.level?.objects?.[x]?.[y]?.some(
        object => object.otyp === SCR_SCARE_MONSTER,
    )) return true;
    const inHell = !!state.dungeons?.[state.u?.uz?.dnum ?? -1]?.flags?.hellish;
    const inFinalDungeon = !!state.u?.uz && !!state.astral_level
        && state.u.uz.dnum === state.astral_level.dnum;
    if (inHell || inFinalDungeon || mndx === PM_MINOTAUR
        || ((MONSTER_FLAGS1[mndx] ?? 0) & M1_NOEYES)) return false;
    const engraving = state === game
        ? engravingAt(x, y)
        : state.level?.engravings?.find(candidate =>
            candidate.x === x && candidate.y === y);
    return !!engraving?.text?.includes('Elbereth');
}
