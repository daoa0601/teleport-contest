import { formatFeltMessage } from './hero_speech.js';
import { monsterAtPosition, monsterHasMapPosition } from './monster_location.js';
import { isPoolAt } from './terrain_properties.js';
// ball.js — Punishment ball-and-chain movement.
// C ref: ball.c bc_order(), move_bc(), and drag_ball().

import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { maybeUnhideAt } from './monster_hiding.js';
import {
    cls, map_object, newsym, plineWithContinuation,
} from './display.js';
import {
    moveObject, placeObjectSynchronously, remove_object,
} from './floor_object.js';
import { applyFloorEffects, landFloorObject } from './floor_effects.js';
import { exerciseAttribute } from './attrib.js';
import { objectIsHardHelmet } from './armor.js';
import { heroHeadName } from './body_parts.js';
import { loseHeroHp } from './hero_damage.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { canLetGo, finishInventoryRemoval } from './hero_inventory.js';
import { unlinkObject } from './object_location.js';
import { makePlural } from './object_grammar.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { rn1, rn2, rnd } from './rng.js';
import {
    A_STR, BC_BALL, BC_CHAIN, D_CLOSED, D_LOCKED, DOOR, IS_OBSTRUCTED, LEFT_SIDE, POOL, RIGHT_SIDE,
    TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB,
    Is_waterlevel, is_hole, is_pit,
} from './const.js';
import { OBJECT_NAMES } from './object_data.js';
import { encumbranceMessage, nearCapacity, SLT_ENCUMBER, weightCapacity } from './weight.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind } from './senses.js';
import { heroLegName } from './body_parts.js';
import { woundHeroLegs } from './hero_legs.js';
import { clearHeroTrap } from './hero_traps.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { hitMonsterWithHeroObject } from './hero_physical_hit.js';
import { findMonsterArmorClass } from './monworn.js';
import { objectName } from './objnam.js';
import { rayMissMessage } from './ray_hit_message.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';

import { applyHeroLocationEffects } from './cmd.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation } from './map_types.js';
import type { MessagePublisher } from './display.js';

interface BallMoveGeometry {
    ball: GameObject;
    chain: GameObject;
    control: number;
    ballx: number;
    bally: number;
    chainx: number;
    chainy: number;
    causeDelay: boolean;
}
export interface BallChainMove extends BallMoveGeometry { blocked: false }
export interface BlockedBallMove extends BallMoveGeometry {
    blocked: true;
    consumedTurn: boolean;
    // Null means drag_ball already presented and resolved the interruption.
    blockedMessage: string | null;
}
export type BallMovePlan = BallChainMove | BlockedBallMove;
export interface BallMoveOptions { state?: GameState; allowDrag?: boolean }
export interface BallDropOptions { state?: GameState; publish?: MessagePublisher }

export const BCPOS_DIFFER = 0;
export const BCPOS_CHAIN = 1;
export const BCPOS_BALL = 2;

export function heroIsPunished(state: GameState = game): boolean {
    return !!(state.uball || state.u?.uball);
}

// C ball.c:drag_down(). The ball can pull the hero forward or hit from behind.
export async function dragBallDownStairs(state: GameState = game): Promise<boolean> {
    const ball = state.uball || state.u.uball;
    const weapon = state.uwep || state.u.uwep;
    const forward = carried(ball, state)
        && (weapon === ball || !weapon || rn2(3) === 0);
    if (carried(ball, state) && !isWeldedPrimary(ball, state))
        await plineWithContinuation('You lose your grip on the iron ball.');
    await cls();

    if (forward) {
        if (rn2(6)) {
            await plineWithContinuation('The iron ball drags you downstairs!');
            if (await ballDamage(rnd(6), 'dragged downstairs by an iron ball', state))
                return true;
            await scatterCarriedItems(state);
        }
    } else {
        let dragChance = 3;
        if (rn2(2)) {
            await plineWithContinuation('The iron ball smacks into you!');
            if (await ballDamage(rnd(20), 'iron ball collision', state)) return true;
            await exerciseAttribute(A_STR, false);
            dragChance -= 2;
        }
        if (dragChance >= rnd(6)) {
            await plineWithContinuation('The iron ball drags you downstairs!');
            if (await ballDamage(rnd(3), 'dragged downstairs by an iron ball', state))
                return true;
            await exerciseAttribute(A_STR, false);
            await scatterCarriedItems(state);
        }
    }
    if (state.program_state?.gameover) return true;
    await releaseCarriedBall(state);
    return !!state.program_state?.gameover;
}

