// Container use and object transfer.
// C refs: pickup.c use_container(), in_container(), out_container().

import { bot, docrt, flush_screen, pline, plineWithContinuation } from './display.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { triggerChestTrap } from './chest_trap.js';
import { game } from './gstate.js';
import { startGlobTimeout } from './glob.js';
import { addHeroGoldObject } from './hero_gold.js';
import { nhgetch } from './input.js';
import { inventoryItemDescription } from './invent.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import { liftObject } from './lift_object.js';
import { endObjectBurn } from './light.js';
import { addObjectToContainer } from './object_container.js';
import { place_object } from './floor_object.js';
import {
    makemonNear, startCorpseTimeout,
} from './mklev.js';
import { MONSTER_SIZE } from './monster_data.js';
import { deleteObject } from './object_delete.js';
import {
    AMULET_OF_YENDOR, BAG_OF_HOLDING, BELL_OF_OPENING, BOULDER,
    BAG_OF_TRICKS, CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, GOLD_PIECE,
    ICE_BOX,
    LARGE_BOX, LEASH, LOADSTONE, OBJECT_NAMES,
    OILSKIN_SACK, SACK, SPE_BOOK_OF_THE_DEAD, STATUE, WAN_CANCELLATION,
} from './object_data.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import {
    objectQuantity, rejoinObjectStack, splitObjectStack,
} from './object_stack.js';
import {
    OBJECT_TIMER_KIND, stopObjectTimer,
} from './object_timers.js';
import { heroHasNoHands } from './polyself.js';
import { d, rn2 } from './rng.js';
import { rejoinShopBill, splitShopBill } from './shk.js';
import { touchPetrifyingCorpse } from './stoning.js';
import { NO_COLOR } from './terminal.js';
import { assignInventoryLetter } from './u_init.js';
import { objectWeight } from './weight.js';
import { heroHasFreeHand } from './weapon_type.js';
import {
    restoreMenuUnderlay, showChoiceWindow,
    showMultiSelectWindow,
} from './windows.js';
import { W_ACCESSORY, W_ARMOR } from './const.js';

export const CONTAINER_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, BAG_OF_HOLDING, OILSKIN_SACK,
]);

const CLASS_ORDER = [
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems/Stones',
    'Rocks', 'Balls', 'Chains', 'Other',
];

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver',
    'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
    'uleft', 'uright', 'uamul', 'ublindf',
];

const FORBIDDEN_CONTENTS = new Set([
    AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION,
    BELL_OF_OPENING,
    SPE_BOOK_OF_THE_DEAD,
]);

export function isContainer(object) {
    return !!object && CONTAINER_TYPES.has(object.otyp);
}

const quantity = objectQuantity;

