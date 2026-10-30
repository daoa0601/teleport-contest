// Probing reveals object descriptions and immediate container contents.
// C refs: zap.c probe_objchain(), probe_monster(), and bhito(WAN_PROBING).
import { game } from './gstate.js';
import { consumeHallucinatedMenuObjectGlyph, plineWithContinuation as pline, randomDisplayMonsterName } from './display.js';
import { isContainer } from './container.js';
import { inventoryItemDescription } from './invent.js';
import { objectDescription } from './object_description.js';
import { definiteName, definiteObjectAction, objectName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterStatusLine } from './monster_status.js';
import { CHEST, EGG, LARGE_BOX, STATUE, TIN } from './object_data.js';
import { observeObject } from './object_knowledge.js';
import { heroIsHallucinating } from './senses.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { objectClassForType } from './object_knowledge.js';
import { showInventoryWindow } from './windows.js';
function schroedingersBox(object) {
    return object.otyp === LARGE_BOX && object.spe === 1;
}
export async function probeMonster(monster, { state = game, onHead = true, x = monster.mx, y = monster.my, publish = pline, } = {}) {
    await publish(await monsterStatusLine(monster, { state, x, y }));
    if (!onHead)
        return;
    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.length) {
        const carryingHero = state.u.uswallow && state.u.ustuck === monster;
        // zap.c:probe_monster() formats the name with noit_Monnam():
        // ARTICLE_YOUR plus SUPPRESS_IT, so a tame carrier reads "Your
        // kitten" and hostiles fall back to "The".
        await publish(`${monsterName(monster, { state, capitalized: true, article: 'your', suppressIt: true })} is not carrying anything${carryingHero ? ' besides you' : ''}.`);
        return;
    }
    probeObjectChain(inventory, { state });
    // invent.c:display_minventory() titles the menu with
    // s_suffix(noit_Monnam(mon)) — ARTICLE_YOUR plus SUPPRESS_IT, matching
    // the empty-carrier message above — and shows the monster's whole
    // inventory through query_objlist() with INVORDER_SORT: entries group
    // by class in inv_order under class headings, the tty layer generates
    // the selector letters, and only a leading gold stack keeps its own
    // '$' selector (pickup.c:1129-1139).
    const name = monsterName(monster, { state, capitalized: true, article: 'your', suppressIt: true });
    await showProbedObjectInventory(inventory, `${possessiveName(name)} possessions:`, { state });
}
// C zap.c:probe_objchain().
export function probeObjectChain(inventory, { state = game } = {}) {
    for (const object of inventory) {
        observeObject(object, state);
        if (isContainer(object) || object.otyp === STATUE) {
            object.lknown = true;
            if (!schroedingersBox(object))
                object.cknown = true;
        }
        else if (object.otyp === TIN)
            object.known = true;
    }
}
export async function probeObject(object, { state = game } = {}) {
    let learned = !object.dknown;
    observeObject(object, state);
    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = object.lknown = true;
        const name = definiteName(objectName(object, state), state);
        if ([CHEST, LARGE_BOX].includes(object.otyp) && !object.tknown) {
            if (object.otrapped)
                await pline(`${definiteObjectAction(object, 'are', state)} trapped!`);
            object.tknown = true;
        }
        if (!object.contents?.length)
            await pline(`${definiteObjectAction(object, 'are', state)} empty.`);
        else if (schroedingersBox(object)) {
            const cat = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'cat';
            await pline(`You aren't sure whether ${name} has ${withIndefiniteArticle(cat)} or its corpse inside.`);
            object.cknown = false;
        }
        else {
            for (const content of object.contents)
                observeObject(content, state);
            await showProbedObjectInventory(object.contents, `Contents of ${await probedContentsTitle(object, state)}:`, { state });
        }
        learned = true;
    }
    else if (object.otyp === TIN) {
        learned ||= !object.known || !object.cknown;
        object.known = object.cknown = true;
    }
    else if (object.otyp === EGG) {
        learned ||= !object.known && (object.corpsenm ?? -1) >= 0;
        object.known = true;
    }
    return learned;
}
// C query_objlist(): PICK_NONE still gives each object a menu identifier,
// so tty assigns letters. INVORDER_SORT adds headings even for one item.
export async function showProbedObjectInventory(objects, title, { state = game, groupByClass = true, } = {}) {
    const sorted = sortObjects(objects, { mode: lootSortMode({ state }), state });
    const sections = [];
    const classes = groupByClass ? inventoryClassOrder(state) : [null];
    let first = true;
    for (const oclass of classes) {
        const members = oclass === null ? sorted
            : sorted.filter(object => (object.oclass || objectClassForType(object.otyp)) === oclass);
        if (!members.length)
            continue;
        const items = [];
        for (const object of members) {
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({
                ...(first && objectClassForType(object.otyp) === 12 ? { key: '$' } : {}),
                text: await inventoryItemDescription(object), value: object,
            });
            first = false;
        }
        sections.push({ heading: oclass === null ? null : objectClassHeading(oclass), items });
    }
    await showInventoryWindow(sections, { title });
}
// C invent.c:cinv_doname(): the probing contents menu names the box with
// "trapped" inserted before its lock state even though doname() already
// shows a just-learned trap, so a trapped box is named twice.
async function probedContentsTitle(object, state) {
    let name = await objectDescription(object, { state });
    if (!object.otrapped)
        return name;
    const locked = name.indexOf(' locked ');
    const unlocked = name.indexOf(' unlocked ');
    if (locked >= 0 && (unlocked < 0 || locked < unlocked))
        name = name.replace(' locked ', ' trapped locked ');
    else if (unlocked >= 0)
        name = name.replace(' unlocked ', ' trapped unlocked ');
    return name.replace('an trapped ', 'a trapped ');
}
//# sourceMappingURL=magic_probe.js.map