// C ball.c:ballfall(). An unwielded ball can strike the hero after a fall.
export async function fallWithIronBall(state: GameState = game): Promise<boolean> {
    const ball = state.uball || state.u.uball;
    if (!ball || (carried(ball, state) && isWeldedPrimary(ball, state))) return false;
    const weapon = state.uwep || state.u.uwep;
    const hits = (ball.ox !== state.u.ux || ball.oy !== state.u.uy)
        && weapon !== ball && rn2(5) !== 0;
    await releaseCarriedBall(state, true);
    if (!hits) return false;

    let damage = rn2(7) + 25;
    await plineWithContinuation(`The iron ball falls on your ${heroHeadName(state)}.`);
    const helmet = state.uarmh || state.u.uarmh;
    if (helmet) {
        if (objectIsHardHelmet(helmet)) {
            await plineWithContinuation('Fortunately, you are wearing a hard helmet.');
            damage = 3;
        } else if (state.flags.verbose !== false) {
            await plineWithContinuation(
                `Your ${helmet.name || OBJECT_NAMES[helmet.otyp]} does not protect you.`,
            );
        }
    }
    return ballDamage(damage, 'crunched in the head by an iron ball', state);
}

async function ballDamage(amount: number, killer: string, state: GameState): Promise<boolean> {
    if (state.u.halfPhysicalDamage) amount = Math.trunc((amount + 1) / 2);
    return loseHeroHp(amount, killer, { state });
}

async function scatterCarriedItems(state: GameState): Promise<void> {
    const capacity = weightCapacity(state);
    const ball = state.uball || state.u.uball;
    for (const object of [...state.inventory]) {
        if (object === ball || rnd(capacity) > object.owt
            || !await canLetGo(object, '', state)) continue;
        const plural = object.quan !== 1;
        const name = object.name || OBJECT_NAMES[object.otyp];
        await plineWithContinuation(
            `You drop your ${plural ? makePlural(name) : name} and `
            + `${plural ? 'they fall' : 'it falls'} down the stairs with you.`,
        );
        await removeHeroEquipment(object, state);
        unlinkObject(object, state);
        await finishInventoryRemoval(object, state);
        await landFloorObject(object, state.u.ux, state.u.uy, {
            state, publish: plineWithContinuation,
        });
        if (state.program_state?.gameover) return;
    }
}

async function releaseCarriedBall(state: GameState, showMessage = false): Promise<void> {
    const ball = state.uball || state.u.uball;
    if (!ball || !carried(ball, state) || isWeldedPrimary(ball, state)) return;
    if (showMessage) await plineWithContinuation('Startled, you drop the iron ball.');
    const previousCapacity = nearCapacity(state);
    await removeHeroEquipment(ball, state);
    unlinkObject(ball, state);
    await finishInventoryRemoval(ball, state);
    const currentCapacity = nearCapacity(state);
    state._encumbranceLevel = currentCapacity;
    const message = encumbranceMessage(previousCapacity, currentCapacity);
    if (message) await plineWithContinuation(message);
}

// C unplacebc()/placebc(): swallowing removes the floor pair but leaves a
// carried ball in the pack. Expulsion returns the chain to the hero's square.
export function unplaceBallAndChain(state: GameState = game): void {
    requireLiveGame(state);
    const ball = state.uball || state.u.uball;
    const chain = state.uchain || state.u.uchain;
    if (!ball || !chain) return;
    if (state.u.uswallow) {
        if (Is_waterlevel(state.u.uz)) {
            if (!carried(ball, state)) unlinkObject(ball, state);
            unlinkObject(chain, state);
        }
        return;
    }
    if (!carried(ball, state)) {
        unlinkObject(ball, state);
        if (heroIsBlind(state) && ((state.u.bc_felt ?? 0) & BC_BALL))
            locationAt(ball.ox, ball.oy, state).remembered_glyph = state.u.bglyph;
        maybeUnhideAt(ball.ox, ball.oy, state);
        newsym(ball.ox, ball.oy);
    }
    unlinkObject(chain, state);
    if (heroIsBlind(state) && ((state.u.bc_felt ?? 0) & BC_CHAIN))
        locationAt(chain.ox, chain.oy, state).remembered_glyph = state.u.cglyph;
    maybeUnhideAt(chain.ox, chain.oy, state);
    newsym(chain.ox, chain.oy);
    state.u.bc_felt = 0;
}

