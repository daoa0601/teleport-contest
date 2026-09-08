// teleport.js - same-level teleportation.
// C ref: teleport.c teleok(), safe_teleds(), teleds(), and tele_trap().

import { game } from './gstate.js';
import { newsym, plineWithContinuation } from './display.js';
import {
    leashAttachedToMonster, releaseMonsterLeash,
} from './monster_leash.js';
import { rn2, rnd } from './rng.js';
import {
    A_STR, ACCESSIBLE, ALTAR, COLNO, D_CLOSED, D_LOCKED, DOOR, FAINTED,
    HEADSTONE,
    IS_LAVA, IS_POOL, ROWNO, VAULT, VIBRATING_SQUARE,
    WATER, W_NONPASSWALL, ZAP_POS, is_hole, is_pit, isok,
} from './const.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    AMULET_OF_YENDOR, BOULDER, LEASH, OBJECT_SPELL_LEVEL,
    RIN_TELEPORTATION, RIN_TELEPORT_CONTROL, SCR_SCARE_MONSTER,
    SPE_TELEPORT_AWAY,
} from './object_data.js';
import { currentAttribute } from './attrib.js';
import {
    beginBallAndChainTeleport, finishBallAndChainTeleport,
} from './ball.js';
import { heroHasWaterWalking, heroIsDisplaced } from './armor.js';
import { engravingAt } from './engrave.js';
import { somexyspace } from './mkroom.js';
import { priestAlignment, priestIsInOwnTemple } from './priest.js';
import { shopkeeperInOwnShop } from './shk.js';
import {
    heroTeleportRestricted, monsterGoodPosition, monsterTeleportRestricted,
} from './teleport_rules.js';
import { exceedsActionCapacity } from './weight.js';

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_TPORT = 0x02000000;
const M1_TPORT_CNTRL = 0x04000000;
const M2_ROCKTHROW = 0x08000000;
const S_HUMAN = 53;
const S_VAMPIRE = 48;
const PM_FLOATING_EYE = 28;
const PM_ANGEL = 122;
const PM_MINOTAUR = 177;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const G_UNIQ = 0x1000;

function wornRing(state, objectType) {
    return [
        state?.uleft, state?.uright,
        state?.u?.uleft, state?.u?.uright,
    ].some(ring => ring?.otyp === objectType);
}

function heroHasTeleportation(state) {
    const u = state?.u;
    return !!(u?.teleporting || u?.teleportation
        || (u?.teleportingTurns ?? 0) > 0
        || wornRing(state, RIN_TELEPORTATION));
}

function heroFormCanTeleport(state) {
    return !!(heroFormFlags(state).flags1 & M1_TPORT);
}

export function heroCanTeleport(state = game) {
    return heroHasTeleportation(state) || heroFormCanTeleport(state);
}

export function heroControlsTeleport(state = game) {
    const u = state?.u;
    return !!(u?.teleport_control || u?.teleportControl
        || wornRing(state, RIN_TELEPORT_CONTROL)
        || (heroFormFlags(state).flags1 & M1_TPORT_CNTRL));
}

export function heroIsUnaware(state = game) {
    if (!((state?._helplessTurns ?? 0) > 0)) return false;
    const reason = state?._helplessReason || '';
    return !!state?.u?.usleep || state?.u?.uhs === FAINTED
        || reason.startsWith('unconscious from')
        || reason === 'sleeping off a magical draught';
}

export function heroTeleportTrapBlock(state = game) {
    const level = state?.u?.uz;
    const astral = state?.astral_level;
    if (level && astral && level.dnum === astral.dnum) return 'endgame';
    if (state?.u?.antimagic || state?.u?.magicProtection)
        return 'antimagic';
    if (heroTeleportRestricted(state)) return 'level';
    return null;
}

