// Equipping and removing the punishment ball and chain.
// C refs: read.c punish()/unpunish().

import { W_BALL, W_CHAIN, WT_IRON_BALL_INCR } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { placeBallAndChain, setBallAndChainFelt } from './ball.js';
import { heroIsBlind } from './senses.js';
import { landFloorObject } from './floor_effects.js';
import { delobj } from './object_delete.js';
import { game, requirePlayingGame } from './gstate.js';
import { mkobj } from './mklev.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly,
} from './monster_data.js';
import { HEAVY_IRON_BALL } from './object_data.js';
import { heroMonsterForm } from './polyself.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

const BALL_CLASS = 15;
const CHAIN_CLASS = 16;

export async function punishHero(source: GameObject | null = null, state: GameState = game) {
    requirePlayingGame(state);
    const reusedBall = source?.otyp === HEAVY_IRON_BALL ? source : null;
    if (!reusedBall)
        await plineWithContinuation('You are being punished for your misbehavior!');
    const attachedBall = state.uball || state.u.uball;
    if (attachedBall) {
        await plineWithContinuation('Your iron ball gets heavier.');
        attachedBall.owt += WT_IRON_BALL_INCR * (source?.cursed ? 2 : 1);
        return;
    }
    const species = heroMonsterForm(state);
    const form = species == null ? null : { mnum: species };
    if (monsterIsAmorphous(form) || monsterIsWhirly(form) || monsterIsUnsolid(form)) {
        if (!reusedBall)
            await plineWithContinuation('A ball and chain appears, then falls away.');
        const ball = reusedBall || await mkobj(BALL_CLASS, true);
        if (state.u.uswallow) {
            const swallower = state.u.ustuck;
            if (!swallower) throw new Error('A swallowed hero has no swallowing monster');
            await addObjectToMonsterInventory(swallower, ball, state);
        } else
            await landFloorObject(ball, state.u.ux, state.u.uy, { state });
        return;
    }
    const chain = await mkobj(CHAIN_CLASS, true);
    const ball = reusedBall || await mkobj(BALL_CLASS, true);
    chain.owornmask = W_CHAIN;
    ball.owornmask = W_BALL;
    state.uchain = state.u.uchain = chain;
    state.uball = state.u.uball = ball;
    state.u.punished = true;
    if (!state.u.uswallow) {
        await placeBallAndChain(state);
        if (heroIsBlind(state)) await setBallAndChainFelt(true, state);
        newsym(state.u.ux, state.u.uy);
    }
}

export async function unpunishHero(state: GameState = game) {
    const chain = state.uchain || state.u.uchain;
    const ball = state.uball || state.u.uball;

    if (chain) {
        state.uchain = null;
        state.u.uchain = null;
        chain.owornmask = (chain.owornmask ?? 0) & ~W_CHAIN;
        await delobj(chain, state);
    }
    if (ball)
        ball.owornmask = (ball.owornmask ?? 0) & ~W_BALL;

    state.uchain = state.uball = null;
    state.u.uchain = state.u.uball = null;
    state.u.punished = false;
    return { ball, chain };
}