// C gulpmu(): the swallowed floor pair stays FREE but follows its swallower.
export function moveSwallowedBallAndChain(monster: Monster, state: GameState = game): void {
    const ball = state.uball || state.u.uball;
    if (!ball) return;
    const chain = state.uchain || state.u.uchain;
    if (!chain) throw new Error('A swallowed punishment ball requires its chain');
    for (const object of [chain, ball]) {
        if (object.where === 'free') {
            object.ox = monster.mx;
            object.oy = monster.my;
        }
    }
}

export async function placeBallAndChain(
    state: GameState = game, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    requireLiveGame(state);
    const ball = state.uball || state.u.uball;
    const chain = state.uchain || state.u.uchain;
    if (chain && chain.where !== 'free') {
        await impossible('bc already placed?');
        return;
    }
    if (!ball || !chain) {
        await impossible('Where are your ball and chain?');
        return;
    }
    const { ux: x, uy: y } = state.u;
    await applyFloorEffects(chain, x, y, { state, publish });
    if (carried(ball, state)) {
        state.u.bc_order = BCPOS_DIFFER;
    } else {
        await applyFloorEffects(ball, x, y, { state, publish });
        placeObjectSynchronously(ball, x, y, state);
        state.u.bc_order = BCPOS_CHAIN;
    }
    placeObjectSynchronously(chain, x, y, state);
    state.u.bglyph = state.u.cglyph = rememberedGlyphAt(x, y, state);
    newsym(x, y);
}

