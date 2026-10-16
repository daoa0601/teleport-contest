// C makemon.c:mongets()/mkmonmoney(), also used after ordinary monster birth.
import { P_SHORT_SWORD, P_SABER } from './const.js';
import { game } from './gstate.js';
import { mksobj } from './mklev.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { MONSTER_FLAGS2, MONSTER_SYMBOL, monsterIsPlayerMonster } from './monster_data.js';
import { addCreatedObjectToMonsterInventory, linkCreatedObjectToMonsterInventory } from './monster_inventory.js';
import type { Monster } from './monster_types.js';
import {
    BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, GOLD_PIECE,
    OBJECT_SUBTYPE, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import type { GameObject } from './object_types.js';
import { objectWeight } from './weight.js';
import { rn2 } from './rng.js';

export async function giveMonsterStartingObject(monster: Monster, type: number): Promise<GameObject | null> {
    if (!type) return null;
    const object = await mksobj(type, true, false);
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if (MONSTER_SYMBOL[monster.mnum] === 56) {
        if (object.blessed) {
            object.blessed = false;
            object.cursed = true;
        }
    } else if ((flags & 0x1000) && monsterAlignmentType(monster) === 1) {
        object.cursed = false;
        object.spe = Math.max(0, object.spe);
        object.oerodeproof = true;
        object.oeroded = object.oeroded2 = 0;
        object.orotten = object.odiluted = object.norevive = false;
    } else if (monsterIsPlayerMonster(monster.mnum) && object.oclass === 2
        && (OBJECT_SUBTYPE[type] ?? 0) >= P_SHORT_SWORD
        && (OBJECT_SUBTYPE[type] ?? 0) <= P_SABER) {
        object.spe = 3 + rn2(4);
    }
    if (type === CANDELABRUM_OF_INVOCATION) {
        object.spe = 0;
        object.age = 0;
        object.lamplit = false;
        object.blessed = object.cursed = false;
    } else if (type === BELL_OF_OPENING) {
        object.blessed = object.cursed = false;
    } else if (type === SPE_BOOK_OF_THE_DEAD) {
        object.blessed = false;
        object.cursed = true;
    }
    if (flags & 0x800) {
        if (object.oclass === 2) object.spe = Math.max(1, object.spe);
        else if (object.oclass === 3) object.spe = Math.max(0, object.spe);
    }
    await addCreatedObjectToMonsterInventory(monster, object, game);
    return object.where === 'gone' ? null : object;
}

export async function giveMonsterStartingGold(monster: Monster, amount: number): Promise<void> {
    if (amount <= 0) return;
    const gold = await mksobj(GOLD_PIECE, false, false);
    gold.quan = gold.quantity = amount;
    gold.owt = objectWeight(gold);
    await linkCreatedObjectToMonsterInventory(monster, gold);
}
