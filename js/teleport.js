// teleport.js - same-level teleportation.
// C ref: teleport.c teleok(), safe_teleds(), teleds(), and tele_trap().

import { game } from './gstate.js';
import { rn2, rnd } from './rng.js';
import {
    ACCESSIBLE, COLNO, D_CLOSED, D_LOCKED, DOOR,
    IS_LAVA, IS_POOL, ROWNO, VIBRATING_SQUARE,
    WATER, W_NONPASSWALL, ZAP_POS, is_hole, is_pit, isok,
} from './const.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    AMULET_OF_YENDOR, BOULDER, LEASH,
} from './object_data.js';
import {
    beginBallAndChainTeleport, finishBallAndChainTeleport,
} from './ball.js';
import { monsterGoodPosition } from './mklev.js';

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_ROCKTHROW = 0x08000000;
const M3_COVETOUS = 0x001f;
const S_DEMON = 56;
const PM_FLOATING_EYE = 28;

function monsterIsDemonRuler(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return MONSTER_SYMBOL[monster?.mnum] === S_DEMON
        && !!(flags & (M2_LORD | M2_PRINCE));
}

function monsterIsCovetous(monster) {
    return !!((MONSTER_FLAGS3[monster?.mnum] ?? 0) & M3_COVETOUS);
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

export function heroTeleportTrapBlock(state = game) {
    const level = state?.u?.uz;
    const astral = state?.astral_level;
    if (level && astral && level.dnum === astral.dnum) return 'endgame';
    if (state?.u?.antimagic || state?.antimagic
        || state?.u?.magicResistance || state?.u?.magic_resistance
        || state?.u?.magicProtection) return 'antimagic';
    const currentForm = state?.u?.mtimedone
        ? state.u.umonnum : state?.u?.umonster;
    if (monsterTeleportRestricted({ mnum: currentForm }, state)) return 'level';
    return null;
}

function inside(area, x, y) {
    return area && x >= area.lx && x <= area.hx
        && y >= area.ly && y <= area.hy;
}

function crossesTeleportBoundary(state, x, y) {
    for (const region of [
        state?.level?.downTeleportRegion,
        state?.level?.upTeleportRegion,
    ]) {
        const area = region?.exclude;
        if (!area || area.lx <= 0) continue;
        if (inside(area, state.u.ux, state.u.uy) !== inside(area, x, y))
            return true;
    }
    return false;
}

function heroFormFlags(state) {
    const form = state?.u?.mtimedone && Number.isInteger(state.u.umonnum)
        ? state.u.umonnum : null;
    return {
        form,
        flags1: form == null ? 0 : MONSTER_FLAGS1[form] ?? 0,
        flags2: form == null ? 0 : MONSTER_FLAGS2[form] ?? 0,
    };
}

function heroCanEnterTerrain(state, location) {
    const { form, flags1 } = heroFormFlags(state);
    const flying = !!(state?.u?.flying || state?.u?.flight
        || (flags1 & M1_FLY));
    const levitating = !!(state?.u?.levitating || state?.u?.levitation);
    const waterWalking = !!(state?.u?.waterWalking
        || state?.u?.water_walking);
    const waterLevel = state?.u?.uz && state?.water_level
        && state.u.uz.dnum === state.water_level.dnum
        && state.u.uz.dlevel === state.water_level.dlevel;

    if (IS_POOL(location.typ)) {
        if (state?.u?.swimming || state?.u?.amphibious
            || (flags1 & M1_SWIM)) return true;
        return !waterLevel && location.typ !== WATER
            && (flying || levitating || waterWalking);
    }
    if (IS_LAVA(location.typ)) {
        if (form === PM_FLOATING_EYE) return false;
        const boots = state?.uarmf || state?.u?.uarmf;
        const protectedWaterWalking = waterWalking
            && !!(state?.u?.fireResistance || state?.u?.fire_resistance)
            && !!boots?.oerodeproof;
        return flying || levitating || protectedWaterWalking
            || !!(state?.u?.likesLava || state?.u?.likes_lava);
    }
    if ((flags1 & M1_WALLWALK)
        && !(location.wall_info & W_NONPASSWALL)) return true;
    if ((flags1 & M1_AMORPHOUS) && location.typ === DOOR
        && (location.doormask & (D_CLOSED | D_LOCKED))) return true;
    if (location.typ === DOOR
        && (location.doormask & (D_CLOSED | D_LOCKED))) return false;
    return ACCESSIBLE(location.typ);
}

function trapAllowedAtDestination(state, trap, allowTrap) {
    if (!trap || allowTrap) return true;
    if (trap.ttyp === VIBRATING_SQUARE) return true;
    const floating = !!(state?.u?.levitating || state?.u?.levitation
        || state?.u?.flying || state?.u?.flight);
    return floating && (is_pit(trap.ttyp) || is_hole(trap.ttyp));
}

export function heroTeleportDestinationOk(
    x, y, { state = game, allowTrap = false } = {},
) {
    if (!isok(x, y)) return false;
    const location = state?.level?.at?.(x, y);
    if (!location || !heroCanEnterTerrain(state, location)) return false;
    if (state.level?.monsters?.some(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y)) {
        return false;
    }
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (!trapAllowedAtDestination(state, trap, allowTrap)) return false;
    const { flags2 } = heroFormFlags(state);
    if (!(flags2 & M2_ROCKTHROW)
        && state.level?.objects?.[x]?.[y]?.some(
            object => object.otyp === BOULDER,
        )) return false;
    return !crossesTeleportBoundary(state, x, y);
}

function shuffleCoordinates(coordinates, random) {
    let start = 0;
    for (let remaining = coordinates.length; remaining > 1; remaining--) {
        const offset = random(remaining);
        if (offset) {
            [coordinates[start], coordinates[start + offset]] = [
                coordinates[start + offset], coordinates[start],
            ];
        }
        start++;
    }
}

function teleportCandidates(state, random) {
    const cx = state.u.ux;
    const cy = state.u.uy;
    const rowRange = cy < ROWNO / 2 ? ROWNO - 1 - cy : cy;
    const colRange = cx < COLNO / 2 ? COLNO - 1 - cx : cx;
    const maxRadius = Math.max(rowRange, colRange);
    const passesWalls = !!(heroFormFlags(state).flags1 & M1_WALLWALK);
    const result = [];
    let pair = [];

    for (let radius = 1; radius <= maxRadius; radius++) {
        const lox = cx - radius;
        const hix = cx + radius;
        const loy = cy - radius;
        const hiy = cy + radius;
        for (let y = Math.max(loy, 0); y <= Math.min(hiy, ROWNO - 1); y++) {
            for (let x = Math.max(lox, 1); x <= Math.min(hix, COLNO - 1); x++) {
                if (x !== lox && x !== hix && y !== loy && y !== hiy)
                    continue;
                if (state.level?.monsters?.some(monster =>
                    (monster.mhp ?? 1) > 0
                    && monster.mx === x && monster.my === y)) continue;
                if (!passesWalls && !ZAP_POS(state.level?.at?.(x, y)?.typ))
                    continue;
                pair.push({ x, y });
            }
        }
        if (radius % 2 === 0 || radius === maxRadius) {
            shuffleCoordinates(pair, random);
            result.push(...pair);
            pair = [];
        }
    }
    return result;
}

export function safeTeleportDestination(
    state = game, random = rn2, rollOne = rnd,
) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const x = rollOne(COLNO - 1);
        const y = random(ROWNO);
        if (heroTeleportDestinationOk(x, y, { state })) return { x, y };
    }

    let trappedFallback = null;
    for (const point of teleportCandidates(state, random)) {
        if (heroTeleportDestinationOk(point.x, point.y, { state }))
            return point;
        if (!trappedFallback
            && state.level?.traps?.some(trap =>
                trap.tx === point.x && trap.ty === point.y)
            && heroTeleportDestinationOk(point.x, point.y, {
                state, allowTrap: true,
            })) trappedFallback = point;
    }
    return trappedFallback;
}