function indefiniteArticle(noun) {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function containerNoun(container) {
    if ([SACK, OILSKIN_SACK, BAG_OF_HOLDING].includes(container.otyp))
        return 'bag';
    return OBJECT_NAMES[container.otyp] || container.name || 'container';
}

function containerReference(container, held) {
    return `${held ? 'your' : 'the'} ${containerNoun(container)}`;
}

function objectDescription(object) {
    if (object.otyp === GOLD_PIECE) {
        const amount = quantity(object);
        return `${amount} gold piece${amount === 1 ? '' : 's'}`;
    }
    return inventoryItemDescription(object);
}

function simpleObjectDescription(object) {
    return objectDescription(object).replace(/^(?:an?|the)\s+/, '');
}

function className(object) {
    if (object.otyp === GOLD_PIECE || object.oclass === 12) return 'Coins';
    const names = {
        2: 'Weapons',
        3: 'Armor',
        4: 'Rings',
        5: 'Amulets',
        6: 'Tools',
        7: 'Comestibles',
        8: 'Potions',
        9: 'Scrolls',
        10: 'Spellbooks',
        11: 'Wands',
        13: 'Gems/Stones',
        14: 'Rocks',
        15: 'Balls',
        16: 'Chains',
    };
    return names[object.oclass] || object.class || 'Other';
}

function classOrder(object) {
    const order = CLASS_ORDER.indexOf(className(object));
    return order < 0 ? CLASS_ORDER.length : order;
}

function objectsByClass(objects) {
    const groups = new Map();
    for (const object of objects) {
        const name = className(object);
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(object);
    }
    return [...groups.entries()]
        .map(([name, members]) => ({
            name,
            members,
            order: classOrder(members[0]),
        }))
        .sort((left, right) => left.order - right.order
            || left.name.localeCompare(right.name));
}

function bucCategory(object) {
    if (object.oclass === 12)
        return game.flags?.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest') object.bknown = true;
    if (!object.bknown) return 'X';
    if (object.blessed) return 'B';
    if (object.cursed) return 'C';
    return 'U';
}

function categoryChoices(objects) {
    const groups = objectsByClass(objects);
    const choices = [
        {
            key: 'a', text: 'All types',
            value: { matches: () => true },
        },
        ...groups.map((group, index) => ({
            key: String.fromCharCode(98 + index),
            text: group.name,
            value: {
                matches: object => className(object) === group.name,
            },
        })),
    ];
    const bucNames = {
        B: 'Items known to be Blessed',
        C: 'Items known to be Cursed',
        U: 'Items known to be Uncursed',
        X: 'Items of unknown Bless/Curse status',
    };
    for (const category of ['B', 'C', 'U', 'X']) {
        if (!objects.some(object => bucCategory(object) === category))
            continue;
        choices.push({
            key: category,
            text: bucNames[category],
            value: {
                matches: object => bucCategory(object) === category,
            },
        });
    }
    if (objects.some(object => object.pickup_prev)) {
        choices.push({
            key: 'P', text: 'Items you just picked up',
            value: { matches: object => !!object.pickup_prev },
        });
    }
    return choices;
}

async function chooseCategories(title, objects) {
    const groups = objectsByClass(objects);
    const knownBuc = new Set(objects.map(bucCategory));
    if (groups.length === 1 && knownBuc.size <= 1)
        return [object => className(object) === groups[0].name];

    const selected = await showMultiSelectWindow({
        title,
        sections: [{ heading: '', items: categoryChoices(objects) }],
        omitHeadings: true,
        left: 23,
    });
    return selected.map(choice => choice.matches);
}

function matchingObjects(objects, matchers) {
    if (!matchers.length) return [];
    return objects.filter(object => matchers.some(matches => matches(object)));
}

function selectionSections(objects, useInventoryLetters) {
    let nextLetter = 0;
    return objectsByClass(objects).map(group => ({
        heading: group.name,
        items: [...group.members]
            .sort((left, right) => simpleObjectDescription(left)
                .localeCompare(simpleObjectDescription(right)))
            .map(object => ({
                key: object.otyp === GOLD_PIECE ? '$'
                    : useInventoryLetters && object.invlet
                        ? object.invlet
                        : String.fromCharCode(97 + nextLetter++),
                text: objectDescription(object),
                value: object,
            })),
    }));
}

async function chooseObjects(title, objects, useInventoryLetters) {
    if (!objects.length) return [];
    return showMultiSelectWindow({
        title,
        sections: selectionSections(objects, useInventoryLetters),
        left: 41,
        returnCounts: true,
    });
}

function updateContainerWeights(container) {
    let current = container;
    const visited = new Set();
    while (current && !visited.has(current)) {
        visited.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained' ? current.container : null;
    }
}

function magicBagExplodes(object, depth = 0) {
    if ((object.otyp === WAN_CANCELLATION
            || object.otyp === BAG_OF_TRICKS)
        && (object.spe ?? 0) <= 0) return false;
    const dangerous = object.otyp === BAG_OF_HOLDING
        || object.otyp === BAG_OF_TRICKS
        || object.otyp === WAN_CANCELLATION;
    if (dangerous
        && rn2(1 << Math.min(depth, 7)) <= depth) return true;
    return (object.contents || []).some(content =>
        magicBagExplodes(content, depth + 1));
}

function scatterBagContents(container, state) {
    const contents = [...(container.contents || [])];
    container.contents = [];
    for (const object of contents) {
        object.container = null;
        if (rn2(13) === 0) {
            deleteObject(object, state);
            continue;
        }
        place_object(object, state.u.ux, state.u.uy);
    }
}

function explodeBag(container, trigger, state) {
    const triggerDescription = objectDescription(trigger);
    if (trigger.otyp === BAG_OF_HOLDING)
        scatterBagContents(trigger, state);
    deleteObject(trigger, state);
    scatterBagContents(container, state);
    deleteObject(container, state);
    const damage = d(6, 6);
    state.u.uhp = Math.max(0, (state.u.uhp ?? 1) - damage);
    return {
        moved: false,
        destroyedContainer: true,
        message: `As you put ${triggerDescription} inside, you are blasted by a magical explosion!`,
    };
}

async function loseCursedBagContents(container, state) {
    if (container.otyp !== BAG_OF_HOLDING || !container.cursed
        || !container.contents?.length) return false;
    const vanished = [];
    for (const object of [...container.contents]) {
        if (rn2(13) !== 0) continue;
        vanished.push(objectDescription(object));
        deleteObject(object, state);
    }
    if (!vanished.length) return false;
    updateContainerWeights(container);
    for (const description of vanished) {
        await plineWithContinuation(
            `${description[0].toUpperCase()}${description.slice(1)} vanished!`,
        );
    }
    return true;
}

async function observeQuantumCat(container, state) {
    if (container.otyp !== LARGE_BOX || container.spe !== 1) return false;
    const corpse = container.contents?.find(object => object.otyp === CORPSE);
    const alive = rn2(2) === 0;
    if (alive) {
        const x = container.where === 'floor' ? container.ox : state.u.ux;
        const y = container.where === 'floor' ? container.oy : state.u.uy;
        const cat = await makemonNear(33, x, y);
        if (!cat) return false;
        cat.mpeaceful = 1;
        cat.name = "Schroedinger's Cat";
        if (corpse) deleteObject(corpse, state);
        container.spe = 0;
        state.u.uexp = (state.u.uexp ?? 0) + 10;
        state.score = (state.score ?? 0) + 20;
        await pline("The housecat inside the box is still alive!");
    } else {
        container.spe = 0;
        if (corpse) {
            corpse.age = state.moves ?? 0;
            corpse.corpsenm = 33;
            corpse.oname = "Schroedinger's Cat";
            startCorpseTimeout(corpse);
        }
        state.u.uexp = (state.u.uexp ?? 0) + 20;
        state.score = (state.score ?? 0) + 10;
        await pline('The housecat inside the box is dead!');
    }
    updateContainerWeights(container);
    return true;
}

function clearEquipment(object, state) {
    for (const slot of EQUIPMENT_SLOTS) {
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
    }
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

function removeFromInventory(object, state) {
    state.inventory = (state.inventory || [])
        .filter(candidate => candidate !== object);
    clearEquipment(object, state);
}

function addToInventory(object, state) {
    const existing = (state.inventory || []).find(candidate =>
        mergable(candidate, object, state));
    if (existing)
        return markJustPicked(mergeObjectStacks(existing, object, state));
    object.dknown = true;
    assignInventoryLetter(object);
    object.where = 'inventory';
    state.inventory ||= [];
    state.inventory.push(object);
    return markJustPicked(object);
}

function freezeObject(object, state) {
    if (object.ageRelative) return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = true;
    if (object.otyp === CORPSE) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.ROT_CORPSE);
        stopObjectTimer(object, OBJECT_TIMER_KIND.REVIVE_MON);
    } else if (object.globby) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.SHRINK_GLOB);
    }
}

