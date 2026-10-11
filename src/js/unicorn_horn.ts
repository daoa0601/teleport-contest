// Using a unicorn horn as an item or as a polymorphed unicorn's ability.
// C refs: apply.c use_unicorn_horn(), cmd.c domonability().

import { makeHallucinated } from './hero_mental_status.js';
import { heroIsUnaware } from './hero_sleep.js';
import { currentAttribute } from './attrib.js';
import {
    A_CON, SICK_ALL, SICK_NONVOMITABLE,
} from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { objectName } from './objnam.js';
import { refreshProperty } from './properties.js';
import {
    cureHeroSickness, cureHeroVomiting, heroIsVomiting,
    startHeroSickness, startHeroVomiting, vomitHero,
} from './hero_illness.js';
import {
    MONSTER_ATTACKS, monsterIsUnicorn,
} from './monster_data.js';
import { AD_BLND, AT_ENGL } from './monster_attack_types.js';
import { heroMonsterForm } from './polyself.js';
import { d, rn2 } from './rng.js';
import {
    heroIsBlind, heroIsDeaf, setHeroBlindnessTurns, syncDeafness, heroIsHallucinating } from './senses.js';
import type { MessagePublisher } from './display.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';

const SICK = 'sickness';
const BLIND = 'blindness';
const HALLUCINATING = 'hallucination';
const VOMITING = 'vomiting';
const CONFUSED = 'confusion';
const STUNNED = 'stun';
const DEAF = 'deafness';

export type HornTrouble = typeof SICK | typeof BLIND | typeof HALLUCINATING
    | typeof VOMITING | typeof CONFUSED | typeof STUNNED | typeof DEAF;

export interface UnicornHornOptions {
    object?: GameObject | null;
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
}

export interface UnicornHornResult {
    used: true;
    spentTime: true;
    caused: HornTrouble | null;
    cured: HornTrouble[];
}

export function heroCanUseUnicornHorn(state: GameState = game) {
    const form = heroMonsterForm(state);
    return form !== null && monsterIsUnicorn(form);
}

export async function useUnicornHorn({
    object = null,
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
}: UnicornHornOptions = {}): Promise<UnicornHornResult> {
    if (object?.cursed) {
        const caused = await causeHornTrouble(
            object, state, publish, random, rollDice,
        );
        return { used: true, spentTime: true, caused, cured: [] };
    }

    const troubles = currentHornTroubles(state);
    if (!troubles.length) {
        await publish('Nothing seems to happen.');
        return { used: true, spentTime: true, caused: null, cured: [] };
    }
    if (troubles.length > 1) shuffle(troubles, random);

    const maximum = rollDice(2, object?.blessed ? 4 : 2);
    const cureCount = Math.min(troubles.length, random(maximum));
    const cured: HornTrouble[] = [];
    for (let index = 0; index < cureCount; index++) {
        const trouble = troubles[index];
        if (!trouble) throw new RangeError('Unicorn horn selected a missing condition.');
        await cureHornTrouble(trouble, state, publish);
        cured.push(trouble);
    }
    if (!cured.length) await publish('Nothing seems to happen.');
    return { used: true, spentTime: true, caused: null, cured };
}

function currentHornTroubles(state: GameState) {
    const hero = state.u;
    const troubles: HornTrouble[] = [];
    if ((hero.sickTurns ?? 0) > 0) troubles.push(SICK);
    if ((hero.blindTurns ?? 0) > (hero.ucreamed ?? 0)
        && !swallowedByBlindingMonster(state)) troubles.push(BLIND);
    if ((hero.hallucinationTurns ?? 0) > 0) troubles.push(HALLUCINATING);
    if ((hero.vomitingTurns ?? 0) > 0) troubles.push(VOMITING);
    if ((hero.confusionTurns ?? 0) > 0) troubles.push(CONFUSED);
    if ((hero.stunnedTurns ?? 0) > 0) troubles.push(STUNNED);
    if ((hero.deafTurns ?? 0) > 0) troubles.push(DEAF);
    return troubles;
}

function swallowedByBlindingMonster(state: GameState) {
    if (!state.u?.uswallow || !state.u?.ustuck) return false;
    return (MONSTER_ATTACKS[state.u.ustuck.mnum] || []).some(
        ([attackType, damageType]) =>
            attackType === AT_ENGL && damageType === AD_BLND,
    );
}

function shuffle(values: HornTrouble[], random: typeof rn2) {
    for (let index = values.length - 1; index > 0; index--) {
        const other = random(index + 1);
        if (other === index) continue;
        const currentValue = values[index];
        const otherValue = values[other];
        if (!currentValue || !otherValue)
            throw new RangeError('Unicorn horn shuffle selected a missing condition.');
        [values[index], values[other]] = [otherValue, currentValue];
    }
}

