// figurine_timer.js — the cursed-carried-figurine branch of C invent.c
// carry_obj_effects(); attach_fig_transform_timeout() lives in timeout.ts
// with its timeout.c owner.

import { game } from './gstate.js';
import { attachFigurineTimer } from './timeout.js';
import type { GameState } from './game_state.js';
import type { GameObject, ObjectTimer } from './object_types.js';

// Part of C invent.c:carry_obj_effects(): the cursed-carried-figurine branch
// that attaches the transform timer.
export function attachCursedFigurineTimer(figurine: GameObject | null | undefined, state: GameState = game): ObjectTimer | null {
    if (!figurine?.cursed) return null;
    return attachFigurineTimer(figurine, state);
}
