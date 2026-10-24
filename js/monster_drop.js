// C steal.c:mdrop_obj()/mdrop_special_objs(), mkobj.c:discard_minvent().
import { artifactByName, uncreateArtifact } from './artifacts.js';
import { SHOPBASE, W_SADDLE } from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { petDroppableObject } from './dog.js';
import { landFloorObject } from './floor_effects.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { updateMonsterEquipment } from './monster_equipment.js';
import { removeObjectFromMonsterInventory, unlinkMonsterObject } from './monster_inventory.js';
import { monsterName, possessiveName } from './monster_name.js';
import { GOLD_PIECE } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { observeDistantObjectForNaming } from './objnam.js';
import { objectResistsDestruction } from './object_state.js';
import { relocateObjectRandomly } from './object_teleport.js';
import { rn2 } from './rng.js';
import { roomsAt } from './room.js';
import { costlySpot } from './shk.js';
import { inventoryItem } from './u_init.js';
import { cansee } from './vision.js';
export async function dropMonsterObject(monster, object, state = game, { verbosely = false, publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const x = monster.mx, y = monster.my;
    const worn = object.owornmask ?? 0;
    const name = await distantDropObjectName(object, state);
    if (!await removeObjectFromMonsterInventory(monster, object, state, {
        doExtrinsics: false, silently: true, publish,
    }))
        return null;
    if ((worn & W_SADDLE) && monster.mtame && !object.unpaid
        && costlySpot(x, y, state)
        && roomsAt(level, state.u.ux, state.u.uy, SHOPBASE)
            .includes(level.at(x, y)?.roomno ?? 0)) {
        object.no_charge = true;
    }
    if (verbosely && cansee(x, y))
        await publish(`${monsterName(monster, { state, capitalized: true })} drops ${name}.`);
    const landed = await landFloorObject(object, x, y, {
        state, publish, random,
    });
    // Losing a saddle can kill its rider. Keep the dropped item in the world
    // before dismounting, so a resulting bones file can include it.
    if (!state.program_state?.gameover && monster.mhp > 0 && worn)
        await updateMonsterEquipment(monster, object, false, state, {
            silently: true, publish,
        });
    return landed;
}
async function distantDropObjectName(object, state) {
    observeDistantObjectForNaming(object, state);
    return await inventoryItemDescription(inventoryItem(object));
}
// C steal.c:relobj(). Pets keep their worn gear and useful tools.
export async function releaseMonsterInventory(monster, state = game, { isPet = false, show = true, publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const gameWasOver = state.program_state.gameover;
    const x = monster.mx, y = monster.my;
    const inventory = () => monster.minvent || monster.inventory || [];
    const gold = monster.isgd && inventory().find(object => object.otyp === GOLD_PIECE);
    if (gold) {
        if (canSpotMonster(monster)) {
            const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
            await publish(`${owner} gold ${canSeeMonster(monster)
                ? 'vanishes' : 'seems to vanish'}.`);
        }
        unlinkMonsterObject(monster, gold);
        await deleteObject(gold, state);
    }
    const dropped = [];
    for (let object; (object = isPet ? petDroppableObject(monster) : inventory()[0]);) {
        const landed = await dropMonsterObject(monster, object, state, {
            verbosely: isPet && state.flags?.verbose !== false, publish, random,
        });
        if (landed)
            dropped.push(landed);
        if (!gameWasOver && state.program_state.gameover)
            return dropped;
    }
    if (show && cansee(x, y))
        newsym(x, y);
    return dropped;
}
export async function dropSpecialMonsterObjects(monster, state = game, { publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const questArtifact = artifactByName(state.urole?.artifactName);
    const dropped = [];
    for (const object of [...(monster.minvent || monster.inventory || [])]) {
        if (!objectResistsDestruction(object, 0, 0, random)
            && !(questArtifact && object.oartifact === questArtifact.id))
            continue;
        if (monster.mx) {
            const landed = await dropMonsterObject(monster, object, state, { publish, random });
            if (landed)
                dropped.push(landed);
        }
        else {
            await removeObjectFromMonsterInventory(monster, object, state, {
                silently: true, publish,
            });
            await relocateObjectRandomly(object, { state, publish, random });
            if (object.where !== 'gone')
                dropped.push(object);
        }
    }
    return dropped;
}
export async function discardMonsterInventory(monster, uncreateArtifacts, state = game, { publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const discarded = [];
    for (;;) {
        const object = (monster.minvent || monster.inventory || [])[0];
        if (!object)
            break;
        if (!await removeObjectFromMonsterInventory(monster, object, state, {
            silently: true, publish,
        }))
            return discarded;
        if (uncreateArtifacts && object.oartifact)
            uncreateArtifact(object, state);
        await deleteObject(object, state);
        discarded.push(object);
    }
    return discarded;
}
//# sourceMappingURL=monster_drop.js.map