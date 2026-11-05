// wield.c:ready_ok() — the quiver command's getobj suggestion.
// C refs: wield.c:ready_ok()/setuqwep(); the shared class read is the
// obj.h oclass lookup autoquiver() also uses (dothrow.ts).  Command
// prompts remain in cmd.js.

import { WEAPON_CLASS, COIN_CLASS } from './objclass.js';
import { is_launcher } from './object_properties.js';
import { objectClassForType } from './object_data.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import {
    isLauncherAmmunition, launcherMatchesAmmo,
} from './object_properties.js';

// obj.h's oclass read with the type-table fallback; shared by
// dothrow.c:autoquiver() and wield.c:ready_ok().
export function quiverObjectClass(item: GameObject): number {
    return item.oclass || objectClassForType(item.otyp);
}

// C wield.c:ready_ok(). The empty-quiver choice stays in the caller.
export function readySuggestion(item: GameObject, state: GameState): boolean {
    const quantity = item.quantity ?? item.quan ?? 1;
    if (item === state.uwep
        || (item === state.uswapwep && state.u?.twoweap)) {
        return quantity > 1;
    }
    if (isLauncherAmmunition(item)) {
        return launcherMatchesAmmo(item, state.uwep)
            || launcherMatchesAmmo(item, state.uswapwep);
    }
    if (is_launcher(item)) return false;
    return [WEAPON_CLASS, COIN_CLASS].includes(quiverObjectClass(item));
}
