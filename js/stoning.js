// Hero petrification from contact, corpses, and eggs.
// C refs: mondata.c touch_petrifies()/poly_when_stoned(),
// pickup.c fatal_corpse_mistake(), trap.c instapetrify(),
// potion.c make_stoned(), and timeout.c stoned_dialogue().

import { exerciseAttribute } from './attrib.js';
import { A_DEX, G_GENOD, STONING } from './const.js';
import { pline, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { cureHeroVomiting } from './hero_illness.js';
import { healHeroLegs } from './hero_legs.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { CORPSE, EGG } from './object_data.js';
import {
    heroHasNoLimbs, heroIsPolymorphed, polymonHero,
} from './polyself.js';
import { removeIntrinsicProperty } from './properties.js';
import { clearHeroSliming } from './slime.js';
import { stopRun } from './runmode.js';

const PM_CHICKATRICE = 9;
const PM_COCKATRICE = 10;
const PM_MEDUSA = 284;
const PM_STONE_GOLEM = 257;
const S_GOLEM = 55;

export function touchPetrifies(mnum) {
    return mnum === PM_CHICKATRICE || mnum === PM_COCKATRICE;
}

export function fleshPetrifies(mnum) {
    return touchPetrifies(mnum) || mnum === PM_MEDUSA;
}

function heroResistsStoning(state = game) {
    return !!(state.u?.stoneResistance || state.u?.stone_resistance);
}

export function heroIsPetrifying(state = game) {
    return !!state.u?.stoned || (state.u?.stonedTurns ?? 0) > 0;
}

export function startHeroPetrification({
    state = game,
    turns = 5,
    killer = 'petrification',
} = {}) {
    const hero = state.u || (state.u = {});
    if (heroIsPetrifying(state)
        || hero.stoneResistance || hero.stone_resistance) return false;
    hero.stonedTurns = turns;
    hero.stoned = turns > 0;
    hero.stoneKiller = killer;
    return hero.stoned;
}

export function clearHeroPetrification(state = game) {
    const hero = state.u || (state.u = {});
    const wasPetrifying = heroIsPetrifying(state);
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    return wasPetrifying;
}

function stopPositiveAction(state) {
    if (state._runState) stopRun(state);
    state._commandCount = 0;
    if ((state.multi ?? 0) > 0) state.multi = 0;
    if ((state._multi ?? 0) > 0) state._multi = 0;
}

function stopOccupation(state) {
    state._occupation = null;
    stopPositiveAction(state);
}

function removeHeroSpeed(state) {
    const hero = state.u;
    hero.fastTurns = 0;
    hero.veryFastTurns = 0;
    removeIntrinsicProperty('fast', state);
    hero.veryFast = !!hero.veryFastFromArmor;
}

function petrificationMessage(turns, state) {
    if (turns === 5) return 'You are slowing down.';
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
    if (turns === 2) return 'You have turned to stone.';
    return turns === 1 ? 'You are a statue.' : null;
}

export async function advanceHeroPetrification({
    state = game,
    publish = pline,
    die = finishHeroDeath,
} = {}) {
    const hero = state.u || (state.u = {});
    const turns = hero.stonedTurns ?? 0;
    if (turns <= 0) return { active: false, died: false };

    const message = petrificationMessage(turns, state);
    if (message) await publish(message);

    if (turns === 5) {
        removeHeroSpeed(state);
        stopPositiveAction(state);
    } else if (turns === 4) {
        stopOccupation(state);
    } else if (turns === 3) {
        stopOccupation(state);
        state._helplessTurns = 3;
        state._helplessReason = 'getting stoned';
        state._helplessDoneMessage = 'You can move again.';
        healHeroLegs(state, { showBodyMessage: false });
    } else if (turns === 2) {
        if ((hero.deafTurns ?? 0) > 0 && hero.deafTurns < 5)
            hero.deafTurns = 5;
        cureHeroVomiting(state);
        clearHeroSliming(state);
    }
    exerciseAttribute(A_DEX, false, state);

    hero.stonedTurns = turns - 1;
    if (hero.stonedTurns > 0)
        return { active: true, died: false, turns: hero.stonedTurns };

    const killer = hero.stoneKiller || 'petrification';
    const died = await die({
        killer,
        deathVerb: 'turned to stone',
        deathType: STONING,
    });
    clearHeroPetrification(state);
    return { active: false, died: !!died, turns: 0 };
}

function heroPolymorphsWhenStoned(state = game) {
    const form = state.u?.umonnum;
    return heroIsPolymorphed(state)
        && MONSTER_SYMBOL[form] === S_GOLEM
        && form !== PM_STONE_GOLEM;
}

function heroCanBecomeStoneGolem(state = game) {
    const stoneGolemGenocided = !!(
        (state.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & G_GENOD
    );
    return heroPolymorphsWhenStoned(state) && !stoneGolemGenocided;
}

export function heroWouldPetrifyFromFlesh(mnum, state = game) {
    return fleshPetrifies(mnum)
        && !heroResistsStoning(state)
        && !heroPolymorphsWhenStoned(state);
}

function corpseWithArticle(object) {
    const species = MONSTER_NAME[object.corpsenm] || 'monster';
    const name = object.oextra?.oname || object.oname;
    const noun = `${species} corpse${name ? ` named ${name}` : ''}`;
    return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

export async function touchPetrifyingCorpse(object, {
    action = 'Touching', beforeDeath = null,
} = {}) {
    const gloves = game.uarmg || game.u?.uarmg;
    if (object?.otyp !== CORPSE || !touchPetrifies(object.corpsenm)
        || gloves || heroResistsStoning()) return null;

    if (heroCanBecomeStoneGolem()) {
        await polymonHero(PM_STONE_GOLEM);
        return null;
    }

    const corpse = corpseWithArticle(object);
    await pline(`${action} ${corpse} is a fatal mistake.`);
    await beforeDeath?.();
    await pline('You turn to stone...');
    const died = await finishHeroDeath({
        killer: corpse,
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { died };
}

export async function eatPetrifyingEgg(object) {
    if (object?.otyp !== EGG || !fleshPetrifies(object.corpsenm)
        || heroResistsStoning()) return { started: false };

    if (heroCanBecomeStoneGolem()) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }

    const species = MONSTER_NAME[object.corpsenm] || 'monster';
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

    if (heroCanBecomeStoneGolem(state)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }

    const started = startHeroPetrification({ state });
    return { started, transformed: false };
}

export async function tastePetrifyingFlesh(object, {
    publish = plineWithContinuation,
    die = finishHeroDeath,
} = {}) {
    if (!fleshPetrifies(object?.corpsenm) || heroResistsStoning())
        return { stopped: false, transformed: false };

    if (heroCanBecomeStoneGolem()) {
        await polymonHero(PM_STONE_GOLEM);
        return { stopped: false, transformed: true };
    }

    await publish('You turn to stone.');
    const species = MONSTER_NAME[object.corpsenm] || 'monster';
    const died = await die({
        killer: `tasting ${species} meat`,
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { stopped: true, transformed: false, died: !!died };
}