function dist2(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

function distmin(x1: number, y1: number, x2: number, y2: number): number {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function carried(object: GameObject | null | undefined, state: GameState = game): boolean {
    return !!object && (object.where === 'inventory' || state.inventory.includes(object));
}

function chainRock(x: number, y: number, state: GameState = game): boolean {
    const loc = state.level?.at(x, y);
    return !loc || IS_OBSTRUCTED(loc.typ)
        || (loc.typ === DOOR
            && !!((loc.doormask || 0) & (D_CLOSED | D_LOCKED)));
}

// C ball.c:882-961 drop_ball().  The punished hero drops or throws her
// iron ball; the ball must already be placed at <x,y>.  When the ball left
// the hero's square, the chain drags the hero after it: a holding trap
// releases her (with its own damage for the bear trap), she lands on the
// ball's square when it is over water or a pit, otherwise one square short.
export async function dropBall(x: number, y: number, { state = game, publish = plineWithContinuation }: BallDropOptions = {}): Promise<void> {
    const level = requireGameLevel(state);
    requireLiveGame(state);
    const hero = state.u;
    const blind = heroIsBlind(state);
    if (blind) {
        hero.bc_order = await ballChainOrder(state);
        // C ball.c:888-889: remember what was under the dropped ball for
        // when the chain drags the hero away from it
        hero.bglyph = hero.bc_order
            ? hero.cglyph : rememberedGlyphAt(x, y, state);
    }

    if (x !== hero.ux || y !== hero.uy) {
        if (hero.utrap
            && hero.utraptype !== TT_INFLOOR
            && hero.utraptype !== TT_BURIEDBALL) {
            const pullmsg = 'The ball pulls you out of the ';
            if (hero.utraptype === TT_PIT) {
                await publish(`${pullmsg}pit!`);
            } else if (hero.utraptype === TT_WEB) {
                await publish(`${pullmsg}web!`);
                await publish('The web is destroyed!');
                const web = level.traps.find(candidate =>
                    candidate.tx === hero.ux && candidate.ty === hero.uy);
                if (web) level.traps.splice(
                    level.traps.indexOf(web), 1);
            } else if (hero.utraptype === TT_LAVA) {
                await publish(`${pullmsg}lava!`);
            } else if (hero.utraptype === TT_BEARTRAP) {
                const side = rn2(3) ? LEFT_SIDE : RIGHT_SIDE;
                await publish(`${pullmsg}bear trap!`);
                await woundHeroLegs(side === LEFT_SIDE ? 'left' : 'right',
                    rn1(1000, 500), state, { publish });
                if (!hero.usteed) {
                    await publish(`Your ${side === LEFT_SIDE ? 'left' : 'right'} ${
                        heroLegName(state)} is severely damaged.`);
                    let damage = 2;
                    if (hero.halfPhysicalDamage)
                        damage = Math.trunc((damage + 1) / 2);
                    if (await loseHeroHp(damage,
                        'leg damage from being pulled out of a bear trap',
                        { state, publish }))
                        return;
                }
            }
            clearHeroTrap(state);
            await fillPitWithBoulderAt(hero.ux, hero.uy, state, { publish });
        }

        hero.ux0 = hero.ux;
        hero.uy0 = hero.uy;
        const monsterOnBall = level.monsters.some(monster => monsterHasMapPosition(monster, state) &&
            !monster.dead && (monster.mhp ?? 1) > 0
            && monster.mx === x && monster.my === y);
        const trap = level.traps.find(candidate =>
            candidate.tx === x && candidate.ty === y) || null;
        if (!propertyIsActive('levitation', state) && !monsterOnBall
            && !hero.utrap
            && (isPoolAt(x, y, state)
                || (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp))))) {
            hero.ux = x;
            hero.uy = y;
        } else {
            hero.ux = x - (hero.dx ?? 0);
            hero.uy = y - (hero.dy ?? 0);
        }
        state.vision_full_recalc = 1; // hero has moved, recalc vision later

        if (blind) {
            // C ball.c:944-951: drop the remembered chain glyph where it was
            // felt, then pick up whatever the hero's new square remembers
            const chain = state.uchain || hero.uchain;
            if (chain && ((hero.bc_felt ?? 0) & BC_CHAIN)) {
                const chainLoc = locationAt(chain.ox, chain.oy, state);
                if (chainLoc) chainLoc.remembered_glyph = hero.cglyph;
            }
            hero.bc_felt = 0; // feel nothing
            hero.cglyph = hero.bc_order
                ? hero.bglyph : rememberedGlyphAt(hero.ux, hero.uy, state);
        }
        // C movobj(uchain, u.ux, u.uy): shared owner handles the pile
        // unlink/relink, maybe_unhide_at, and both newsym calls
        const chain = state.uchain || hero.uchain;
        if (chain) await moveObject(chain, hero.ux, hero.uy, state);
        if (blind) hero.bc_order = await ballChainOrder(state);
        newsym(hero.ux0, hero.uy0); // clean up old position
        if (hero.ux0 !== hero.ux || hero.uy0 !== hero.uy)
            await applyHeroLocationEffects(publish);
    }
}

// Display memory records are replaced, not mutated, by their display owners.
// Use this layer rather than glyphAt(), which can return a live actor overlay.
function rememberedGlyphAt(x: number, y: number, state: GameState): MapLocation['remembered_glyph'] {
    return locationAt(x, y, state).remembered_glyph;
}

export async function ballChainOrder(state: GameState = game): Promise<number> {
    requireLiveGame(state);
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (!ball || !chain || carried(ball, state) || state.u.uswallow
        || ball.ox !== chain.ox || ball.oy !== chain.oy)
        return BCPOS_DIFFER;
    const pile = requireGameLevel(state).objects[ball.ox]?.[ball.oy] || [];
    for (const object of pile) {
        if (object === chain) return BCPOS_CHAIN;
        if (object === ball) return BCPOS_BALL;
    }
    await impossible('bc_order:  ball&chain not in same location!');
    return BCPOS_DIFFER;
}