function nearbyMonsterDestination(
    monster, centerX, centerY, state, random = rn2,
) {
    const rowRange = centerY < ROWNO / 2
        ? ROWNO - 1 - centerY : centerY;
    const colRange = centerX < COLNO / 2
        ? COLNO - 1 - centerX : centerX;
    const maxRadius = Math.max(rowRange, colRange);
    for (const checkScary of [true, false]) {
        for (let radius = 1; radius <= maxRadius; radius++) {
            const candidates = [];
            const lox = centerX - radius;
            const hix = centerX + radius;
            const loy = centerY - radius;
            const hiy = centerY + radius;
            for (let y = Math.max(loy, 0); y <= Math.min(hiy, ROWNO - 1); y++) {
                for (let x = Math.max(lox, 1);
                    x <= Math.min(hix, COLNO - 1); x++) {
                    if (x !== lox && x !== hix && y !== loy && y !== hiy)
                        continue;
                    if (monsterGoodPosition(
                        monster.mnum, x, y, false, checkScary,
                    )) candidates.push({ x, y });
                }
            }
            if (!candidates.length) continue;
            return candidates[random(candidates.length)];
        }
    }
    return null;
}

export function clearFixedTeleportDestination(
    x, y, state = game, random = rn2,
) {
    const monster = state.level?.monsters?.find(candidate =>
        (candidate.mhp ?? 1) > 0 && candidate.mx === x && candidate.my === y);
    if (!monster) return { cleared: true, relocation: null };
    const oldx = monster.mx;
    const oldy = monster.my;
    const destination = nearbyMonsterDestination(
        monster, monster.mx, monster.my, state, random,
    );
    if (!destination) return { cleared: false, relocation: null };
    monster.mx = destination.x;
    monster.my = destination.y;
    monster.mtrack = [];
    return {
        cleared: true,
        relocation: {
            monster, oldx, oldy,
            x: destination.x, y: destination.y,
        },
    };
}

