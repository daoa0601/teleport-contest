// Expulsion from an engulfing monster, including the hero's landing.
// C refs: mhitu.c expels(), mon.c unstuck(), mnexto().
import { releaseHeroFromMonster, redrawAfterRelease, moveMonsterNextToHero } from './mon.js';
import { game } from './gstate.js';
import { impossible } from './diagnostics.js';
import { monsterName } from './do_name.js';
import { heroFormSticks } from './polyself.js';
import { RLOC_NOMSG } from './const.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { AD_COLD, AD_ELEC, AT_ENGL } from './monster_attack_types.js';
import { newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { applyHeroLocationEffects } from './hack.js';
import { rnd, rn2 } from './rng.js';
import { monsterDigests, monsterEnfolds, monsterIsWhirly } from './mondata.js';
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
//# sourceMappingURL=hero_expulsion.js.map