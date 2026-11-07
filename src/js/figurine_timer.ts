// figurine_timer.js — the cursed-carried-figurine branch of C invent.c
// carry_obj_effects(); attach_fig_transform_timeout() lives in timeout.ts
// with its timeout.c owner.

import { game } from './gstate.js';
import { FIGURINE } from './object_data.js';
import { attachFigurineTimer } from './timeout.js';
import type { GameState } from './game_state.js';
import type { GameObject, ObjectTimer } from './object_types.js';

// C invent.c:carry_obj_effects()
// Carrying affects the object: a cursed figurine of a live species arms the
// fig_transform timer.  The species/dead_species gate and the scheduling
// are attach_fig_transform_timeout() (timeout.ts:attachFigurineTimer()).
export function carryObjEffects(object: GameObject | null | undefined, state: GameState = game): ObjectTimer | null {
    if (object?.otyp !== FIGURINE || !object.cursed) return null;
    return attachFigurineTimer(object, state);
}
