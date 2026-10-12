// C invent.c:useupf(). Consume floor stock, retaining any used-up shop bill.
import { delobj } from './object_delete.js';
import { splitObjectStack } from './object_stack.js';
import { addShopObjectToBill, costlySpot } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { roomsAt } from './room.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { hideHeroUnder } from './monster_hiding.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';

interface FloorConsumptionOptions { state?: GameState; publish?: MessagePublisher }

export async function useUpFloorObject(object: GameObject, count: number, {
    state = game, publish = plineWithContinuation,
}: FloorConsumptionOptions = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { ox: x, oy: y } = object;
    const consumed = object.quan > count ? splitObjectStack(object, count, state) : object;
    if (!consumed) throw new Error('Floor consumption requires a valid stack quantity');
    if (!state.context.mon_moving && costlySpot(x, y, state)) {
        const room = roomsAt(state.level, x, y)[0];
        if (room !== undefined && state.u.urooms.includes(room))
            await addShopObjectToBill(consumed, state, { ininv: false, silent: false, publish });
        else await stolenValue(consumed, x, y, false, { silent: false, state, publish });
    }
    await delobj(consumed, state);
    if (state.u.ux === x && state.u.uy === y
        && state.u.uundetected && heroFormHidesUnderObjects(state)) hideHeroUnder(state);
}
