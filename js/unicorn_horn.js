// Using a unicorn horn as an item or as a polymorphed unicorn's ability.
// C refs: apply.c use_unicorn_horn(), cmd.c domonability().

import {
    A_CON, SICK_ALL, SICK_NONVOMITABLE,
} from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
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
    heroIsBlind, heroIsDeaf, setHeroBlindnessTurns, syncDeafness,
} from './senses.js';

const SICK = 'sickness';
const BLIND = 'blindness';
const HALLUCINATING = 'hallucination';
const VOMITING = 'vomiting';
const CONFUSED = 'confusion';
const STUNNED = 'stun';
const DEAF = 'deafness';

export function heroCanUseUnicornHorn(state = game) {
    const form = heroMonsterForm(state);
    return form !== null && monsterIsUnicorn(form);
}

export async function useUnicornHorn({
    object = null,
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
} = {}) {
    if (object?.cursed) {
        const caused = await causeHornTrouble(
            state, publish, random, rollDice,
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
    const cured = [];
    for (let index = 0; index < cureCount; index++) {
        await cureHornTrouble(troubles[index], state, publish);
        cured.push(troubles[index]);
    }
    if (!cured.length) await publish('Nothing seems to happen.');
    return { used: true, spentTime: true, caused: null, cured };
}

function currentHornTroubles(state) {
    const hero = state.u || {};
    const troubles = [];
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

function swallowedByBlindingMonster(state) {
    if (!state.u?.uswallow || !state.u?.ustuck) return false;
    return (MONSTER_ATTACKS[state.u.ustuck.mnum] || []).some(
        ([attackType, damageType]) =>
            attackType === AT_ENGL && damageType === AD_BLND,
    );
}

function shuffle(values, random) {
    for (let index = values.length - 1; index > 0; index--) {
        const other = random(index + 1);
        if (other === index) continue;
        [values[index], values[other]] = [values[other], values[index]];
    }
}

async function cureHornTrouble(trouble, state, publish) {
    const hero = state.u || (state.u = {});
    const talk = !hero.unaware;
    if (trouble === SICK) {
        cureHeroSickness(state, SICK_ALL);
        await publish('You feel cured.  What a relief!');
        return;
    }
    if (trouble === BLIND) {
        const wasBlind = heroIsBlind(state);
        const result = setHeroBlindnessTurns(hero.ucreamed ?? 0, state);
        if (talk && wasBlind && result.regainedSight) {
            await publish(hero.hallucinating
                ? 'Far out!  Everything is all cosmic again!'
                : 'You can see again.');
        }
        return;
    }
    if (trouble === HALLUCINATING) {
        hero.hallucinationTurns = 0;
        hero.hallucinating = false;
        state.vision_full_recalc = 1;
        if (talk) {
            await publish(`Everything ${
                heroIsBlind(state) ? 'feels' : 'looks'
            } SO boring now.`);
        }
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
                hero.hallucinating ? 'trippy' : 'confused'
            } now.`);
        }
        return;
    }
    if (trouble === STUNNED) {
        hero.stunnedTurns = 0;
        hero.stunned = false;
        if (talk) {
            await publish(`You feel ${
                hero.hallucinating ? 'less wobbly' : 'a bit steadier'
            } now.`);
        }
        return;
    }
    hero.deafTurns = 0;
    syncDeafness(state);
    if (talk && !heroIsDeaf(state)) await publish('You can hear again.');
}

async function causeHornTrouble(state, publish, random, rollDice) {
    const extraTurns = random(90) + 10;
    const trouble = Math.trunc(random(13) / 2);
    if (trouble === 0) {
        const currentTurns = state.u?.sickTurns ?? 0;
        const constitution = Math.max(
            1, state.u?.acurr?.a?.[A_CON] ?? 10,
        );
        const sickness = startHeroSickness({
            state,
            turns: currentTurns
                ? Math.trunc(currentTurns / 3) + 1
                : random(constitution) + 20,
            cause: 'unicorn horn',
            type: SICK_NONVOMITABLE,
        });
        if (sickness.message) await publish(sickness.message);
        return SICK;
    }
    if (trouble === 1) {
        await addBlindness(extraTurns, state, publish);
        return BLIND;
    }
    if (trouble === 2) {
        const hero = state.u || (state.u = {});
        if (!(hero.confusionTurns ?? 0) && !hero.unaware) {
            await publish(`You suddenly feel ${
                hero.hallucinating ? 'trippy' : 'confused'
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
        await addHallucination(extraTurns, state, publish);
        return HALLUCINATING;
    }
    await addDeafness(extraTurns, state, publish);
    return DEAF;
}

async function addBlindness(turns, state, publish) {
    const hero = state.u || (state.u = {});
    const wasBlind = heroIsBlind(state);
    setHeroBlindnessTurns((hero.blindTurns ?? 0) + turns, state);
    if (!hero.unaware && !wasBlind && heroIsBlind(state)) {
        await publish(hero.hallucinating
            ? 'Oh, bummer!  Everything is dark!  Help!'
            : 'A cloud of darkness falls upon you.');
    }
}

async function addStun(turns, state, publish) {
    const hero = state.u || (state.u = {});
    if (!(hero.stunnedTurns ?? 0) && !hero.unaware) {
        await publish(hero.usteed
            ? 'You wobble in the saddle.' : 'You stagger...');
    }
    hero.stunnedTurns = (hero.stunnedTurns ?? 0) + turns;
    hero.stunned = true;
}

async function addHallucination(turns, state, publish) {
    const hero = state.u || (state.u = {});
    const wasHallucinating = !!hero.hallucinating;
    hero.hallucinationTurns = (hero.hallucinationTurns ?? 0) + turns;
    hero.hallucinating = !hero.hallucinationResistance;
    if (!hero.unaware && !wasHallucinating && hero.hallucinating) {
        state.vision_full_recalc = 1;
        await publish(`Oh wow!  Everything ${
            heroIsBlind(state) ? 'feels' : 'looks'
        } so cosmic!`);
    }
}

async function addDeafness(turns, state, publish) {
    const hero = state.u || (state.u = {});
    const wasDeaf = heroIsDeaf(state);
    hero.deafTurns = (hero.deafTurns ?? 0) + turns;
    syncDeafness(state);
    if (wasDeaf) await publish('Nothing seems to happen.');
    else if (!hero.unaware) await publish('You are unable to hear anything.');
}
