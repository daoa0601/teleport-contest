// ball.js — Punishment ball-and-chain movement.
// C ref: ball.c bc_order(), move_bc(), and drag_ball().

import { game } from './gstate.js';
import { clearMapDisplay, map_object, newsym, plineWithContinuation } from './display.js';
import { place_object, remove_object } from './floor_object.js';
import { applyFloorEffects, landFloorObject } from './floor_effects.js';
import { exerciseAttribute } from './attrib.js';
import { objectIsHardHelmet } from './armor.js';
import { heroHeadName } from './body_parts.js';
import { loseHeroHp } from './hero_damage.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { canLoseInventoryObject, finishInventoryRemoval } from './hero_inventory.js';
import { unlinkObject } from './object_location.js';
import { makePlural } from './object_grammar.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { mksobj } from './mklev.js';
import { rn2, rnd } from './rng.js';
import {
    A_STR, D_CLOSED, D_LOCKED, DOOR, IS_OBSTRUCTED, W_BALL, W_CHAIN,
} from './const.js';
import { IRON_CHAIN, OBJECT_NAMES } from './object_data.js';
import { encumbranceMessage, nearCapacity, SLT_ENCUMBER, weightCapacity } from './weight.js';

export const BC_BALL = 0x01;
export const BC_CHAIN = 0x02;

export const BCPOS_DIFFER = 0;
export const BCPOS_CHAIN = 1;
export const BCPOS_BALL = 2;

export function heroIsPunished(state = game) {
    return !!(state.uball || state.u?.uball);
}

// C ball.c:drag_down(). The ball can pull the hero forward or hit from behind.
export async function dragBallDownStairs(state = game) {
    const ball = state.uball || state.u.uball;
    const weapon = state.uwep || state.u.uwep;
    const forward = carried(ball, state)
        && (weapon === ball || !weapon || rn2(3) === 0);
    if (carried(ball, state) && !isWeldedPrimary(ball, state))
        await plineWithContinuation('You lose your grip on the iron ball.');
    clearMapDisplay();

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
            exerciseAttribute(A_STR, false);
            dragChance -= 2;
        }
        if (dragChance >= rnd(6)) {
            await plineWithContinuation('The iron ball drags you downstairs!');
            if (await ballDamage(rnd(3), 'dragged downstairs by an iron ball', state))
                return true;
            exerciseAttribute(A_STR, false);
            await scatterCarriedItems(state);
        }
    }
    if (state.program_state?.gameover) return true;
    await releaseCarriedBall(state);
    return !!state.program_state?.gameover;
}

