// Hero sickness and nausea state.
// C refs: potion.c make_sick(), make_vomiting();
// timeout.c sickness_dialogue(), vomiting_dialogue(); eat.c vomit().

import {
    adjustAttribute, currentAttribute, exerciseAttribute,
} from './attrib.js';
import {
    A_CON, ALTAR, FAINTED, FAINTING, ICE, POISONING, SICK_ALL,
    SICK_NONVOMITABLE, SICK_VOMITABLE, STARVED,
} from './const.js';
import { pline } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { meltIce } from './ice.js';
import {
    MONSTER_FLAGS1, MONSTER_SYMBOL,
} from './monster_data.js';
import { heroMonsterForm } from './polyself.js';
import { altarWrath } from './pray.js';
import { d, rn2 } from './rng.js';
import {
    heroAcidBreathAttack, hitHeroWithBreath,
} from './hero_breath.js';

const S_RODENT = 18;
const M1_ACID = 0x08000000;
const PM_ROCK_MOLE = 92;
const PM_WOODCHUCK = 93;
const PM_PONY = 100;
const PM_HORSE = 104;
const PM_WARHORSE = 105;

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

export function cureHeroSickness(state = game, type = SICK_ALL) {
    const hero = state.u || (state.u = {});
    const currentType = hero.sickType ?? 0;
    if (!heroIsSick(state) || !(currentType & type)) return false;

    hero.sickType = currentType & ~type;
    if (hero.sickType) {
        hero.sick = true;
        hero.sickTurns = Math.max(1, (hero.sickTurns ?? 1) * 2);
    } else {
        hero.sick = false;
        hero.sickTurns = 0;
        delete hero.sickCause;
    }
    return true;
}

export function heroIsVomiting(state = game) {
    return !!state.u?.vomiting || (state.u?.vomitingTurns ?? 0) > 0;
}

export function startHeroVomiting({ state = game, turns } = {}) {
    const hero = state.u || (state.u = {});
    hero.vomitingTurns = Math.max(0, turns ?? 0);
    hero.vomiting = hero.vomitingTurns > 0;
    return hero.vomiting;
}