function distanceToHero(monster, state) {
    return Math.max(
        Math.abs(monster.mx - state.u.ux),
        Math.abs(monster.my - state.u.uy),
    );
}

function moveLeashedMonsterNextToHero(monster, state, random) {
    if (distanceToHero(monster, state) <= 1) return;
    const oldx = monster.mx;
    const oldy = monster.my;
    const destination = nearbyMonsterDestination(
        monster, state.u.ux, state.u.uy, state, random,
    );
    if (!destination) return;
    monster.mx = destination.x;
    monster.my = destination.y;
    monster.mtrack = [];
    if (distanceToHero(monster, state) > 1) {
        monster.mx = oldx;
        monster.my = oldy;
    }
}

export function prepareHeroTeleport(state = game, random = rn2) {
    const messages = [];
    for (const monster of state.level?.monsters || []) {
        if (!monster?.mleashed || (monster.mhp ?? 1) <= 0) continue;
        moveLeashedMonsterNextToHero(monster, state, random);
        if (distanceToHero(monster, state) <= 1) continue;

        const leash = state.inventory?.find(object =>
            object.otyp === LEASH && object.leashmon === monster.m_id);
        if (!leash || leash.cursed) return { allowed: false, messages };
        monster.mleashed = 0;
        leash.leashmon = 0;
        const leashedCount = state.level.monsters.filter(candidate =>
            candidate.mleashed).length;
        messages.push(`You feel ${leashedCount ? 'a' : 'the'} leash go slack.`);
    }

    const steed = state.u?.usteed;
    const steedInventory = steed?.minvent || steed?.inventory || [];
    if (steedInventory.some(object => object.otyp === AMULET_OF_YENDOR))
        return { allowed: false, messages };
    return { allowed: true, messages };
}

export function moveHeroByTeleport(x, y, state = game) {
    const u = state.u;
    const oldx = u.ux;
    const oldy = u.uy;
    const ballAndChain = beginBallAndChainTeleport(x, y, state);

    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = x;
    u.uy = y;
    if (u.usteed) {
        u.usteed.mx = x;
        u.usteed.my = y;
    }
    u.utrap = 0;
    u.utraptype = 0;
    u.ustuck = null;
    u.uswallow = false;
    state._runState = null;
    if (state.context) {
        state.context.run = 0;
        state.context.mv = false;
        state.context.travel = false;
        state.context.travel1 = false;
        state.context.nopick = false;
    }
    finishBallAndChainTeleport(ballAndChain, state);
    return { oldx, oldy, x, y };
}