function thawObject(object, state) {
    if (!object.ageRelative) return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = false;
    if (object.otyp === CORPSE) {
        object.norevive = object.corpsenm === 221 ? 0 : 1;
        startCorpseTimeout(object);
    } else if (object.globby) {
        startGlobTimeout(object, state, state.moves ?? 0);
    }
}

function cannotFit(object) {
    if ([LARGE_BOX, CHEST, ICE_BOX, BOULDER].includes(object.otyp))
        return true;
    return object.otyp === STATUE
        && (MONSTER_SIZE[object.corpsenm] ?? 0) >= 3;
}

function weldedPrimary(object, state) {
    const primary = state.uwep || state.u?.uwep;
    return object === primary && !!object.cursed;
}

function rejectedPutMessage(container, object, state) {
    if (object === state.uball || object === state.uchain
        || object === state.u?.uball || object === state.u?.uchain) {
        return 'You must be kidding.';
    }
    if (object === container)
        return 'That would be an interesting topological exercise.';
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))
        return `You cannot stash ${objectDescription(object)} you are wearing.`;
    if (object.otyp === LOADSTONE && object.cursed) {
        object.bknown = true;
        return `The stone${quantity(object) === 1 ? '' : 's'} won't leave your person.`;
    }
    if (FORBIDDEN_CONTENTS.has(object.otyp)) {
        const noun = OBJECT_NAMES[object.otyp] || object.name || 'object';
        return `${indefiniteArticle(noun)} ${noun} cannot be confined in such trappings.`;
    }
    if (object.otyp === LEASH && object.leashmon)
        return `${objectDescription(object)} is attached to your pet.`;
    if (weldedPrimary(object, state)) {
        object.bknown = true;
        return `${objectDescription(object)} is welded to your hand!`;
    }
    if (cannotFit(object)) {
        return `You cannot fit ${objectDescription(object)} into the ${
            containerNoun(container)}.`;
    }
    return null;
}

