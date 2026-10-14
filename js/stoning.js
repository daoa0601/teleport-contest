// Hero petrification from contact, corpses, and eggs.
// C refs: mondata.c touch_petrifies()/poly_when_stoned(),
// pickup.c fatal_corpse_mistake(), trap.c instapetrify(),
// potion.c make_stoned(), and timeout.c stoned_dialogue().
import { heroIsHallucinating } from './senses.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHandName } from './body_parts.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { objectQuantity } from './object_stack.js';
import { A_CHA, A_DEX, G_GENOD, KILLED_BY, KILLED_BY_AN, NEW_MOON, NO_KILLER_PREFIX, STONING, TIMEOUT, W_ARMC, W_ARMF, W_ARMG, W_ARMH, } from './const.js';
import { canSpotMonster, pline, plineWithContinuation, randomDisplayMonsterSubject, } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requireLiveGame } from './gstate.js';
import { cureHeroVomiting } from './hero_illness.js';
import { healHeroLegs } from './hero_legs.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName, requireMonsterData } from './monster_data.js';
import { AT_NONE, AT_SPIT, AT_EXPL, AT_BOOM, AT_GAZE, AT_BREA, AT_MAGC, AT_CLAW, AT_TUCH, AT_WEAP, AT_KICK, AT_BUTT, AT_HUGS, } from './monster_attack_types.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { CORPSE, EGG } from './object_data.js';
import { heroHasNoLimbs, heroIsPolymorphed, polymonHero, } from './polyself.js';
import { removeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { clearHeroSliming } from './slime.js';
import { stopHeroOccupation } from './occupation.js';
import { openingTinMaySaveHero } from './tin.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { rn2 } from './rng.js';
const PM_CHICKATRICE = 9;
const PM_COCKATRICE = 10;
const PM_MEDUSA = 284;
const PM_STONE_GOLEM = 257;
const S_GOLEM = 55;
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
export function touchPetrifies(mnum) {
    return mnum === PM_CHICKATRICE || mnum === PM_COCKATRICE;
}
export function fleshPetrifies(mnum) {
    return touchPetrifies(mnum) || mnum === PM_MEDUSA;
}
// C mhitm.c:attk_protection(). Bites cannot be insulated by worn armor.
export function contactIsProtected(attackType, wornMask, usedWeapon = false) {
    if ([AT_NONE, AT_SPIT, AT_EXPL, AT_BOOM, AT_GAZE, AT_BREA, AT_MAGC]
        .includes(attackType))
        return true;
    if ([AT_CLAW, AT_TUCH, AT_WEAP].includes(attackType))
        return usedWeapon || !!(wornMask & W_ARMG);
    if (attackType === AT_KICK)
        return !!(wornMask & W_ARMF);
    if (attackType === AT_BUTT)
        return !!(wornMask & W_ARMH);
    if (attackType === AT_HUGS)
        return (wornMask & (W_ARMC | W_ARMG)) === (W_ARMC | W_ARMG);
    return false;
}
// C uhitm.c:do_stone_u(). A successful golem transformation avoids the timer.
export async function startHeroPetrificationFromMonster(monster, state = game) {
    if (heroIsPetrifying(state) || heroResistsStoning(state))
        return false;
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const transformed = await polymonHero(PM_STONE_GOLEM);
        if (transformed.transformed)
            return false;
    }
    const unique = !!(requireMonsterData(MONSTER_GENO, monster.mnum) & G_UNIQ);
    const properName = !!(requireMonsterData(MONSTER_FLAGS2, monster.mnum) & M2_PNAME);
    const name = monsterTypeName(monster.mnum, monster.female);
    return startHeroPetrification({
        state, killer: unique && !properName ? `the ${name}` : name,
        killerFormat: unique ? KILLED_BY : KILLED_BY_AN,
    });
}
// C uhitm.c:mhitm_ad_ston(), after the ordinary hit message.
export async function applyMonsterStoningAttack(monster, { state = game, random = rn2, publish = plineWithContinuation, } = {}) {
    if (random(3) !== 0)
        return false;
    const spotted = canSpotMonster(monster);
    const hallucinating = heroIsHallucinating(state);
    const subject = () => !spotted ? 'It'
        : hallucinating ? randomDisplayMonsterSubject() : monsterSentenceSubject(monster);
    const target = () => spotted ? subject().replace(/^The /u, 'the ') : 'it';
    const deaf = heroIsDeaf(state);
    if (monster.mcan) {
        if (!deaf)
            await publish(`You hear a cough from ${target()}!`);
        return false;
    }
    const blind = heroIsBlind(state);
    if (hallucinating && !blind) {
        if (!deaf)
            await publish('You hear hissing.');
        await publish(`${subject()} appears to be blowing you a kiss...`);
    }
    else if (!deaf) {
        const name = target();
        const possessive = name === 'it' ? 'its'
            : name.endsWith('s') ? `${name}'` : `${name}'s`;
        await publish(`You hear ${possessive} hissing!`);
    }
    else if (!blind) {
        await publish(`${subject()} seems to grimace.`);
    }
    if (random(10) !== 0 && state.flags.moonphase !== NEW_MOON)
        return false;
    return startHeroPetrificationFromMonster(monster, state);
}
export function heroResistsStoning(state = game) {
    return !!state.u?.stoneResistance;
}
export function heroIsPetrifying(state = game) {
    return !!state.u?.stoned || (state.u?.stonedTurns ?? 0) > 0;
}
// C potion.c:make_stoned(). Admission belongs to the attack or command;
// replacing an active timeout must retain its original delayed killer.
export async function setHeroPetrificationTimeout(turns, { state = game, message = null, killer = null, killerFormat = KILLED_BY_AN, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (!Number.isFinite(turns))
        throw new RangeError('Petrification timeout must be finite.');
    const requested = Math.trunc(turns);
    const hero = state.u;
    const old = hero.stonedTurns ?? 0;
    hero.stonedTurns = Math.max(0, Math.min(TIMEOUT, requested));
    hero.stoned = hero.stonedTurns > 0;
    if ((requested !== 0) !== (old !== 0)) {
        state.context.botl = true;
        if (message !== null)
            await publish(message);
    }
    // Native killer bookkeeping follows the transition message's input pause.
    if (!hero.stonedTurns) {
        delete hero.stoneKiller;
        delete hero.stoneKillerFormat;
    }
    else if (!old) {
        hero.stoneKiller = killer ?? '';
        hero.stoneKillerFormat = killerFormat;
    }
}
export function startHeroPetrification({ state = game, turns = 5, killer = '', killerFormat = KILLED_BY_AN, } = {}) {
    const hero = state.u;
    if (heroIsPetrifying(state)
        || hero.stoneResistance)
        return false;
    hero.stonedTurns = turns;
    hero.stoned = turns > 0;
    if (hero.stoned)
        state.context.botl = true;
    hero.stoneKiller = killer;
    hero.stoneKillerFormat = killerFormat;
    return hero.stoned;
}
export function clearHeroPetrification(state = game) {
    const hero = state.u;
    const wasPetrifying = heroIsPetrifying(state);
    if (wasPetrifying)
        state.context.botl = true;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    delete hero.stoneKillerFormat;
    return wasPetrifying;
}
// C eat.c:fix_petrification(): the timeout stops before its cure feedback.
export async function fixHeroPetrification({ state = game } = {}) {
    if (!heroIsPetrifying(state))
        return false;
    const message = heroIsHallucinating(state)
        ? `What a pity--you just ruined a future piece of ${currentAttribute(A_CHA, state) > 15 ? 'fine ' : ''}art!`
        : 'You feel limber!';
    await setHeroPetrificationTimeout(0, { state, message });
    return true;
}
function removeHeroSpeed(state) {
    setPropertyTimeout('fast', 0, state);
    removeIntrinsicProperty('fast', state);
}
function petrificationMessage(turns, state) {
    if (turns === 5)
        return 'You are slowing down.';
    if (turns === 4) {
        return heroHasNoLimbs(state)
            ? 'Your extremities are stiffening.'
            : 'Your limbs are stiffening.';
    }
    if (turns === 3) {
        return heroHasNoLimbs(state)
            ? 'Your extremities have turned to stone.'
            : 'Your limbs have turned to stone.';
    }
    if (turns === 2)
        return 'You have turned to stone.';
    return turns === 1 ? 'You are a statue.' : null;
}
export async function advanceHeroPetrification({ state = game, publish = pline, die = finishHeroDeath, } = {}) {
    const hero = state.u;
    const turns = hero.stonedTurns ?? 0;
    if (turns <= 0)
        return { active: false, died: false };
    const message = petrificationMessage(turns, state);
    if (message)
        await publish(message);
    if (turns === 5) {
        removeHeroSpeed(state);
        if (state.multi > 0)
            endVoluntaryMultiTurn(state);
    }
    else if (turns === 4) {
        if (!openingTinMaySaveHero('stoned', state))
            await stopHeroOccupation(state, publish);
        if (state.multi > 0)
            endVoluntaryMultiTurn(state);
    }
    else if (turns === 3) {
        await stopHeroOccupation(state, publish);
        endVoluntaryMultiTurn(state);
        state._helplessTurns = 3;
        state._helplessReason = 'getting stoned';
        state._helplessDoneMessage = 'You can move again.';
        if (!hero.usteed)
            await healHeroLegs(state, { cause: 'petrification', publish });
    }
    else if (turns === 2) {
        if (hero.deafTurns !== undefined && hero.deafTurns > 0 && hero.deafTurns < 5)
            hero.deafTurns = 5;
        cureHeroVomiting(state);
        clearHeroSliming(state);
    }
    await exerciseAttribute(A_DEX, false, state);
    hero.stonedTurns = turns - 1;
    if (hero.stonedTurns > 0)
        return { active: true, died: false, turns: hero.stonedTurns };
    const killer = hero.stoneKiller || 'petrification';
    const died = await die({
        killer,
        deathCause: petrificationDeathCause(state),
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    clearHeroPetrification(state);
    return { active: false, died: !!died, turns: 0 };
}
function heroPolymorphsWhenStoned(state = game) {
    const form = state.u?.umonnum;
    return heroIsPolymorphed(state)
        && form !== undefined && MONSTER_SYMBOL[form] === S_GOLEM
        && form !== PM_STONE_GOLEM;
}
export function formCanBecomeStoneGolem(mnum, state = game) {
    const stoneGolemGenocided = !!((state.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & G_GENOD);
    return mnum !== undefined && MONSTER_SYMBOL[mnum] === S_GOLEM && mnum !== PM_STONE_GOLEM
        && !stoneGolemGenocided;
}
export async function resolveImmediatePetrification({ state = game, killer, publish = plineWithContinuation, die = finishHeroDeath, }) {
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const result = await polymonHero(PM_STONE_GOLEM);
        if (result.transformed || result.died)
            return { died: !!result.died, transformed: !!result.transformed };
    }
    await publish('You turn to stone...');
    const died = await die({
        killer,
        killerFormat: KILLED_BY,
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { died: !!died, transformed: false };
}
export function heroWouldPetrifyFromFlesh(mnum, state = game) {
    return fleshPetrifies(mnum)
        && !heroResistsStoning(state)
        && !heroPolymorphsWhenStoned(state);
}
function corpseWithArticle(object) {
    const species = corpseSpeciesName(object);
    const name = object.oextra?.oname || object.oname;
    const noun = `${species} corpse${name ? ` named ${name}` : ''}`;
    return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}
export async function selfTouchPetrifyingWeapons({ messageStart = 'No longer petrify-resistant, you', state = game, publish = pline, die = finishHeroDeath, } = {}) {
    if (heroResistsStoning(state))
        return { touched: false, died: false };
    let touched = false;
    for (let slot = 0; slot < 2; slot++) {
        const weapon = slot === 0
            ? state.uwep || state.u?.uwep
            : state.u?.twoweap
                ? state.uswapwep || state.u?.uswapwep : null;
        if (weapon?.otyp !== CORPSE || !touchPetrifies(weapon.corpsenm))
            continue;
        touched = true;
        const species = corpseSpeciesName(weapon);
        await publish(`${messageStart} touch the ${species} corpse.`);
        const result = await resolveImmediatePetrification({
            killer: corpseWithArticle(weapon),
            state, publish, die,
        });
        if (result.died)
            return { touched: true, died: true };
        if (!(state.uarmg || state.u?.uarmg) && !heroResistsStoning(state))
            await releaseWeaponSlots(weapon, state);
    }
    return { touched, died: false };
}
// C invent.c:will_feel_cockatrice()/feel_cockatrice(). Unlike picking up a
// corpse, a floor inspection only touches it when blind or explicitly forced.
export function willFeelPetrifyingCorpse(object, { forceTouch = false, state = game } = {}) {
    return (heroIsBlind(state) || forceTouch)
        && !(state.uarmg || state.u?.uarmg) && !heroResistsStoning(state)
        && object.otyp === CORPSE && touchPetrifies(object.corpsenm);
}
export async function feelPetrifyingCorpse(object, { forceTouch = false, state = game, publish = plineWithContinuation, } = {}) {
    if (!willFeelPetrifyingCorpse(object, { forceTouch, state }))
        return { touched: false, died: false };
    const quantity = objectQuantity(object);
    const noun = `${corpseSpeciesName(object)} corpse${quantity > 1 ? 's' : ''}`;
    if (formCanBecomeStoneGolem(state.u.umonnum, state))
        await publish(`You touched the ${noun} with your bare ${makePlural(heroHandName(state))}.`);
    else
        await publish(`Touching the ${noun} is a fatal mistake...`);
    const result = await resolveImmediatePetrification({
        state, publish,
        killer: `touching ${quantity === 1 ? 'a ' : ''}${noun} bare-handed`,
    });
    return { touched: true, died: result.died };
}
export async function touchPetrifyingCorpse(object, { action = 'Touching', beforeDeath = null, } = {}) {
    const gloves = game.uarmg || game.u?.uarmg;
    if (object?.otyp !== CORPSE || !touchPetrifies(object.corpsenm)
        || gloves || heroResistsStoning())
        return null;
    const corpse = corpseWithArticle(object);
    await plineWithContinuation(`${action} ${corpse} is a fatal mistake.`);
    await beforeDeath?.();
    const result = await resolveImmediatePetrification({
        killer: corpse,
        publish: plineWithContinuation,
    });
    return result.transformed && !result.died ? null : { died: result.died };
}
export async function eatPetrifyingEgg(object) {
    if (object?.otyp !== EGG || !fleshPetrifies(object.corpsenm)
        || heroResistsStoning())
        return { started: false };
    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }
    const species = corpseSpeciesName(object);
    const started = startHeroPetrification({
        killer: `${species} egg`,
    });
    return { started, transformed: false };
}
export async function hitByPetrifyingEgg(object, state = game) {
    if (object?.otyp !== EGG || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state)) {
        return { started: false, transformed: false };
    }
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }
    const started = startHeroPetrification({ state, killer: '', killerFormat: KILLED_BY });
    return { started, transformed: false };
}
function corpseSpeciesName(object) {
    if (object.corpsenm === undefined)
        throw new Error('Petrifying contact requires a corpse or egg species.');
    return requireMonsterData(MONSTER_NAME, object.corpsenm);
}
function petrificationDeathCause(state) {
    const name = state.u.stoneKiller;
    if (!name)
        return 'killed by petrification';
    const format = state.u.stoneKillerFormat;
    if (format === undefined)
        throw new Error('Petrification requires its delayed killer format.');
    if (format === NO_KILLER_PREFIX)
        return name;
    return `petrified by ${format === KILLED_BY_AN ? withIndefiniteArticle(name) : name}`;
}
//# sourceMappingURL=stoning.js.map