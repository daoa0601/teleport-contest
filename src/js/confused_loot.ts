// C pickup.c:reverse_loot(): confused looting can display old loot or
// give away a random fraction of one carried gold stack.
import { THRONE, T_LOOTED } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { plineWithContinuation as pline } from './display.js';
import { CHEST, GOLD_PIECE, SPE_WIZARD_LOCK } from './object_data.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { freeInventoryObject } from './hero_inventory.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { addObjectToContainer } from './object_container.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { changeBoxLockByMagic } from './box_magic.js';
import { courtMonsterType, makemonAt } from './mklev.js';
import { inventoryItemDescription, inventoryPrimaryHandDetail } from './invent.js';
import { heroIsDeaf } from './senses.js';
import { objectWeight } from './weight.js';
import { rn2, rnd } from './rng.js';
import type { GameObject } from './object_types.js';

export async function reverseLoot(): Promise<boolean> {
    if (!rn2(3)) {
        let remaining = game.inventory.length;
        for (const object of game.inventory) {
            if (!rn2(remaining + 1)) {
                await pline(`You find old loot: ${object.invlet} - ${inventoryItemDescription(
                    object, { primaryHandDetail: inventoryPrimaryHandDetail(object) })}.`);
                return true;
            }
            remaining--;
        }
        return false;
    }
    let gold = game.inventory.find(object => object.oclass === 12);
    if (!gold) return false;
    const amount = Math.trunc((rnd(5) * objectQuantity(gold) + 4) / 5);
    if (amount < objectQuantity(gold)) gold = splitObjectStack(gold, amount) ?? gold;
    await removeHeroEquipment(gold);
    const { ux: x, uy: y } = game.u;
    const level = requireGameLevel();
    const square = level.requireAt(x, y);
    if (square.typ !== THRONE) {
        await dropInventoryObjectAtHero(gold);
        if (level.objects[x]?.[y]?.some(object => object.otyp === GOLD_PIECE))
            await pline('Ok, now there is loot here.');
        return true;
    }
    const coffers = royalCoffers();
    if (coffers) {
        if (!heroIsDeaf(game)) await pline('"Thank you for your contribution to reduce the debt."');
        await freeInventoryObject(gold);
        await addObjectToContainer(coffers, gold);
        coffers.owt = objectWeight(coffers);
        coffers.cknown = false;
        if (!coffers.olocked) await changeBoxLockByMagic(coffers, { otyp: SPE_WIZARD_LOCK });
    } else {
        const collector = square.looted !== T_LOOTED ? await makemonAt(courtMonsterType(), x, y) : null;
        if (collector) {
            await freeInventoryObject(gold);
            await addObjectToMonsterInventory(collector, gold);
            await pline('The exchequer accepts your contribution.');
            if (!rn2(10)) square.looted = T_LOOTED;
        } else {
            await pline(`You drop ${inventoryItemDescription(gold)}.`);
            await dropInventoryObjectAtHero(gold);
        }
    }
    return true;
}

function royalCoffers(): GameObject | null {
    const { ux: x, uy: y } = game.u;
    const chests = requireGameLevel().objects.flatMap(column => column?.flatMap(pile => pile ?? []) ?? [])
        .filter(object => object.otyp === CHEST)
        .sort((left, right) => (right._fobjOrder ?? 0) - (left._fobjOrder ?? 0));
    const royal = chests.find(object => object.spe === 2);
    if (royal) return royal;
    const distance = (object: GameObject) => (object.ox - x) ** 2 + (object.oy - y) ** 2;
    return chests.reduce<GameObject | null>((nearest, object) =>
        !nearest || distance(object) < distance(nearest) ? object : nearest, null);
}