export function cureHeroVomiting(state = game) {
    const hero = state.u || (state.u = {});
    const cured = heroIsVomiting(state);
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

function heroCannotVomit(state) {
    const form = heroMonsterForm(state);
    if (form == null) return false;
    if (MONSTER_SYMBOL[form] === S_RODENT
        && form !== PM_ROCK_MOLE && form !== PM_WOODCHUCK) return true;
    return form === PM_PONY || form === PM_HORSE || form === PM_WARHORSE;
}

function currentHungerState(state) {
    const existing = state.u?.uhs;
    if (existing === FAINTED || existing === STARVED) return existing;
    const nutrition = state.u?.uhunger ?? 900;
    return nutrition > 1000 ? 0
        : nutrition > 150 ? 1
            : nutrition > 50 ? 2
                : nutrition > 0 ? 3 : FAINTING;
}

function installVomitingHelplessness(state) {
    if ((state._helplessTurns ?? 0) > 2) return;
    state._helplessTurns = 2;
    state._helplessReason = 'vomiting';
    state._helplessDoneMessage = 'You can move again.';
}

async function cureFoodPoisoningByVomiting(state, publish) {
    const hero = state.u || {};
    if (!(hero.sickType & SICK_VOMITABLE)) return false;
    cureHeroSickness(state, SICK_VOMITABLE);
    await publish(hero.sickType
        ? 'You feel somewhat better.'
        : 'You feel cured.  What a relief!');
    return true;
}

export async function vomitHero({
    state = game,
    publish = pline,
    angerAltar = altarWrath,
    melt = meltIce,
    random = rn2,
    rollDice = d,
} = {}) {
    const hero = state.u || (state.u = {});
    const cannotVomit = heroCannotVomit(state);
    const hungerState = currentHungerState(state);
    hero.uhs = hungerState;

    if (cannotVomit) {
        await publish('Your jaw gapes convulsively.');
    } else {
        await cureFoodPoisoningByVomiting(state, publish);
        if (hungerState >= FAINTING)
            await publish('Your stomach heaves convulsively!');
    }

    installVomitingHelplessness(state);
    if (cannotVomit || hungerState >= FAINTING)
        return { spewed: false, cannotVomit };

    const x = hero.ux, y = hero.uy;
    const acidBreath = heroAcidBreathAttack(state);
    if (acidBreath) {
        await publish('You breathe acid on yourself...');
        const breath = await hitHeroWithBreath({
            state,
            attack: acidBreath,
            publish,
            random,
            rollDice,
        });
        if (breath.heroDied)
            return { spewed: true, cannotVomit: false, heroDied: true };
    }
    if (state.level?.at(x, y)?.typ === ALTAR)
        await angerAltar(x, y, state);
    const form = heroMonsterForm(state);
    if (form != null
        && ((MONSTER_FLAGS1[form] ?? 0) & M1_ACID)
        && state.level?.at(x, y)?.typ === ICE) {
        await melt(x, y, {
            message: 'Your stomach acid melts straight through the ice!',
        });
    }
    return { spewed: true, cannotVomit: false };
}

function stopCountedAction(state) {
    if (state._occupation?.key === 's' || state._occupation?.key === '.')
        state._occupation = null;
}

function vomitingMessage(state, nextTurns) {
    const hero = state.u || {};
    if (nextTurns === 14) return 'You are feeling mildly nauseated.';
    if (nextTurns === 11) {
        return (hero.confusionTurns ?? 0) > 0
            ? 'You feel more confused.' : 'You feel slightly confused.';
    }
    if (nextTurns === 8) {
        return (hero.stunnedTurns ?? 0) > 0
            ? "You can't think straight."
            : "You can't seem to think straight.";
    }
    if (nextTurns === 5) return 'You feel incredibly sick.';
    if (nextTurns === 2) {
        if (heroCannotVomit(state)) return 'You gag uncontrollably.';
        return hero.hallucinating || (hero.hallucinationTurns ?? 0) > 0
            ? 'You are about to hurl!' : 'You are about to vomit.';
    }
    return null;
}

export async function advanceHeroVomiting({
    state = game,
    publish = pline,
    rollDice = d,
} = {}) {
    const hero = state.u || (state.u = {});
    if (!heroIsVomiting(state)) return { active: false, vomited: false };

    const nextTurns = Math.max(0, (hero.vomitingTurns ?? 0) - 1);
    if (nextTurns === 9) {
        hero.confusionTurns = (hero.confusionTurns ?? 0) + rollDice(2, 4);
        stopCountedAction(state);
    } else if (nextTurns === 6) {
        hero.stunnedTurns = (hero.stunnedTurns ?? 0) + rollDice(2, 4);
        hero.stunned = true;
        state._occupation = null;
        hero.confusionTurns = (hero.confusionTurns ?? 0) + rollDice(2, 4);
    }

    const message = vomitingMessage(state, nextTurns);
    if (message) await publish(message);

    let vomited = false;
    if (nextTurns === 0) {
        state._occupation = null;
        if (!heroCannotVomit(state)) {
            hero.uhunger = (hero.uhunger ?? 900) - 20;
            hero.uhs = currentHungerState(state);
            if (hero.uhs < FAINTING) {
                await publish(hero.hallucinating
                    || (hero.hallucinationTurns ?? 0) > 0
                    ? 'You hurl chunks!' : 'You vomit!');
            }
        }
        await vomitHero({ state, publish });
        vomited = true;
    }

    exerciseAttribute(A_CON, false, state);
    hero.vomitingTurns = nextTurns;
    hero.vomiting = nextTurns > 0;
    if (!hero.vomiting && vomited)
        await publish('You feel much less nauseated now.');
    return { active: hero.vomiting, vomited, turns: nextTurns };
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
