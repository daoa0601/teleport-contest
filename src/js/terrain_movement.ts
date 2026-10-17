import { formatFeltMessage } from './hero_speech.js';
import { monsterHasMapPosition } from './monster_location.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { classifyStatusTerrain } from './status_terrain.js';
// C hack.c:switch_terrain(), trap.c:float_up()/reset_utrap().

import {
    D_CLOSED, D_LOCKED, DISMOUNT_FELL, DISMOUNT_GENERIC, DOOR, HOLE,
    IS_OBSTRUCTED, IS_ROOM, IS_WATERWALL, Is_airlevel, Is_waterlevel,
    LAVAWALL, STATUE_TRAP, TRAPDOOR, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR,
    TT_LAVA, TT_PIT, TT_WEB, W_SADDLE, is_hole, is_pit,
} from './const.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { Trap } from './map_types.js';
import type { LevitationState } from './property_types.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { newsym, plineWithContinuation } from './display.js';
import {
    captureLevitationState, clearLevitationMasks, levitationAtWill,
    propertyIsActive, propertyIsBlocked, refreshMovementProperties,
    setPropertyTerrainBlocked,
} from './properties.js';
import { clearHeroTrap, triggerHeroTrap } from './hero_traps.js';
import { moveObject } from './floor_object.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { buriedBallNear } from './buried_object.js';
import { heroLegName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { heroIsHallucinating } from './senses.js';
import { surfaceName } from './terrain_name.js';
import { holdingMonsterName, holdingMonsterSubject } from './hero_expulsion.js';
import { heroFormSticks } from './hero_species.js';
import {
    MONSTER_FLAGS1, MONSTER_SYMBOL, monsterDigests, monsterIsAnimal, requireMonsterData,
} from './monster_data.js';
import { dismountHero, steedIsGrounded } from './steed.js';
import {
    applyHeroLiquidEffects, applyHeroLocationEffects,
} from './cmd.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { heroCanSwim } from './hack.js';

import { heroHasWaterWalking } from './armor.js';
import { heroIsPunished } from './ball.js';
import { rnd } from './rng.js';
import { loseHeroHp } from './hero_damage.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { finishTeleportArrival } from './location_effects.js';
import { gotoLevel } from './level_change.js';
import { autopickupAtHero } from './pickup.js';
import { canFallThrough } from './mklev.js';

export async function floatHeroUp(
    state: GameState = game, previous: LevitationState | null = null,
): Promise<void> {
    // World transitions (trap triggers, pickups, level changes) must run on
    // the live singleton; pure property snapshots keep an injected state.
    requireLiveGame(state);
    state.context.botl = true;
    const hero = state.u;
    // Wearing a levitation source suppresses Flying before this runs, so the
    // flight-loss feedback reads the pre-wear snapshot when the caller
    // captured one (properties.js:captureLevitationState()).
    const wasFlying = previous ? previous.flying : !!hero.flying;
    if (hero.utrap) {
        if (hero.utraptype === TT_PIT) {
            clearHeroTrap(state);
            await plineWithContinuation('You float up, out of the pit!');
            state.vision_full_recalc = 1;
            await fillPitWithBoulderAt(hero.ux, hero.uy, state);
        } else if (hero.utraptype === TT_LAVA || hero.utraptype === TT_INFLOOR) {
            await plineWithContinuation(
                `Your body pulls upward, but your ${makePlural(heroLegName(state))} are still stuck.`);
        } else if (hero.utraptype === TT_BURIEDBALL) {
            const ball = buriedBallNear(hero.ux, hero.uy, state);
            const terrain = requireGameLevel(state).requireAt(
                ball?.ox ?? hero.ux, ball?.oy ?? hero.uy,
            );
            await plineWithContinuation(
                `You feel lighter, but your ${heroLegName(state)} is still chained to the ${IS_ROOM(terrain.typ) ? 'floor' : 'ground'}.`);
        } else if (hero.utraptype === TT_WEB) {
            await plineWithContinuation(
                'You float up slightly, but you are still stuck in the web.');
        } else {
            await plineWithContinuation(
                `You float up slightly, but your ${heroLegName(state)} is still stuck.`);
        }
    } else if (hero.uinwater) {
        // C float_up() (trap.c:3975) calls spoteffects(TRUE): leaving the
        // water on the way up does consider autopickup.
        await applyHeroLocationEffects();
    } else if (hero.uswallow) {
        if (!hero.ustuck) throw new Error('A swallowed hero must have a swallowing monster.');
        await plineWithContinuation(monsterIsAnimal(hero.ustuck)
            ? `You float away from the ${surfaceName(hero.ux, hero.uy, state)}.`
            : `You spiral up into ${holdingMonsterName(hero.ustuck)}.`);
    } else if (heroIsHallucinating(state)) {
        await plineWithContinuation("Up, up, and awaaaay!  You're walking on air!");
    } else if (Is_airlevel(hero.uz)) {
        await plineWithContinuation('You gain control over your movements.');
    } else {
        await plineWithContinuation('You start to float in the air!');
    }
    const steed = hero.usteed;
    if (steed && ![5, 25].includes(requireMonsterData(MONSTER_SYMBOL, steed.mnum))
        && !(requireMonsterData(MONSTER_FLAGS1, steed.mnum) & 0x01)) {
        if (levitationAtWill(state)) {
            await plineWithContinuation(`${holdingMonsterSubject(steed)} magically floats up!`);
        } else {
            await plineWithContinuation(`You cannot stay on ${holdingMonsterName(steed)}.`);
            await dismountHero(DISMOUNT_GENERIC, { state });
        }
    }
    if (wasFlying)
        await plineWithContinuation('You are no longer able to control your flight.');
    refreshMovementProperties(state);
    state.context.botl = true;
    await reportHeroEncumbrance(state);
}

// C trap.c:float_down(hmask, emask).  The raw C bitmask arguments are kept:
// hmask clears intrinsic levitation (TIMEOUT zeroes the timeout, I_SPECIAL
// drops the blessed-potion at-will marker), emask clears extrinsic levitation
// (W_ARTI the invoked artifact; W_SADDLE is never stored in this model — the
// steed contributes through live u.usteed flags — and only suppresses the
// landing message below).  W_ART clears the carried source which keeps the
// hero aloft until a dropped invoked artifact reaches the floor.
// Equipment setters which already removed the worn source pass a
// captureLevitationState() snapshot as `previous`; without one the pre-clear
// state is captured at entry, before the masks above are applied.
export async function floatHeroDown(
    hmask = 0, emask = 0, state: GameState = game,
    previous: LevitationState | null = null,
): Promise<0 | 1> {
    // World transitions (liquid entries, trap triggers, pickups, level
    // changes) must run on the live singleton; this guard fires before any
    // property source or mask mutation.
    requireLiveGame(state);
    const hero = state.u;
    const before = previous ?? captureLevitationState(state);

    clearLevitationMasks(hmask, emask, state);
    if (propertyIsActive('levitation', state))
        return 0; // maybe another ring/potion/boots

    if (before.blockedByTerrain || before.blockedByTrap) {
        state.context.botl = true; // float_vs_flight() precedes its feedback.
        // C BLevitation: never actually levitating, so no landing effects.
        // Only a sole floor-trap hold (C BLevitation == I_SPECIAL) speaks.
        const trappedSolely = before.blockedByTrap
            && !before.blockedByTerrain && hero.utrap;
        if (trappedSolely) {
            await plineWithContinuation(
                `You are no longer trying to float up from the ${
                    floorTrapHoldName(hero)}.`);
        }
        refreshMovementProperties(state);
        await reportHeroEncumbrance(state);
        return 0;
    }

    state.context.botl = true;
    endVoluntaryMultiTurn(state); // C nomul(0)

    if (before.flyingBlocked) {
        // controlled flight is no longer overridden by levitation
        refreshMovementProperties(state);
        if (propertyIsActive('flying', state)) {
            await plineWithContinuation(
                'You have stopped levitating and are now flying.');
            refreshMovementProperties(state);
            await reportHeroEncumbrance(state);
            return 1;
        }
    }

    if (hero.uswallow) {
        await plineWithContinuation(
            `You float down, but you are still ${
                monsterDigests(hero.ustuck) ? 'swallowed' : 'engulfed'}.`);
        refreshMovementProperties(state);
        await reportHeroEncumbrance(state);
        return 1;
    }

    let ballTrap: Trap | null = null;
    if (heroIsPunished(state)) {
        const ball = state.uball || hero.uball;
        const chain = state.uchain || hero.uchain;
        if (ball && chain && ball.where !== 'inventory'
            && !requireGameLevel(state).monsters.some(monster => monsterHasMapPosition(monster, state) &&
                !monster.dead && monster.mx === ball.ox && monster.my === ball.oy)) {
            // C: is_pool() short-circuits before t_at(), so the trap under
            // the ball only exists as a pull target when it is a pit or hole.
            const ballPool = isPoolAt(ball.ox, ball.oy, state);
            const trapUnderBall = ballPool ? null
                : requireGameLevel(state).traps.find(candidate =>
                    candidate.tx === ball.ox && candidate.ty === ball.oy) || null;
            if (ballPool || (trapUnderBall
                && (is_pit(trapUnderBall.ttyp) || is_hole(trapUnderBall.ttyp)))) {
                ballTrap = trapUnderBall;
                hero.ux0 = hero.ux;
                hero.uy0 = hero.uy;
                hero.ux = ball.ox;
                hero.uy = ball.oy;
                // C movobj(uchain, uball->ox, uball->oy): shared owner
                // handles the pile unlink/relink, maybe_unhide_at, and
                // both newsym calls
                await moveObject(chain, ball.ox, ball.oy, state);
                newsym(hero.ux0, hero.uy0);
                state.vision_full_recalc = 1; // in case the hero moved
            }
        }
    }

    let noMsg = false;
    if (!propertyIsActive('flying', state)) {
        if (!hero.uswallow && hero.ustuck) {
            if (heroFormSticks(state)) {
                await plineWithContinuation(
                    `You aren't able to maintain your hold on ${
                        holdingMonsterName(hero.ustuck)}.`);
            } else {
                await plineWithContinuation(
                    `Startled, ${holdingMonsterSubject(hero.ustuck)} can no longer hold you!`);
            }
            hero.ustuck = null;
        }
        // C calls drown() and lava_effects() directly, bypassing
        // spoteffects().  Both entries run through the complete production
        // liquid owner (real teleport chooser, fire inventory handling,
        // landing spot effects); drown()'s relocations land via teleds'
        // spoteffects(TRUE) (teleport.c:568).  Either entry can kill the
        // hero (drowning, burning to a crisp); a dead hero gets no landing
        // message, trap activation, or autopickup.
        // C Wwalking macro: the boots do not count on the Plane of Water.
        if (isPoolAt(hero.ux, hero.uy, state)
            && !(heroHasWaterWalking(state) && !Is_waterlevel(hero.uz))
            && !heroCanSwim(state) && !hero.uinwater) {
            const liquid = await applyHeroLiquidEffects(
                plineWithContinuation, { entry: 'float-down' });
            if (liquid?.died || state.program_state?.gameover) return 1;
            noMsg = !!liquid?.moved; // C drown(): TRUE after relocation or rescue
        }
        const location = requireGameLevel(state).requireAt(hero.ux, hero.uy);
        if (isLavaAt(hero.ux, hero.uy, state) && !state.iflags?.in_lava_effects) {
            const lava = await applyHeroLiquidEffects(
                plineWithContinuation, { entry: 'float-down' });
            if (lava?.died || state.program_state?.gameover) return 1;
            noMsg = true;
        }
    }

    let trap = ballTrap;
    if (!trap) {
        trap = requireGameLevel(state).traps.find(candidate =>
            candidate.tx === hero.ux && candidate.ty === hero.uy) || null;
        if (Is_airlevel(hero.uz)) {
            await plineWithContinuation('You begin to tumble in place.');
        } else if (Is_waterlevel(hero.uz) && !noMsg) {
            await plineWithContinuation(formatFeltMessage('heavier.', state));
            /* u.uinwater messages already in spoteffects()/drown() */
        } else if (!hero.uinwater && !noMsg && !(emask & W_SADDLE)) {
            if (requireGameLevel(state).flags.sokoban_rules && trap) {
                // Sokoban air currents knock the ending levitator off her feet.
                if (heroIsHallucinating(state)) {
                    await plineWithContinuation("Bummer!  You've crashed.");
                } else {
                    await plineWithContinuation('You fall over.');
                }
                if (await loseHeroHp(rnd(2), 'dangerous winds', { state }))
                    return 1;
                if (hero.usteed) {
                    const dismount = await dismountHero(DISMOUNT_FELL, { state });
                    if (dismount.died || state.program_state?.gameover) return 1;
                }
                const contact = await selfTouchPetrifyingWeapons({
                    messageStart: 'As you fall, you', state,
                });
                if (contact.died) return 1;
            } else if (hero.usteed && !steedIsGrounded(hero.usteed, state)) {
                await plineWithContinuation(
                    'You settle more firmly in the saddle.');
            } else if (heroIsHallucinating(state)) {
                await plineWithContinuation(`Bummer!  You've ${
                    isPoolAt(hero.ux, hero.uy, state)
                        ? 'splashed down' : 'hit the ground'}.`);
            } else {
                await plineWithContinuation(
                    `You float gently to the ${surfaceName(hero.ux, hero.uy, state)}.`);
            }
        }
    }

    // Levitation gives maximum carrying capacity, so having it end can raise
    // encumbrance: after the landing messages, before traps and autopickup.
    refreshMovementProperties(state);
    await reportHeroEncumbrance(state);

    // Falling through a trap door changes the level before this returns.
    const levelBefore = { dnum: hero.uz?.dnum, dlevel: hero.uz?.dlevel };
    if (trap && trap.ttyp !== STATUE_TRAP) {
        const hole = trap.ttyp === HOLE || trap.ttyp === TRAPDOOR;
        const blocked = hole && (!canFallThrough(hero.uz) || hero.ustuck);
        if (!blocked && !hero.utrap) { // not already in the trap
            const result = await triggerHeroTrap(trap, {
                finishTeleport: finishTeleportArrival, gotoLevel,
            });
            if (result.died) return 1;
        }
    }
    if (!Is_airlevel(hero.uz) && !Is_waterlevel(hero.uz) && !hero.uswallow
        && hero.uz?.dnum === levelBefore.dnum
        && hero.uz?.dlevel === levelBefore.dlevel)
        await autopickupAtHero();
    return 1;
}

// C trap.c:float_down() floor-trap hold names, keyed by u.utraptype.
function floorTrapHoldName(hero: Pick<Hero, 'utraptype'>): string {
    if (hero.utraptype === TT_BEARTRAP) return "trap's jaws";
    if (hero.utraptype === TT_WEB) return 'web';
    if (hero.utraptype === TT_BURIEDBALL) return 'chain';
    if (hero.utraptype === TT_LAVA) return 'lava';
    return 'ground'; // TT_INFLOOR
}

export async function resetHeroTrap(message = true, state: GameState = game): Promise<void> {
    const wasLevitating = propertyIsActive('levitation', state);
    const wasFlying = propertyIsActive('flying', state);
    clearHeroTrap(state);
    if (message) {
        if (!wasLevitating && propertyIsActive('levitation', state))
            await floatHeroUp(state);
        if (!wasFlying && propertyIsActive('flying', state))
            await plineWithContinuation('You can fly.');
    }
}

// hack.c:set_uinwater(). Entering or leaving water also changes terrain
// properties and the optional terrain status, even on the same square.
export async function setHeroInWater(inWater: boolean, state: GameState = game): Promise<void> {
    if (!!state.u.uinwater === inWater) return;
    state.u.uinwater = inWater ? 1 : 0;
    await switchHeroTerrain(state);
}

export async function switchHeroTerrain(state: GameState = game): Promise<void> {
    const wasLevitating = propertyIsActive('levitation', state);
    const wasFlying = propertyIsActive('flying', state);
    const hero = state.u;
    const location = requireGameLevel(state).requireAt(hero.ux, hero.uy);
    const blocked = IS_OBSTRUCTED(location.typ)
        || (location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED)))
        || IS_WATERWALL(location.typ) || location.typ === LAVAWALL;
    if (blocked) {
        if (propertyIsActive('levitation', state))
            await plineWithContinuation("You can't levitate in here.");
        setPropertyTerrainBlocked('levitation', true, state);
    } else if (propertyIsBlocked('levitation', state)) {
        setPropertyTerrainBlocked('levitation', false, state);
        if (propertyIsActive('levitation', state) || propertyIsBlocked('levitation', state))
            await floatHeroUp(state);
    }
    if (blocked) {
        if (propertyIsActive('flying', state))
            await plineWithContinuation("You can't fly in here.");
        setPropertyTerrainBlocked('flying', true, state);
    } else if (propertyIsBlocked('flying', state)) {
        setPropertyTerrainBlocked('flying', false, state);
        refreshMovementProperties(state);
        state.context.botl = true;
        if (propertyIsActive('flying', state))
            await plineWithContinuation('You start flying.');
    }
    if (wasLevitating !== propertyIsActive('levitation', state)
        || wasFlying !== propertyIsActive('flying', state)) state.context.botl = true;
    if (state.flags.terrainstatus) classifyStatusTerrain(state);
}
