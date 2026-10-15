// C eat.c:eataccessory(), accessory_has_effect(), bounded_increase().
import { removeHeroAccessory } from './accessory.js';
import { findArmorClass } from './armor.js';
import { adjustAttribute, attributeChangeMessage, reportHeroEncumbrance } from './attrib.js';
import { A_CHA, A_CON, A_STR, TIMEOUT } from './const.js';
import { newsym, plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { chokeHeroOnFood } from './hunger.js';
import { heroIsInvisible, invisibilityIsBlocked, syncHeroInvisibility } from './hero_invisibility.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { changeHeroSex } from './hero_species.js';
import { MONSTER_FLAGS1, requireMonsterData } from './monster_data.js';
import { restoreNaturalMonsterShapes } from './monster_polymorph.js';
import { OBJECT_NAMES, OBJECT_PROPERTY, requireObjectData } from './object_data.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { heroIsPolymorphed, returnHeroToHumanForm } from './polyself.js';
import { captureLevitationState, grantIntrinsicProperty, hasCarriedProperty, hasIntrinsicProperty, hasTimedProperty, hasInvokedProperty, hasWornProperty, propertyIsActive, refreshProperty, propertyTimeout, setPropertyTimeout, } from './properties.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { floatHeroUp } from './terrain_movement.js';
const type = (name) => OBJECT_NAMES.indexOf(name);
const ADORNMENT = type('adornment'), STRENGTH = type('gain strength');
const CONSTITUTION = type('gain constitution'), ACCURACY = type('increase accuracy');
const DAMAGE = type('increase damage'), PROTECTION = type('protection');
const SEE_INVISIBLE = type('see invisible'), INVISIBILITY = type('invisibility');
const SHAPE_PROTECTION = type('protection from shape changers'), LEVITATION = type('levitation');
const FREE_ACTION = type('free action'), SUSTAIN = type('sustain ability');
const CHANGE = type('amulet of change'), UNCHANGING = type('amulet of unchanging');
const GUARDING = type('amulet of guarding'), STRANGULATION = type('amulet of strangulation');
const SLEEP = type('amulet of restful sleep');
const NO_DIGESTED_EFFECT = new Set([SUSTAIN, type('amulet of life saving'),
    type('amulet of flying'), type('amulet of reflection')]);
export async function digestAccessory(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const property = requireObjectData(OBJECT_PROPERTY, object.otyp);
    const oldIntrinsic = property && (hasIntrinsicProperty(property, null, state)
        || hasTimedProperty(property, state));
    if (object === state.uleft || object === state.uright) {
        await removeHeroAccessory(object, state);
        if (state.program_state.gameover || state.u.uhp <= 0)
            return;
    }
    observeObject(object, state);
    object.known = true;
    if (rn2(object.oclass === 4 ? 3 : 5))
        return;
    if (NO_DIGESTED_EFFECT.has(object.otyp))
        return;
    if ([ADORNMENT, STRENGTH, CONSTITUTION].includes(object.otyp)) {
        await accessoryEffectMessage(object);
        const attribute = object.otyp === ADORNMENT ? A_CHA : object.otyp === STRENGTH ? A_STR : A_CON;
        const change = adjustAttribute(attribute, object.spe, state);
        if (change.changed) {
            const message = attributeChangeMessage(attribute, change);
            if (message)
                await pline(message);
            if (state._moveloopStarted && [A_STR, A_CON].includes(attribute))
                await reportHeroEncumbrance(state);
            learnObjectType(object.otyp, state);
        }
    }
    else if ([ACCURACY, DAMAGE].includes(object.otyp)) {
        await accessoryEffectMessage(object);
        const field = object.otyp === ACCURACY ? 'uhitinc' : 'udaminc';
        state.u[field] = boundedIncrease(state.u[field] || 0, object.spe, object.otyp, state);
    }
    else if (object.otyp === PROTECTION || object.otyp === GUARDING) {
        await accessoryEffectMessage(object);
        grantIntrinsicProperty('protection', 'outside', state);
        state.u.ublessed = boundedIncrease(state.u.ublessed || 0, object.otyp === PROTECTION ? object.spe : 2, object.otyp, state);
        findArmorClass(state);
        state.context.botl = true;
    }
    else if (object.otyp === FREE_ACTION) {
        if (!hasIntrinsicProperty('sleepResistance', 'outside', state))
            await accessoryEffectMessage(object);
        if (!state.u.sleepResistance)
            await pline('You feel wide awake.');
        grantIntrinsicProperty('sleepResistance', 'outside', state);
    }
    else if (object.otyp === CHANGE) {
        await accessoryEffectMessage(object);
        learnObjectType(object.otyp, state);
        changeHeroSex(state);
        await pline(`You are suddenly very ${state.flags.female ? 'feminine' : 'masculine'}!`);
        state.context.botl = true;
    }
    else if (object.otyp === UNCHANGING) {
        if (!state.u.unchanging && heroIsPolymorphed(state)) {
            await accessoryEffectMessage(object);
            learnObjectType(object.otyp, state);
            await returnHeroToHumanForm(state);
        }
    }
    else if (object.otyp === STRANGULATION) {
        await chokeHeroOnFood(object, { state });
    }
    else if (object.otyp === SLEEP) {
        const delay = rnd(100);
        const oldDelay = propertyTimeout('sleepy', state);
        if (!hasIntrinsicProperty('sleepy', 'outside', state))
            await accessoryEffectMessage(object);
        grantIntrinsicProperty('sleepy', 'outside', state);
        if (!oldDelay || delay < oldDelay)
            setPropertyTimeout('sleepy', delay, state);
    }
    else if (property) {
        if (!hasIntrinsicProperty(property, 'outside', state))
            await accessoryEffectMessage(object);
        if (object.otyp === LEVITATION) {
            // The generic intrinsic gain is immediately undone by C. Only
            // this temporary flight remains, and existing levitation wins.
            if (!propertyIsActive('levitation', state)) {
                await floatHeroUp(state, captureLevitationState(state));
                state.u.levitationTurns = Math.min(TIMEOUT, (state.u.levitationTurns || 0) + d(10, 20));
                refreshProperty('levitation', state);
                learnObjectType(object.otyp, state);
            }
            return;
        }
        grantIntrinsicProperty(property, 'outside', state);
        if (object.otyp === SEE_INVISIBLE) {
            await refreshHeroSeeing({ state });
            const innateSight = requireMonsterData(MONSTER_FLAGS1, state.u.umonnum) & 0x01000000;
            if (heroIsInvisible(state) && !oldIntrinsic && !extrinsicProperty(property, state)
                && !innateSight && !heroIsBlind(state)) {
                newsym(state.u.ux, state.u.uy);
                await pline('Suddenly you can see yourself.');
                learnObjectType(object.otyp, state);
            }
        }
        else if (object.otyp === INVISIBILITY) {
            syncHeroInvisibility(state);
            if (!oldIntrinsic && !extrinsicProperty(property, state) && !invisibilityIsBlocked(state)
                && !state.u.seeInvisible && !heroIsBlind(state)) {
                newsym(state.u.ux, state.u.uy);
                await pline(`Your body takes on a ${heroIsHallucinating(state) ? 'normal' : 'strange'} transparency...`);
                learnObjectType(object.otyp, state);
            }
        }
        else if (object.otyp === SHAPE_PROTECTION) {
            await restoreNaturalMonsterShapes(state);
        }
    }
}
function accessoryEffectMessage(object) {
    return pline(`Magic spreads through your body as you digest the ${object.oclass === 4 ? 'ring' : 'amulet'}.`);
}
function extrinsicProperty(property, state) {
    return hasWornProperty(property, state) || hasInvokedProperty(property, state)
        || hasCarriedProperty(property, null, state);
}
function boundedIncrease(old, amount, objectType, state) {
    const worn = [state.uleft, state.uright].filter((ring) => ring != null && ring.otyp === objectType);
    const wornBonus = objectType === PROTECTION ? 0 : worn.reduce((sum, ring) => sum + ring.spe, 0);
    old -= wornBonus;
    const total = Math.abs(old) + Math.abs(amount);
    if (amount && Math.sign(old) === Math.sign(amount) && total >= 10) {
        let increase;
        if (total < 20) {
            increase = rnd(Math.abs(amount));
            if (Math.abs(old) + increase < 10)
                increase = 10 - Math.abs(old);
        }
        else if (total < 40) {
            increase = rn2(Math.abs(amount)) ? 1 : 0;
            if (Math.abs(old) + increase < 20)
                increase = rnd(20 - Math.abs(old));
        }
        else
            increase = 0;
        amount = Math.sign(amount) * increase;
    }
    return old + wornBonus + amount;
}
//# sourceMappingURL=eaten_accessory.js.map