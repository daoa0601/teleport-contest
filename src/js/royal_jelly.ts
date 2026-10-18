// Applying and eating royal jelly.
// C refs: apply.c use_royal_jelly(), eat.c fpostfx().

import {
    gainHeroStrength,
} from './attrib.js';
import { POISONING } from './const.js';
import { pline, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requirePlayingGame, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import { freeInventoryObject } from './hero_inventory.js';
import { healHeroLegs } from './hero_legs.js';
import { restartEggHatchTimer } from './mklev.js';
import { EGG, LUMP_OF_ROYAL_JELLY } from './object_data.js';
import { deleteObject } from './object_delete.js';
import {
    OBJECT_TIMER_KIND, objectTimers, stopObjectTimer,
} from './object_timers.js';
import { definiteObjectAction, ownedObjectName } from './objnam.js';
import {
    rejoinObjectStack, splitObjectStack,
} from './object_stack.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { addInventoryItem } from './u_init.js';
import {
    heroIsPolymorphed, heroIsUnchanging, polymonHero,
    returnHeroToHumanForm,
} from './polyself.js';
import { rn2, rnd } from './rng.js';

interface JellyUse {
    jelly: GameObject;
    parent: GameObject | null;
}

interface RoyalJellyEffect {
    transformed: boolean;
    died: boolean;
}

const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;

// C use_royal_jelly(): split off one lump (splitobj -> splitbill), then
// freeinv() it so the egg prompt cannot offer it.
async function takeOneJelly(stack: GameObject): Promise<JellyUse> {
    if (!game.inventory.includes(stack)) throw new Error('Royal jelly must be carried before applying it.');
    const parent = stack.quan === 1 ? null : stack;
    const jelly = parent ? splitObjectStack(parent, 1, game) : stack;
    if (!jelly) throw new Error('Could not separate one lump from the royal jelly stack.');
    await freeInventoryObject(jelly, game);
    return { jelly, parent };
}

async function putJellyBack(use: JellyUse): Promise<void> {
    if (use.parent) {
        // C unsplitobj() refuses the freed lump, so it never returns.
        await rejoinObjectStack(use.parent, use.jelly, game);
        return;
    }

    const savedNoMerge = use.jelly.nomerge;
    use.jelly.nomerge = true;
    try {
        await addInventoryItem(use.jelly, null, false);
    } finally {
        if (savedNoMerge === undefined) delete use.jelly.nomerge;
        else use.jelly.nomerge = savedNoMerge;
    }
}

async function consumeJelly(jelly: GameObject): Promise<void> {
    await releaseWeaponSlots(jelly);
    jelly.owornmask = 0;
    jelly.worn = false;
    await deleteObject(jelly);
}

function quiverMessage(egg: GameObject, adverb: 'feebly' | 'briefly'): string {
    return `${definiteObjectAction(egg, 'quiver')} ${adverb}.`;
}

export async function useRoyalJelly(
    stack: GameObject | null | undefined,
    chooseTarget: () => GameObject | null | Promise<GameObject | null>,
): Promise<boolean> {
    if (stack?.otyp !== LUMP_OF_ROYAL_JELLY) return false;
    const use = await takeOneJelly(stack);
    const egg = await chooseTarget();
    if (!egg) {
        await putJellyBack(use);
        return false;
    }

    await pline(`You smear royal jelly all over ${ownedObjectName(egg, game, { capitalized: false })}.`);
    if (egg.otyp !== EGG) {
        await pline('Nothing happens.');
        await consumeJelly(use.jelly);
        return true;
    }
    const oldSpecies = egg.corpsenm ?? -1;
    if (oldSpecies === PM_KILLER_BEE) egg.corpsenm = PM_QUEEN_BEE;

    const wasTimed = objectTimers(egg).length > 0;
    if (use.jelly.cursed) {
        await pline(wasTimed || egg.corpsenm !== oldSpecies
            ? quiverMessage(egg, 'feebly')
            : 'Nothing seems to happen.');
        stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
    } else {
        if ((egg.corpsenm ?? -1) !== -1) {
            if (!wasTimed) restartEggHatchTimer(egg);
            if (use.jelly.blessed && !egg.spe) egg.spe = 2;
        }
        const quivers = (!!egg.timed && !wasTimed) || egg.spe === 2
            || egg.corpsenm !== oldSpecies;
        await pline(quivers
            ? quiverMessage(egg, 'briefly')
            : 'Nothing seems to happen.');
    }

    await consumeJelly(use.jelly);
    return true;
}

export function isRoyalJelly(
    object: GameObject | null | undefined,
): object is GameObject & { otyp: typeof LUMP_OF_ROYAL_JELLY } {
    return object?.otyp === LUMP_OF_ROYAL_JELLY;
}

export async function eatRoyalJelly(jelly: GameObject, {
    state = game,
    publish = plineWithContinuation,
    die = finishHeroDeath,
}: { state?: GameState; publish?: MessagePublisher; die?: DeathHandler } = {}): Promise<RoyalJellyEffect> {
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
            if (rn2(17) === 0) hero.mhmax++;
            hero.mh = hero.mhmax;
        } else if (hero.mh <= 0) {
            const restored = await returnHeroToHumanForm(
                state, { publish, die },
            );
            if (restored.died) return { transformed: true, died: true };
        }
    } else {
        hero.uhp += hitPointChange;
        if (hero.uhp > hero.uhpmax) {
            if (rn2(17) === 0) {
                hero.uhpmax++;
                hero.uhppeak = Math.max(
                    hero.uhppeak, hero.uhpmax,
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
        await healHeroLegs(state, { publish });
    }
    return { transformed: false, died: false };
}