function transferQuantity(object, count) {
    const total = quantity(object);
    return count > 0 ? Math.min(Math.trunc(count), total) : total;
}

function splitForTransfer(object, count, state) {
    const amount = transferQuantity(object, count);
    const split = splitObjectStack(object, amount, state);
    if (!split) return { object, parent: null, bill: null };
    const bill = splitShopBill(object, split, state);
    return { object: split, parent: object, bill };
}

function restoreRejectedSplit(transfer, state) {
    if (!transfer.parent) return;
    if (rejoinObjectStack(transfer.parent, transfer.object, state)) {
        rejoinShopBill(transfer.bill);
        return;
    }

    let owner = null;
    if (transfer.parent.where === 'inventory') {
        owner = state.inventory || (state.inventory = []);
    } else if (transfer.parent.where === 'contained') {
        owner = transfer.parent.container?.contents;
    }
    if (!owner || owner.includes(transfer.object)) return;
    const parentIndex = owner.indexOf(transfer.parent);
    owner.splice(parentIndex + 1, 0, transfer.object);
}

export async function putIntoContainer(
    container, object, state = game, count = -1,
) {
    const transfer = splitForTransfer(object, count, state);
    object = transfer.object;
    if (await touchPetrifyingCorpse(object)) {
        restoreRejectedSplit(transfer, state);
        return { moved: false, stop: true, message: null };
    }
    const rejected = rejectedPutMessage(container, object, state);
    if (rejected) {
        restoreRejectedSplit(transfer, state);
        return { moved: false, message: rejected };
    }

    removeFromInventory(object, state);
    if (object.lamplit) endObjectBurn(object, state, state.moves ?? 0);
    if (container.otyp === ICE_BOX) freezeObject(object, state);
    else if (container.otyp === BAG_OF_HOLDING
        && magicBagExplodes(object)) {
        return explodeBag(container, object, state);
    }

    addObjectToContainer(container, object, state);
    container.cknown = true;
    updateContainerWeights(container);
    state._capacityDirty = true;
    return {
        moved: true,
        message: `You put ${objectDescription(object)} into the ${
            containerNoun(container)}.`,
    };
}

