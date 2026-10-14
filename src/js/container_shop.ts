// C shk.c:pick_pick(), called by pickup.c:out_container() before addinv().
import { game } from './gstate.js';
import { plineWithContinuation as pline } from './display.js';
import { currentShopResident, shopkeeperInOwnShop } from './shk.js';
import { shopkeeperIsMuted } from './shop_loss.js';
import { shopkeeperCustomerInsult } from './shop_damage.js';
import { shopkeeperName } from './monster_name.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { heroIsDeaf } from './senses.js';
import { isPick } from './weapon_type.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';

const M1_NOEYES = 0x00001000;

export async function warnAboutRemovedPick(object: GameObject, state: GameState = game): Promise<void> {
    if (object.unpaid || !isPick(object)) return;
    const keeper = currentShopResident(state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state)) return;
    if (state.moves !== (state._pickWarningMove ?? 0)) {
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(keeper)) {
            await pline(`"You sneaky ${shopkeeperCustomerInsult(state)}!  Get out of here with that pick!"`);
        } else {
            const hasEyes = !((MONSTER_FLAGS1[keeper.mnum] ?? 0) & M1_NOEYES);
            await pline(`${shopkeeperName(keeper, { state })} ${hasEyes ? 'glares at' : 'is dismayed because of'} your pick!`);
        }
    }
    state._pickWarningMove = state.moves;
}
