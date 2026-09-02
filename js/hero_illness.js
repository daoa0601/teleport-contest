// Hero sickness and nausea state.
// C refs: potion.c make_sick(), make_vomiting();
// timeout.c sickness_dialogue().

import {
    adjustAttribute, currentAttribute, exerciseAttribute,
} from './attrib.js';
import {
    A_CON, POISONING, SICK_NONVOMITABLE, SICK_VOMITABLE,
} from './const.js';
import { pline } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { rn2 } from './rng.js';

export function heroIsSick(state = game) {
    return !!state.u?.sick || (state.u?.sickTurns ?? 0) > 0;
}

export function startHeroSickness({
    state = game,
    turns,
    cause = 'illness',
    type = SICK_VOMITABLE,
} = {}) {
    const hero = state.u || (state.u = {});
    if (hero.sickResistance || hero.sick_resistance)
        return { started: false, newlySick: false, message: null };
    const oldTurns = hero.sickTurns ?? 0;
    const newlySick = !heroIsSick(state);
    hero.sick = turns > 0;
    hero.sickTurns = Math.max(0, turns ?? 0);
    hero.sickType = (hero.sickType ?? 0) | type;
    hero.sickCause = cause;
    exerciseAttribute(A_CON, false, state);
    const message = newlySick
        ? 'You feel deathly sick.'
        : `You feel ${hero.sickTurns <= oldTurns / 2
            ? 'much' : 'even'} worse.`;
    return { started: hero.sick, newlySick, message };
}

export function cureHeroSickness(state = game) {
    const hero = state.u || (state.u = {});
    const cured = heroIsSick(state);
    hero.sick = false;
    hero.sickTurns = 0;
    hero.sickType = 0;
    delete hero.sickCause;
    return cured;
}

export function cureHeroVomiting(state = game) {
    const hero = state.u || (state.u = {});
    const cured = !!hero.vomiting || (hero.vomitingTurns ?? 0) > 0;
    hero.vomiting = false;
    hero.vomitingTurns = 0;
    return cured;
}

export function cureHeroIllness(state = game) {
    return {
        sicknessCured: cureHeroSickness(state),
        nauseaCured: cureHeroVomiting(state),
    };
}

function sicknessMessage(hero) {
    const turns = hero.sickTurns ?? 0;
    if (turns % 2 === 0) return null;
    const stage = Math.trunc(turns / 2);
    const noun = (hero.sickType & SICK_NONVOMITABLE)
        ? 'illness' : 'sickness';
    if (stage === 3) return `Your ${noun} feels worse.`;
    if (stage === 2) return `Your ${noun} is severe.`;
    return stage === 1 ? "You are at Death's door." : null;
}

export async function advanceHeroSickness({
    state = game,
    publish = pline,
    die = finishHeroDeath,
    random = rn2,
} = {}) {
    const hero = state.u || (state.u = {});
    if (!heroIsSick(state)) return { active: false, died: false };

    const message = sicknessMessage(hero);
    if (message) await publish(message);
    exerciseAttribute(A_CON, false, state);

    hero.sickTurns = Math.max(0, (hero.sickTurns ?? 0) - 1);
    if (hero.sickTurns > 0)
        return { active: true, died: false, turns: hero.sickTurns };

    const canRecover = !(hero.sickType & SICK_NONVOMITABLE)
        && random(100) < currentAttribute(A_CON, state);
    if (canRecover) {
        await publish('You have recovered from your illness.');
        cureHeroSickness(state);
        exerciseAttribute(A_CON, false, state);
        adjustAttribute(A_CON, -1, state);
        return { active: false, died: false, recovered: true, turns: 0 };
    }

    await publish('You die from your illness.');
    const killer = hero.sickCause || 'illness';
    const died = await die({
        killer,
        deathLineShown: true,
        deathType: POISONING,
    });
    cureHeroSickness(state);
    return { active: false, died: !!died, recovered: false, turns: 0 };
}