export function monsterIsScaredAt(monster, state, x, y) {
    if (monster?.iswiz || monster?.mnum === PM_ANGEL
        || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(monster?.mnum)
        || (monster?.isminion && priestAlignment(monster) > 0)) return false;

    const symbol = MONSTER_SYMBOL[monster?.mnum];
    if (symbol === S_HUMAN
        || ((MONSTER_GENO[monster?.mnum] ?? 0) & G_UNIQ)
        || shopkeeperInOwnShop(monster, state)
        || priestIsInOwnTemple(monster, state)) return false;

    const vampireShifter = monster?.cham === PM_VAMPIRE
        || monster?.cham === PM_VAMPIRE_LEADER;
    if (state?.level?.at?.(x, y)?.typ === ALTAR
        && (symbol === S_VAMPIRE || vampireShifter)) return true;

    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (pile.some(object => object.otyp === SCR_SCARE_MONSTER)) return true;

    const engraving = engravingAt(x, y, state?.level);
    const completeElbereth = engraving?.engr_type !== HEADSTONE
        && (engraving?.epoch ?? 0) <= (state?.moves ?? 0)
        && /^Elbereth$/i.test(engraving?.text || '');
    if (!completeElbereth) return false;
    const protectsSquare = state?.u?.ux === x && state?.u?.uy === y
        || (heroIsDisplaced(state)
            && monster?.mux === x && monster?.muy === y)
        || (engraving.guardobjects && pile.length > 0);
    if (!protectsSquare) return false;

    const inHell = !!state?.dungeons?.[state?.u?.uz?.dnum ?? -1]
        ?.flags?.hellish;
    const endgame = !!state?.u?.uz && !!state?.astral_level
        && state.u.uz.dnum === state.astral_level.dnum;
    return !(monster?.isshk || monster?.isgd
        || monster?.mcansee === false || monster?.mcansee === 0
        || monster?.mpeaceful || monster?.mnum === PM_MINOTAUR
        || inHell || endgame);
}

function inside(area, x, y) {
    return area && x >= area.lx && x <= area.hx
        && y >= area.ly && y <= area.hy;
}