export async function takeFromContainer(
    container, object, state = game, count = -1,
    { resetJustPicked = false } = {},
) {
    if (!container.contents?.includes(object))
        return { moved: false, message: null };
    if (object.oartifact) {
        const touch = await touchArtifactByHero(object);
        if (!touch.allowed || touch.died) {
            return {
                moved: false,
                stop: touch.died,
                message: null,
            };
        }
    }
    if (await touchPetrifyingCorpse(object)) {
        return { moved: false, stop: true, message: null };
    }
    const lift = await liftObject({
        object,
        container,
        count: transferQuantity(object, count),
        state,
    });
    if (lift.decision !== 'lift') {
        return {
            moved: false,
            stop: lift.decision === 'stop',
            message: null,
        };
    }

    const transfer = splitForTransfer(object, lift.count, state);
    object = transfer.object;
    if (!transfer.parent) {
        container.contents = container.contents
            .filter(candidate => candidate !== object);
    }
    object.container = null;
    object.where = 'free';
    if (container.otyp === ICE_BOX) thawObject(object, state);
    if (resetJustPicked) clearJustPicked(state);

    let carried;
    if (object.otyp === GOLD_PIECE) {
        carried = addHeroGoldObject(state, object).object;
    } else {
        carried = addToInventory(object, state);
    }
    container.cknown = true;
    updateContainerWeights(container);
    state._capacityDirty = true;
    return {
        moved: true,
        message: `${carried.invlet || '$'} - ${objectDescription(carried)}.`,
    };
}

async function reportResults(results) {
    const messages = results.map(result => result.message).filter(Boolean);
    for (let index = 0; index < messages.length; index++) {
        if (index + 1 < messages.length)
            await plineWithContinuation(messages[index]);
        else await pline(messages[index]);
    }
}

async function takeSelectedObjects(container) {
    if (!container.contents?.length) return [];
    const matchers = await chooseCategories(
        'Take out what type of objects?', container.contents,
    );
    const eligible = matchingObjects(container.contents, matchers);
    const selected = await chooseObjects('Take out what?', eligible, false);
    const results = [];
    let resetJustPicked = true;
    for (const selection of selected) {
        results.push(await takeFromContainer(
            container, selection.value, game, selection.count,
            { resetJustPicked },
        ));
        if (results.at(-1).moved) resetJustPicked = false;
        if (results.at(-1).stop) break;
    }
    await reportResults(results);
    return results;
}

async function putSelectedObjects(container, stashOne = false) {
    const candidates = (game.inventory || [])
        .filter(object => object !== container);
    if (!candidates.length) return [];
    let selected;
    if (stashOne) {
        selected = await chooseObjects('What do you want to stash?', candidates, true);
        selected = selected.slice(0, 1);
    } else {
        const matchers = await chooseCategories(
            'Put in what type of objects?', candidates,
        );
        const eligible = matchingObjects(candidates, matchers);
        selected = await chooseObjects('Put in what?', eligible, true);
    }
    const results = [];
    for (const selection of selected) {
        const result = await putIntoContainer(
            container, selection.value, game, selection.count,
        );
        results.push(result);
        if (result.destroyedContainer || result.stop) break;
    }
    await reportResults(results);
    return results;
}

function contentLines(container) {
    return [...(container.contents || [])]
        .sort((left, right) => classOrder(left) - classOrder(right)
            || simpleObjectDescription(left)
                .localeCompare(simpleObjectDescription(right)))
        .map(object => `  ${objectDescription(object)}`);
}

async function showContents(container) {
    container.cknown = true;
    if (!container.contents?.length) {
        await pline(`The ${containerNoun(container)} is empty.`);
        return;
    }
    const display = game.nhDisplay;
    if (!display) return;
    const left = 41;
    const lines = [
        `Contents of the ${containerNoun(container)}:`,
        '',
        ...contentLines(container),
        '--More--',
    ];
    for (let row = 0; row < lines.length && row < display.rows; row++) {
        for (let col = 38; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < lines[row].length; col++)
            display.setCell(left + col, row, lines[row][col], NO_COLOR, 0);
    }
    display.setCursor(left + 8, Math.min(lines.length - 1, display.rows - 1));
    await nhgetch();
}

function actionKeys() {
    return game.flags?.lootabc
        ? { takeOut: 'a', putIn: 'b', both: 'c', reverse: 'd', stash: 'e' }
        : { takeOut: 'o', putIn: 'i', both: 'b', reverse: 'r', stash: 's' };
}

