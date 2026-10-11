// C invent.c:consume_obj_charge(). Billing can suspend before charge removal.
import { game, requireLiveGame } from './gstate.js';
import { chargeUnpaidUsage } from './shk.js';
export async function consumeObjectCharge(object, { maybeUnpaid = true, state = game, } = {}) {
    requireLiveGame(state);
    if (maybeUnpaid)
        await chargeUnpaidUsage(object, { state });
    object.spe--;
}
//# sourceMappingURL=object_charge.js.map