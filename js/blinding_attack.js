// Blindness caused by cream pies and blinding venom.
// C refs: uhitm.c hmon_hitmon_misc_obj() and mthrowu.c m_throw()/ohitmon();
// mondata.c can_blnd() itself lives in mondata.js.
import { EYE, FACE } from './const.js';
import { heroSpecies, body_part, mbodypart } from './polyself.js';
import { heroIsBlind } from './senses.js';
import { AT_SPIT, AT_WEAP } from './monster_attack_types.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { BLINDING_VENOM, CREAM_PIE, } from './object_data.js';
import { makePlural, verbForSubject, objectName, pluralizeObjectNoun } from './objnam.js';
import { rnd } from './rng.js';
import { makeBlinded } from './potion.js';
import { plineWithContinuation } from './pline.js';
import { monsterName } from './do_name.js';
import { canBlnd, eyecount, monsterHasEyes } from './mondata.js';
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
// Part of C uhitm.c:hmon_hitmon_misc_obj(): the mcansee/mblinded
// application for a blinding hit, shared with the thrown-pie callers.
export function applyMonsterBlindness(monster, blindIncrement) {
    const wasSeeing = !!monster.mcansee;
    monster.mcansee = 0;
    monster.mblinded = Math.min(127, (monster.mblinded ?? 0) + blindIncrement);
    return { blindIncrement, wasSeeing };
}
// Part of C uhitm.c:hmon_hitmon_misc_obj(): the CREAM_PIE/BLINDING_VENOM
// impact and blinded-target messages.
export function heroBlindingObjectHitMessage(monster, object, { canBlind, state = game, thrown = false, describeTarget = () => monsterName(monster, { state }), } = {}) {
    const impact = object?.otyp === CREAM_PIE ? 'Splat!' : 'Splash!';
    if (!canBlind || heroIsBlind(state))
        return impact;
    if (object.otyp === BLINDING_VENOM) {
        return `The venom blinds ${describeTarget()}${monster.mcansee ? '' : ' further'}!`;
    }
    const target = creamPieTarget(monster, describeTarget());
    const count = object.quan ?? object.quantity ?? 1;
    const plural = thrown && count > 1;
    const noun = objectName(object, state);
    const subject = `${!thrown && count > 1 ? 'A' : 'The'} ${plural ? pluralizeObjectNoun(object, noun) : noun}`;
    return `${subject} ${plural ? 'splash' : 'splashes'} over ${target}!`;
}
// Part of C uhitm.c:hmon_hitmon_misc_obj(): the s_suffix + mbodypart FACE
// "whom" of the pie-splash message.
function creamPieTarget(monster, name) {
    const hasFace = monsterHasEyes(monster.mnum)
        && monster.mnum !== PM_FLOATING_EYE;
    if (!hasFace)
        return name;
    const face = mbodypart(monster.mnum, FACE);
    return /s$/i.test(name) ? `${name}' ${face}` : `${name}'s ${face}`;
}
// Part of C mthrowu.c:m_throw(): the blinding-venom hit message for the
// hero ("The venom blinds you." / "Your eyes sting.").
function venomBlindMessage(state, wasBlind) {
    if (!wasBlind)
        return 'The venom blinds you.';
    const eye = body_part(EYE, state);
    const eyes = eyecount(heroSpecies(state)) === 1 ? eye : makePlural(eye);
    return `Your ${eyes} ${verbForSubject(eyes, 'sting')}.`;
}
// Part of C mthrowu.c:m_throw(): the cream-pie hit message for the hero
// ("Yecch!  You've been creamed." / sticky FACE).
function creamPieBlindMessage(state, wasBlind) {
    return wasBlind
        ? `There's something sticky all over your ${body_part(FACE, state)}.`
        : "Yecch!  You've been creamed.";
}
// Part of C mthrowu.c:m_throw(): the hero-side can_blnd() check and rnd(25)
// blinding roll of a monster-thrown pie or venom.
// The impact message precedes the end of the visible missile flight.
// The impact message precedes the end of the visible missile flight.
export function prepareHeroThrownBlindness(objectType, state = game, rollOne = rnd) {
    // C mthrowu.c passes a null aggressor (magr) for a monster-thrown
    // object that hits the hero, so the raven self-check does not run.
    if (!canBlnd(null, { youmonst: true }, objectType === BLINDING_VENOM ? AT_SPIT : AT_WEAP, { otyp: objectType }, state))
        return null;
    const wasBlind = heroIsBlind(state);
    const blindIncrement = rollOne(25);
    const message = objectType === CREAM_PIE
        ? creamPieBlindMessage(state, wasBlind)
        : venomBlindMessage(state, wasBlind);
    return { blindIncrement, wasBlind, message };
}
// Part of C mthrowu.c:m_throw(): the blindinc tail — ucreamed,
// make_blinded(), and the quick-clear notice.
export async function finishHeroThrownBlindness(effect, state = game, publish = plineWithContinuation) {
    if (!effect.blindIncrement)
        return;
    state.u.ucreamed = (state.u.ucreamed ?? 0) + effect.blindIncrement;
    await makeBlinded((state.u.blindTurns ?? 0) + effect.blindIncrement, {
        state, publish, talk: false,
    });
    if (!heroIsBlind(state))
        await publish('Your vision quickly clears.');
}
//# sourceMappingURL=blinding_attack.js.map