async function chooseAction(container, held, usedTime, moreContainers) {
    const keys = actionKeys();
    const hasContents = !!container.contents?.length;
    const mayTakeOut = hasContents || !container.cknown;
    const mayPutIn = (game.inventory || []).some(object => object !== container);
    const entries = [`: - Look inside the ${containerNoun(container)}`];
    if (mayTakeOut) entries.push(`${keys.takeOut} - take something out`);
    if (mayPutIn) entries.push(`${keys.putIn} - put something in`);
    if (mayTakeOut) entries.push(
        `${keys.both} - ${mayPutIn ? 'both; ' : ''}take out, then put in`,
    );
    if (mayPutIn) {
        entries.push(
            `${keys.reverse} - ${mayTakeOut ? 'both reversed; ' : ''}put in, then take out`,
        );
        entries.push(`${keys.stash} - stash one item into the ${containerNoun(container)}`);
    }
    entries.push('');
    if (moreContainers) entries.push('n - loot next container');
    entries.push(`q * ${usedTime ? 'done' : 'do nothing'}`);
    const valid = [27, 58, 63, 110, 113,
        ...Object.values(keys).map(key => key.charCodeAt(0))];
    const title = mayTakeOut
        ? `Do what with ${containerReference(container, held)}?`
        : `The ${containerNoun(container)} is empty.  Do what with it?`;
    return String.fromCharCode(await showChoiceWindow({
        title,
        entries,
        left: 38,
        validKeys: valid,
    }));
}

export async function useContainer(container, {
    held = false,
    moreContainers = false,
    underlay = null,
} = {}) {
    if (heroHasNoHands(game)) {
        await pline('You have no hands!');
        return { spentTime: false, container };
    }
    if (!heroHasFreeHand(game)) {
        await pline('You have no free hand.');
        return { spentTime: false, container };
    }

    container.contents ||= [];
    container.lknown = true;
    if (container.olocked) {
        await plineWithContinuation(
            `The ${containerNoun(container)} is locked.`,
        );
        if (held) await pline('You must put it down to unlock.');
        return { spentTime: false, container };
    }
    if (container.otrapped) {
        const trap = await triggerChestTrap(container);
        return {
            spentTime: true,
            container: trap?.destroyed ? null : container,
        };
    }

    let spentTime = await observeQuantumCat(container, game);
    if (await loseCursedBagContents(container, game)) spentTime = true;
    const keys = actionKeys();
    let action;
    for (;;) {
        action = await chooseAction(
            container, held, spentTime, moreContainers,
        );
        if (action !== ':') break;
        if (!container.cknown) spentTime = true;
        await showContents(container);
        if (underlay) restoreMenuUnderlay(underlay);
    }

    const takeOut = [keys.takeOut, keys.both, keys.reverse].includes(action);
    const putIn = [keys.putIn, keys.both, keys.reverse].includes(action);
    const putInFirst = action === keys.reverse;
    let stopped = false;

    if (takeOut && !putInFirst) {
        if (!container.contents.length) {
            if (!container.cknown) spentTime = true;
            container.cknown = true;
            await pline(`The ${containerNoun(container)} is empty.`);
        } else {
            const results = await takeSelectedObjects(container);
            if (results.some(result => result.moved)) spentTime = true;
            stopped = results.some(result => result.stop);
        }
    }

    if (!stopped && (putIn || action === keys.stash)) {
        const hasOtherInventory = (game.inventory || [])
            .some(object => object !== container);
        if (!hasOtherInventory) {
            await pline(`You don't have anything else to ${
                action === keys.stash ? 'stash' : 'put in'}.`);
        } else {
            const results = await putSelectedObjects(
                container, action === keys.stash,
            );
            if (results.some(result => result.moved)) spentTime = true;
            stopped = results.some(result => result.stop);
            if (results.some(result => result.destroyedContainer)) {
                return { spentTime: true, container: null };
            }
        }
    }

    if (!stopped && takeOut && putInFirst && container.contents?.length) {
        const results = await takeSelectedObjects(container);
        if (results.some(result => result.moved)) spentTime = true;
    }

    if (spentTime) container.cknown = true;
    if (underlay) restoreMenuUnderlay(underlay);
    await docrt();
    await bot();
    await flush_screen(1);
    return { spentTime, container };
}