// C ball.c:ballfall(). An unwielded ball can strike the hero after a fall.
export async function fallWithIronBall(state = game) {
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

async function ballDamage(amount, killer, state) {
    if (state.u.halfPhysicalDamage) amount = Math.trunc((amount + 1) / 2);
    return loseHeroHp(amount, killer, { state });
}

async function scatterCarriedItems(state) {
    const capacity = weightCapacity(state);
    const ball = state.uball || state.u.uball;
    for (const object of [...state.inventory]) {
        if (object === ball || rnd(capacity) > object.owt
            || !canLoseInventoryObject(object, state)) continue;
        const plural = object.quan !== 1;
        const name = object.name || OBJECT_NAMES[object.otyp];
        await plineWithContinuation(
            `You drop your ${plural ? makePlural(name) : name} and `
            + `${plural ? 'they fall' : 'it falls'} down the stairs with you.`,
        );
        removeHeroEquipment(object, state);
        unlinkObject(object, state);
        await finishInventoryRemoval(object, state);
        await landFloorObject(object, state.u.ux, state.u.uy, {
            state, publish: plineWithContinuation,
        });
        if (state.program_state?.gameover) return;
    }
}

async function releaseCarriedBall(state, showMessage = false) {
    const ball = state.uball || state.u.uball;
    if (!carried(ball, state) || isWeldedPrimary(ball, state)) return;
    if (showMessage) await plineWithContinuation('Startled, you drop the iron ball.');
    const previousCapacity = nearCapacity(state);
    removeHeroEquipment(ball, state);
    unlinkObject(ball, state);
    await finishInventoryRemoval(ball, state);
    const currentCapacity = nearCapacity(state);
    state._encumbranceLevel = currentCapacity;
    const message = encumbranceMessage(previousCapacity, currentCapacity);
    if (message) await plineWithContinuation(message);
}

// C unplacebc()/placebc(): swallowing removes the floor pair but leaves a
// carried ball in the pack. Expulsion returns the chain to the hero's square.
export function unplaceBallAndChain(state = game) {
    const ball = state.uball || state.u.uball;
    const chain = state.uchain || state.u.uchain;
    if (!ball || !chain) return;
    if (!carried(ball, state)) remove_object(ball, state);
    remove_object(chain, state);
}

export async function placeBallAndChain(
    state = game, publish = plineWithContinuation,
) {
    const ball = state.uball || state.u.uball;
    const chain = state.uchain || state.u.uchain;
    if (!ball || !chain) return;
    const { ux: x, uy: y } = state.u;
    await applyFloorEffects(chain, x, y, { state, publish });
    if (carried(ball, state)) {
        state.u.bc_order = BCPOS_DIFFER;
    } else {
        await applyFloorEffects(ball, x, y, { state, publish });
        place_object(ball, x, y, state);
        state.u.bc_order = BCPOS_CHAIN;
    }
    place_object(chain, x, y, state);
    newsym(x, y);
}

export function attachBuriedBall(ball) {
    const state = game;
    if (!ball || !state.u) return false;
    const buried = state.level?.buriedObjects || [];
    const buriedIndex = buried.indexOf(ball);
    if (buriedIndex >= 0) buried.splice(buriedIndex, 1);

    const oldX = ball.ox;
    const oldY = ball.oy;
    const chain = mksobj(IRON_CHAIN, true, false);
    chain.owornmask = W_CHAIN;
    ball.owornmask = W_BALL;
    state.uchain = state.u.uchain = chain;
    state.uball = state.u.uball = ball;
    state.u.punished = true;
    place_object(ball, state.u.ux, state.u.uy);
    place_object(chain, state.u.ux, state.u.uy);
    state.u.bc_order = BCPOS_CHAIN;
    state.level.engravings = (state.level.engravings || []).filter(
        engraving => engraving.x !== oldX || engraving.y !== oldY,
    );
    newsym(oldX, oldY);
    newsym(state.u.ux, state.u.uy);
    return true;
}

function dist2(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function carried(object, state = game) {
    return object?.where === 'inventory'
        || state.inventory?.includes(object);
}

function chainRock(x, y, state = game) {
    const loc = state.level?.at(x, y);
    return !loc || IS_OBSTRUCTED(loc.typ)
        || (loc.typ === DOOR
            && ((loc.doormask || 0) & (D_CLOSED | D_LOCKED)));
}

export function ballChainOrder(state = game) {
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (!ball || !chain || carried(ball, state)
        || ball.ox !== chain.ox || ball.oy !== chain.oy)
        return BCPOS_DIFFER;
    const pile = state.level?.objects?.[ball.ox]?.[ball.oy] || [];
    for (const object of pile) {
        if (object === chain) return BCPOS_CHAIN;
        if (object === ball) return BCPOS_BALL;
    }
    return BCPOS_DIFFER;
}

function chainInMiddle(targetX, targetY, chainX, chainY, ballX, ballY) {
    return distmin(targetX, targetY, chainX, chainY) <= 1
        && distmin(chainX, chainY, ballX, ballY) <= 1;
}

function dragBothPlan(plan, targetX, targetY, state) {
    const { chain } = plan;
    const oldHeroX = state.u.ux;
    const oldHeroY = state.u.uy;
    let newChainX = oldHeroX;
    let newChainY = oldHeroY;

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
export function planBallAndChainMove(targetX, targetY, {
    state = game, allowDrag = true,
} = {}) {
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (!ball || !chain || state.u?.uswallow) return null;

    const plan = {
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
        const candidateIsNewRock = (x, y) =>
            chainRock(x, y, state) && !alreadyInRock;

        switch (dist2(targetX, targetY, ball.ox, ball.oy)) {
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
            if (dist2(targetX, targetY, chain.ox, chain.oy) === 4) {
                if (chain.oy === targetY) plan.chainx = ball.ox;
                else plan.chainy = ball.oy;
                fallBackToDrag = candidateIsNewRock(
                    plan.chainx, plan.chainy,
                );
                break;
            }
            // fall through
        case 1:
        case 0:
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
        plan.blocked = true;
        plan.blockedMessage = state.inventory?.length
            ? 'You cannot carry all that and also drag the heavy iron ball.'
            : 'You cannot drag the heavy iron ball.';
        return plan;
    }
    return dragBothPlan(plan, targetX, targetY, state);
}

export function beginBallAndChainMove(targetX, targetY, options = {}) {
    const state = options.state || game;
    const plan = planBallAndChainMove(targetX, targetY, options);
    if (!plan || plan.blocked) return plan;

    // ball.c:move_bc(before) is deliberately a no-op for a blind hero.
    // When neither attachment moves, its felt object glyph remains in hero
    // memory and is exposed as soon as the hero leaves that square.  Taking
    // the sighted remove/re-place path here would replace it with terrain.
    if (state.blind && !plan.control) {
        const pile = state.level?.objects?.[plan.chain.ox]?.[plan.chain.oy]
            || [];
        const felt = pile[0];
        if (felt === plan.chain || felt === plan.ball)
            map_object(felt, false, false);
        plan.blindUnmoved = true;
        return plan;
    }

    if (!plan.control) state.u.bc_order = ballChainOrder(state);
    const oldChainX = plan.chain.ox;
    const oldChainY = plan.chain.oy;
    const ballOnFloor = !carried(plan.ball, state);
    const oldBallX = plan.ball.ox;
    const oldBallY = plan.ball.oy;

    remove_object(plan.chain);
    newsym(oldChainX, oldChainY);
    if (ballOnFloor) {
        remove_object(plan.ball);
        newsym(oldBallX, oldBallY);
    }
    return plan;
}

export function finishBallAndChainMove(plan, state = game) {
    if (!plan || plan.blocked) return;
    if (plan.blindUnmoved) {
        // Blind move_bc(after, control=0) only refreshes bc_order; both floor
        // identities and the felt glyph stay exactly where they were.
        state.u.bc_order = ballChainOrder(state);
        return;
    }
    const ballOnFloor = !carried(plan.ball, state);
    if ((plan.control & BC_CHAIN)
        || (!plan.control && state.u.bc_order === BCPOS_CHAIN)) {
        if (ballOnFloor)
            place_object(plan.ball, plan.ballx, plan.bally);
        place_object(plan.chain, plan.chainx, plan.chainy);
    } else {
        place_object(plan.chain, plan.chainx, plan.chainy);
        if (ballOnFloor)
            place_object(plan.ball, plan.ballx, plan.bally);
    }
    state.u.bc_order = ballChainOrder(state);
    newsym(plan.chainx, plan.chainy);
    if (ballOnFloor) newsym(plan.ballx, plan.bally);

    // hack.c installs nomul(-2) only after move_bc() and spoteffects().  JS
    // has no nested scheduler inside finishMovedHero(), so recording it here
    // produces the same two automatic hero actions once that call returns.
    if (plan.causeDelay) {
        // ball.c calls nomul(-2), which installs the dragging delay and also
        // calls end_running(TRUE).  A travel command must not resume after
        // the two helpless turns have elapsed.
        state._runState = null;
        state.context.run = 0;
        state.context.mv = false;
        state.context.travel = false;
        state.context.travel1 = false;
        state.context.nopick = false;
        state._helplessTurns = 2;
        state._helplessReason = 'dragging an iron ball';
        state._helplessDoneMessage = '';
    }
}

// teleport.c:teleds() either lets drag_ball() adjust a still-nearby floor
// ball or unplaces the complete punishment pair and relocates it with the
// hero.  Keep this two-phase so the caller can update the hero coordinates
// between teleds's unplacebc() and placebc().
export function beginBallAndChainTeleport(targetX, targetY, state = game) {
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (!ball || !chain) return null;

    const ballOnFloor = !carried(ball, state);
    if (ballOnFloor && distmin(targetX, targetY, ball.ox, ball.oy) <= 2) {
        const plan = beginBallAndChainMove(targetX, targetY, {
            state, allowDrag: false,
        });
        if (plan && !plan.blocked) {
            // teleds ignores drag_ball()'s cause_delay result.
            plan.causeDelay = false;
            return { kind: 'nearby', plan };
        }
    }

    const oldChainX = chain.ox;
    const oldChainY = chain.oy;
    remove_object(chain);
    newsym(oldChainX, oldChainY);
    if (ballOnFloor) {
        const oldBallX = ball.ox;
        const oldBallY = ball.oy;
        remove_object(ball);
        newsym(oldBallX, oldBallY);
    }
    return {
        kind: 'relocate', ball, chain, ballOnFloor, targetX, targetY,
    };
}

export function finishBallAndChainTeleport(teleport, state = game) {
    if (!teleport) return;
    if (teleport.kind === 'nearby') {
        finishBallAndChainMove(teleport.plan, state);
        return;
    }
    if (teleport.ballOnFloor)
        place_object(teleport.ball, teleport.targetX, teleport.targetY);
    place_object(teleport.chain, teleport.targetX, teleport.targetY);
    state.u.bc_order = ballChainOrder(state);
    newsym(teleport.targetX, teleport.targetY);
}
