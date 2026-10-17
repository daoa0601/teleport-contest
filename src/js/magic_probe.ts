import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
// Probing reveals object descriptions and immediate container contents.
// C refs: zap.c probe_objchain(), probe_monster(), and bhito(WAN_PROBING).
import { game } from './gstate.js';
import { plineWithContinuation as pline, randomDisplayMonsterName } from './display.js';
import type { MessagePublisher } from './display.js';
import { isContainer } from './container.js';
import { inventoryItemDescription } from './invent.js';
import { definiteName, definiteObjectAction, objectName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterStatusLine } from './monster_status.js';
import { CHEST, EGG, LARGE_BOX, STATUE, TIN } from './object_data.js';
import { observeObject } from './object_knowledge.js';
import { heroIsHallucinating } from './senses.js';
import { showInventoryWindow } from './windows.js';

function schroedingersBox(object: GameObject) {
    return object.otyp === LARGE_BOX && object.spe === 1;
}

export async function probeMonster(monster: Monster, {
    state = game, onHead = true, x = monster.mx, y = monster.my, publish = pline,
}: { state?: GameState; onHead?: boolean; x?: number; y?: number; publish?: MessagePublisher } = {}) {
    await publish(await monsterStatusLine(monster, { state, x, y }));
    if (!onHead) return;
    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.length) {
        const carryingHero = state.u.uswallow && state.u.ustuck === monster;
        await publish(`${monsterName(monster, { state, capitalized: true, suppressIt: true })} is not carrying anything${carryingHero ? ' besides you' : ''}.`);
        return;
    }
    probeObjectChain(inventory, { state });
    const name = monsterName(monster, { state, capitalized: true, suppressIt: true });
    await showInventoryWindow([{ heading: '', items: inventory.map(object => ({ text: inventoryItemDescription(object) })) }], {
        title: `${possessiveName(name)} possessions:`,
    });
}

export function probeObjectChain(inventory: readonly GameObject[], { state = game }: { state?: GameState } = {}) {
    for (const object of inventory) {
        observeObject(object, state);
        if (isContainer(object) || object.otyp === STATUE) {
            object.lknown = true;
            if (!schroedingersBox(object)) object.cknown = true;
        } else if (object.otyp === TIN) object.known = true;
    }
}

export async function probeObject(object: GameObject, { state = game }: { state?: GameState } = {}) {
    let learned = !object.dknown;
    observeObject(object, state);
    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = object.lknown = true;
        const name = definiteName(objectName(object, state), state);
        if ([CHEST, LARGE_BOX].includes(object.otyp) && !object.tknown) {
            if (object.otrapped) await pline(`${definiteObjectAction(object, 'are', state)} trapped!`);
            object.tknown = true;
        }
        if (!object.contents?.length) await pline(`${definiteObjectAction(object, 'are', state)} empty.`);
        else if (schroedingersBox(object)) {
            const cat = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'cat';
            await pline(`You aren't sure whether ${name} has ${withIndefiniteArticle(cat)} or its corpse inside.`);
            object.cknown = false;
        } else {
            for (const content of object.contents) observeObject(content, state);
            await showInventoryWindow([{ heading: '', items: object.contents.map(content => ({ text: inventoryItemDescription(content) })) }], { title: `Contents of ${name}:` });
        }
        learned = true;
    } else if (object.otyp === TIN) {
        learned ||= !object.known || !object.cknown;
        object.known = object.cknown = true;
    } else if (object.otyp === EGG) {
        learned ||= !object.known && (object.corpsenm ?? -1) >= 0;
        object.known = true;
    }
    return learned;
}