async function cureHornTrouble(trouble: HornTrouble, state: GameState, publish: MessagePublisher) {
    const hero = state.u;
    const talk = !heroIsUnaware(state);
    if (trouble === SICK) {
        cureHeroSickness(state, SICK_ALL);
        await publish('You feel cured.  What a relief!');
        return;
    }
    if (trouble === BLIND) {
        const wasBlind = heroIsBlind(state);
        const result = setHeroBlindnessTurns(hero.ucreamed ?? 0, state);
        if (talk && wasBlind && result.regainedSight) {
            await publish(heroIsHallucinating(state)
                ? 'Far out!  Everything is all cosmic again!'
                : 'You can see again.');
        }
        return;
    }
    if (trouble === HALLUCINATING) {
        await makeHallucinated(0, { state, talk, publish });
        return;
    }
    if (trouble === VOMITING) {
        cureHeroVomiting(state);
        if (talk) await publish('You feel much less nauseated now.');
        return;
    }
    if (trouble === CONFUSED) {
        hero.confusionTurns = 0;
        if (talk) {
            await publish(`You feel less ${
                heroIsHallucinating(state) ? 'trippy' : 'confused'
            } now.`);
        }
        return;
    }
    if (trouble === STUNNED) {
        hero.stunnedTurns = 0;
        refreshProperty('stunned', state);
        if (talk) {
            await publish(`You feel ${
                heroIsHallucinating(state) ? 'less wobbly' : 'a bit steadier'
            } now.`);
        }
        return;
    }
    hero.deafTurns = 0;
    syncDeafness(state);
    if (talk && !heroIsDeaf(state)) await publish('You can hear again.');
}

async function causeHornTrouble(
    object: GameObject, state: GameState, publish: MessagePublisher,
    random: typeof rn2, rollDice: typeof d,
): Promise<HornTrouble> {
    const extraTurns = random(90) + 10;
    const trouble = Math.trunc(random(13) / 2);
    if (trouble === 0) {
        const currentTurns = state.u?.sickTurns ?? 0;
        const constitution = currentAttribute(A_CON, state);
        await startHeroSickness({
            state, publish,
            turns: currentTurns
                ? Math.trunc(currentTurns / 3) + 1
                : random(constitution) + 20,
            cause: objectName(object, state),
            type: SICK_NONVOMITABLE,
        });
        return SICK;
    }
    if (trouble === 1) {
        await addBlindness(extraTurns, state, publish);
        return BLIND;
    }
    if (trouble === 2) {
        const hero = state.u;
        if (!(hero.confusionTurns ?? 0) && !heroIsUnaware(state)) {
            await publish(`You suddenly feel ${
                heroIsHallucinating(state) ? 'trippy' : 'confused'
            }.`);
        }
        hero.confusionTurns = (hero.confusionTurns ?? 0) + extraTurns;
        return CONFUSED;
    }
    if (trouble === 3) {
        await addStun(extraTurns, state, publish);
        return STUNNED;
    }
    if (trouble === 4) {
        if (heroIsVomiting(state)) {
            await vomitHero({ state, publish, random, rollDice });
        } else {
            startHeroVomiting({ state, turns: 14 });
        }
        return VOMITING;
    }
    if (trouble === 5) {
        await makeHallucinated((state.u.hallucinationTurns ?? 0) + extraTurns, { state, publish });
        return HALLUCINATING;
    }
    await addDeafness(extraTurns, state, publish);
    return DEAF;
}

async function addBlindness(turns: number, state: GameState, publish: MessagePublisher) {
    const hero = state.u;
    const wasBlind = heroIsBlind(state);
    setHeroBlindnessTurns((hero.blindTurns ?? 0) + turns, state);
    if (!heroIsUnaware(state) && !wasBlind && heroIsBlind(state)) {
        await publish(heroIsHallucinating(state)
            ? 'Oh, bummer!  Everything is dark!  Help!'
            : 'A cloud of darkness falls upon you.');
    }
}

async function addStun(turns: number, state: GameState, publish: MessagePublisher) {
    const hero = state.u;
    if (!(hero.stunnedTurns ?? 0) && !heroIsUnaware(state)) {
        await publish(hero.usteed
            ? 'You wobble in the saddle.' : 'You stagger...');
    }
    hero.stunnedTurns = (hero.stunnedTurns ?? 0) + turns;
    hero.stunned = true;
}



async function addDeafness(turns: number, state: GameState, publish: MessagePublisher) {
    const hero = state.u;
    const wasDeaf = heroIsDeaf(state);
    hero.deafTurns = (hero.deafTurns ?? 0) + turns;
    syncDeafness(state);
    if (wasDeaf) await publish('Nothing seems to happen.');
    else if (!heroIsUnaware(state)) await publish('You are unable to hear anything.');
}
