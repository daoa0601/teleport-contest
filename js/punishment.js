// Equipping and removing the punishment ball and chain.
// C refs: read.c punish()/unpunish().

import { W_BALL, W_CHAIN, WT_IRON_BALL_INCR } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { heroIsPunished, placeBallAndChain } from './ball.js';
import { landFloorObject } from './floor_effects.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import { mkobj } from './mklev.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly,
} from './monster_data.js';
import { HEAVY_IRON_BALL } from './object_data.js';
import { heroMonsterForm } from './polyself.js';

const BALL_CLASS = 15;
const CHAIN_CLASS = 16;

export async function punishHero(source = null, state = game) {
    const reusedBall = source?.otyp === HEAVY_IRON_BALL ? source : null;
    if (!reusedBall)
        await plineWithContinuation('You are being punished for your misbehavior!');
    if (heroIsPunished(state)) {
        await plineWithContinuation('Your iron ball gets heavier.');
        state.uball.owt += WT_IRON_BALL_INCR * (source?.cursed ? 2 : 1);
        return;
    }
    const form = { mnum: heroMonsterForm(state) };
    if (monsterIsAmorphous(form) || monsterIsWhirly(form) || monsterIsUnsolid(form)) {
        if (!reusedBall)
            await plineWithContinuation('A ball and chain appears, then falls away.');
        const ball = reusedBall || mkobj(BALL_CLASS, true);
        if (state.u.uswallow)
            addObjectToMonsterInventory(state.u.ustuck, ball, state);
        else
            await landFloorObject(ball, state.u.ux, state.u.uy, { state });
        return;
    }
    const chain = mkobj(CHAIN_CLASS, true);
    const ball = reusedBall || mkobj(BALL_CLASS, true);
    chain.owornmask = W_CHAIN;
    ball.owornmask = W_BALL;
    state.uchain = state.u.uchain = chain;
    state.uball = state.u.uball = ball;
    state.u.punished = true;
    if (!state.u.uswallow) await placeBallAndChain(state);
}

export function unpunishHero(state = game) {
    const chain = state.uchain || state.u?.uchain;
    const ball = state.uball || state.u?.uball;

    if (chain) {
        const x = chain.ox;
        const y = chain.oy;
        remove_object(chain, state);
        chain.owornmask = (chain.owornmask ?? 0) & ~W_CHAIN;
        chain.where = 'gone';
        chain.ox = chain.oy = 0;
        if (Number.isInteger(x) && Number.isInteger(y)) newsym(x, y);
    }
    if (ball)
        ball.owornmask = (ball.owornmask ?? 0) & ~W_BALL;

    state.uchain = state.uball = null;
    if (state.u) {
        state.u.uchain = state.u.uball = null;
        state.u.punished = false;
    }
    return { ball, chain };
}
