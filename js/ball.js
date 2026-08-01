// ball.js — Punishment ball-and-chain movement.
// C ref: ball.c bc_order(), move_bc(), and drag_ball().

import { game } from './gstate.js';
import { map_object, newsym } from './display.js';
import { place_object, remove_object } from './mklev.js';
import { rn2 } from './rng.js';
import {
    D_CLOSED, D_LOCKED, DOOR, IS_OBSTRUCTED,
} from './const.js';
import { nearCapacity, SLT_ENCUMBER } from './weight.js';

export const BC_BALL = 0x01;
export const BC_CHAIN = 0x02;

export const BCPOS_DIFFER = 0;
export const BCPOS_CHAIN = 1;
export const BCPOS_BALL = 2;

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
