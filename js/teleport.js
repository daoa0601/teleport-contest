// teleport.js - same-level teleportation.
// C ref: teleport.c teleok(), safe_teleds(), teleds(), and tele_trap().
import { monsterHasMapPosition, monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { updateMonsterRegions } from './regions.js';
import { clearMonsterWormFromMap, placeMonsterWormTailRandomly } from './monster_worm.js';
import { game, requireLiveGame, requireGameLevel, requirePlayingGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { askMonsterTeleportDestination, askTeleportDestination } from './cmd.js';
import { randomTeleportDepth } from './level_teleport.js';
import { depth } from './hacklib.js';
import { levelAtDepth, insideWizardTower, levelIsWizardTower } from './dungeon.js';
import { propertyIsActive } from './properties.js';
import { finishTeleportArrival } from './location_effects.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, docrt, newsym, plineWithContinuation, see_monsters } from './display.js';
import { vision_recalc } from './vision.js';
import { leashAttachedToMonster, releaseMonsterLeash, } from './monster_leash.js';
import { rn2, rnd } from './rng.js';
import { GP_CHECKSCARY, A_STR, COLNO, ROWNO, VAULT, VIBRATING_SQUARE, M_AP_NOTHING, MON_FLOOR, MON_OFFMAP, RLOC_MSG, RLOC_NOMSG, RLOC_NONE, RLOC_ERR, STRAT_APPEARMSG, BOLT_LIM, TT_BURIEDBALL, In_endgame, MIGR_PORTAL, Upolyd, ZAP_POS, is_hole, is_pit, isok, } from './const.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterHasNoAttacks, } from './monster_data.js';
import { AMULET_OF_YENDOR, LEASH, OBJECT_SPELL_LEVEL, RIN_TELEPORTATION, RIN_TELEPORT_CONTROL, SPE_TELEPORT_AWAY, } from './object_data.js';
import { currentAttribute } from './attrib.js';
import { spendHeroNutrition } from './hunger.js';
import { beginBallAndChainMove, finishBallAndChainMove, heroIsPunished, placeBallAndChain, unplaceBallAndChain, } from './ball.js';
import { somexyspace } from './mkroom.js';
import { priestIsInOwnTemple } from './priest.js';
import { checkSpecialRoom, costlySpot, shopkeeperInOwnShop } from './shk.js';
import { makeAngryShopkeeper } from './shop_damage.js';
import { findObjectOwner, onBillEntry, stolenValue } from './shop_loss.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterName } from './monster_name.js';
import { publishMonsterYelp } from './monster_anger.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { tryMonsterTrapEscape } from './monster_trap_escape.js';
import { stopHeroOccupation } from './occupation.js';
import { couldsee } from './vision.js';
import { findNearbyMonsterPosition, heroTeleportRestricted, goodPosition, monsterTeleportRestricted, } from './teleport_rules.js';
import { exceedsActionCapacity, nearCapacity, SLT_ENCUMBER } from './weight.js';
import { distmin } from './hacklib.js';
import { heroIsUnaware, heroIsUnconscious } from './hero_sleep.js';
import { promptYesNo } from './query.js';
import { heroIsBlind, heroIsHallucinating, setHeroBlindnessTurns } from './senses.js';
import { buriedBallToPunishment } from './buried_object.js';
import { placeHeroOnLevel } from './hero_location.js';
import { migrateMonsterOffLevel, migrateMonsterToLevel, sendMonsterToLimbo } from './monster_migration.js';
import { isHomeElemental } from './monster_hit_points.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { Is_astralevel, MON_ENDGAME_MIGR, MON_OBLITERATE } from './const.js';
import { clearHeroTrap } from './hero_traps.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { seeTrap } from './trap.js';
import { isRoom } from './map_types.js';
import { hasShopkeeperData } from './shop_types.js';
function requireLevel(state) {
    if (!state.level)
        throw new Error('Teleportation requires a dungeon level.');
}
const M1_WALLWALK = 0x00000008;
const M1_TPORT = 0x02000000;
const M1_TPORT_CNTRL = 0x04000000;
const S_ELEMENTAL = 31;
const S_MIMIC = 13;
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
    return Upolyd(state.u) && state.u.umonnum !== undefined
        && !!((MONSTER_FLAGS1[state.u.umonnum] ?? 0) & M1_TPORT);
}
export function heroCanTeleport(state = game) {
    return heroHasTeleportation(state) || heroFormCanTeleport(state);
}
export function heroControlsTeleport(state = game) {
    const u = state?.u;
    return !!(u?.teleportControl
        || wornRing(state, RIN_TELEPORT_CONTROL)
        || (Upolyd(u) && u.umonnum !== undefined && ((MONSTER_FLAGS1[u.umonnum] ?? 0) & M1_TPORT_CNTRL)));
}
export function heroTeleportTrapBlock(state = game) {
    const level = state?.u?.uz;
    const astral = state?.astral_level;
    if (level && astral && level.dnum === astral.dnum)
        return 'endgame';
    if (state?.u?.antimagic)
        return 'antimagic';
    if (heroTeleportRestricted(state))
        return 'level';
    return null;
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
        if (!area || area.lx <= 0)
            continue;
        if (inside(area, fromX, fromY) !== inside(area, toX, toY))
            return true;
    }
    return false;
}
function trapAllowedAtDestination(state, trap, allowTrap) {
    if (!trap || allowTrap)
        return true;
    if (trap.ttyp === VIBRATING_SQUARE)
        return true;
    const floating = propertyIsActive('levitation', state) || propertyIsActive('flying', state);
    return floating && (is_pit(trap.ttyp) || is_hole(trap.ttyp));
}
export function heroTeleportDestinationOk(x, y, { state = game, allowTrap = false } = {}) {
    if (!isok(x, y))
        return false;
    const trap = requireGameLevel(state).traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trapAllowedAtDestination(state, trap, allowTrap))
        return false;
    if (!goodPosition(x, y, { kind: 'hero' }, { state }))
        return false;
    return !crossesTeleportBoundary(state, state.u.ux, state.u.uy, x, y);
}
function shuffleCoordinates(coordinates, random) {
    let start = 0;
    for (let remaining = coordinates.length; remaining > 1; remaining--) {
        const offset = random(remaining);
        if (offset) {
            const left = coordinates[start];
            const right = coordinates[start + offset];
            if (!left || !right)
                throw new RangeError('Teleport shuffle index is out of range.');
            coordinates[start] = right;
            coordinates[start + offset] = left;
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
                if (state.level?.monsters?.some(monster => monsterHasMapPosition(monster, state) &&
                    (monster.mhp ?? 1) > 0
                    && monster.mx === x && monster.my === y))
                    continue;
                if (!passesWalls && !ZAP_POS(state.level?.at?.(x, y)?.typ ?? -1))
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
export function safeTeleportDestination(state = game, random = rn2, rollOne = rnd) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const x = rollOne(COLNO - 1);
        const y = random(ROWNO);
        if (heroTeleportDestinationOk(x, y, { state }))
            return { x, y };
    }
    let trappedFallback = null;
    for (const point of teleportCandidates(state, random)) {
        if (heroTeleportDestinationOk(point.x, point.y, { state }))
            return point;
        if (!trappedFallback
            && state.level?.traps?.some(trap => trap.tx === point.x && trap.ty === point.y)
            && heroTeleportDestinationOk(point.x, point.y, {
                state, allowTrap: true,
            }))
            trappedFallback = point;
    }
    return trappedFallback;
}
// C teleport.c:tele()/scrolltele(NULL). The reader returns coordinates or null.
export async function teleportHero({ chooseDestination, source = null, discover = null } = {}) {
    let sourceDiscovered = false;
    const discoverSource = async () => {
        if (!source || sourceDiscovered)
            return;
        sourceDiscovered = true;
        await discover?.();
    };
    if (heroTeleportRestricted(game) && !game.flags.debug) {
        await plineWithContinuation('A mysterious force prevents you from teleporting!');
        await discoverSource();
        return { moved: false, died: false };
    }
    if (!heroIsBlind(game))
        setHeroBlindnessTurns(0, game);
    const onWizardTower = levelIsWizardTower();
    if ((game.u.uhave?.amulet || onWizardTower) && !rn2(3)) {
        await plineWithContinuation('You feel disoriented for a moment.');
        if (!game.flags.debug || await promptYesNo('Override?', 'n') !== 'y')
            return { moved: false, died: false };
    }
    const controlled = ((heroControlsTeleport() || source?.blessed) && !heroIsStunned(game))
        || game.flags.debug;
    let destination = null;
    let acceptedChoice = false;
    if (controlled) {
        if (heroIsUnconscious()) {
            await plineWithContinuation('Being unconscious, you cannot control your teleport.');
        }
        else {
            if (typeof chooseDestination !== 'function')
                throw new TypeError('controlled teleport needs a destination reader');
            destination = await chooseDestination({ onPrompt: discoverSource });
            if (!destination)
                return { moved: false, died: false };
            acceptedChoice = heroTeleportDestinationOk(destination.x, destination.y);
            if (!acceptedChoice) {
                await plineWithContinuation('Sorry...');
                destination = null;
            }
        }
    }
    await discoverSource();
    destination ||= safeTeleportDestination();
    if (!destination)
        return { moved: false, died: false };
    const movement = await moveHeroByTeleport(destination.x, destination.y);
    await finishTeleportArrival(movement);
    const died = !!game.program_state.gameover;
    if (!died && acceptedChoice
        && game.u.ux === game._travelTarget?.x
        && game.u.uy === game._travelTarget?.y)
        game._travelTarget = null;
    return { moved: true, died };
}
export async function teleportHeroSafely() {
    const destination = safeTeleportDestination();
    if (!destination)
        return false;
    const movement = await moveHeroByTeleport(destination.x, destination.y);
    await finishTeleportArrival(movement, { announceTeleport: false });
    return true;
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
    const energy = 5 * teleportSpellLevel();
    if (energy > (u.uen ?? 0))
        return 'You lack the energy to teleport.';
    return null;
}
export async function teleportHeroAtWill({ state = game, random = rn2, rollOne = rnd, chooseDestination = null, finishArrival = finishTeleportArrival, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    const failure = teleportAtWillFailure(state);
    if (failure) {
        await publish(failure);
        return { moved: false, died: false };
    }
    if (exceedsActionCapacity(state)) {
        await publish('Your concentration falters from carrying so much.');
        return { moved: false, died: false };
    }
    const canChoose = heroControlsTeleport(state)
        && !heroIsStunned(state) && !heroIsUnaware(state);
    if (canChoose && !chooseDestination)
        return { moved: false, needsDestination: true, died: false };
    const energy = 5 * teleportSpellLevel();
    state.u.uen -= energy;
    state.context.botl = true;
    const followersReady = await bringLeashedFollowers(state, random);
    if (!followersReady) {
        await publish('You shudder for a moment.');
        return { moved: false, died: false };
    }
    // dotele() discards the prior travel suggestion before calling tele().
    state._travelTarget = null;
    let destination = canChoose && chooseDestination ? await chooseDestination() : null;
    if (canChoose && !destination) {
        await spendHeroNutrition(100, { state });
        return { moved: false, cancelled: true, died: !!state.program_state.gameover };
    }
    if (!destination || !heroTeleportDestinationOk(destination.x, destination.y, { state })) {
        if (destination)
            await publish('Sorry...');
        destination = safeTeleportDestination(state, random, rollOne);
    }
    if (!destination) {
        await spendHeroNutrition(100, { state });
        return { moved: false, died: !!state.program_state.gameover };
    }
    const movement = await moveHeroByTeleport(destination.x, destination.y, state);
    if (state.flags?.verbose !== false) {
        await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
            ? 'the same' : 'a different'} location!`);
    }
    const arrival = await finishArrival(movement);
    if (arrival?.died || state.program_state.gameover)
        return { moved: true, movement, arrival, died: true };
    // C dotele(): teleds() completes all landing effects before morehungry.
    await spendHeroNutrition(100, { state });
    return { moved: true, movement, arrival, died: !!state.program_state.gameover };
}
export async function randomMonsterRelocation(monster, { state = game, calls = [], random = rn2, rollOne = rnd, flags = RLOC_NONE, } = {}) {
    if (!monster)
        return null;
    requireLiveGame(state);
    requireLevel(state);
    if (monster === state.u.usteed) {
        const oldx = monster.mx, oldy = monster.my;
        const teleport = await teleportHero({ chooseDestination: askTeleportDestination });
        // Native rloc succeeds even when tele is cancelled or restricted.
        return {
            oldx, oldy, x: monster.mx, y: monster.my,
            moved: monster.mx !== oldx || monster.my !== oldy,
            died: teleport.died,
        };
    }
    if (monster.iswiz && monster.mx) {
        const heroInTower = insideWizardTower(state.u.ux, state.u.uy, state);
        const downLadder = heroInTower ? wizardStairway(state, true, false) : null;
        const stair = heroInTower
            ? downLadder || wizardStairway(state, true, true)
            : wizardStairway(state, false, true);
        if (stair && goodPosition(stair.sx, stair.sy, { kind: 'monster', monster }, { state, random }))
            return await relocateMonsterTo(monster, stair.sx, stair.sy, {
                state, random, rollOne, calls, flags,
            });
    }
    if (state._monTelecontrol && monster.mx) {
        const destination = await controlMonsterTeleport(monster, {
            x: monster.mx, y: monster.my,
        }, { state, flags, random, mode: 'random' });
        if (destination)
            return await relocateMonsterTo(monster, destination.x, destination.y, {
                state, random, rollOne, calls, flags,
            });
    }
    for (let attempt = 0; attempt < 50; attempt++) {
        const x = rollOne(COLNO - 1);
        calls?.push(`rnd(${COLNO - 1})`);
        const y = random(ROWNO);
        calls?.push(`rn2(${ROWNO})`);
        if (monsterTeleportDestinationOk(monster, state, x, y, random))
            return await relocateMonsterTo(monster, x, y, { state, random, rollOne, calls, flags });
    }
    const candidates = monsterRelocationCandidates(monster, state);
    let fallback = null;
    for (let index = 0; index < candidates.length; index++) {
        const remaining = candidates.length - index;
        const offset = random(remaining);
        calls?.push(`rn2(${remaining})`);
        if (offset) {
            const left = candidates[index];
            const right = candidates[index + offset];
            if (!left || !right)
                throw new RangeError('Relocation shuffle index is out of range.');
            candidates[index] = right;
            candidates[index + offset] = left;
        }
        const candidate = candidates[index];
        if (!candidate)
            throw new Error('Relocation candidate is missing.');
        const { x, y } = candidate;
        if (monsterTeleportDestinationOk(monster, state, x, y, random))
            return await relocateMonsterTo(monster, x, y, { state, random, rollOne, calls, flags });
        if (!fallback && goodPosition(x, y, { kind: 'monster', monster }, { state, random }))
            fallback = { x, y };
    }
    if (fallback)
        return await relocateMonsterTo(monster, fallback.x, fallback.y, { state, random, rollOne, calls, flags });
    if (flags & RLOC_ERR)
        await impossible("rloc(): couldn't relocate monster", { state });
    return null;
}
// C teleport.c:control_mon_tele(). False selection resumes the caller's policy.
export async function controlMonsterTeleport(monster, defaultPoint, { state = game, mode = 'random', flags = RLOC_NONE, random = rn2, } = {}) {
    requireLiveGame(state);
    requireLevel(state);
    let start = { ...defaultPoint };
    if (!isok(start.x, start.y))
        start = { x: monster.mx, y: monster.my };
    if (!isok(start.x, start.y))
        start = { x: state.u.ux, y: state.u.uy };
    if (!state.flags.debug || !state._monTelecontrol)
        return null;
    const destination = await askMonsterTeleportDestination(monster, start);
    if (destination && !(destination.x === state.u.ux && destination.y === state.u.uy)) {
        const { x, y } = destination;
        const valid = mode === 'random'
            ? monsterTeleportDestinationOk(monster, state, x, y, random)
            : goodPosition(x, y, { kind: 'monster', monster }, { state, gpflags: flags, random });
        if (valid)
            return destination;
        if (!state.flags.debug_fuzzer && await promptYesNo(`<${monster.mx},${monster.my}> is not considered viable; force anyway?`) === 'y')
            return destination;
    }
    await plineWithContinuation(`${mode === 'random' ? 'Picking random' : 'Using derived'} destination.`);
    return null;
}
function wizardStairway(state, ladder, up) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (!!stair.isladder === ladder && !!stair.up === up
            && stair.tolev.dnum === state.u.uz?.dnum)
            return stair;
    }
    return null;
}
function monsterTeleportDestinationOk(monster, state, x, y, random) {
    if (!goodPosition(x, y, { kind: 'monster', monster }, {
        state, random, gpflags: GP_CHECKSCARY,
    }))
        return false;
    if (!monster.mx) {
        const migrationFlags = monster.migrationFlags ?? 0;
        const towerBoundary = state.level.downTeleportRegion?.exclude;
        if (towerBoundary?.lx && levelIsWizardTower(state))
            return !!(migrationFlags & 2) === inside(towerBoundary, x, y);
        const arrival = migrationFlags & 1
            ? state.level.upTeleportRegion : state.level.downTeleportRegion;
        if (arrival?.lx)
            return inside(arrival, x, y)
                && (!arrival.exclude?.lx || !inside(arrival.exclude, x, y));
        return true;
    }
    const roomno = state.level.at(x, y)?.roomno;
    if (shopkeeperInOwnShop(monster, state)) {
        if (roomno !== monster.eshk?.shoproom)
            return false;
    }
    else if (priestIsInOwnTemple(monster, state)) {
        const priest = monster.epri || monster.mextra?.epri;
        if (roomno !== priest?.shroom)
            return false;
    }
    return !crossesTeleportBoundary(state, monster.mx, monster.my, x, y);
}
function monsterRelocationCandidates(monster, state) {
    const centerX = Math.trunc(COLNO / 2);
    const centerY = Math.trunc(ROWNO / 2);
    const maxRadius = Math.max(centerX, centerY, COLNO - 1 - centerX, ROWNO - 1 - centerY);
    const passesWalls = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK);
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
                if (monsterAtPosition(state.level, x, y))
                    continue;
                if (!passesWalls && !ZAP_POS(state.level?.at?.(x, y)?.typ ?? -1))
                    continue;
                candidates.push({ x, y });
            }
        }
    }
    return candidates;
}
function monsterVisibleAt(monster, state, x = monster.mx, y = monster.my) {
    const inSight = !state?.viz_array
        || !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2);
    const canSeeInvisible = !!(state?.u?.seeInvisible);
    return !state?.blind && !((state.u.blindTurns ?? 0) > 0)
        && inSight && !monster.mundetected
        && (!monster.minvis || canSeeInvisible);
}
// C teleport.c:rloc_to_core(). Direct placements suppress messages by default.
export async function relocateMonsterTo(monster, x, y, { state = game, random = rn2, rollOne = rnd, calls = null, flags = RLOC_NOMSG, } = {}) {
    requireLiveGame(state);
    requireLevel(state);
    const gameWasOver = state.program_state.gameover;
    const oldx = monster.mx;
    const oldy = monster.my;
    const residentShopkeeper = monster.isshk && shopkeeperInOwnShop(monster, state);
    const relocation = { oldx, oldy, x, y, moved: oldx !== x || oldy !== y };
    if (oldx === x && oldy === y && monsterAtPosition(state.level, x, y) === monster)
        return relocation;
    let appear = !!((monster.mstrategy ?? 0) & STRAT_APPEARMSG);
    const report = !state.in_mklev && !(flags & RLOC_NOMSG)
        && (!!(flags & RLOC_MSG) || appear);
    let seenAtBothEnds = false;
    if (oldx && report && canSpotMonster(monster)) {
        seenAtBothEnds = couldsee(x, y) || canSenseMonster(monster);
        if (!seenAtBothEnds)
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} vanishes!`);
        appear = false;
    }
    const segments = monster.wormno ? monster.wormSegments?.length ?? 0 : 0;
    if (oldx) {
        if (monster.wormno)
            clearMonsterWormFromMap(monster);
        else {
            monster.mstate = (monster.mstate ?? 0) | MON_OFFMAP;
            newsym(oldx, oldy);
        }
    }
    monster.mtrack = [];
    placeMonsterAt(monster, x, y);
    updateMonsterRegions(monster, state);
    if (monster.wormno)
        placeMonsterWormTailRandomly(monster, segments, { state, random });
    const hero = state.u;
    if (hero.ustuck === monster) {
        if (hero.uswallow) {
            await placeHeroOnLevel(x, y, state);
            await checkSpecialRoom();
            await docrt();
        }
        else if (Math.abs(x - hero.ux) > 1 || Math.abs(y - hero.uy) > 1) {
            await releaseHeroFromMonster(monster, { state, rollOne });
        }
    }
    maybeUnhideAt(x, y, state);
    newsym(x, y);
    setMonsterApparentHeroPosition(monster, state, random, calls);
    if (report && (canSpotMonster(monster) || appear || hero.ustuck === monster)) {
        const distance = (x - hero.ux) ** 2 + (y - hero.uy) ** 2;
        const near = distance <= 2 ? ' next to you'
            : distance <= BOLT_LIM * BOLT_LIM ? ' close by' : '';
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_APPEARMSG;
        if (hero.ustuck === monster && (hero.ux !== hero.ux0 || hero.uy !== hero.uy0)) {
            await plineWithContinuation(`You and ${monsterName(monster, { state })} teleport together.`);
        }
        else if (seenAtBothEnds && (couldsee(x, y) || canSenseMonster(monster))) {
            const oldDistance = (oldx - hero.ux) ** 2 + (oldy - hero.uy) ** 2;
            const suffix = near || (oldDistance === distance ? ''
                : distance < oldDistance ? ' closer to you' : ' farther away');
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} vanishes and reappears${suffix}.`);
        }
        else {
            const name = monsterName(monster, {
                state, capitalized: true, article: appear ? 'a' : 'the',
            });
            await plineWithContinuation(`${name} ${appear ? 'suddenly ' : ''}${heroIsBlind(state) ? 'arrives' : 'appears'}${near}!`);
        }
    }
    if (residentShopkeeper && hasShopkeeperData(monster) && !shopkeeperInOwnShop(monster, state))
        await makeAngryShopkeeper(monster, state);
    const inventory = monster.minvent;
    const firstObject = inventory?.[0];
    if (inventory && firstObject && !costlySpot(x, y, state)) {
        const owner = findObjectOwner(firstObject, oldx, oldy, state);
        const peaceful = !owner || owner.mpeaceful;
        for (const object of inventory) {
            if (object.no_charge)
                object.no_charge = false;
            else if (owner && onBillEntry(object, owner))
                await stolenValue(object, oldx, oldy, peaceful, { silent: false, state });
        }
    }
    await stopOccupationForRelocatedMonster(monster, state);
    if (!gameWasOver && state.program_state.gameover)
        return { ...relocation, died: true };
    if (monster.mtrapped && !monster.wormno) {
        await tryMonsterTrapEscape(monster, state, {
            random,
            describeMonster: target => monsterName(target, { state, capitalized: true }),
        });
    }
    return relocation;
}
// C mon.c:mnexto(). The old square remains occupied during enexto().
export async function moveMonsterNextToHero(monster, state = game, { flags = RLOC_NONE, random = rn2, } = {}) {
    requireLiveGame(state);
    requireLevel(state);
    if (monster === state.u.usteed) {
        const oldx = monster.mx, oldy = monster.my;
        monster.mx = state.u.ux;
        monster.my = state.u.uy;
        return { oldx, oldy, x: monster.mx, y: monster.my, moved: false };
    }
    let destination = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, { state, random });
    if (!destination) {
        await dealWithMonsterOvercrowding(monster, state);
        return null;
    }
    const controlled = await controlMonsterTeleport(monster, destination, {
        state, mode: 'near', flags, random,
    });
    destination = controlled || destination;
    return await relocateMonsterTo(monster, destination.x, destination.y, {
        state, random, flags,
    });
}
// C mon.c:deal_with_overcrowding()/elemental_clog().
export async function dealWithMonsterOvercrowding(monster, state = game) {
    requirePlayingGame(state);
    requireLiveGame(state);
    requireLevel(state);
    if (!In_endgame(state.u.uz)) {
        await sendMonsterToLimbo(monster, state);
        return;
    }
    const previous = state._elementalClogMessageMove || 0;
    if (!previous || state.moves - previous > 200) {
        if (!previous || rn2(2))
            await plineWithContinuation('You feel besieged.');
        state._elementalClogMessageMove = state.moves;
    }
    const victim = overcrowdingVictim(monster, state);
    if (victim) {
        const x = victim.mx, y = victim.my;
        victim.mstate = (victim.mstate ?? 0) | MON_OBLITERATE;
        await removeMonsterFromGame(victim);
        await relocateMonsterTo(monster, x, y, { state, flags: RLOC_NONE });
    }
    else if (!Is_astralevel(state.u.uz)) {
        monster.mstate = (monster.mstate ?? 0) | MON_ENDGAME_MIGR;
        await migrateMonsterToLevel(monster, {
            ...state.u.uz, dlevel: state.u.uz.dlevel - 1,
        }, state);
    }
}
function overcrowdingVictim(arriving, state) {
    let foreignElemental = null, homeElemental = null;
    let weakest = null, other = null, pet = null;
    let lowestLevel = 0;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.mhp <= 0 || monster === arriving || !monster.mx)
            continue;
        const name = MONSTER_NAME[monster.mnum];
        if ((name !== undefined && ['Wizard of Yendor', 'Death', 'Pestilence', 'Famine'].includes(name))
            || monster.isminion || monster.emin || monster.mextra?.emin
            || monster.epri || monster.mextra?.epri
            || monster.eshk || monster.mextra?.eshk
            || monster === state.u.ustuck || monster === state.u.usteed
            || monster.minvent?.some(object => object.otyp === AMULET_OF_YENDOR))
            continue;
        if (MONSTER_SYMBOL[monster.mnum] === 31) {
            if (isHomeElemental(monster.mnum))
                homeElemental ||= monster;
            else
                foreignElemental ||= monster;
        }
        else if (!monster.mtame) {
            if (!lowestLevel || monster.m_lev < lowestLevel) {
                lowestLevel = monster.m_lev;
                weakest = monster;
            }
            else {
                other ||= monster;
            }
        }
        else {
            pet = monster;
            break;
        }
    }
    return foreignElemental || homeElemental || weakest || other || pet;
}
// C teleport.c:tele_to_rnd_pet(). Each pet gets reservoir-sampling odds;
// the chosen pet supplies exactly one candidate square, with no fallback.
export async function teleportHeroToRandomPet(state = game) {
    requirePlayingGame(state);
    let selected = null;
    let count = 0;
    for (const pet of [...state.level.monsters].reverse()) {
        if (pet.mhp <= 0 || !pet.mtame || !pet.mx
            || (pet.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        if (rn2(++count) === 0)
            selected = pet;
    }
    if (!selected || distanceToHero(selected, state) <= 1)
        return false;
    const x = selected.mx + rn2(3) - 1;
    const y = selected.my + rn2(3) - 1;
    if (!heroTeleportDestinationOk(x, y, { state }))
        return false;
    const movement = await moveHeroByTeleport(x, y, state);
    await finishTeleportArrival(movement);
    return true;
}
// C dochugw(FALSE): new arrivals have no previous-sighting exemption.
async function stopOccupationForRelocatedMonster(monster, state) {
    if (!state._occupation)
        return;
    if (!heroIsHallucinating(state)
        && (monster.mpeaceful || monsterHasNoAttacks(monster.mnum)))
        return;
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (distance > (BOLT_LIM + 1) ** 2 || !canSpotMonster(monster)
        || !couldsee(monster.mx, monster.my) || !monster.mcanmove
        || monsterIsScaredAt(monster, state, state.u.ux, state.u.uy))
        return;
    await stopHeroOccupation(state);
}
export async function clearFixedTeleportDestination(x, y, state = game, random = rn2) {
    const monster = state.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, state) &&
        (candidate.mhp ?? 1) > 0
        && ((candidate.mx === x && candidate.my === y)
            || candidate.wormSegments?.some(segment => segment.x === x && segment.y === y)));
    if (!monster)
        return { cleared: true, relocation: null };
    const oldx = monster.mx;
    const oldy = monster.my;
    const destination = findNearbyMonsterPosition(monster.mnum, monster.mx, monster.my, { state, random });
    if (!destination)
        return { cleared: false, relocation: null };
    await relocateMonsterTo(monster, destination.x, destination.y, { state, random });
    return {
        cleared: true,
        relocation: {
            monster, oldx, oldy,
            x: destination.x, y: destination.y,
        },
    };
}
function distanceToHero(monster, state) {
    return Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy));
}
async function moveLeashedMonsterNextToHero(monster, state, random) {
    if (distanceToHero(monster, state) <= 1)
        return;
    const oldx = monster.mx;
    const oldy = monster.my;
    const destination = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, { state, random });
    if (!destination)
        return;
    await relocateMonsterTo(monster, destination.x, destination.y, { state, random });
    if (state === game) {
        newsym(oldx, oldy);
        newsym(monster.mx, monster.my);
    }
}
// C apply.c:next_to_u(), used before stairs, falls, and teleportation.
export async function bringLeashedFollowers(state = game, random = rn2) {
    for (const monster of [...(state.level?.monsters || [])].reverse()) {
        if (!monster?.mleashed || (monster.mhp ?? 1) <= 0)
            continue;
        await moveLeashedMonsterNextToHero(monster, state, random);
        if (distanceToHero(monster, state) <= 1)
            continue;
        const leash = leashAttachedToMonster(monster, state);
        if (!leash || leash.cursed)
            return false;
        releaseMonsterLeash(monster, state);
        const leashedCount = requireGameLevel(state).monsters.filter(candidate => candidate.mleashed).length;
        await plineWithContinuation(`You feel ${leashedCount > 1 ? 'a' : 'the'} leash go slack.`);
    }
    const steed = state.u?.usteed;
    const steedInventory = steed?.minvent || steed?.inventory || [];
    if (steedInventory.some(object => object.otyp === AMULET_OF_YENDOR))
        return false;
    return true;
}
// C teleport_pet(): feedback may wait for input while the leash is attached.
async function teleportMonsterPet(monster, state, force, publish) {
    if (monster === state.u.usteed)
        return false;
    if (!monster.mleashed)
        return true;
    const leash = leashAttachedToMonster(monster, state);
    if (!leash) {
        await impossible(`${monsterName(monster, { state, capitalized: true })} is leashed, without a leash.`, { state });
    }
    else if (leash.cursed && !force) {
        await publishMonsterYelp(monster);
        return false;
    }
    else {
        await publish('Your leash goes slack.');
    }
    releaseMonsterLeash(monster, state);
    return true;
}
export async function teleportMonsterFromTrap(monster, trap, { state = game, calls = [], random = rn2, rollOne = rnd, publish = plineWithContinuation, } = {}) {
    requireLevel(state);
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
    if (!await teleportMonsterPet(monster, state, false, publish))
        return event;
    const subject = monsterName(monster, { state, capitalized: true });
    const fixedDestination = trap.teledest
        && isok(trap.teledest.x, trap.teledest.y);
    if (trap.once) {
        const vault = state.level.rooms.find(room => isRoom(room) && room.rtype === VAULT);
        if (vault && isRoom(vault)) {
            const square = { x: 0, y: 0 };
            if (somexyspace(vault, square)
                && goodPosition(square.x, square.y, { kind: 'monster', monster }, { state, random })) {
                event.relocation = await relocateMonsterTo(monster, square.x, square.y, { state, random, rollOne, calls });
            }
        }
        event.relocation ||= await randomMonsterRelocation(monster, { state, calls, random, rollOne, flags: RLOC_NONE });
    }
    else if (fixedDestination && trap.teledest) {
        const occupiedByHero = state.u?.ux === trap.teledest.x
            && state.u?.uy === trap.teledest.y;
        const occupiedByMonster = monsterAtPosition(state.level, trap.teledest.x, trap.teledest.y);
        if (!occupiedByHero && !occupiedByMonster) {
            event.relocation = await relocateMonsterTo(monster, trap.teledest.x, trap.teledest.y, { state, random, rollOne, calls, flags: RLOC_MSG });
        }
    }
    else {
        event.relocation = await randomMonsterRelocation(monster, { state, calls, random, rollOne, flags: RLOC_NONE });
    }
    if (event.visible) {
        await publish(`${subject} ${canSeeMonster(monster) ? 'seems disoriented.' : 'suddenly disappears!'}`);
        seeTrap(trap, state);
    }
    return event;
}
export async function moveHeroByTeleport(x, y, state = game, { allowDrag = false } = {}) {
    requirePlayingGame(state);
    requireLiveGame(state);
    requireLevel(state);
    const u = state.u;
    const oldx = u.ux;
    const oldy = u.uy;
    if (u.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(state);
    let ball = state.uball || u.uball;
    let ballActive = !!ball && ball.where !== 'free';
    let ballStillInRange = false;
    if (!ballActive || nearCapacity(state) > SLT_ENCUMBER
        || distmin(oldx, oldy, x, y) > 1)
        allowDrag = false;
    if (ballActive && ball) {
        if (ball.where !== 'inventory'
            && distmin(x, y, ball.ox, ball.oy) <= 2)
            ballStillInRange = true;
        else if (!allowDrag)
            unplaceBallAndChain(state);
    }
    clearHeroTrap(state);
    const wasSwallowed = u.uswallow;
    u.ustuck = null;
    u.uswallow = false;
    u.ux0 = oldx;
    u.uy0 = oldy;
    // Native hideunder() cannot conceal a mimic: these forms have M1_HIDE,
    // not M1_CONCEAL. u_on_newpos() then reveals every relocated hero.
    if (Upolyd(u) && MONSTER_SYMBOL[u.umonnum] === S_MIMIC)
        u.m_ap_type = M_AP_NOTHING;
    if (wasSwallowed) {
        if (heroIsPunished(state)) {
            ballActive = true;
            ballStillInRange = allowDrag = false;
        }
        await docrt();
    }
    // C teleds() moves a nearby pair before changing the hero's position.
    // Unlike walking, teleportation ignores drag_ball's cause_delay result.
    if (ballActive && (ballStillInRange || allowDrag)) {
        const plan = await beginBallAndChainMove(x, y, { state, allowDrag });
        if (plan && !plan.blocked) {
            await finishBallAndChainMove(plan, state);
        }
        else {
            ball = state.uball || u.uball;
            ballActive = !!ball && ball.where !== 'free';
            if (ballActive)
                unplaceBallAndChain(state);
        }
    }
    await placeHeroOnLevel(x, y, state);
    const oldTrap = state.level.traps.find(trap => trap.tx === oldx && trap.ty === oldy);
    if (oldTrap && is_pit(oldTrap.ttyp))
        await fillPitWithBoulderAt(oldx, oldy, state);
    const chain = state.uchain || u.uchain;
    if (ballActive && chain?.where === 'free')
        await placeBallAndChain(state);
    newsym(oldx, oldy);
    await see_monsters();
    state.vision_full_recalc = 1;
    vision_recalc(0);
    endVoluntaryMultiTurn(state);
    return { oldx, oldy, x, y };
}
function teleportSpellLevel() {
    const level = OBJECT_SPELL_LEVEL[SPE_TELEPORT_AWAY];
    if (level === undefined)
        throw new Error('Missing teleport spell level.');
    return level;
}
// C teleport.c:mlevel_tele_trap(), the MAGIC_PORTAL branch.
export async function teleportMonsterThroughPortal(monster, trap, { state = game, random = rn2, force = false, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    if (monster === state.u.ustuck)
        return null;
    if (!await teleportMonsterPet(monster, state, force, publish))
        return null;
    const seen = canSeeMonster(monster) || monster === state.u.usteed;
    if (In_endgame(state.u.uz)
        && ((monster.minvent || []).some(object => object.otyp === AMULET_OF_YENDOR)
            || isHomeElemental(monster.mnum) || random(7))) {
        if (seen && MONSTER_SYMBOL[monster.mnum] !== S_ELEMENTAL) {
            await publish(`${monsterName(monster, { state, capitalized: true })} seems to shimmer for a moment.`);
            seeTrap(trap, state);
        }
        return null;
    }
    if (seen) {
        await publish(`Suddenly, ${monsterName(monster, { state })} disappears out of sight.`);
        seeTrap(trap, state);
    }
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_TPORT_CNTRL))
        monster.mconf = 1;
    return migrateMonsterOffLevel(monster, state, trap, {
        kind: 'magic-portal-migration', mode: MIGR_PORTAL,
    });
}
// C teleport.c:mlevel_tele_trap(), the LEVEL_TELEP branch. The destination
// follows the hero's current dungeon, even for a monster with another home.
export async function teleportMonsterToRandomLevel(monster, trap, { state = game, random = rn2, rollOne = rnd, force = false, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    if (monster === state.u.ustuck)
        return null;
    if (!await teleportMonsterPet(monster, state, force, publish))
        return null;
    const seen = canSeeMonster(monster) || monster === state.u.usteed;
    const subject = () => monsterName(monster, { state, capitalized: true });
    if (In_endgame(state.u.uz) || (monster.minvent || []).some(object => object.otyp === AMULET_OF_YENDOR)) {
        if (seen)
            await publish(`${subject()} seems very disoriented for a moment.`);
        return null;
    }
    const destination = randomTeleportDepth(state, random, rollOne);
    if (destination === depth(state.u.uz, state.dungeons)) {
        if (seen)
            await publish(`${subject()} shudders for a moment.`);
        return null;
    }
    if (seen) {
        await publish(`Suddenly, ${monsterName(monster, { state })} disappears out of sight.`);
        seeTrap(trap, state);
    }
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_TPORT_CNTRL))
        monster.mconf = 1;
    return migrateMonsterOffLevel(monster, state, { ...trap, dst: levelAtDepth(destination, { state }) }, { kind: 'level-migration' });
}
//# sourceMappingURL=teleport.js.map