// C ball.c:set_bc(). Eyewear can already have changed effective sight, so
// the caller must specify whether to capture the layer beneath the pair.
export async function setBallAndChainFelt(alreadyBlind: boolean, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    const ball = state.uball || state.u.uball;
    const chain = state.uchain || state.u.uchain;
    if (!ball || !chain) throw new Error('Feeling punishment requires a ball and chain');
    const ballOnFloor = !carried(ball, state);
    const hero = state.u;
    hero.bc_order = await ballChainOrder(state);
    hero.bc_felt = ballOnFloor ? BC_BALL | BC_CHAIN : BC_CHAIN;
    if (alreadyBlind || hero.uswallow) {
        hero.cglyph = hero.bglyph = rememberedGlyphAt(hero.ux, hero.uy, state);
        return;
    }
    remove_object(chain, state);
    if (ballOnFloor) remove_object(ball, state);
    newsym(chain.ox, chain.oy);
    hero.cglyph = rememberedGlyphAt(chain.ox, chain.oy, state);
    if (hero.bc_order === BCPOS_DIFFER) {
        placeObjectSynchronously(chain, chain.ox, chain.oy, state);
        newsym(chain.ox, chain.oy);
        if (ballOnFloor) {
            newsym(ball.ox, ball.oy);
            hero.bglyph = rememberedGlyphAt(ball.ox, ball.oy, state);
            placeObjectSynchronously(ball, ball.ox, ball.oy, state);
            newsym(ball.ox, ball.oy);
        }
    } else {
        hero.bglyph = hero.cglyph;
        if (hero.bc_order === BCPOS_CHAIN) {
            placeObjectSynchronously(ball, ball.ox, ball.oy, state);
            placeObjectSynchronously(chain, chain.ox, chain.oy, state);
        } else {
            placeObjectSynchronously(chain, chain.ox, chain.oy, state);
            placeObjectSynchronously(ball, ball.ox, ball.oy, state);
        }
        newsym(ball.ox, ball.oy);
    }
}

function chainInMiddle(targetX: number, targetY: number, chainX: number, chainY: number, ballX: number, ballY: number): boolean {
    return distmin(targetX, targetY, chainX, chainY) <= 1
        && distmin(chainX, chainY, ballX, ballY) <= 1;
}

function dragBothPlan(plan: BallChainMove, targetX: number, targetY: number, state: GameState): BallChainMove {
    const { chain } = plan;
    const oldHeroX = state.u.ux;
    const oldHeroY = state.u.uy;
    let newChainX = oldHeroX;
    let newChainY = oldHeroY;

    // A teleport whose chain route meets rock cannot drag across the gap.
    if (dist2(targetX, targetY, oldHeroX, oldHeroY) > 2) {
        plan.control = BC_BALL | BC_CHAIN;
        plan.ballx = plan.chainx = targetX;
        plan.bally = plan.chainy = targetY;
        plan.causeDelay = true;
        return plan;
    }

    // ball.c keeps the chain directly between the new hero square and its
    // old square when that midpoint is usable.
    if (dist2(targetX, targetY, chain.ox, chain.oy) === 4
        && !chainRock(newChainX, newChainY, state)) {
        const midpointX = (targetX + chain.ox) / 2;
        const midpointY = (targetY + chain.oy) / 2;
        if (!chainRock(midpointX, midpointY, state)) {
            newChainX = midpointX;
            newChainY = midpointY;
        }
    }

    plan.control = BC_BALL | BC_CHAIN;
    plan.ballx = chain.ox;
    plan.bally = chain.oy;
    plan.chainx = newChainX;
    plan.chainy = newChainY;
    plan.causeDelay = true;
    return plan;
}

/**
 * Compute ball.c:drag_ball()'s floor geometry without mutating the floor
 * piles.  beginBallAndChainMove() performs move_bc(before), and
 * finishBallAndChainMove() performs move_bc(after).
 */
