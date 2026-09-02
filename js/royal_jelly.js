// Applying and eating royal jelly.
// C refs: apply.c use_royal_jelly(), eat.c fpostfx().

import {
    adjustAttribute, attributeChangeMessage,
} from './attrib.js';
import { A_STR, POISONING } from './const.js';
import { pline, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { healHeroLegs } from './hero_legs.js';
import { nextIdent } from './ident.js';
import { restartEggHatchTimer } from './mklev.js';
import { LUMP_OF_ROYAL_JELLY } from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, stopObjectTimer,
} from './object_timers.js';
import {
    moveUsedObjectToBill, rejoinShopBill, splitShopBill,
} from './shk.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { objectWeight } from './weight.js';
import {
    heroIsPolymorphed, polymonHero, rehumanizeHero,
} from './polyself.js';
import { rn2, rnd } from './rng.js';
import { heroIsUnchanging } from './were.js';

const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;

function quantityOf(object) {
    return object.quan ?? object.quantity ?? 1;
}

function takeOneJelly(stack) {
    const inventoryIndex = game.inventory.indexOf(stack);
    if (quantityOf(stack) === 1) {
        game.inventory.splice(inventoryIndex, 1);
        stack.where = 'free';
        return {
            jelly: stack,
            parent: null,
            inventoryIndex,
            billSplit: null,
        };
    }

    const jelly = {
        ...stack,
        o_id: nextIdent(game),
        quan: 1,
        quantity: 1,
        owt: 0,
        owornmask: 0,
        worn: false,
        wielded: false,
        alternate: false,
        ready: false,
        timed: 0,
        objectTimers: [],
        where: 'free',
    };
    jelly.owt = objectWeight(jelly);
    stack.quan = stack.quantity = quantityOf(stack) - 1;
    stack.owt = objectWeight(stack);
    return {
        jelly,
        parent: stack,
        inventoryIndex,
        billSplit: splitShopBill(stack, jelly),
    };
}

function putJellyBack(use) {
    if (use.parent) {
        use.parent.quan = use.parent.quantity = quantityOf(use.parent) + 1;
        use.parent.owt = objectWeight(use.parent);
        rejoinShopBill(use.billSplit);
        use.jelly.where = 'gone';
        return;
    }

    const index = Math.max(0, Math.min(
        use.inventoryIndex, game.inventory.length,
    ));
    game.inventory.splice(index, 0, use.jelly);
    use.jelly.where = 'inventory';
}

function consumeJelly(jelly) {
    releaseWeaponSlots(jelly);
    jelly.owornmask = 0;
    jelly.worn = false;
    if (!moveUsedObjectToBill(jelly)) jelly.where = 'gone';
    game._capacityDirty = true;
}

function eggHasHatchTimer(egg) {
    return objectTimers(egg).some(timer =>
        timer.kind === OBJECT_TIMER_KIND.HATCH_EGG);
}

function eggName(egg) {
    return quantityOf(egg) === 1 ? 'egg' : `${quantityOf(egg)} eggs`;
}

function quiverMessage(egg, adverb) {
    const verb = quantityOf(egg) === 1 ? 'quivers' : 'quiver';
    return `The ${eggName(egg)} ${verb} ${adverb}.`;
}

export async function useRoyalJelly(stack, chooseEgg) {
    if (stack?.otyp !== LUMP_OF_ROYAL_JELLY) return false;
    const use = takeOneJelly(stack);
    const egg = await chooseEgg();
    if (!egg) {
        putJellyBack(use);
        return false;
    }

    await pline(`You smear royal jelly all over your ${eggName(egg)}.`);
    const oldSpecies = egg.corpsenm ?? -1;
    if (oldSpecies === PM_KILLER_BEE) egg.corpsenm = PM_QUEEN_BEE;

    const hadTimer = eggHasHatchTimer(egg);
    let quivers = egg.corpsenm !== oldSpecies;
    if (use.jelly.cursed) {
        stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
        await pline(quivers || hadTimer
            ? quiverMessage(egg, 'feebly')
            : 'Nothing seems to happen.');
    } else {
        if ((egg.corpsenm ?? -1) >= 0 && !hadTimer) {
            restartEggHatchTimer(egg);
            quivers = eggHasHatchTimer(egg) || quivers;
        }
        if (use.jelly.blessed && !egg.spe) {
            egg.spe = 2;
            quivers = true;
        }
        if (egg.spe === 2) quivers = true;
        await pline(quivers
            ? quiverMessage(egg, 'briefly')
            : 'Nothing seems to happen.');
    }

    consumeJelly(use.jelly);
    return true;
}

export function isRoyalJelly(object) {
    return object?.otyp === LUMP_OF_ROYAL_JELLY;
}

async function publishHumanForm(restored, publish) {
    if (!restored.changed) return;
    await publish(`You return to ${restored.race} form!${
        restored.regainedSight ? '  You can see again.' : ''
    }`);
    if (restored.encumbranceMessage)
        await publish(restored.encumbranceMessage);
}

export async function eatRoyalJelly(jelly, {
    state = game,
    publish = plineWithContinuation,
    die = finishHeroDeath,
} = {}) {
    const hero = state.u || (state.u = {});
    if (heroIsPolymorphed(state) && hero.umonnum === PM_KILLER_BEE
        && !heroIsUnchanging(state)) {
        await polymonHero(PM_QUEEN_BEE);
        return { transformed: true, died: false };
    }

    const strength = adjustAttribute(
        A_STR, jelly.cursed ? -1 : 1, state,
    );
    const strengthMessage = attributeChangeMessage(A_STR, strength);
    if (strengthMessage) await publish(strengthMessage);

    const hitPointChange = rnd(20) * (jelly.cursed ? -1 : 1);
    if (heroIsPolymorphed(state)) {
        hero.mh = (hero.mh ?? 0) + hitPointChange;
        if (hero.mh > (hero.mhmax ?? 0)) {
            if (rn2(17) === 0) hero.mhmax = (hero.mhmax ?? 0) + 1;
            hero.mh = hero.mhmax;
        } else if (hero.mh <= 0) {
            await publishHumanForm(rehumanizeHero(state), publish);
        }
    } else {
        hero.uhp = (hero.uhp ?? 0) + hitPointChange;
        if (hero.uhp > (hero.uhpmax ?? 0)) {
            if (rn2(17) === 0) {
                hero.uhpmax = (hero.uhpmax ?? 0) + 1;
                hero.uhppeak = Math.max(
                    hero.uhppeak ?? 0, hero.uhpmax,
                );
            }
            hero.uhp = hero.uhpmax;
        } else if (hero.uhp <= 0) {
            const died = await die({
                killer: 'rotten lump of royal jelly',
                deathType: POISONING,
            });
            return { transformed: false, died: !!died };
        }
    }

    if (!jelly.cursed) {
        const healing = healHeroLegs(state);
        for (const message of healing.messages) await publish(message);
    }
    return { transformed: false, died: false };
}
