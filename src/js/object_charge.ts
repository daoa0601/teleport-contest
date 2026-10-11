// C invent.c:consume_obj_charge(). Billing can suspend before charge removal.
import { game, requireLiveGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { chargeUnpaidUsage } from './shk.js';

export async function consumeObjectCharge(object: GameObject, {
    maybeUnpaid = true, state = game,
}: { maybeUnpaid?: boolean; state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    if (maybeUnpaid) await chargeUnpaidUsage(object, { state });
    object.spe--;
}