export function planBallAndChainMove(targetX: number, targetY: number, {
    state = game, allowDrag = true,
}: BallMoveOptions = {}): BallMovePlan | null {
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (!ball || !chain || state.u?.uswallow) return null;

    const plan: BallChainMove = {
        ball,
        chain,
        control: 0,
        ballx: ball.ox,
        bally: ball.oy,
        chainx: chain.ox,
        chainy: chain.oy,
        causeDelay: false,
        blocked: false,
    };

    // The chain already reaches the destination.  move_bc still temporarily
    // unplaces both objects so the hero and vision layers can move first.
    if (dist2(targetX, targetY, chain.ox, chain.oy) <= 2) return plan;

    // If the ball is close enough, only the chain changes squares.
    if (carried(ball, state)
        || distmin(targetX, targetY, ball.ox, ball.oy) <= 2) {
        plan.control = BC_CHAIN;
        if (carried(ball, state)) {
            if (distmin(targetX, targetY, chain.ox, chain.oy) > 1) {
                plan.chainx = state.u.ux;
                plan.chainy = state.u.uy;
            }
            return plan;
        }

        const oldChainX = chain.ox;
        const oldChainY = chain.oy;
        const alreadyInRock = chainRock(state.u.ux, state.u.uy, state)
            || chainRock(oldChainX, oldChainY, state)
            || chainRock(ball.ox, ball.oy, state);
        let fallBackToDrag = false;
        const candidateIsNewRock = (x: number, y: number) =>
            chainRock(x, y, state) && !alreadyInRock;

        const distanceToBall = dist2(targetX, targetY, ball.ox, ball.oy);
        switch (distanceToBall) {
        case 8:
            plan.chainx = (ball.ox + targetX) / 2;
            plan.chainy = (ball.oy + targetY) / 2;
            fallBackToDrag = candidateIsNewRock(plan.chainx, plan.chainy);
            break;
        case 5: {
            let firstX, firstY, secondX, secondY;
            if (Math.abs(targetX - ball.ox) === 1) {
                firstX = targetX;
                secondX = ball.ox;
                firstY = secondY = (ball.oy + targetY) / 2;
            } else {
                firstX = secondX = (ball.ox + targetX) / 2;
                firstY = targetY;
                secondY = ball.oy;
            }

            const firstRock = chainRock(firstX, firstY, state);
            const secondRock = chainRock(secondX, secondY, state);
            if (firstRock && !secondRock && !alreadyInRock) {
                if (allowDrag
                    && ((dist2(state.u.ux, state.u.uy, ball.ox, ball.oy) === 5
                        && dist2(targetX, targetY, firstX, firstY) === 1)
                    || (dist2(state.u.ux, state.u.uy, ball.ox, ball.oy) === 4
                        && dist2(targetX, targetY, firstX, firstY) === 2))) {
                    fallBackToDrag = true;
                    break;
                }
                plan.chainx = secondX;
                plan.chainy = secondY;
            } else if (!firstRock && secondRock && !alreadyInRock) {
                if (allowDrag
                    && ((dist2(state.u.ux, state.u.uy, ball.ox, ball.oy) === 5
                        && dist2(targetX, targetY, secondX, secondY) === 1)
                    || (dist2(state.u.ux, state.u.uy, ball.ox, ball.oy) === 4
                        && dist2(targetX, targetY, secondX, secondY) === 2))) {
                    fallBackToDrag = true;
                    break;
                }
                plan.chainx = firstX;
                plan.chainy = firstY;
            } else if (firstRock && secondRock && !alreadyInRock) {
                fallBackToDrag = true;
            } else {
                const firstDistance = dist2(
                    firstX, firstY, oldChainX, oldChainY,
                );
                const secondDistance = dist2(
                    secondX, secondY, oldChainX, oldChainY,
                );
                if (firstDistance < secondDistance
                    || (firstDistance === secondDistance && rn2(2))) {
                    plan.chainx = firstX;
                    plan.chainy = firstY;
                } else {
                    plan.chainx = secondX;
                    plan.chainy = secondY;
                }
            }
            break;
        }
        case 4:
            if (!chainInMiddle(
                targetX, targetY, chain.ox, chain.oy, ball.ox, ball.oy,
            )) {
                plan.chainx = (targetX + ball.ox) / 2;
                plan.chainy = (targetY + ball.oy) / 2;
                fallBackToDrag = candidateIsNewRock(
                    plan.chainx, plan.chainy,
                );
            }
            break;
        case 2:
        case 1:
        case 0:
            if (distanceToBall === 2 && dist2(targetX, targetY, chain.ox, chain.oy) === 4) {
                if (chain.oy === targetY) plan.chainx = ball.ox;
                else plan.chainy = ball.oy;
                fallBackToDrag = candidateIsNewRock(
                    plan.chainx, plan.chainy,
                );
                break;
            }
            if (chainInMiddle(
                targetX, targetY, chain.ox, chain.oy, ball.ox, ball.oy,
            )) {
                break;
            }
            if (chainInMiddle(
                targetX, targetY, state.u.ux, state.u.uy, ball.ox, ball.oy,
            )) {
                plan.chainx = state.u.ux;
                plan.chainy = state.u.uy;
            } else {
                plan.chainx = targetX;
                plan.chainy = targetY;
            }
            break;
        default:
            fallBackToDrag = true;
            break;
        }
        if (!fallBackToDrag) return plan;
    }

    if (nearCapacity(state) > SLT_ENCUMBER
        && dist2(targetX, targetY, state.u.ux, state.u.uy) <= 2) {
        return {
            ...plan, blocked: true, consumedTurn: false,
            blockedMessage: state.inventory.length
                ? 'You cannot carry all that and also drag the heavy iron ball.'
                : 'You cannot drag the heavy iron ball.',
        };
    }
    return dragBothPlan(plan, targetX, targetY, state);
}

