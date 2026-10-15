// C steal.c:maybe_absorb_item(). A mimic can take a carried or flying item.
import { monsterCanTouchArtifact } from './artifacts.js';
import { reportHeroEncumbrance } from './attrib.js';
import { heroHandName } from './body_parts.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { freeInventoryObject } from './hero_inventory.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { objectResistsDestruction } from './object_state.js';
import type { GameObject } from './object_types.js';
import { objectNameIsPlural, observeObjectForNaming, ownedObjectName } from './objnam.js';
import { currentShopResident, removeObjectAndContentsFromBill } from './shk.js';
import { cansee } from './vision.js';

const ROCK_CLASS = 14;

export async function maybeAbsorbItem(
    monster: Monster, object: GameObject, state: GameState = game,
    ordinaryChance = 50, artifactChance = 10,
): Promise<void> {
    if (object === state.uball || object === state.uchain || object.oclass === ROCK_CLASS
        || objectResistsDestruction(object, 100 - ordinaryChance, 100 - artifactChance)
        || !monsterCanTouchArtifact(monster, object, state)) return;

    if (object.where === 'inventory') {
        if (object.owornmask) await removeWornHeroItem(object, state);
        if (state.program_state.gameover) return;
        if (object.unpaid)
            removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
        observeObjectForNaming(object, { state });
        const name = ownedObjectName(object, state, { capitalized: false });
        if (cansee(monster.mx, monster.my)) {
            const subject = monsterName(monster, { capitalized: true, augmentIt: true, state });
            await plineWithContinuation(`${subject} pulls ${name} away from you and absorbs ${object.quan > 1 ? 'them' : 'it'}!`);
        } else {
            const hand = heroHandName(state);
            const hands = OBJECT_BIMANUAL[object.otyp] ? makePlural(hand) : hand;
            const subject = name.charAt(0).toUpperCase() + name.slice(1);
            await plineWithContinuation(`${subject} ${objectNameIsPlural(object, state) ? 'are' : 'is'} pulled from your ${hands}!`);
        }
        await freeInventoryObject(object, state);
        if (state.program_state.gameover) return;
        await reportHeroEncumbrance(state);
    } else if (canSpotMonster(monster)) {
        observeObjectForNaming(object, { state });
        const subject = monsterName(monster, { capitalized: true, state });
        await plineWithContinuation(`${subject} absorbs ${ownedObjectName(object, state, { capitalized: false })}!`);
    }
    await addObjectToMonsterInventory(monster, object, state);
}
