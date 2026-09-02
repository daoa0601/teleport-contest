// Blindness caused by cream pies and blinding venom.
// C refs: mondata.c can_blnd() and mthrowu.c m_throw()/ohitmon().

import { W_ARMH } from './const.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import {
    BLINDING_VENOM, CREAM_PIE, OBJECT_DESCRIPTIONS,
} from './object_data.js';
import { heroMonsterForm } from './polyself.js';
import { rnd } from './rng.js';
import { blindfolded, heroIsBlind, syncBlindness } from './senses.js';

const M1_NOEYES = 0x00001000;
const PM_CYCLOPS = MONSTER_NAME.indexOf('Cyclops');
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');

function wearsVisoredHelmet(objects, state) {
    return objects.some(object =>
        ((object?.owornmask ?? 0) & W_ARMH)
        && (state.objectDescriptions?.[object.otyp]
            ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
}

function monsterCanBeBlindedByObject(
    monster, objectType, { heroInsideTarget = false, state = game } = {},
) {
    if (![CREAM_PIE, BLINDING_VENOM].includes(objectType)) return false;
    if ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_NOEYES) return false;
    if (!monster?.mcansee && (monster?.mblinded ?? 0) === 0) return false;
    if (heroInsideTarget) return false;
    if (objectType !== BLINDING_VENOM) return true;
    return !wearsVisoredHelmet(
        monster?.minvent || monster?.inventory || [],
        state,
    );
}

export function blindMonsterWithThrownObject(
    monster, objectType, {
        heroInsideTarget = false,
        state = game,
        rollOne = rnd,
    } = {},
) {
    if (!monsterCanBeBlindedByObject(
        monster, objectType, { heroInsideTarget, state },
    )) return null;

    const wasSeeing = !!monster.mcansee;
    const blindIncrement = rollOne(25) + 20;
    monster.mcansee = 0;
    monster.mblinded = Math.min(
        127, (monster.mblinded ?? 0) + blindIncrement,
    );
    return { blindIncrement, wasSeeing };
}

function heroHasEyes(state) {
    const hero = state.u || {};
    const form = heroMonsterForm(state);
    return !hero.noEyes && !hero.eyeless
        && (form === null
            || !((MONSTER_FLAGS1[form] ?? 0) & M1_NOEYES));
}

export function heroCanBeBlindedByVenom(state = game) {
    const hero = state.u || {};
    if (!heroHasEyes(state)
        || state.ublindf || hero.ublindf || hero.ucreamed) return false;

    const helmet = state.uarmh || hero.uarmh;
    const wornObjects = helmet
        ? [helmet, ...(state.inventory || [])]
        : state.inventory || [];
    return !wearsVisoredHelmet(wornObjects, state);
}

function heroCanBeBlindedByCreamPie(state) {
    return heroHasEyes(state) && !blindfolded(state);
}

function heroCanBeBlindedByObject(objectType, state) {
    if (objectType === CREAM_PIE)
        return heroCanBeBlindedByCreamPie(state);
    if (objectType === BLINDING_VENOM)
        return heroCanBeBlindedByVenom(state);
    return false;
}

function venomBlindMessage(state, wasBlind) {
    if (!wasBlind) return 'The venom blinds you.';
    const form = heroMonsterForm(state);
    return form === PM_CYCLOPS || form === PM_FLOATING_EYE
        ? 'Your eye stings.' : 'Your eyes sting.';
}

function creamPieBlindMessage(wasBlind) {
    return wasBlind
        ? "There's something sticky all over your face."
        : "Yecch!  You've been creamed.";
}

export function blindHeroWithThrownObject(
    objectType, state = game, rollOne = rnd,
) {
    if (!heroCanBeBlindedByObject(objectType, state)) return null;

    const wasBlind = heroIsBlind(state);
    const blindIncrement = rollOne(25);
    state.u.ucreamed = (state.u.ucreamed ?? 0) + blindIncrement;
    state.u.blindTurns = (state.u.blindTurns ?? 0) + blindIncrement;
    const blind = syncBlindness(state);
    if (blind !== wasBlind) state.vision_full_recalc = 1;

    const message = objectType === CREAM_PIE
        ? creamPieBlindMessage(wasBlind)
        : venomBlindMessage(state, wasBlind);
    return { blindIncrement, wasBlind, message };
}