export async function beginBallAndChainMove(targetX: number, targetY: number, options: BallMoveOptions = {}): Promise<BallMovePlan | null> {
    const state = options.state || game;
    requireLiveGame(state);
    const plan = planBallAndChainMove(targetX, targetY, options);
    if (!plan || plan.blocked) return plan;
    if (plan.control === (BC_BALL | BC_CHAIN)) {
        const { ball, chain } = plan;
        const level = requireGameLevel(state);
        const chainPullsFromWater = isPoolAt(chain.ox, chain.oy, state)
            && (level.requireAt(chain.ox, chain.oy).typ === POOL
                || !isPoolAt(ball.ox, ball.oy, state)
                || level.requireAt(ball.ox, ball.oy).typ === POOL);
        const trap = chainPullsFromWater ? null : level.traps.find(candidate =>
            candidate.tx === chain.ox && candidate.ty === chain.oy);
        if (chainPullsFromWater || trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) {
            if (propertyIsActive('levitation', state)) {
                await plineWithContinuation(formatFeltMessage('a tug from the iron ball.', state));
                if (trap) trap.tseen = true;
            } else {
                await jerkHeroBackToChain(plan, state);
                return {
                    ...plan, blocked: true, consumedTurn: true,
                    blockedMessage: null, causeDelay: false,
                };
            }
        }
    }
    await unplaceMovingBallAndChain(plan, state);
    return plan;
}

async function jerkHeroBackToChain(plan: BallChainMove, state: GameState): Promise<void> {
    const { ball, chain } = plan;
    const level = requireGameLevel(state);
    await plineWithContinuation('You are jerked back by the iron ball!');
    const victim = monsterAtPosition(level, chain.ox, chain.oy);
    if (victim) {
        const dieRoll = rnd(20);
        const luck = (state.u.uluck ?? 0) + (state.u.moreluck ?? 0);
        const threshold = -2 + luck + findMonsterArmorClass(victim)
            + rangedTargetHitBonus(ball, victim, { state, defenderNotices: true });
        if (threshold >= dieRoll) {
            const hit = await hitMonsterWithHeroObject(victim, ball, {
                mode: 'dragged', dieRoll, state, target: { x: chain.ox, y: chain.oy },
            });
            if (hit.heroDied) return;
        } else {
            await plineWithContinuation(rayMissMessage(objectName(ball, state), victim, {
                x: state.bhitpos.x, y: state.bhitpos.y, state,
            }));
        }
    }
    // Death, life saving, and displacement can each change who occupies the
    // chain square. Only an empty square lets the chain pull the hero there.
    if (!monsterAtPosition(level, chain.ox, chain.oy)) {
        state.u.ux = chain.ox;
        state.u.uy = chain.oy;
        newsym(state.u.ux0, state.u.uy0);
    }
    endVoluntaryMultiTurn(state);
    plan.control = BC_BALL;
    plan.ballx = chain.ox;
    plan.bally = chain.oy;
    plan.chainx = chain.ox;
    plan.chainy = chain.oy;
    await unplaceMovingBallAndChain(plan, state);
    await finishBallAndChainMove(plan, state);
    await applyHeroLocationEffects();
}

async function unplaceMovingBallAndChain(plan: BallChainMove, state: GameState): Promise<void> {
    if (heroIsBlind(state)) return;
    if (!plan.control) state.u.bc_order = await ballChainOrder(state);
    remove_object(plan.chain, state);
    maybeUnhideAt(plan.chain.ox, plan.chain.oy, state);
    newsym(plan.chain.ox, plan.chain.oy);
    if (!carried(plan.ball, state)) {
        remove_object(plan.ball, state);
        maybeUnhideAt(plan.ball.ox, plan.ball.oy, state);
        newsym(plan.ball.ox, plan.ball.oy);
    }
}

