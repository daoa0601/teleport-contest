// C mon.c:mpickstuff(). Selection, visible naming, and transfer are one action.
import { SHOPBASE } from './const.js';
import { cansee } from './vision.js';
import { newsym, plineWithContinuation } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { inventoryItemDescription } from './invent.js';
import { isLevelPrize } from './level_prize.js';
import { monsterCanTouchObject, monsterCarryAmount } from './monster_carry.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterWantsFloorObject } from './monster_item_interest.js';
import { monsterCouldReachItem } from './monster_item_reach.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import type { RandomBelow } from './monster_action_types.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { CORPSE } from './object_data.js';
import { unlinkObject } from './object_location.js';
import { splitObjectStack } from './object_stack.js';
import type { GameObject } from './object_types.js';
import { observeDistantObjectForNaming } from './objnam.js';
import { roomsAt } from './room.js';
import { rn2 } from './rng.js';
import { shopkeeperInOwnShop } from './shk.js';
import { touchPetrifies } from './stoning.js';

const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
const S_NYMPH = 14;
const M1_ACID = 0x08000000;

export async function pickUpMonsterFloorObject(
    monster: Monster, state: PlayingGameState, random: RandomBelow = rn2,
): Promise<boolean> {
    if (shopkeeperInOwnShop(monster, state)) return false;
    if (!monster.mtame && roomsAt(state.level, monster.mx, monster.my, SHOPBASE).length
        && random(25)) return false;
    if (!monsterCouldReachItem(monster, monster.mx, monster.my, state)) return false;

    const pile = state.level.objects[monster.mx]?.[monster.my] ?? [];
    for (const object of pile) {
        if (isLevelPrize(object, state) || !monsterWantsFloorObject(monster, object, state)
            || rejectsOrdinaryCorpse(monster, object) || !monsterCanTouchObject(monster, object, state))
            continue;
        const amount = monsterCarryAmount(monster, object, state, random);
        if (!amount) continue;
        const carried = amount === object.quan ? object : splitObjectStack(object, amount, state);
        if (!carried) throw new Error(`Monster pickup could not split ${amount} objects from stack ${object.o_id}`);
        if (cansee(monster.mx, monster.my)) {
            // Native distant_name names the original stack after splitting,
            // and observes it even when verbose messages are disabled.
            observeDistantObjectForNaming(object, state);
            const name = inventoryItemDescription(object);
            if (state.flags.verbose)
                await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} picks up ${name}.`);
        }
        unlinkObject(carried, state);
        await addObjectToMonsterInventory(monster, carried, state);
        checkMonsterGearNextTurn(monster);
        newsym(monster.mx, monster.my);
        return true;
    }
    return false;
}

function rejectsOrdinaryCorpse(monster: Monster, object: GameObject): boolean {
    if (object.otyp !== CORPSE || MONSTER_SYMBOL[monster.mnum] === S_NYMPH) return false;
    const species = object.corpsenm ?? -1;
    return !touchPetrifies(species) && species !== PM_LIZARD
        && !((MONSTER_FLAGS1[species] ?? 0) & M1_ACID);
}
