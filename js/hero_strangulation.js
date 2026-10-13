// Amulet strangulation and its turn countdown.
// C refs: do_wear.c Amulet_on/off(), polyself.c check_strangling(),
// mondata.c can_be_strangled(), timeout.c choke_dialogue()/nh_timeout().
import { exerciseAttribute } from './attrib.js';
import { heroNeckName } from './body_parts.js';
import { A_STR, DIED } from './const.js';
import { displayColorName, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { heroHasNoHead, heroIsBreathless } from './hero_species.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { AMULET_OF_STRANGULATION, OBJECT_NAMES } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { learnObjectType } from './object_knowledge.js';
import { refreshProperty } from './properties.js';
import { rn2 } from './rng.js';
import { stopHeroOccupation } from './occupation.js';
const CHOKING_MESSAGES = [
    'You find it hard to breathe.',
    "You're gasping for air.",
    'You can no longer breathe.',
    "You're turning %s.",
    'You suffocate.',
];
const CONSTRICTION_MESSAGES = [
    'Your %s is becoming constricted.',
    'Your blood is having trouble reaching your brain.',
    'The pressure on your %s increases.',
    'Your consciousness is fading.',
    'You suffocate.',
];
export function heroCanBeStrangled(state = game) {
    if (heroHasNoHead(state))
        return false;
    const form = state.u.umonnum;
    const flags = form === undefined ? 0 : (MONSTER_FLAGS1[form] ?? 0);
    const mindless = !!(flags & 0x00010000);
    return !mindless || !heroIsBreathless(state);
}
export function heroIsStrangled(state = game) {
    return !!state.u.strangled || (state.u.strangledTurns ?? 0) > 0;
}
export function startAmuletStrangulation(state = game) {
    if (!heroCanBeStrangled(state) || heroIsStrangled(state))
        return false;
    learnObjectType(AMULET_OF_STRANGULATION, state);
    state.u.strangledTurns = 6;
    state.context.botl = true;
    refreshProperty('strangled', state);
    return true;
}
export function clearHeroStrangulation(state = game) {
    if (heroIsStrangled(state))
        state.context.botl = true;
    state.u.strangledTurns = 0;
    refreshProperty('strangled', state);
}
export async function stopStrangulationInImmuneForm(state = game, publish = plineWithContinuation) {
    if (!heroIsStrangled(state) || heroCanBeStrangled(state))
        return;
    clearHeroStrangulation(state);
    await publish('You are no longer being strangled.');
}
export async function restartAmuletStrangulation(state = game, publish = plineWithContinuation) {
    const amulet = state.uamul || state.u.uamul;
    if (amulet?.otyp !== AMULET_OF_STRANGULATION || !heroCanBeStrangled(state))
        return;
    const wasStrangled = heroIsStrangled(state);
    state.u.strangledTurns = 6;
    state.context.botl = true;
    refreshProperty('strangled', state);
    const action = wasStrangled ? 'still constricts' : 'begins constricting';
    const name = amulet.dknown === false ? 'amulet'
        : state._knownObjectTypes?.has(amulet.otyp)
            ? OBJECT_NAMES[amulet.otyp] : amulet.name;
    await publish(`Your ${name} ${action} your ${heroNeckName(state)}!`);
    learnObjectType(AMULET_OF_STRANGULATION, state);
}
export async function advanceHeroStrangulation({ state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    const hero = state.u;
    const turns = hero.strangledTurns || 0;
    if (turns <= 0)
        return { died: false };
    if (turns <= 5) {
        const index = 5 - turns;
        const constriction = CONSTRICTION_MESSAGES[index];
        const choking = CHOKING_MESSAGES[index];
        if (constriction === undefined || choking === undefined)
            throw new RangeError(`Invalid strangulation countdown: ${turns}`);
        if (heroIsBreathless(state) || rn2(50) === 0) {
            await publish(constriction.replace('%s', heroNeckName(state)));
        }
        else {
            let message = choking;
            if (message.includes('%s'))
                message = message.replace('%s', displayColorName('blue', state));
            await publish(message);
            await stopHeroOccupation(state, publish);
        }
    }
    await exerciseAttribute(A_STR, false, state);
    hero.strangledTurns = turns - 1;
    if (hero.strangledTurns > 0)
        return { died: false };
    // C done_timeout() keeps the condition visible during death disclosure.
    hero.strangled = true;
    const died = await die({
        killer: hero.uburied ? 'suffocation' : 'strangulation',
        deathType: DIED,
    });
    clearHeroStrangulation(state);
    const amulet = state.uamul || hero.uamul;
    if (!died && amulet?.otyp === AMULET_OF_STRANGULATION) {
        await publish('Your amulet vanishes!');
        await deleteObject(amulet, state);
    }
    return { died };
}
//# sourceMappingURL=hero_strangulation.js.map