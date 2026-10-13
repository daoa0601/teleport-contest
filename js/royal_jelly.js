// Applying and eating royal jelly.
// C refs: apply.c use_royal_jelly(), eat.c fpostfx().
import { gainHeroStrength, } from './attrib.js';
import { POISONING } from './const.js';
import { pline, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requirePlayingGame, requireLiveGame } from './gstate.js';
import { freeInventoryObject } from './hero_inventory.js';
import { healHeroLegs } from './hero_legs.js';
import { restartEggHatchTimer } from './mklev.js';
import { LUMP_OF_ROYAL_JELLY } from './object_data.js';
import { OBJECT_TIMER_KIND, objectTimers, stopObjectTimer, } from './object_timers.js';
import { moveUsedObjectToBill, } from './shk.js';
import { rejoinObjectStack, splitObjectStack, } from './object_stack.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { heroIsPolymorphed, heroIsUnchanging, polymonHero, returnHeroToHumanForm, } from './polyself.js';
import { rn2, rnd } from './rng.js';
const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;
// C use_royal_jelly(): split off one lump (splitobj -> splitbill), then
// freeinv() it so the egg prompt cannot offer it.
async function takeOneJelly(stack) {
    const inventoryIndex = game.inventory.indexOf(stack);
    if (inventoryIndex < 0)
        throw new Error('Royal jelly must be carried before applying it.');
    const parent = stack.quan === 1 ? null : stack;
    const jelly = parent ? splitObjectStack(parent, 1, game) : stack;
    if (!jelly)
        throw new Error('Could not separate one lump from the royal jelly stack.');
    await freeInventoryObject(jelly, game);
    return { jelly, parent, inventoryIndex };
}
async function putJellyBack(use) {
    if (use.parent) {
        // C unsplitobj() refuses the freed lump, so it never returns.
        await rejoinObjectStack(use.parent, use.jelly, game);
        return;
    }
    const index = Math.max(0, Math.min(use.inventoryIndex, game.inventory.length));
    game.inventory.splice(index, 0, use.jelly);
    use.jelly.where = 'inventory';
}
async function consumeJelly(jelly) {
    await releaseWeaponSlots(jelly);
    jelly.owornmask = 0;
    jelly.worn = false;
    if (!moveUsedObjectToBill(jelly))
        jelly.where = 'gone';
    game._capacityDirty = true;
}
function eggHasHatchTimer(egg) {
    return objectTimers(egg).some(timer => timer.kind === OBJECT_TIMER_KIND.HATCH_EGG);
}
function eggName(egg) {
    return egg.quan === 1 ? 'egg' : `${egg.quan} eggs`;
}
function quiverMessage(egg, adverb) {
    const verb = egg.quan === 1 ? 'quivers' : 'quiver';
    return `The ${eggName(egg)} ${verb} ${adverb}.`;
}
export async function useRoyalJelly(stack, chooseEgg) {
    if (stack?.otyp !== LUMP_OF_ROYAL_JELLY)
        return false;
    const use = await takeOneJelly(stack);
    const egg = await chooseEgg();
    if (!egg) {
        await putJellyBack(use);
        return false;
    }
    await pline(`You smear royal jelly all over your ${eggName(egg)}.`);
    const oldSpecies = egg.corpsenm ?? -1;
    if (oldSpecies === PM_KILLER_BEE)
        egg.corpsenm = PM_QUEEN_BEE;
    const hadTimer = eggHasHatchTimer(egg);
    let quivers = egg.corpsenm !== oldSpecies;
    if (use.jelly.cursed) {
        stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
        await pline(quivers || hadTimer
            ? quiverMessage(egg, 'feebly')
            : 'Nothing seems to happen.');
    }
    else {
        if ((egg.corpsenm ?? -1) >= 0 && !hadTimer) {
            restartEggHatchTimer(egg);
            quivers = eggHasHatchTimer(egg) || quivers;
        }
        if (use.jelly.blessed && !egg.spe) {
            egg.spe = 2;
            quivers = true;
        }
        if (egg.spe === 2)
            quivers = true;
        await pline(quivers
            ? quiverMessage(egg, 'briefly')
            : 'Nothing seems to happen.');
    }
    await consumeJelly(use.jelly);
    return true;
}
export function isRoyalJelly(object) {
    return object?.otyp === LUMP_OF_ROYAL_JELLY;
}
export async function eatRoyalJelly(jelly, { state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    if (heroIsPolymorphed(state) && hero.umonnum === PM_KILLER_BEE
        && !heroIsUnchanging(state)) {
        const transformation = await polymonHero(PM_QUEEN_BEE);
        if (transformation.transformed)
            return { transformed: true, died: !!transformation.died };
    }
    await gainHeroStrength(jelly, 1, { state });
    const hitPointChange = rnd(20) * (jelly.cursed ? -1 : 1);
    state.context.botl = true;
    if (heroIsPolymorphed(state)) {
        hero.mh += hitPointChange;
        if (hero.mh > hero.mhmax) {
            if (rn2(17) === 0)
                hero.mhmax++;
            hero.mh = hero.mhmax;
        }
        else if (hero.mh <= 0) {
            const restored = await returnHeroToHumanForm(state, { publish, die });
            if (restored.died)
                return { transformed: true, died: true };
        }
    }
    else {
        hero.uhp += hitPointChange;
        if (hero.uhp > hero.uhpmax) {
            if (rn2(17) === 0) {
                hero.uhpmax++;
                hero.uhppeak = Math.max(hero.uhppeak, hero.uhpmax);
            }
            hero.uhp = hero.uhpmax;
        }
        else if (hero.uhp <= 0) {
            const died = await die({
                killer: 'rotten lump of royal jelly',
                deathType: POISONING,
            });
            return { transformed: false, died: !!died };
        }
    }
    if (!jelly.cursed) {
        await healHeroLegs(state, { publish });
    }
    return { transformed: false, died: false };
}
//# sourceMappingURL=royal_jelly.js.map