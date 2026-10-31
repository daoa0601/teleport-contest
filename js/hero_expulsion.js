// Expulsion from an engulfing monster, including the hero's landing.
// C refs: mhitu.c expels(), mon.c unstuck(), mnexto().
import { moveMonsterNextToHero } from './teleport.js';
import { setHeroGrip } from './hero_grip.js';
import { formatFeltMessage } from './hero_speech.js';
import { game, requireLiveGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { monsterName, possessiveName } from './monster_name.js';
import { heroFormSticks } from './hero_species.js';
import { heroIsBlind } from './senses.js';
import { RLOC_NOMSG } from './const.js';
import { MONSTER_ATTACKS, monsterDigests, monsterEnfolds, monsterIsWhirly, monsterHasNoHands, } from './monster_data.js';
import { AD_COLD, AD_ELEC, AD_STCK, AT_ENGL, AT_HUGS, } from './monster_attack_types.js';
import { docrt, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { placeBallAndChain } from './ball.js';
import { applyHeroLocationEffects } from './hack.js';
import { rnd, rn2 } from './rng.js';
import { vision_reset } from './vision.js';
// C monmove.c:release_hero(). A monster can end its own hold, but cannot
// release a sticky hero's grip. Expulsion also settles the hero's landing.
export async function releaseMonsterHold(monster, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    if (state.u.ustuck !== monster)
        return false;
    if (state.u.uswallow) {
        const result = await expelHero(monster, { state, publish, random, rollOne });
        return !!result.died;
    }
    if (!heroFormSticks(state)) {
        await releaseHeroFromMonster(monster, { state, publish, rollOne });
        await publish('You get released!');
    }
    return false;
}
// C names the hero's holder with mon_nam() in every message that uses it
// (do.c drop(), trap.c float_up()/float_down(), zap.c's slow-monster
// disrupt), so engulfing priests and minions keep their "of <god>" title,
// shopkeepers their names, and invisible holders their "invisible".
export function holdingMonsterName(monster, state = game) {
    return monsterName(monster, { state });
}
export function holdingMonsterSubject(monster, state = game) {
    const name = holdingMonsterName(monster, state);
    return name.charAt(0).toUpperCase() + name.slice(1);
}
// C polyself.c:uunstick().
export async function releaseHeroGrip(state = game, publish = plineWithContinuation) {
    const holder = state.u.ustuck;
    if (!holder)
        throw new Error('Releasing the hero grip requires a held monster.');
    setHeroGrip(null, state);
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
                ? formatFeltMessage('a sudden rush of air!', state)
                : `${monsterName(monster, { state, capitalized: true })} opens its mouth!`);
        return await expelHero(monster, { state });
    }
    if (heroFormSticks(state)) {
        setHeroGrip(null, state);
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
    setHeroGrip(null, state);
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
    // C mhitu.c expels() flags the status line before its message: vpline()
    // flushes the screen (redrawing botl) before update_topl() pages the
    // still-unseen line that forced this expulsion's --More--.
    state.context.botl = true;
    if (message) {
        const line = expulsionMessage(monster, engulfingSpecies, state);
        if (line)
            await publish(line);
        else
            await impossible('Swallower has no engulfing attack?', { state });
    }
    await releaseHeroFromMonster(monster, { state, publish, redraw, rollOne });
    await moveMonsterNextToHero(monster, state, { flags: RLOC_NOMSG, random });
    if (state.program_state.gameover)
        return { expelled: true, died: true };
    // mnexto() redraws the monster; expels() then redraws only the hero.
    await refresh(state.u.ux, state.u.uy);
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
    if (!attack && !monsterEnfolds(body))
        return null;
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