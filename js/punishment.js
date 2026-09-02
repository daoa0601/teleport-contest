// Equipping and removing the punishment ball and chain.
// C ref: read.c unpunish().

import { W_BALL, W_CHAIN } from './const.js';
import { newsym } from './display.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';

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
