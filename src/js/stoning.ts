// Shared petrifying contact and delayed hero petrification.
// State helpers serve potion.c make_stoned(); corpse pickup and whip snatching
// share the contact transaction, while egg effects serve eat.c and mthrowu.c.

import type { PetrificationKillerFormat } from './potion.js';
import { KILLED_BY, KILLED_BY_AN } from './const.js';
import { plineWithContinuation } from './pline.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { game } from './gstate.js';
import { MONSTER_NAME, requireMonsterData } from './monster_data.js';
import { CORPSE, EGG } from './object_data.js';
import { polymonHero } from './polyself.js';
import { resolveImmediatePetrification } from './trap.js';
import {
    PM_STONE_GOLEM, touchPetrifies, fleshPetrifies, heroResistsStoning, formCanBecomeStoneGolem,
} from './mondata.js';export function heroIsPetrifying(state: GameState = game): boolean {
    return !!state.u?.stoned || (state.u?.stonedTurns ?? 0) > 0;
}

export function startHeroPetrification({
    state = game,
    turns = 5,
    killer = '',
    killerFormat = KILLED_BY_AN,
}: { state?: GameState; turns?: number; killer?: string; killerFormat?: PetrificationKillerFormat } = {}): boolean {
    const hero = state.u;
    if (heroIsPetrifying(state)
        || hero.stoneResistance) return false;
    hero.stonedTurns = turns;
    hero.stoned = turns > 0;
    if (hero.stoned) state.context.botl = true;
    hero.stoneKiller = killer;
    hero.stoneKillerFormat = killerFormat;
    return hero.stoned;
}

export function clearHeroPetrification(state: GameState = game): boolean {
    const hero = state.u;
    const wasPetrifying = heroIsPetrifying(state);
    if (wasPetrifying) state.context.botl = true;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    delete hero.stoneKillerFormat;
    return wasPetrifying;
}

export function handlesPetrifyingCorpseBareHanded(object: GameObject | null | undefined): object is GameObject {
    return object?.otyp === CORPSE && touchPetrifies(object.corpsenm)
        && !(game.uarmg || game.u?.uarmg) && !heroResistsStoning();
}

export async function petrifyFromCorpseContact(
    message: string, killer: string, beforeDeath: (() => unknown) | null = null,
): Promise<{ died: boolean } | null> {
    // Pickup and snatching try the golem conversion before warning or
    // placing a snatched corpse on the floor for death cleanup.
    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        const result = await polymonHero(PM_STONE_GOLEM);
        if (result.died) return { died: true };
        if (result.transformed) return null;
    }
    await plineWithContinuation(message);
    await beforeDeath?.();
    const result = await resolveImmediatePetrification({
        killer,
        publish: plineWithContinuation,
    });
    return { died: result.died };
}

export async function eatPetrifyingEgg(object: GameObject | null | undefined): Promise<{ started: boolean; transformed?: boolean }> {
    if (object?.otyp !== EGG || !fleshPetrifies(object.corpsenm)
        || heroResistsStoning()) return { started: false };

    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }

    const species = corpseSpeciesName(object);
    const started = startHeroPetrification({
        killer: `${species} egg`,
    });
    return { started, transformed: false };
}

export async function hitByPetrifyingEgg(object: GameObject | null | undefined, state: GameState = game): Promise<{ started: boolean; transformed: boolean }> {
    if (object?.otyp !== EGG || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state)) {
        return { started: false, transformed: false };
    }

    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }

    const started = startHeroPetrification({ state, killer: '', killerFormat: KILLED_BY });
    return { started, transformed: false };
}

function corpseSpeciesName(object: Pick<GameObject, 'corpsenm'>): string {
    if (object.corpsenm === undefined)
        throw new Error('Petrifying contact requires a corpse or egg species.');
    return requireMonsterData(MONSTER_NAME, object.corpsenm);
}

