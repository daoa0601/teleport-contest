// attrib.js — Hero attributes, exercise, luck, poison, and HP maxima.
// One TS module per C file: every attrib.c function lives here.
import { formatFeltMessage } from './hero_speech.js';
import { game, requirePlayingGame } from './gstate.js';
import { artifactById } from './artifacts.js';
import { plineWithContinuation } from './pline.js';
import { shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import { encumber_msg } from './pickup.js';
import { MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { monsterHasEyes, monsterHasProperName, nameToMonster } from './mondata.js';
import { definiteName, ownedSimpleObjectName, withIndefiniteArticle } from './objnam.js';
import { d, rn2, rnd } from './rng.js';
import { propertyIsActive, propertyTimeout } from './properties.js';
import { formMaximumStrength } from './polyself.js';
import { CORNUTHAUM, DUNCE_CAP, GAUNTLETS_OF_POWER, MUMMY_WRAPPING, } from './object_data.js';
import { heroFaceName } from './body_parts.js';
import { blindnessBlocked, blindfolded, isEyesOfTheOverworld } from './senses.js';
import { RACE_LEVEL_ABILITIES, ROLE_LEVEL_ABILITIES } from './innate_abilities.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_MAX, A_STR, A_WIS, DIED, FROMEXPER, FROMFORM, FROMOUTSIDE, FROMRACE, I_SPECIAL, INTRINSIC, LUCKMAX, LUCKMIN, POISONING, Upolyd, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_ART, W_ARTI, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP, } from './const.js';
import { loseHeroHp } from './hack.js';
const ATTRIBUTE_INDICES = [0, 1, 2, 3, 4, 5];
const STR25 = 125;
const MAX_EXERCISE = 50;
const PM_AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');
const S_NYMPH = 14;
const ATTRIBUTE_GAIN_WORD = [
    'strong', 'smart', 'wise', 'agile', 'tough', 'charismatic',
];
const ATTRIBUTE_LOSS_WORD = [
    'weak', 'stupid', 'foolish', 'clumsy', 'fragile', 'repulsive',
];
const ATTRIBUTE_NAME = [
    'strength', 'intelligence', 'wisdom', 'dexterity', 'constitution',
    'charisma',
];
export const ATTRIBUTE_DISPLAY_ORDER = Object.freeze([
    A_STR, A_DEX, A_CON, A_INT, A_WIS, A_CHA,
]);
// C attrib.c:change_luck(). The carried Luck bonus is separate from uluck.
export function changeHeroLuck(amount, state = game) {
    state.u.uluck = Math.max(LUCKMIN, Math.min(LUCKMAX, (state.u.uluck ?? 0) + amount));
}
function wornObject(state, slot) {
    return state?.[slot] || state?.u?.[slot] || null;
}
// Equipment changes the effective value without overwriting the base value.
export function currentAttribute(attribute, state = game) {
    requireAttributeIndex(attribute);
    const hero = state.u;
    let value = (hero.acurr?.a?.[attribute] ?? 10)
        + (hero.abon?.a?.[attribute] ?? 0) + (hero.atemp?.a?.[attribute] ?? 0);
    if (attribute === A_CHA && (hero.umonnum !== undefined && MONSTER_SYMBOL[hero.umonnum] === S_NYMPH
        || hero.umonnum === PM_AMOROUS_DEMON))
        value = Math.max(18, value);
    const [minimum, maximum] = attributeLimits(attribute, state);
    return Math.max(minimum, Math.min(maximum, value));
}
// C attrib.c:acurrstr(). Convert exceptional Strength to the 3..25 scale.
export function currentStrength(state = game) {
    const strength = currentAttribute(A_STR, state);
    if (strength <= 18)
        return Math.max(strength, 3);
    if (strength <= 121)
        return 19 + Math.trunc(strength / 50);
    return Math.min(strength, 125) - 100;
}
function attributeLimits(attribute, state) {
    if (attribute === A_STR)
        return [wornObject(state, 'uarmg')?.otyp === GAUNTLETS_OF_POWER ? STR25 : 3, STR25];
    if (attribute === A_CON
        && artifactById(wornObject(state, 'uwep')?.oartifact)?.name === 'Ogresmasher')
        return [25, 25];
    if ((attribute === A_INT || attribute === A_WIS)
        && wornObject(state, 'uarmh')?.otyp === DUNCE_CAP)
        return [6, 6];
    return [3, 25];
}
// C attrib.c:extremeattr().
export function attributeIsAtLimit(attribute, state = game) {
    requireAttributeIndex(attribute);
    const value = currentAttribute(attribute, state);
    return attributeLimits(attribute, state).includes(value);
}
export function adjustAttribute(attribute, amount, state = game) {
    requireAttributeIndex(attribute);
    const hero = state.u;
    if (!amount || hero.fixedAbilities
        || propertyIsActive('sustainAbility', state)) {
        return { changed: false, amount, fixed: true };
    }
    const helmet = wornObject(state, 'uarmh');
    if ((attribute === A_INT || attribute === A_WIS)
        && helmet?.otyp === DUNCE_CAP) {
        return { changed: false, amount, blockedByDunceCap: true };
    }
    const current = hero.acurr?.a;
    const maximum = hero.amax?.a;
    if (!Array.isArray(current) || !Array.isArray(maximum))
        return { changed: false, amount };
    const oldValue = currentAttribute(attribute, state);
    const oldBase = current[attribute];
    const oldMaximum = maximum[attribute];
    const raceMinimum = state.urace?.attrmin?.[attribute] ?? 3;
    const raceMaximum = maximumAttribute(attribute, state);
    current[attribute] += amount;
    if (amount > 0 && current[attribute] > maximum[attribute]) {
        maximum[attribute] = current[attribute];
        if (maximum[attribute] > raceMaximum) {
            current[attribute] = raceMaximum;
            maximum[attribute] = raceMaximum;
        }
    }
    else if (amount < 0 && current[attribute] < raceMinimum) {
        const excess = raceMinimum - current[attribute];
        current[attribute] = raceMinimum;
        maximum[attribute] = Math.max(raceMinimum, maximum[attribute] - rn2(excess + 1));
    }
    const newValue = currentAttribute(attribute, state);
    const changed = newValue !== oldValue;
    if (changed) {
        state.context.botl = true;
        if (!Array.isArray(hero._exercise))
            hero._exercise = [0, 0, 0, 0, 0, 0];
        hero._exercise[attribute] = 0;
    }
    return {
        changed,
        amount,
        oldValue,
        newValue,
        baseChanged: current[attribute] !== oldBase,
        maximumChanged: maximum[attribute] !== oldMaximum,
    };
}
// C attrib.h:ATTRMAX(). Only polymorphed Strength uses the creature's
// limit; every other attribute keeps the hero's racial limit.
export function maximumAttribute(attribute, state = game) {
    if (attribute === A_STR && Upolyd(state.u)) {
        const species = state.u.umonnum;
        if (species === undefined)
            throw new Error('Polymorphed Strength requires a creature form');
        return formMaximumStrength(species);
    }
    return state.urace?.attrmax[attribute] ?? 18;
}
// C attrib.c:gainstr(). Random gains use base strength even when equipment
// fixes the effective value; adjattrib's conditional message then stays quiet.
export async function gainHeroStrength(object = null, amount = 0, { state = game, giveMessage = true, } = {}) {
    if (!amount) {
        if (!state.u.acurr)
            throw new Error('Strength gain requires initialized hero attributes');
        const strength = state.u.acurr.a[A_STR];
        if (strength < 18)
            amount = rn2(4) ? 1 : rnd(6);
        else if (strength < 103)
            amount = rnd(10); // STR18(85)
        else
            amount = 1;
    }
    const change = adjustAttribute(A_STR, object?.cursed ? -amount : amount, state);
    if (change.changed) {
        if (giveMessage) {
            const message = attributeChangeMessage(A_STR, change, state);
            if (message)
                await plineWithContinuation(message);
        }
        if (state._moveloopStarted)
            await encumber_msg(state);
    }
    return change;
}
// C attrib.c:losestr(). Frailty damage can suspend or end the game before
// maximum HP and the remaining base-strength loss are committed.
export async function loseHeroStrength(amount, killer, { state = game, random = rn2, publish = plineWithContinuation, die, deathCause = null, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const minimumStrength = state.urace.attrmin[A_STR];
    const minimumHp = Math.max(hero.ulevel, 1);
    const wasPolymorphed = Upolyd(hero);
    let remainingLoss = amount;
    let reducedStrength = hero.acurr.a[A_STR] - amount;
    let damage = 0;
    while (reducedStrength < minimumStrength) {
        reducedStrength++;
        remainingLoss--;
        damage += 3 + random(4);
    }
    if (damage) {
        if (!killer) {
            killer = 'terminal frailty';
            deathCause = 'killed by terminal frailty';
        }
        if (await loseHeroHp(damage, killer, { state, publish, ...(die ? { die } : {}), deathCause }))
            return true;
        if (Upolyd(hero)) {
            hero.mhmax = Math.max(hero.mhmax - damage, 1);
            hero.mh = Math.min(hero.mh, hero.mhmax);
        }
        else if (!wasPolymorphed && hero.uhpmax > minimumHp) {
            hero.uhpmax = Math.max(hero.uhpmax - damage, minimumHp);
            hero.uhp = Math.min(hero.uhp, hero.uhpmax);
        }
        state.context.botl = true;
    }
    if (remainingLoss > 0 && (Upolyd(hero) || !wasPolymorphed)) {
        const change = adjustAttribute(A_STR, -remainingLoss, state);
        if (change.changed && state._moveloopStarted)
            await encumber_msg(state, publish);
    }
    return false;
}
const POISON_EFFECT = [
    'You feel weaker!',
    'Your brain is on fire!',
    'Your judgement is impaired!',
    "Your muscles won't obey you!",
    'You feel very sick!',
    'You break out in hives!',
];
// C attrib.c:poison_strdmg(). Both argument rolls precede this call;
// recovery from frailty completes before the independent poison damage.
export async function poisonHeroStrengthAndHp(strengthLoss, damage, killer, options = {}) {
    if (await loseHeroStrength(strengthLoss, killer, options))
        return true;
    return loseHeroHp(damage, killer, options);
}
// C attrib.c:poisontell().
export function poisonAttributeMessage(attribute, state = game, exclaim = true) {
    const punctuation = exclaim ? '!' : '.';
    if (attribute === A_STR && currentAttribute(A_STR, state) === 125)
        return formatFeltMessage(`innately weaker${punctuation}`, state);
    if (attribute === A_CON && currentAttribute(A_CON, state) === 25)
        return formatFeltMessage(`sick inside${punctuation}`, state);
    const message = POISON_EFFECT[attribute];
    if (!message)
        throw new RangeError(`Unknown poisoned attribute ${attribute}.`);
    const text = message.replace(/!$/u, punctuation);
    return text.startsWith('You feel ') ? formatFeltMessage(text.slice(9), state) : text;
}
// C attrib.c:adjuhploss(). Pending poison damage is reduced by whatever
// share of it the setuhpmax() clamping already removed from current HP.
function adjustedDamageAfterMaxHpLoss(loss, oldHp, state) {
    const hero = state.u;
    if (!Upolyd(hero) && hero.uhp < oldHp)
        loss -= oldHp - hero.uhp;
    else if (Upolyd(hero) && hero.mh < oldHp)
        loss -= oldHp - hero.mh;
    return Math.max(loss, 1);
}
// C attrib.c:poisoned().
export async function poisonHero({ reason, killer, attribute, fatal = 30, state = game, random = rn2, rollDice = d, rollOne = rnd, publish = plineWithContinuation, die = finishHeroDeath, thrownWeapon = false, }) {
    requirePlayingGame(state);
    let pagerOwned = false;
    const line = async (message) => {
        const dismissal = await publish(message);
        if (dismissal !== null && dismissal !== undefined)
            pagerOwned = true;
    };
    const blast = reason === 'blast';
    if (!blast && !/poison/iu.test(reason)) {
        const article = /^[A-Z]/u.test(reason) ? '' : 'The ';
        const verb = reason.endsWith('s') ? 'were' : 'was';
        await line(`${article}${reason} ${verb} poisoned!`);
    }
    const hero = state.u;
    const resisted = !!hero.poisonResistance;
    if (resisted) {
        if (blast)
            await shieldeff(hero.ux, hero.uy);
        await line("The poison doesn't seem to affect you.");
        return { resisted: true, died: false, pagerOwned };
    }
    // poisoned() uses the unique monster's name without an indefinite
    // article, even though its caller only supplied a species name.
    const species = nameToMonster(killer);
    const unique = species >= 0 && !!((MONSTER_GENO[species] ?? 0) & 0x1000);
    const personal = species >= 0 && monsterHasProperName(species);
    if (unique && !personal)
        killer = definiteName(killer);
    const attributedKiller = unique || /^(?:the|an?) /iu.test(killer)
        ? killer : withIndefiniteArticle(killer);
    const hpDeathCause = `killed by ${attributedKiller}`;
    const loseAttribute = async (target, amount) => {
        const change = adjustAttribute(target, amount, state);
        if (!change.changed)
            return;
        state.context.botl = true;
        // adjattrib() calls encumber_msg() before poisontell() during play.
        if (state.program_state.in_moveloop && (target === A_STR || target === A_CON))
            await encumber_msg(state, line);
        await line(poisonAttributeMessage(target, state));
    };
    const outcome = fatal
        ? random(fatal + (thrownWeapon ? 20 : 0)) : 1;
    let damage = 0;
    if (outcome === 0 && attribute !== A_CHA) {
        damage = 6 + rollDice(4, 6);
        // The pinned C code checks human health here, even while polymorphed.
        if (hero.uhp <= damage) {
            hero.uhp = -1;
            state.context.botl = true;
            await line('The poison was deadly...');
        }
        else {
            const oldHp = hero.uhp;
            const maximum = Math.max(hero.uhpmax - Math.trunc(damage / 2), hero.ulevel, 3);
            hero.uhppeak = Math.max(hero.uhppeak ?? hero.uhpmax, maximum);
            hero.uhpmax = maximum;
            hero.uhp = Math.min(hero.uhp, maximum);
            damage = adjustedDamageAfterMaxHpLoss(damage, oldHp, state);
            if (await loseHeroHp(damage, killer, { state, publish: line, die, deathCause: hpDeathCause }))
                return { damage, died: true, pagerOwned };
            const constitutionLoss = attribute === A_CON ? -3 : -1;
            await loseAttribute(A_CON, constitutionLoss);
            if (attribute !== A_CON)
                await loseAttribute(attribute, -3);
        }
    }
    else if (outcome > 5) {
        damage = thrownWeapon ? rollOne(6) : 6 + random(10);
        if ((blast || reason === 'gas cloud')
            && hero.halfGasDamage) {
            damage = Math.trunc((damage + 1) / 2);
        }
        if (await loseHeroHp(damage, killer, { state, publish: line, die, deathCause: hpDeathCause }))
            return { damage, died: true, pagerOwned };
    }
    else {
        const loss = thrownWeapon || !fatal ? 1 : rollDice(2, 2);
        await loseAttribute(attribute, -loss);
    }
    if (hero.uhp < 1 && await die({
        killer,
        deathLineShown: true,
        deathType: /poison/iu.test(killer) ? DIED : POISONING,
        deathCause: /poison/iu.test(killer) ? hpDeathCause : `poisoned by ${attributedKiller}`,
    }))
        return { damage, died: true, pagerOwned };
    await encumber_msg(state, line);
    return {
        damage,
        died: false,
        pagerOwned,
    };
}
export function attributeChangeMessage(attribute, result, state = game) {
    requireAttributeIndex(attribute);
    if (!result || result.fixed)
        return null;
    if (result.blockedByDunceCap)
        return 'Your cap constricts briefly, then relaxes again.';
    const word = result.amount > 0
        ? ATTRIBUTE_GAIN_WORD[attribute] : ATTRIBUTE_LOSS_WORD[attribute];
    if (!result.changed) {
        if (state.flags.verbose === false)
            return null;
        if (result.baseChanged || result.maximumChanged) {
            const direction = result.amount > 0 ? 'improved' : 'declined';
            return `Your innate ${ATTRIBUTE_NAME[attribute]} has ${direction}.`;
        }
        const bonus = state.u.abon?.a[attribute] ?? 0;
        const opposingBonus = result.amount > 0 ? bonus < 0 : bonus > 0;
        return `You're ${opposingBonus ? 'currently' : 'already'} as ${word} as you can get.`;
    }
    const emphasis = Math.abs(result.amount) > 1 ? 'very ' : '';
    return formatFeltMessage(`${emphasis}${word}!`, state);
}
// C attrib.c:exercise(): accumulate attribute exercise, then report
// encumbrance when Strength or Constitution can change.
export async function exerciseAttribute(attribute, improving, state = game) {
    if (!accumulateAttributeExercise(attribute, improving, state))
        return;
    if (state.moves > 0 && (attribute === A_STR || attribute === A_CON))
        await encumber_msg(state);
}
// C attrib.c:exercise() for Wisdom: exercise never calls encumber_msg().
// Knowledge and identification can therefore use the same accumulation
// rule without an input boundary.
export function exerciseWisdom(improving = true, state = game) {
    accumulateAttributeExercise(A_WIS, improving, state);
}
function accumulateAttributeExercise(attribute, improving, state) {
    requireAttributeIndex(attribute);
    const hero = state.u;
    if (attribute === A_INT || attribute === A_CHA)
        return false;
    if (Upolyd(hero) && attribute !== A_WIS)
        return false;
    if (!Array.isArray(hero._exercise))
        hero._exercise = [0, 0, 0, 0, 0, 0];
    if (Math.abs(hero._exercise[attribute] ?? 0) < MAX_EXERCISE) {
        const current = currentAttribute(attribute, state);
        const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
        hero._exercise[attribute] += amount;
    }
    return true;
}
// C attrib.c:exerchk(). Periodic accumulation runs at the caller's earlier
// boundary; this owner settles it once the hero's multi-action has ended.
export async function checkAttributeExercise(sourceTurn, state = game) {
    requirePlayingGame(state);
    if (!Number.isInteger(state._nextAttribCheck))
        state._nextAttribCheck = 600;
    const checkTurn = state._nextAttribCheck;
    if (checkTurn === undefined)
        throw new Error('Attribute exercise check has no scheduled turn');
    if (sourceTurn < checkTurn || exerciseCheckIsDeferred(state))
        return;
    const hero = state.u;
    const exercise = hero._exercise || [];
    for (const attribute of ATTRIBUTE_INDICES) {
        let accumulated = exercise[attribute] ?? 0;
        if (!accumulated)
            continue;
        const direction = Math.sign(accumulated);
        const minimum = state.urace?.attrmin?.[attribute] ?? 3;
        const maximum = Math.min(18, maximumAttribute(attribute, state));
        const base = hero.acurr.a[attribute];
        const withinLimit = direction > 0 ? base < maximum : base > minimum;
        const canExercise = attribute === A_WIS || !Upolyd(hero);
        if (withinLimit && canExercise) {
            const threshold = attribute === A_WIS ? Math.abs(accumulated)
                : Math.trunc(Math.abs(accumulated) * 2 / 3);
            if (rn2(MAX_EXERCISE) <= threshold) {
                const change = adjustAttribute(attribute, direction, state);
                if (change.changed) {
                    accumulated = 0;
                    const message = attributeChangeMessage(attribute, change, state);
                    if (message)
                        await plineWithContinuation(message);
                    if (state._moveloopStarted && (attribute === A_STR || attribute === A_CON))
                        await encumber_msg(state);
                    const explanations = EXERCISE_EXPLANATIONS[attribute];
                    if (!explanations)
                        throw new Error(`Attribute ${attribute} cannot accumulate exercise`);
                    const explanation = explanations[direction > 0 ? 0 : 1];
                    await plineWithContinuation(`You ${direction > 0 ? 'must have been' : "haven't been"} ${explanation}.`);
                }
            }
        }
        exercise[attribute] = Math.trunc(Math.abs(accumulated) / 2) * direction;
    }
    state._nextAttribCheck = checkTurn + 800 + rn2(200);
}
function exerciseCheckIsDeferred(state) {
    // C attrib.c:exerchk() runs its test whenever `moves >=
    // next_attrib_check && !multi`.  An occupation installed with multi
    // zero (spellbook study, eating, lock picking) does not defer it.
    return (state.multi ?? 0) !== 0 || !!state._runState
        || (state._helplessTurns ?? 0) > 0;
}
const SLOT_MASKS = {
    uarm: W_ARM, uarmc: W_ARMC, uarmh: W_ARMH, uarms: W_ARMS,
    uarmg: W_ARMG, uarmf: W_ARMF, uarmu: W_ARMU,
    uleft: W_RINGL, uright: W_RINGR, uamul: W_AMUL, ublindf: W_TOOL,
    uwep: W_WEP, uswapwep: W_SWAPWEP, uquiver: W_QUIVER,
};
export function intrinsicPropertyMask(property, state = game) {
    const sources = state.u._propertySources?.[property]?.intrinsic;
    return propertyTimeout(property, state)
        | (sources?.role || sources?.experience ? FROMEXPER : 0)
        | (sources?.race ? FROMRACE : 0)
        | (sources?.outside || property === 'blinded' && state.u.permaBlind ? FROMOUTSIDE : 0)
        | (sources?.form ? FROMFORM : 0)
        | (sources?.potion ? I_SPECIAL : 0);
}
export function extrinsicPropertyMask(property, state = game) {
    const sources = state.u._propertySources?.[property];
    let mask = (sources?.carried.length ? W_ART : 0) | (sources?.invoked ? W_ARTI : 0);
    for (const source of sources?.worn ?? [])
        mask |= SLOT_MASKS[source.slot];
    // Eyewear stores BLINDED directly rather than through the property list.
    if (property === 'blinded' && blindfolded(state))
        mask |= W_TOOL;
    return mask;
}
export function veryFast(state = game) {
    return !!((intrinsicPropertyMask('fast', state) & ~INTRINSIC)
        || extrinsicPropertyMask('fast', state));
}
// C attrib.c:role_abil(). The role's innate ability table for the current
// role; adjabil() and check_innate_abil() both read it.
function roleAbilities(state) {
    if (!state.urole)
        return [];
    return ROLE_LEVEL_ABILITIES[state.urole.key] ?? [];
}
// C attrib.c:check_innate_abil(). Native checks the role/race tables at the
// current level even if an outside effect removed the corresponding source
// bit. The tables are shared with adjabil.
function checkInnateAbility(property, fromMask, state) {
    const abilities = fromMask === FROMEXPER ? roleAbilities(state)
        : fromMask === FROMRACE && state.urace
            ? RACE_LEVEL_ABILITIES[state.urace.name] : undefined;
    return abilities?.find(([level, ability]) => ability === property && (state.u.ulevel ?? 0) >= level);
}
// C attrib.c:innately().
function innately(property, state) {
    const roleAbility = checkInnateAbility(property, FROMEXPER, state);
    if (roleAbility)
        return roleAbility[0] === 1 ? 'role' : 'experience';
    const raceAbility = checkInnateAbility(property, FROMRACE, state);
    if (raceAbility)
        return 'race';
    const intrinsic = intrinsicPropertyMask(property, state);
    if (intrinsic & FROMOUTSIDE)
        return 'outside';
    if (intrinsic & FROMFORM)
        return 'form';
    return 'none';
}
// C attrib.c:is_innate().
export function isInnate(property, state = game) {
    if (property === 'drainResistance' && (state.u.ulycn ?? -1) >= 0)
        return 'lycanthropy';
    if (property === 'fast' && veryFast(state))
        return 'none';
    const source = innately(property, state);
    if (source !== 'none')
        return source;
    if (property === 'jumping' && state.urole?.key === 'knight'
        && !extrinsicPropertyMask(property, state))
        return 'role';
    if (property === 'blinded' && heroHasNoEyes(state)
        || property === 'blindResistance' && (intrinsicPropertyMask(property, state) & FROMFORM))
        return 'form';
    return 'none';
}
// C attrib.c:from_what().
export function fromWhat(property, state = game, blocked = false) {
    if (!state.flags.debug)
        return '';
    if (blocked)
        return blockedProvenance(property, state);
    const source = isInnate(property, state);
    let suffix = '';
    if (property === 'blinded' && state.u.uroleplay?.blind
        || property === 'deaf' && state.u.uroleplay?.deaf)
        suffix = ' from birth';
    else if (source === 'role' || source === 'race')
        suffix = ' innately';
    else if (source === 'outside')
        suffix = ' intrinsically';
    else if (source === 'experience')
        suffix = ' because of your experience';
    else if (source === 'lycanthropy')
        suffix = ' due to your lycanthropy';
    else if (source === 'form')
        suffix = ' from your creature form';
    else if (property === 'fast' && veryFast(state)) {
        const boots = state.uarmf || state.u.uarmf;
        const extrinsic = extrinsicPropertyMask(property, state);
        const cause = propertyTimeout(property, state) ? 'a potion or spell'
            : (extrinsic & W_ARMF) && boots?.dknown && state._knownObjectTypes?.has(boots.otyp)
                ? ownedSimpleObjectName(boots, state, { capitalized: false })
                : extrinsic ? 'worn equipment' : 'something';
        suffix = ` because of ${cause}`;
    }
    else {
        const object = whatGives(property, state);
        if (object)
            suffix = ` because of ${propertyObjectName(object, state)}`;
        else if (property === 'blinded' && blindfolded(state)
            && !intrinsicPropertyMask(property, state) && !heroHasNoEyes(state)) {
            const blindfold = state.ublindf || state.u.ublindf;
            if (blindfold)
                suffix = ` because of ${ownedSimpleObjectName(blindfold, state, { capitalized: false })}`;
        }
        else if (property === 'blinded' && state.u.ucreamed
            && propertyTimeout(property, state) === state.u.ucreamed
            && !extrinsicPropertyMask(property, state)
            && intrinsicPropertyMask(property, state) === state.u.ucreamed) {
            // The native text deliberately has no leading space here.
            suffix = `due to goop covering your ${heroFaceName(state)}`;
        }
    }
    suffix = suffix.replace(/ pair of /i, ' ');
    if (property === 'strangled')
        suffix = suffix.replace(/ of strangulation.*$/i, '');
    return suffix;
}
function propertyObjectName(object, state) {
    return artifactById(object.oartifact, state)?.name.replace(/^The /, 'the ')
        ?? ownedSimpleObjectName(object, state, { capitalized: false });
}
function blockedProvenance(property, state) {
    const blindfold = state.ublindf || state.u.ublindf;
    if (property === 'blinded' && blindnessBlocked(state) && isEyesOfTheOverworld(blindfold, state)
        && blindfold)
        return ` because of ${propertyObjectName(blindfold, state)}`;
    const cloak = state.uarmc || state.u.uarmc;
    if (property === 'invisible' && cloak?.otyp === MUMMY_WRAPPING)
        return ` because of ${ownedSimpleObjectName(cloak, state, { capitalized: false })}`;
    const helmet = state.uarmh || state.u.uarmh;
    if (property === 'clairvoyant' && state.u.clairvoyanceBlocked && helmet?.otyp === CORNUTHAUM)
        return ` because of ${ownedSimpleObjectName(helmet, state, { capitalized: false })}`;
    return '';
}
export function heroHasNoEyes(state = game) {
    return !monsterHasEyes(state.u.umonnum ?? -1);
}
const DEFENSES = {
    fireResistance: 'fire', coldResistance: 'cold', antimagic: 'magic',
    poisonResistance: 'poison', drainResistance: 'life-drain',
};
const FLAGS = {
    searching: 'SPFX_SEARCH', hallucinationResistance: 'SPFX_HALRES', telepathy: 'SPFX_ESP',
    stealth: 'SPFX_STLTH', regeneration: 'SPFX_REGEN', teleportControl: 'SPFX_TCTRL',
    warnOfMonster: 'SPFX_WARN', warning: 'SPFX_WARN', energyRegeneration: 'SPFX_EREGEN',
    halfSpellDamage: 'SPFX_HSPDAM', halfPhysicalDamage: 'SPFX_HPHDAM', reflection: 'SPFX_REFLECT',
};
// The first item conveying a particular intrinsic.
// C artifact.c:abil_to_adtyp(): the C extrinsic-pointer table became the
// DEFENSES map above.
// C artifact.c:abil_to_spfx(): likewise the FLAGS map for spfx bits.
export function whatGives(property, state = game) {
    const wornmask = W_ARM | W_ARMC | W_ARMH | W_ARMS | W_ARMG | W_ARMF | W_ARMU
        | W_AMUL | W_RINGL | W_RINGR | W_TOOL | W_ART | W_ARTI
        | (state.u.twoweap ? W_SWAPWEP : 0);
    const extrinsic = extrinsicPropertyMask(property, state);
    const wornbits = wornmask & extrinsic;
    for (const object of state.inventory) {
        if (object.oartifact && (property !== 'warnOfMonster' || state.context.warntype?.obj)) {
            const artifact = artifactById(object.oartifact, state);
            if (!artifact)
                continue;
            const defense = DEFENSES[property];
            const flag = FLAGS[property];
            if (defense && (artifact.carriedDefense === defense
                || artifact.defense === defense && ((object.owornmask ?? 0) & ~(W_ART | W_ARTI))))
                return object;
            if (flag && (artifact.carriedFlags.includes(flag)
                || artifact.flags.includes(flag) && object.owornmask))
                return object;
            if (object === state.uwep && property === 'blindResistance' && (extrinsic & W_WEP))
                return object;
        }
        else if (wornbits && wornbits === (wornmask & (object.owornmask ?? 0)))
            return object;
    }
    return null;
}
const EXERCISE_EXPLANATIONS = {
    [A_STR]: ['exercising diligently', 'exercising properly'],
    [A_WIS]: ['very observant', 'paying attention'],
    [A_DEX]: ['working on your reflexes', 'working on reflexes lately'],
    [A_CON]: ['leading a healthy life-style', 'watching your health'],
};
export function requireAttributeIndex(attribute) {
    if (!Number.isInteger(attribute) || attribute < A_STR || attribute > A_CHA)
        throw new RangeError(`Unknown hero attribute ${attribute}`);
}
//# sourceMappingURL=attrib.js.map