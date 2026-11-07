// figurine_timer.js — the cursed-carried-figurine branch of C invent.c
// carry_obj_effects(); attach_fig_transform_timeout() lives in timeout.ts
// with its timeout.c owner.
import { game } from './gstate.js';
import { FIGURINE } from './object_data.js';
import { attachFigurineTimer } from './timeout.js';
// C invent.c:carry_obj_effects()
// Carrying affects the object: a cursed figurine of a live species arms the
// fig_transform timer.  The species/dead_species gate and the scheduling
// are attach_fig_transform_timeout() (timeout.ts:attachFigurineTimer()).
export function carryObjEffects(object, state = game) {
    if (object?.otyp !== FIGURINE || !object.cursed)
        return null;
    return attachFigurineTimer(object, state);
}
//# sourceMappingURL=figurine_timer.js.map