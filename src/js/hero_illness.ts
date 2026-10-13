// Hero sickness and nausea state.
// C refs: potion.c make_sick(), make_vomiting();
// timeout.c sickness_dialogue(), vomiting_dialogue(); eat.c vomit().

import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import { heroIsHallucinating } from './senses.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import {
    adjustAttribute, currentAttribute, exerciseAttribute,
} from './attrib.js';
import {
    A_CON, ALTAR, FAINTING, ICE, POISONING, SICK_ALL,
    SICK_NONVOMITABLE, SICK_VOMITABLE, TIMEOUT,
} from './const.js';
import { pline, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { game, requirePlayingGame } from './gstate.js';
import { currentHungerState, spendHeroNutrition } from './hunger.js';
import { meltIce } from './ice.js';
import {
    MONSTER_FLAGS1, MONSTER_SYMBOL,
} from './monster_data.js';
import { heroMonsterForm } from './polyself.js';
import { altarWrath } from './pray.js';
import { d, rn2 } from './rng.js';
import {
    heroAcidBreathAttack, hitHeroWithRay,
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

interface SicknessOptions {
    state?: GameState;
    turns: number;
    cause?: string;
    type?: number;
    talk?: boolean;
    publish?: MessagePublisher;
}

// The onset line can page before the sickness timeout or cause changes.
export async function startHeroSickness({
    state = game,
    turns,
    cause = 'illness',
    type = SICK_VOMITABLE,
    talk = true,
    publish = plineWithContinuation,
}: SicknessOptions) {
    const hero = state.u;
    if (hero.sicknessResistance) return { started: false, newlySick: false };
    const oldTurns = hero.sickTurns ?? 0;
    const newlySick = !oldTurns;
    if (newlySick) {
        await publish('You feel deathly sick.');
    } else if (talk) {
        const severity = turns <= oldTurns / 2 ? 'much' : 'even';
        await publish(`You feel ${severity} worse.`);
    }
    hero.sickTurns = Math.min(TIMEOUT, Math.max(0, Math.trunc(turns)));
    hero.sick = hero.sickTurns > 0;
    hero.sickType = (hero.sickType ?? 0) | type;
    state.context.botl = true;
    await exerciseAttribute(A_CON, false, state);
    hero.sickCause = cause;
    return { started: hero.sick, newlySick };
}

export function cureHeroSickness(state = game, type = SICK_ALL) {
    const hero = state.u;
    const currentType = hero.sickType ?? 0;
    if (!heroIsSick(state) || !(currentType & type)) return false;

    hero.sickType = currentType & ~type;
    state.context.botl = true;
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

// Native make_sick(0, ..., talk, type): the type mask changes before the
// cure message; the timeout and delayed cause remain until that line returns.
export async function cureHeroSicknessWithMessages(state = game, type = SICK_ALL) {
    const hero = state.u;
    const currentType = hero.sickType ?? 0;
    if (!heroIsSick(state) || !(currentType & type)) return false;
    hero.sickType = currentType & ~type;
    await plineWithContinuation(hero.sickType
        ? 'You feel somewhat better.' : 'You feel cured.  What a relief!');
    if (hero.sickType) {
        hero.sickTurns = Math.min(TIMEOUT, (hero.sickTurns ?? 0) * 2);
        state.context.botl = true;
        await exerciseAttribute(A_CON, false, state);
    } else {
        hero.sick = false;
        hero.sickTurns = 0;
        state.context.botl = true;
        delete hero.sickCause;
    }
    return true;
}

export function heroIsVomiting(state = game) {
    return !!state.u?.vomiting || (state.u?.vomitingTurns ?? 0) > 0;
}

export function startHeroVomiting({ state = game, turns }: { state?: GameState; turns?: number } = {}) {
    const hero = state.u;
    hero.vomitingTurns = Math.max(0, turns ?? 0);
    hero.vomiting = hero.vomitingTurns > 0;
    state.context.botl = true;
    return hero.vomiting;
}

export function cureHeroVomiting(state = game) {
    const hero = state.u;
    const cured = heroIsVomiting(state);
    hero.vomiting = false;
    hero.vomitingTurns = 0;
    state.context.botl = true;
    return cured;
}

export function cureHeroIllness(state = game) {
    return {
        sicknessCured: cureHeroSickness(state),
        nauseaCured: cureHeroVomiting(state),
    };
}

function heroCannotVomit(state: GameState) {
    const form = heroMonsterForm(state);
    if (form == null) return false;
    if (MONSTER_SYMBOL[form] === S_RODENT
        && form !== PM_ROCK_MOLE && form !== PM_WOODCHUCK) return true;
    return form === PM_PONY || form === PM_HORSE || form === PM_WARHORSE;
}

function installVomitingHelplessness(state: GameState) {
    if ((state._helplessTurns ?? 0) > 2) return;
    endVoluntaryMultiTurn(state);
    state._helplessTurns = 2;
    state._helplessReason = 'vomiting';
    state._helplessDoneMessage = 'You can move again.';
}

async function cureFoodPoisoningByVomiting(state: GameState, publish: MessagePublisher) {
    const hero = state.u;
    if (!((hero.sickType ?? 0) & SICK_VOMITABLE)) return false;
    cureHeroSickness(state, SICK_VOMITABLE);
    await publish(hero.sickType
        ? 'You feel somewhat better.'
        : 'You feel cured.  What a relief!');
    return true;
}

interface VomitOptions {
    state?: GameState;
    publish?: MessagePublisher;
    angerAltar?: typeof altarWrath;
    melt?: typeof meltIce;
    random?: typeof rn2;
    rollDice?: typeof d;
}

export async function vomitHero({
    state = game,
    publish = pline,
    angerAltar = altarWrath,
    melt = meltIce,
    random = rn2,
    rollDice = d,
}: VomitOptions = {}) {
    const hero = state.u;
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
        const breath = await hitHeroWithRay({
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

function stopCountedAction(state: GameState) {
    if (state._occupation?.key === 'command')
        state._occupation = null;
}

function vomitingMessage(state: GameState, nextTurns: number) {
    const hero = state.u;
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
        return heroIsHallucinating(state)
            ? 'You are about to hurl!' : 'You are about to vomit.';
    }
    return null;
}

export async function advanceHeroVomiting({
    state = game,
    publish = pline,
    rollDice = d,
}: { state?: GameState; publish?: MessagePublisher; rollDice?: typeof d } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
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
            await spendHeroNutrition(20, { state });
            if (state.program_state.gameover)
                return { active: false, vomited: false, turns: nextTurns, died: true };
            if (hero.uhs < FAINTING) {
                await publish(heroIsHallucinating(state)
                    ? 'You hurl chunks!' : 'You vomit!');
            }
        }
        await vomitHero({ state, publish });
        vomited = true;
    }

    await exerciseAttribute(A_CON, false, state);
    hero.vomitingTurns = nextTurns;
    hero.vomiting = nextTurns > 0;
    if (!hero.vomiting && vomited)
        await publish('You feel much less nauseated now.');
    return { active: hero.vomiting, vomited, turns: nextTurns };
}

function sicknessMessage(hero: Hero) {
    const turns = hero.sickTurns ?? 0;
    if (turns % 2 === 0) return null;
    const stage = Math.trunc(turns / 2);
    const noun = ((hero.sickType ?? 0) & SICK_NONVOMITABLE)
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
}: {
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
    random?: typeof rn2;
} = {}) {
    const hero = state.u;
    if (!heroIsSick(state)) return { active: false, died: false };

    const message = sicknessMessage(hero);
    if (message) await publish(message);
    await exerciseAttribute(A_CON, false, state);

    hero.sickTurns = Math.max(0, (hero.sickTurns ?? 0) - 1);
    if (hero.sickTurns > 0)
        return { active: true, died: false, turns: hero.sickTurns };

    const canRecover = !((hero.sickType ?? 0) & SICK_NONVOMITABLE)
        && random(100) < currentAttribute(A_CON, state);
    if (canRecover) {
        await publish('You have recovered from your illness.');
        cureHeroSickness(state);
        await exerciseAttribute(A_CON, false, state);
        adjustAttribute(A_CON, -1, state);
        return { active: false, died: false, recovered: true, turns: 0 };
    }

    await publish('You die from your illness.');
    const killer = hero.sickCause || 'illness';
    const died = await die({
        killer,
        deathCause: `poisoned by ${killer === '#wizintrinsic'
            ? killer : withIndefiniteArticle(killer)}`,
        deathLineShown: true,
        deathType: POISONING,
    });
    cureHeroSickness(state);
    return { active: false, died: !!died, recovered: false, turns: 0 };
}
