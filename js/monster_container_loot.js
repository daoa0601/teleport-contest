// C muse.c:mloot_container(). Removal precedes the carry check so a carried
// container's contents are not counted twice against the monster's load.
import { thawObject } from './container.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { dist2 } from './hacklib.js';
import { inventoryItemDescription } from './invent.js';
import { monsterCanCarryObject } from './monster_carry.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName, monsterSubjectPronoun } from './monster_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { addObjectToContainer } from './object_container.js';
import { unlinkObject } from './object_location.js';
import { BAG_OF_HOLDING, ICE_BOX } from './object_data.js';
import { objectName, observeDistantObjectForNaming, observeObjectForNaming, pluralizeObjectNoun } from './objnam.js';
import { isQuantumBox } from './quantum_cat.js';
import { rn2 } from './rng.js';
import { objectWeight } from './weight.js';
export async function lootMonsterContainer(monster, container, { state, random = rn2, publish = plineWithContinuation, }) {
    if (!container.contents?.length || container.olocked || isQuantumBox(container)
        || container.otyp === BAG_OF_HOLDING && container.cursed)
        return false;
    const roll = random(10);
    const count = roll < 4 ? 1 : roll < 7 ? 2 : roll < 9 ? 3 : 4;
    const distance = dist2(monster.mx, monster.my, state.u.ux, state.u.uy);
    const visible = canSeeMonster(monster);
    const pronoun = visible ? monsterSubjectPronoun(monster, { state }) : '';
    let name = '';
    let removed = false;
    for (let index = 0; index < count; index++) {
        const contents = container.contents;
        if (!contents?.length || !random(contents.length + 1))
            break;
        const object = contents[random(contents.length)];
        if (!object)
            throw new Error('Monster container selection exceeded its contents');
        container.cknown = false;
        if (!name) {
            if (distance <= 49)
                observeObjectForNaming(container, { state });
            else
                observeDistantObjectForNaming(container, state);
            name = objectName(container, state);
            if (container.quan !== 1)
                name = pluralizeObjectNoun(container, name);
            name = withIndefiniteArticle(name);
        }
        unlinkObject(object, state);
        if (monsterCanCarryObject(monster, object, state, random)) {
            if (visible) {
                const subject = () => monsterName(monster, { state, capitalized: true });
                if (distance > 2)
                    await publish(`${subject()} rummages through ${name}.`, { noRepeat: true });
                else {
                    observeObjectForNaming(object, { state });
                    if (!index)
                        await publish(`${subject()} removes ${await inventoryItemDescription(object)} from ${name}.`);
                    else
                        await publish(`${pronoun.charAt(0).toUpperCase() + pronoun.slice(1)} removes ${await inventoryItemDescription(object)}.`);
                }
            }
            if (container.otyp === ICE_BOX)
                thawObject(object, state);
            await addObjectToMonsterInventory(monster, object, state);
            removed = true;
        }
        else {
            const noMerge = object.nomerge;
            const empty = !container.contents?.length;
            object.nomerge = true;
            await addObjectToContainer(container, object, state);
            if (noMerge === undefined)
                delete object.nomerge;
            else
                object.nomerge = noMerge;
            container.owt = objectWeight(container);
            if (empty)
                break;
        }
    }
    return removed;
}
//# sourceMappingURL=monster_container_loot.js.map