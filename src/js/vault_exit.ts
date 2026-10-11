// C vault.c:paygd(). Only openly carried coins can be reclaimed by a guard.
import { RLOC_NOMSG } from './const.js';
import { currency } from './currency.js';
import { plineWithContinuation } from './display.js';
import { placeObject, stack_object } from './floor_object.js';
import { requireInitializedGame } from './gstate.js';
import { heroGoldAmount } from './hero_gold.js';
import { freeInventoryObject } from './hero_inventory.js';
import { make_grave } from './mklev.js';
import { monsterTypeName } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterName } from './monster_name.js';
import { rn2 } from './rng.js';
import { moveMonsterNextToHero } from './teleport.js';
import { findVaultGuard } from './vault_guard.js';
import type { MessagePublisher } from './display.js';

const COIN_CLASS = 12;

export async function payVaultGuardOnExit({
    silent = false, publish = plineWithContinuation, random = rn2,
}: { silent?: boolean; publish?: MessagePublisher; random?: typeof rn2 } = {}): Promise<void> {
    const state = requireInitializedGame();
    const guard = findVaultGuard(state);
    const amount = heroGoldAmount(state);
    if (!amount || !guard) return;

    let x: number, y: number;
    if (state.u.uinvault) {
        if (!silent)
            await publish(`Your ${amount} ${currency(amount, { state, random })} goes into the Magic Memory Vault.`);
        x = state.u.ux;
        y = state.u.uy;
    } else {
        if (guard.mpeaceful) {
            await removeMonsterFromGame(guard);
            return;
        }
        await moveMonsterNextToHero(guard, state, { flags: RLOC_NOMSG, random });
        if (!silent)
            await publish(`${monsterName(guard, { state, capitalized: true })} remits your gold to the vault.`);
        x = guard._egd.vault.lx + random(2);
        y = guard._egd.vault.ly + random(2);
        const role = monsterTypeName(state.u.umonster, !!state.flags.female);
        make_grave(x, y, `To Croesus: here's the gold recovered from ${state.plname} the ${role}.`);
    }

    for (const coins of [...state.inventory]) {
        if (coins.oclass !== COIN_CLASS) continue;
        await freeInventoryObject(coins, state);
        await placeObject(coins, x, y, state);
        await stack_object(coins, state);
    }
    await removeMonsterFromGame(guard);
}
