// Expulsion from an engulfing monster, including the hero's landing.
// C refs: mhitu.c expels(), mon.c unstuck(), mnexto().

import { game } from './gstate.js';
import { MGIVENNAME } from './const.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS2, monsterDigests, monsterIsWhirly,
    monsterTypeName,
} from './monster_data.js';
import {
    AD_COLD, AD_ELEC, AD_STCK, AD_WRAP, AT_ENGL, AT_HUGS,
} from './monster_attack_types.js';
import {
    docrt, flushPendingTopline, newsym, plineWithContinuation,
} from './display.js';
import { placeBallAndChain } from './ball.js';
import { applyHeroLocationEffects } from './cmd.js';
import { rnd, rn2 } from './rng.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { vision_recalc, vision_reset } from './vision.js';

export function holdingMonsterName(monster) {
    const givenName = MGIVENNAME(monster);
    if (givenName) return givenName;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    return MONSTER_FLAGS2[monster.mnum] & 0x00080000 ? name : `the ${name}`;
}

export function holdingMonsterSubject(monster) {
    const name = holdingMonsterName(monster);
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function releaseHeroGrip(state = game, publish = plineWithContinuation) {
    const subject = holdingMonsterSubject(state.u.ustuck);
    state.u.ustuck = null;
    await publish(`${subject} is no longer in your clutches.`);
}

export async function expelHero(monster, {
    state = game,
    message = true,
    engulfingSpecies = monster.mnum,
    publish = plineWithContinuation,
    redraw = redrawAfterRelease,
    refresh = newsym,
    random = rn2,
    rollOne = rnd,
} = {}) {
    if (!state.u.uswallow || state.u.ustuck !== monster)
        return { expelled: false };
    if (message) await publish(expulsionMessage(monster, engulfingSpecies));
    state.u.ustuck = null;
    state.u.uswallow = 0;
    state.u.uswldtim = 0;
    state.mswallower = null;
    state.u.ux = monster.mx;
    state.u.uy = monster.my;
    const chain = state.uchain || state.u.uchain;
    if (chain && chain.where !== 'floor') await placeBallAndChain(state, publish);
    state.vision_full_recalc = 1;
    await redraw();

    // C unstuck() sets the cooldown after docrt() returns, and only if the
    // monster is still capable of holding or engulfing the hero.
    const canHold = MONSTER_ATTACKS[monster.mnum].some(([type, damage]) =>
        type === AT_ENGL || type === AT_HUGS || damage === AD_STCK);
    if (!monster.mspec_used && canHold) monster.mspec_used = rollOne(2);
    const destination = findNearbyMonsterPosition(
        monster.mnum, state.u.ux, state.u.uy, { state, random },
    );
    const oldx = monster.mx;
    const oldy = monster.my;
    if (destination) {
        monster.mx = destination.x;
        monster.my = destination.y;
        monster.mtrack = [];
        state.vision_full_recalc = 1;
    }
    refresh(oldx, oldy);
    refresh(monster.mx, monster.my);
    refresh(state.u.ux, state.u.uy);
    const distance = Math.max(
        Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy),
    );
    if (distance > 1)
        await publish('Brrooaa...  You land hard at some distance.');
    const landing = await applyHeroLocationEffects(publish);
    return {
        expelled: true, died: !!landing?.died,
    };
}

function expulsionMessage(monster, mnum) {
    const body = { mnum };
    if (monsterDigests(body)) return 'You get regurgitated!';
    const name = holdingMonsterName(monster);
    const attack = MONSTER_ATTACKS[mnum].find(([type]) => type === AT_ENGL);
    if (attack?.[1] === AD_WRAP)
        return `${holdingMonsterSubject(monster)} unfolds and you are released!`;
    let effect = ' with a squelch';
    if (monsterIsWhirly(body)) {
        effect = attack?.[1] === AD_COLD ? ' in a blast of frost'
            : attack?.[1] === AD_ELEC ? ' in a shower of sparks' : '';
    }
    return `You get expelled from ${name}${effect}!`;
}

async function redrawAfterRelease() {
    await flushPendingTopline();
    vision_reset();
    vision_recalc(0);
    await docrt();
}
