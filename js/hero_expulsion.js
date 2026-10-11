// Expulsion from an engulfing monster, including the hero's landing.
// C refs: mhitu.c expels(), mon.c unstuck(), mnexto().
import { game, requireLiveGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { monsterName, possessiveName } from './monster_name.js';
import { heroFormSticks } from './hero_species.js';
import { heroIsBlind } from './senses.js';
import { MGIVENNAME } from './const.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, monsterDigests, monsterEnfolds, monsterIsWhirly, monsterTypeName, monsterHasNoHands, } from './monster_data.js';
import { AD_COLD, AD_ELEC, AD_STCK, AT_ENGL, AT_HUGS, } from './monster_attack_types.js';
import { docrt, newsym, plineWithContinuation, } from './display.js';
import { placeBallAndChain } from './ball.js';
import { applyHeroLocationEffects } from './cmd.js';
import { rnd, rn2 } from './rng.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { vision_reset } from './vision.js';
export function holdingMonsterName(monster) {
    const givenName = MGIVENNAME(monster);
    if (givenName)
        return givenName;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    return (MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x00080000 ? name : `the ${name}`;
}
export function holdingMonsterSubject(monster) {
    const name = holdingMonsterName(monster);
    return name.charAt(0).toUpperCase() + name.slice(1);
}
export async function releaseHeroGrip(state = game, publish = plineWithContinuation) {
    const holder = state.u.ustuck;
    if (!holder)
        throw new Error('Releasing the hero grip requires a held monster.');
    state.u.ustuck = null;
    state.u.uswallow = 0;
    state.u.uswldtim = 0;
    state.context.botl = true;
    await publish(`${monsterName(holder, { state, capitalized: true })} is no longer in your clutches.`);
}
// C zap.c:release_hold(). Magical opening releases either creature's grip,
// or expels the hero with the ordinary landing effects when swallowed.
export async function releaseHold(state = game) {
    requireLiveGame(state);
    const monster = state.u.ustuck;
    if (!monster) {
        await impossible('release_hold when not held?', { state });
        return { died: false };
    }
    if (state.u.uswallow) {
        if (monsterDigests(monster))
            await plineWithContinuation(heroIsBlind(state)
                ? 'You feel a sudden rush of air!'
                : `${monsterName(monster, { state, capitalized: true })} opens its mouth!`);
        return await expelHero(monster, { state });
    }
    if (heroFormSticks(state)) {
        state.u.ustuck = null;
        await plineWithContinuation(`You release ${monsterName(monster, { state })}.`);
    }
    else {
        await releaseHeroFromMonster(monster, { state });
        const name = monsterName(monster, { state });
        await plineWithContinuation(`You are released ${monsterHasNoHands(monster.mnum)
            ? `by ${name}` : `from ${possessiveName(name)} grasp`}.`);
    }
    return { died: !!state.program_state.gameover };
}
// C mon.c:unstuck(). Release a hold without moving the monster or applying
// expulsion landing effects; death and departure use this same boundary.
export async function releaseHeroFromMonster(monster, { state = game, publish = plineWithContinuation, redraw = redrawAfterRelease, rollOne = rnd, } = {}) {
    requireLiveGame(state);
    if (state.u.ustuck !== monster)
        return;
    const swallowed = state.u.uswallow;
    state.u.ustuck = null;
    state.u.uswallow = state.uswallow = 0;
    state.u.uswldtim = 0;
    state.context.botl = true;
    if (swallowed) {
        state._monsterSwallower = null;
        state.u.ux = monster.mx;
        state.u.uy = monster.my;
        const chain = state.uchain || state.u.uchain;
        if (chain && chain.where !== 'floor')
            await placeBallAndChain(state, publish);
        state.vision_full_recalc = 1;
        await redraw();
    }
    const canHold = (MONSTER_ATTACKS[monster.mnum] ?? []).some(([type, damage]) => type === AT_ENGL || type === AT_HUGS || damage === AD_STCK);
    if (!monster.mspec_used && canHold)
        monster.mspec_used = rollOne(2);
}
export async function expelHero(monster, { state = game, message = true, engulfingSpecies = monster.mnum, publish = plineWithContinuation, redraw = redrawAfterRelease, refresh = newsym, random = rn2, rollOne = rnd, } = {}) {
    if (!state.u.uswallow || state.u.ustuck !== monster)
        return { expelled: false };
    if (message)
        await publish(expulsionMessage(monster, engulfingSpecies, state));
    await releaseHeroFromMonster(monster, { state, publish, redraw, rollOne });
    const destination = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, { state, random });
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
    const distance = Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy));
    if (distance > 1)
        await publish('Brrooaa...  You land hard at some distance.');
    const landing = await applyHeroLocationEffects(publish);
    return {
        expelled: true,
        died: !!landing?.died || !!state.program_state?.gameover,
    };
}
function expulsionMessage(monster, mnum, state) {
    const body = { mnum };
    if (monsterDigests(body))
        return 'You get regurgitated!';
    const attack = (MONSTER_ATTACKS[mnum] ?? []).find(([type]) => type === AT_ENGL);
    if (monsterEnfolds(body))
        return `${monsterName(monster, { state, capitalized: true })} unfolds and you are released!`;
    const name = monsterName(monster, { state });
    let effect = ' with a squelch';
    if (monsterIsWhirly(body)) {
        effect = attack?.[1] === AD_COLD ? ' in a blast of frost'
            : attack?.[1] === AD_ELEC ? ' in a shower of sparks' : '';
    }
    return `You get expelled from ${name}${effect}!`;
}
async function redrawAfterRelease() {
    vision_reset();
    await docrt();
}
//# sourceMappingURL=hero_expulsion.js.map