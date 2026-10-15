// C dothrow.c:thitmonst()'s special-object handoff, before the attack roll.
import { deityName } from './alignment.js';
import { reportHeroEncumbrance } from './attrib.js';
import { STRAT_WAITMASK, isok } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { fullyIdentifyObject } from './invent.js';
import { MONSTER_NAME } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName, possessiveName } from './monster_name.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, OBJECT_UNIQUE } from './object_data.js';
import { definiteName, objectCombatName } from './objnam.js';
import type { GameObject } from './object_types.js';
import { finishQuest, isQuestArtifact, isQuestLeader } from './quest.js';
import { heroIsDeaf } from './senses.js';
import { settleThrownShopObject } from './shk.js';
import { captureThrownObjectFlight } from './thrown_object.js';
import { addInventoryItem } from './u_init.js';

// Null leaves ordinary hit admission to the caller. False means the leader
// could not catch the item, so it falls without an attack roll.
export async function catchQuestObject(monster: Monster, object: GameObject, state: PlayingGameState): Promise<boolean | null> {
    const unique = !!OBJECT_UNIQUE[object.otyp];
    if (!(isQuestArtifact(object, state) || unique
        || object.otyp === FAKE_AMULET_OF_YENDOR && !object.known)
        || !isQuestLeader(monster, state)) return null;
    monster.msleeping = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!monster.mcanmove) return false;

    const name = () => monsterName(monster, { state, capitalized: true, augmentIt: true });
    const itemName = () => definiteName(objectCombatName(object, { state }), state);
    await pline(`${name()} catches ${itemName()}.`);
    if (state.u.uevent?.invoked && unique && object.otyp !== AMULET_OF_YENDOR || !monster.mpeaceful) {
        if (monster.mpeaceful && !heroIsDeaf(state)) {
            fullyIdentifyObject(object, state);
            const item = itemName();
            await pline(`"${possessiveName(item.charAt(0).toUpperCase() + item.slice(1))} part in this is finished."`);
            await pline(`"We will guard it in case it is ever needed again, ${deityName(state.u.ualignbase?.[1] ?? state.u.ualign.type, state)} forbid."`);
        }
        if (state.u.ushops.length || object.unpaid)
            await settleThrownShopObject(object, monster.mx, monster.my, state);
        await addObjectToMonsterInventory(monster, object, state);
        return true;
    }

    // C monnear(): a grid bug cannot move or attack diagonally.
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    const adjacent = distance < 3
        && (distance !== 2 || MONSTER_NAME[monster.mnum] !== 'grid bug');
    await finishQuest(object, state);
    await pline(`${name()} ${adjacent ? 'hands' : 'tosses'} ${itemName()} back to you.`);
    if (!adjacent) {
        const dx = state.u.dx ?? 0, dy = state.u.dy ?? 0;
        const path: Position[] = [];
        if (dx || dy) {
            for (let x = monster.mx - dx, y = monster.my - dy;
                isok(x, y) && (x !== state.u.ux || y !== state.u.uy); x -= dx, y -= dy)
                path.push({ x, y });
        }
        await captureThrownObjectFlight(object, path, state);
    }
    await addInventoryItem(object);
    await reportHeroEncumbrance(state);
    return true;
}
