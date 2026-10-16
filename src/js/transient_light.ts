// C light.c:show_transient_light()/transient_light_cleanup().
import { canSeeMonster, canSpotMonster, flush_screen, map_invisible } from './display.js';
import { placeObjectSynchronously, remove_object } from './floor_object.js';
import { game, requirePlayingGame } from './gstate.js';
import { objectLightRadius } from './light.js';
import { vision_recalc } from './vision.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

export async function showTransientLight(
    object: GameObject | null, x: number, y: number, state: GameState = game,
): Promise<void> {
    requirePlayingGame(state);
    if (!object && state.level.requireAt(x, y).lit) return;
    const range = object ? objectLightRadius(object, state) : 0;
    if (object) {
        if (!range || object.where !== 'free')
            throw new Error(`Transient light requires a free, lit object: ${object.o_id}`);
        placeObjectSynchronously(object, x, y, state);
    } else {
        (state._transientLights ??= []).unshift({ x, y, range: 0 });
    }
    try {
        vision_recalc(0);
        await flush_screen(0);
        for (const monster of state.level.monsters) {
            if (monster.dead || monster.mhp <= 0 || monster.isgd && !monster.mx) continue;
            const distance = (monster.mx - x) ** 2 + (monster.my - y) ** 2;
            if (distance <= range * range && canSeeMonster(monster)) monster.mtemplit = 1;
        }
        if (object) await state.animationFrame?.();
    } finally {
        if (object) remove_object(object, state);
    }
}

export function discardFlashes(state: GameState = game): void {
    if (!state._transientLights?.length) return;
    delete state._transientLights;
    state.vision_full_recalc = 1;
}

export async function cleanupTransientLight(state: GameState = game): Promise<void> {
    requirePlayingGame(state);
    discardFlashes(state);
    if (state.vision_full_recalc) vision_recalc(0);
    let changed = false;
    for (const monster of state.level.monsters) {
        if (monster.dead || monster.mhp <= 0 || !monster.mtemplit) continue;
        monster.mtemplit = 0;
        changed = true;
        if (!canSpotMonster(monster)) map_invisible(monster.mx, monster.my);
    }
    if (changed) await flush_screen(0);
}