// C litroom() calls move_bc() around its vision refresh without moving
// either object. Preserve their pile order while removing their old glyphs.
export async function beginBallAndChainRedraw(state: GameState = game): Promise<BallChainMove | null> {
    requireLiveGame(state);
    const ball = state.uball || state.u.uball;
    if (!ball || heroIsBlind(state)) return null;
    const chain = state.uchain || state.u.uchain;
    if (!chain) throw new Error('A punished hero needs its attached chain');
    const plan: BallChainMove = {
        blocked: false, ball, chain, control: 0, causeDelay: false,
        ballx: ball.ox, bally: ball.oy, chainx: chain.ox, chainy: chain.oy,
    };
    await unplaceMovingBallAndChain(plan, state);
    return plan;
}

export async function finishBallAndChainMove(plan: BallMovePlan | null, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    if (!plan || plan.blocked) return;
    const { ball, chain, ballx, bally, chainx, chainy, control } = plan;
    const hero = state.u;
    if (heroIsBlind(state)) {
        if ((control & BC_BALL) && (control & BC_CHAIN)) {
            if ((hero.bc_felt ?? 0) & BC_BALL)
                locationAt(ball.ox, ball.oy, state).remembered_glyph = hero.bglyph;
            if ((hero.bc_felt ?? 0) & BC_CHAIN)
                locationAt(chain.ox, chain.oy, state).remembered_glyph = hero.cglyph;
            hero.bc_felt = 0;
            hero.bglyph = rememberedGlyphAt(ballx, bally, state);
            hero.cglyph = rememberedGlyphAt(chainx, chainy, state);
            await moveObject(ball, ballx, bally, state);
            await moveObject(chain, chainx, chainy, state);
        } else if (control & BC_BALL) {
            if ((hero.bc_felt ?? 0) & BC_BALL) {
                if (hero.bc_order === BCPOS_DIFFER) {
                    locationAt(ball.ox, ball.oy, state).remembered_glyph = hero.bglyph;
                } else if (hero.bc_order === BCPOS_BALL) {
                    if ((hero.bc_felt ?? 0) & BC_CHAIN) map_object(chain, false, false);
                    else locationAt(ball.ox, ball.oy, state).remembered_glyph = hero.bglyph;
                }
                hero.bc_felt = (hero.bc_felt ?? 0) & ~BC_BALL;
            }
            hero.bglyph = ballx !== chainx || bally !== chainy
                ? rememberedGlyphAt(ballx, bally, state) : hero.cglyph;
            await moveObject(ball, ballx, bally, state);
        } else if (control & BC_CHAIN) {
            if ((hero.bc_felt ?? 0) & BC_CHAIN) {
                if (hero.bc_order === BCPOS_DIFFER) {
                    locationAt(chain.ox, chain.oy, state).remembered_glyph = hero.cglyph;
                } else if (hero.bc_order === BCPOS_CHAIN) {
                    if ((hero.bc_felt ?? 0) & BC_BALL) map_object(ball, false, false);
                    else locationAt(chain.ox, chain.oy, state).remembered_glyph = hero.cglyph;
                }
                hero.bc_felt = (hero.bc_felt ?? 0) & ~BC_CHAIN;
            }
            hero.cglyph = ballx !== chainx || bally !== chainy
                ? rememberedGlyphAt(chainx, chainy, state) : hero.bglyph;
            await moveObject(chain, chainx, chainy, state);
        }
        hero.bc_order = await ballChainOrder(state);
        return;
    }
    const ballOnFloor = !carried(ball, state);
    if ((control & BC_CHAIN) || (!control && hero.bc_order === BCPOS_CHAIN)) {
        if (ballOnFloor) placeObjectSynchronously(ball, ballx, bally, state);
        placeObjectSynchronously(chain, chainx, chainy, state);
    } else {
        placeObjectSynchronously(chain, chainx, chainy, state);
        if (ballOnFloor) placeObjectSynchronously(ball, ballx, bally, state);
    }
    newsym(chainx, chainy);
    if (ballOnFloor) newsym(ballx, bally);
}

function locationAt(x: number, y: number, state: GameState): MapLocation {
    const location = requireGameLevel(state).at(x, y);
    if (!location) throw new RangeError(`Punishment square ${x},${y} is outside the map`);
    return location;
}