function crossesTeleportBoundary(state, fromX, fromY, toX, toY) {
    for (const region of [
        state?.level?.downTeleportRegion,
        state?.level?.upTeleportRegion,
    ]) {
        const area = region?.exclude;
        if (!area || area.lx <= 0) continue;
        if (inside(area, fromX, fromY) !== inside(area, toX, toY))
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
    const waterWalking = heroHasWaterWalking(state);
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
    if (locationHasMonster(state, x, y)) return false;
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (!trapAllowedAtDestination(state, trap, allowTrap)) return false;
    const { flags2 } = heroFormFlags(state);
    if (!(flags2 & M2_ROCKTHROW)
        && state.level?.objects?.[x]?.[y]?.some(
            object => object.otyp === BOULDER,
        )) return false;
    return !crossesTeleportBoundary(
        state, state.u.ux, state.u.uy, x, y,
    );
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
    const passesWalls = !!state.u.passesWalls;
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

function heroIsStunned(state) {
    return !!(state?.u?.stunned || (state?.u?.stunnedTurns ?? 0) > 0);
}

function teleportAtWillFailure(state) {
    const u = state.u;
    const nativeForm = heroFormCanTeleport(state);
    const requiredLevel = state.urole?.key === 'wizard' ? 8 : 12;
    if (!heroHasTeleportation(state) && !nativeForm)
        return "You don't know that spell.";
    if ((u.ulevel ?? 1) < requiredLevel && !nativeForm)
        return 'You are not able to teleport at will.';
    if ((u.uhunger ?? 0) <= 10)
        return 'You are too weak from hunger to teleport.';
    if (currentAttribute(A_STR, state) < 4)
        return 'You lack the strength to teleport.';

    const energy = 5 * OBJECT_SPELL_LEVEL[SPE_TELEPORT_AWAY];
    if (energy > (u.uen ?? 0))
        return 'You lack the energy to teleport.';
    return null;
}

export async function teleportHeroAtWill({
    state = game,
    random = rn2,
    rollOne = rnd,
    chooseDestination = null,
} = {}) {
    const failure = teleportAtWillFailure(state);
    if (failure) return { moved: false, messages: [failure] };
    if (exceedsActionCapacity(state)) {
        return {
            moved: false,
            messages: [
                'Your concentration falters from carrying so much.',
            ],
        };
    }

    const canChoose = heroControlsTeleport(state)
        && !heroIsStunned(state) && !heroIsUnaware(state);
    if (canChoose && !chooseDestination)
        return { moved: false, needsDestination: true, messages: [] };

    const energy = 5 * OBJECT_SPELL_LEVEL[SPE_TELEPORT_AWAY];
    state.u.uen -= energy;

    const followersReady = await bringLeashedFollowers(state, random);
    const messages = [];
    if (!followersReady) {
        messages.push('You shudder for a moment.');
        return { moved: false, messages };
    }

    let destination = canChoose ? await chooseDestination() : null;
    if (canChoose && !destination) {
        state.u.uhunger = (state.u.uhunger ?? 900) - 100;
        return { moved: false, cancelled: true, messages };
    }
    if (!destination || !heroTeleportDestinationOk(
        destination.x, destination.y, { state },
    )) {
        if (destination) messages.push('Sorry...');
        destination = safeTeleportDestination(state, random, rollOne);
    }

    state.u.uhunger = (state.u.uhunger ?? 900) - 100;
    if (!destination) return { moved: false, messages };

    const movement = moveHeroByTeleport(
        destination.x, destination.y, state,
    );
    if (state.flags?.verbose !== false) {
        messages.push(`You materialize in ${
            movement.oldx === movement.x && movement.oldy === movement.y
                ? 'the same' : 'a different'
        } location!`);
    }
    return { moved: true, movement, messages };
}

export function randomMonsterRelocation(
    monster, state = game, calls = [], random = rn2, rollOne = rnd,
) {
    if (!monster) return null;
    for (let attempt = 0; attempt < 50; attempt++) {
        const x = rollOne(COLNO - 1);
        calls.push(`rnd(${COLNO - 1})`);
        const y = random(ROWNO);
        calls.push(`rn2(${ROWNO})`);
        if (monsterTeleportDestinationOk(monster, state, x, y))
            return relocateMonsterTo(monster, x, y);
    }

    const candidates = monsterRelocationCandidates(monster, state);
    let fallback = null;
    for (let index = 0; index < candidates.length; index++) {
        const remaining = candidates.length - index;
        const offset = random(remaining);
        calls.push(`rn2(${remaining})`);
        if (offset) {
            [candidates[index], candidates[index + offset]] = [
                candidates[index + offset], candidates[index],
            ];
        }
        const { x, y } = candidates[index];
        if (monsterTeleportDestinationOk(monster, state, x, y))
            return relocateMonsterTo(monster, x, y);
        if (!fallback && monsterGoodPosition(monster.mnum, x, y))
            fallback = { x, y };
    }
    return fallback
        ? relocateMonsterTo(monster, fallback.x, fallback.y)
        : null;
}

function monsterTeleportDestinationOk(monster, state, x, y) {
    const selfSquare = x === monster.mx && y === monster.my;
    if ((selfSquare && monster.wormno)
        || (!selfSquare && !monsterGoodPosition(monster.mnum, x, y))
        || monsterIsScaredAt(monster, state, x, y)) return false;

    const roomno = state.level?.at?.(x, y)?.roomno;
    if (shopkeeperInOwnShop(monster, state)
        && roomno !== monster.eshk?.shoproom) return false;
    const priest = monster.epri || monster.mextra?.epri;
    if (priestIsInOwnTemple(monster, state)
        && roomno !== priest?.shroom) return false;

    return !crossesTeleportBoundary(
        state, monster.mx, monster.my, x, y,
    );
}

function monsterRelocationCandidates(monster, state) {
    const centerX = Math.trunc(COLNO / 2);
    const centerY = Math.trunc(ROWNO / 2);
    const maxRadius = Math.max(
        centerX,
        centerY,
        COLNO - 1 - centerX,
        ROWNO - 1 - centerY,
    );
    const passesWalls = !!(
        (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK
    );
    const candidates = [];

    for (let radius = 0; radius <= maxRadius; radius++) {
        const lox = centerX - radius;
        const hix = centerX + radius;
        const loy = centerY - radius;
        const hiy = centerY + radius;
        for (let y = Math.max(loy, 0); y <= Math.min(hiy, ROWNO - 1); y++) {
            for (let x = Math.max(lox, 1); x <= Math.min(hix, COLNO - 1); x++) {
                if (x !== lox && x !== hix && y !== loy && y !== hiy)
                    continue;
                if (locationHasMonster(state, x, y)) continue;
                if (!passesWalls && !ZAP_POS(state.level?.at?.(x, y)?.typ))
                    continue;
                candidates.push({ x, y });
            }
        }
    }
    return candidates;
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

function monsterVisibleAt(monster, state, x = monster.mx, y = monster.my) {
    const inSight = !state?.viz_array
        || !!(state.viz_array?.[y]?.[x] & 0x2);
    const canSeeInvisible = !!(state?.u?.seeInvisible
        || state?.u?.see_invisible);
    return !state?.blind && !(state?.u?.blindTurns > 0)
        && inSight && !monster.mundetected
        && (!monster.minvis || canSeeInvisible);
}

function locationHasMonster(state, x, y) {
    return state.level?.monsters?.some(monster =>
        (monster.mhp ?? 1) > 0
        && ((monster.mx === x && monster.my === y)
            || monster.wormSegments?.some(segment =>
                segment.x === x && segment.y === y))) ?? false;
}

function relocateMonsterTo(monster, x, y) {
    const oldx = monster.mx;
    const oldy = monster.my;
    monster.mx = x;
    monster.my = y;
    monster.mtrack = [];
    return {
        oldx, oldy, x, y,
        moved: oldx !== x || oldy !== y,
    };
}

export function clearFixedTeleportDestination(
    x, y, state = game, random = rn2,
) {
    const monster = state.level?.monsters?.find(candidate =>
        (candidate.mhp ?? 1) > 0
        && ((candidate.mx === x && candidate.my === y)
            || candidate.wormSegments?.some(segment =>
                segment.x === x && segment.y === y)));
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
    if (state === game) {
        newsym(oldx, oldy);
        newsym(monster.mx, monster.my);
    }
}

// C apply.c:next_to_u(), used before stairs, falls, and teleportation.
export async function bringLeashedFollowers(state = game, random = rn2) {
    for (const monster of [...(state.level?.monsters || [])].reverse()) {
        if (!monster?.mleashed || (monster.mhp ?? 1) <= 0) continue;
        moveLeashedMonsterNextToHero(monster, state, random);
        if (distanceToHero(monster, state) <= 1) continue;

        const leash = leashAttachedToMonster(monster, state);
        if (!leash || leash.cursed) return false;
        releaseMonsterLeash(monster, state);
        const leashedCount = state.level.monsters.filter(candidate =>
            candidate.mleashed).length;
        await plineWithContinuation(`You feel ${leashedCount > 1 ? 'a' : 'the'} leash go slack.`);
    }

    const steed = state.u?.usteed;
    const steedInventory = steed?.minvent || steed?.inventory || [];
    if (steedInventory.some(object => object.otyp === AMULET_OF_YENDOR))
        return false;
    return true;
}

export function prepareMonsterTeleport(
    monster, state = game, force = false,
) {
    if (monster === state?.u?.usteed)
        return { allowed: false, leashReleased: false };
    if (!monster?.mleashed)
        return { allowed: true, leashReleased: false };

    const leash = leashAttachedToMonster(monster, state);
    if (leash?.cursed && !force)
        return { allowed: false, leashReleased: false, cursedLeash: true };

    releaseMonsterLeash(monster, state);
    return { allowed: true, leashReleased: true };
}

export function teleportMonsterFromTrap(
    monster, trap, {
        state = game, calls = [], random = rn2, rollOne = rnd,
    } = {},
) {
    const event = {
        kind: 'teleport-trap', trap,
        trapSquare: { x: monster.mx, y: monster.my },
        visible: monsterVisibleAt(monster, state),
        relocation: null,
        damage: 0,
        killed: false,
    };
    if (monsterTeleportRestricted(monster, state)) {
        event.restricted = true;
        return event;
    }

    const preparation = prepareMonsterTeleport(monster, state);
    event.leashReleased = preparation.leashReleased;
    if (!preparation.allowed) {
        event.cursedLeash = preparation.cursedLeash;
        return event;
    }

    const fixedDestination = trap.teledest
        && isok(trap.teledest.x, trap.teledest.y);
    if (trap.once) {
        const vault = state.level?.rooms?.find(room => room?.rtype === VAULT);
        if (vault) {
            const square = { x: 0, y: 0 };
            if (somexyspace(vault, square)
                && monsterGoodPosition(monster.mnum, square.x, square.y)) {
                event.relocation = relocateMonsterTo(
                    monster, square.x, square.y,
                );
            }
        }
        event.relocation ||= randomMonsterRelocation(
            monster, state, calls, random, rollOne,
        );
    } else if (fixedDestination) {
        const occupiedByHero = state.u?.ux === trap.teledest.x
            && state.u?.uy === trap.teledest.y;
        const occupiedByMonster = state.level?.monsters?.some(candidate =>
            (candidate.mhp ?? 1) > 0
            && candidate.mx === trap.teledest.x
            && candidate.my === trap.teledest.y);
        if (!occupiedByHero && !occupiedByMonster) {
            event.relocation = relocateMonsterTo(
                monster, trap.teledest.x, trap.teledest.y,
            );
        }
    } else {
        event.relocation = randomMonsterRelocation(
            monster, state, calls, random, rollOne,
        );
    }
    event.teleportAttempted = true;
    return event;
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
