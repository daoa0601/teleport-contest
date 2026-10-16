// Container use and object transfer.
// C refs: pickup.c use_container(), in_container(), out_container().
import { makePlural } from './object_grammar.js';
import { containerContents } from './container_contents.js';
import { bot, displayMessageWindow, redrawMap, flush_screen, pline, plineWithContinuation } from './display.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { loseHeroHp } from './hero_damage.js';
import { triggerChestTrap } from './chest_trap.js';
import { game } from './gstate.js';
import { startGlobTimeout } from './glob.js';
import { finishInventoryRemoval, useUpInventoryStack } from './hero_inventory.js';
import { setPrimaryWeapon, setSecondaryWeapon, setQuiverObject } from './weapon_slots.js';
import { inventoryItemDescription, inventoryPrimaryHandDetail } from './invent.js';
import { compactInventoryLetters, promptInventoryObject } from './inventory_prompt.js';
import { definiteName, objectCombatName, objectNameIsPlural, observeObjectForNaming, ownedObjectAction, ownedObjectName, ownedSimpleObjectName, simpleObjectName, } from './objnam.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType } from './object_knowledge.js';
import { clearJustPicked } from './just_picked.js';
import { liftObject } from './lift_object.js';
import { objectShedsLight, snuffLitObject } from './light.js';
import { addObjectToContainer } from './object_container.js';
import { useUpFloorObject } from './floor_consumption.js';
import { scatterFloorObjects } from './scatter.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { startCorpseTimeout } from './mklev.js';
import { MONSTER_NAME, MONSTER_SIZE } from './monster_data.js';
import { deleteObject } from './object_delete.js';
import { AMULET_OF_YENDOR, BAG_OF_HOLDING, BELL_OF_OPENING, BOULDER, BAG_OF_TRICKS, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, GOLD_PIECE, ICE_BOX, LARGE_BOX, LEASH, LOADSTONE, OBJECT_BIMANUAL, OBJECT_NAMES, OIL_LAMP, OILSKIN_SACK, POT_OIL, SACK, SPE_BOOK_OF_THE_DEAD, STATUE, TALLOW_CANDLE, WAN_CANCELLATION, WAX_CANDLE, } from './object_data.js';
import { unlinkObject } from './object_location.js';
import { objectQuantity, rejoinObjectStack, splitObjectStack, } from './object_stack.js';
import { OBJECT_TIMER_KIND, stopObjectTimer, } from './object_timers.js';
import { heroHasNoHands } from './polyself.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { d, rn2 } from './rng.js';
import { paranoidYesNoQuit, promptChoice } from './query.js';
import { touchPetrifyingCorpse } from './stoning.js';
import { addPickedInventoryObject } from './pickup.js';
import { nearCapacity, objectWeight, pickupLoadPrefix } from './weight.js';
import { heroHasFreeHand, willWeld } from './weapon_type.js';
import { heroHandName } from './body_parts.js';
import { heroIsBlind } from './senses.js';
import { addShopObjectToBill, currentShopResident, costlySpot } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { currency } from './currency.js';
import { warnAboutRemovedPick } from './container_shop.js';
import { heroGoldObject } from './hero_gold.js';
import { sellHeroDroppedObject, setSellDisposition, SELL_DELIBERATE, SELL_DONTSELL, SELL_NORMAL } from './shop_sell.js';
import { restoreMenuUnderlay, showChoiceWindow, showDisclosureOverlay, showMultiSelectWindow, showTextWindow, } from './windows.js';
import { GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, MENU_COMBINATION, MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL, MENU_ITEMFLAGS_SKIPINVERT, PARANOID_AUTOALL, PARANOID_CONFIRM, W_ACCESSORY, W_ARMOR, } from './const.js';
export const CONTAINER_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, BAG_OF_HOLDING, OILSKIN_SACK, BAG_OF_TRICKS,
]);
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
function containerNoun(container) {
    if ([SACK, OILSKIN_SACK, BAG_OF_HOLDING].includes(container.otyp))
        return 'bag';
    return OBJECT_NAMES[container.otyp] || container.name || 'container';
}
function objectDescription(object, primaryHandDetail = null) {
    if (object.otyp === GOLD_PIECE) {
        const amount = quantity(object);
        return `${amount} gold piece${amount === 1 ? '' : 's'}`;
    }
    return inventoryItemDescription(object, { primaryHandDetail });
}
function className(object) {
    return objectClassHeading(object.oclass || objectClassForType(object.otyp));
}
function objectsByClass(objects) {
    const groups = new Map();
    for (const object of objects) {
        const name = className(object);
        const members = groups.get(name) ?? [];
        members.push(object);
        groups.set(name, members);
    }
    const headings = [...inventoryClassOrder(), 17, 0].map(objectClassHeading);
    return headings.filter(name => groups.has(name))
        .map(name => ({ name, members: groups.get(name) ?? [] }));
}
function bucCategory(object) {
    if (object.oclass === 12)
        return game.flags?.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest')
        object.bknown = true;
    if (!object.bknown)
        return 'X';
    if (object.blessed)
        return 'B';
    if (object.cursed)
        return 'C';
    return 'U';
}
// C pickup.c:query_category(), for menu_loot's ALL_TYPES/UNPAID/BUCX/
// CHOOSE_ALL/JUSTPICKED flags. Special filters stay out of menu inversion.
function categoryChoices(objects) {
    const groups = objectsByClass(objects);
    const showAll = groups.length > 1;
    const verifyAll = !!((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL);
    const choices = [{
            key: 'A', text: 'Auto-select every relevant item',
            itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: () => false, filter: 'auto' },
        }];
    if (!verifyAll || showAll) {
        const firstHint = verifyAll ? !game._autoAllImpliedHintShown : !game._autoAllHintShown;
        if (firstHint || game.flags.cmdassist !== false)
            choices.push({ selectable: false, text: verifyAll
                    ? "    (if no other choices are picked, 'a' is implied)"
                    : '    (ignored unless some other choices are also picked)' });
        if (verifyAll)
            game._autoAllImpliedHintShown = true;
        else
            game._autoAllHintShown = true;
    }
    choices.push({ selectable: false, text: '' });
    if (showAll)
        choices.push({
            key: 'a', text: 'All types', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: () => true, filter: 'all' },
        });
    choices.push(...groups.map((group, index) => ({
        key: String.fromCharCode((showAll ? 98 : 97) + index),
        text: group.name,
        groupAccelerator: OBJECT_CLASS_SYMBOLS[group.members[0]?.oclass ?? 0] || '',
        value: { matches: (object) => className(object) === group.name, filter: 'class' },
    })));
    const special = [];
    if (objects.some(hasUnpaidContents))
        special.push({
            key: 'u', text: 'Unpaid items', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: hasUnpaidContents, filter: 'unpaid' },
        });
    const bucNames = {
        B: 'Items known to be Blessed', C: 'Items known to be Cursed',
        U: 'Items known to be Uncursed', X: 'Items of unknown Bless/Curse status',
    };
    for (const category of ['B', 'C', 'U', 'X']) {
        if (objects.some(object => bucCategory(object) === category))
            special.push({
                key: category, text: bucNames[category], itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
                value: { matches: object => bucCategory(object) === category, filter: 'buc' },
            });
    }
    const justPicked = objects.filter(object => object.pickup_prev);
    const onePicked = justPicked.length === 1 ? justPicked[0] : null;
    if (justPicked.length)
        special.push({
            key: 'P', text: onePicked ? `Just picked up: ${objectDescription(onePicked, inventoryPrimaryHandDetail(onePicked))}`
                : 'Items you just picked up', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: object => !!object.pickup_prev, filter: 'picked' },
        });
    if (special.length)
        choices.push({ selectable: false, text: '' }, ...special);
    return choices;
}
function hasUnpaidContents(object) {
    return !!object.unpaid || !!object.contents?.some(hasUnpaidContents);
}
// allow_category(): match one selection in every active filter group.
// Selecting coins by class takes precedence over the other filters.
function categoryMatcher(filters) {
    if (filters.some(filter => filter.filter === 'all'))
        return () => true;
    const classes = filters.filter(filter => filter.filter === 'class');
    const groups = ['class', 'buc', 'unpaid', 'picked'];
    return object => {
        if (object.otyp === GOLD_PIECE && classes.length)
            return classes.some(filter => filter.matches(object));
        return groups.every(group => {
            const members = filters.filter(filter => filter.filter === group);
            return !members.length || members.some(filter => filter.matches(object));
        });
    };
}
async function chooseCategories(title, objects) {
    if (game.flags.menu_style !== undefined && game.flags.menu_style !== MENU_FULL)
        return { matchers: [() => true], autoSelect: false };
    const groups = objectsByClass(objects);
    const knownBuc = new Set(objects.map(bucCategory));
    const onlyGroup = groups[0];
    if (groups.length === 1 && onlyGroup && knownBuc.size <= 1
        && !objects.some(hasUnpaidContents))
        return { matchers: [object => className(object) === onlyGroup.name], autoSelect: false };
    const selected = await showMultiSelectWindow({
        title, sections: [{ heading: '', items: categoryChoices(objects) }], omitHeadings: true,
        returnCounts: true,
    });
    let autoSelect = selected.some(choice => choice.value.filter === 'auto');
    const filters = selected.filter(choice => choice.value.filter !== 'auto').map(choice => choice.value);
    const picked = selected.find(choice => choice.value.filter === 'picked');
    const matchers = filters.length ? [categoryMatcher(filters)] : [];
    if (autoSelect) {
        if ((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL) {
            const answer = await paranoidYesNoQuit(!!((game.flags.paranoia_bits ?? 0) & PARANOID_CONFIRM), 'Really autoselect All?');
            if (answer === 'q')
                return { matchers: [], autoSelect: false };
            autoSelect = answer === 'y';
            if (!matchers.length)
                matchers.push(() => true);
        }
        else if (!matchers.length) {
            await plineWithContinuation('No relevant items selected.');
            autoSelect = false;
        }
    }
    return { matchers, autoSelect, ...(picked ? { justPickedCount: Math.max(0, picked.count) } : {}) };
}
function matchingObjects(objects, matchers) {
    if (!matchers.length)
        return [];
    return objects.filter(object => matchers.some(matches => matches(object)));
}
function selectionSections(objects, useInventoryLetters) {
    const ordered = sortObjects(objects, {
        mode: lootSortMode({ inventoryLetters: useInventoryLetters }),
    });
    for (const object of ordered)
        observeObjectForNaming(object);
    let nextLetter = 0;
    const groups = game.flags.sortpack === false ? [{ name: null, members: ordered }]
        : objectsByClass(ordered);
    return groups.map(group => ({
        heading: group.name,
        items: group.members.map(object => ({
            key: object.otyp === GOLD_PIECE ? '$'
                : useInventoryLetters && object.invlet
                    ? object.invlet
                    : String.fromCharCode(97 + nextLetter++),
            text: objectDescription(object, inventoryPrimaryHandDetail(object)),
            value: object,
        })),
    }));
}
async function chooseObjects(title, objects, useInventoryLetters) {
    if (!objects.length)
        return [];
    return showMultiSelectWindow({
        title,
        sections: selectionSections(objects, useInventoryLetters),
        omitHeadings: game.flags.sortpack === false,
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
export function magicBagExplodes(object, depth = 0) {
    if ((object.otyp === WAN_CANCELLATION
        || object.otyp === BAG_OF_TRICKS)
        && (object.spe ?? 0) <= 0)
        return false;
    const dangerous = object.otyp === BAG_OF_HOLDING
        || object.otyp === BAG_OF_TRICKS
        || object.otyp === WAN_CANCELLATION;
    if (dangerous
        && rn2(1 << Math.min(depth, 7)) <= depth)
        return true;
    return (object.contents || []).some(content => magicBagExplodes(content, depth + 1));
}
async function scatterBagContents(container, state, held) {
    container.in_use = true;
    const contents = [...(container.contents || [])];
    for (const object of contents) {
        if (rn2(13) === 0) {
            unlinkObject(object, state);
            await loseMagicBagItem(object, held, state, true);
            continue;
        }
        object.ox = state.u.ux;
        object.oy = state.u.uy;
        await scatterFloorObjects(object.ox, object.oy, 4, {
            state, onlyObject: object, mayFracture: false,
            publish: plineWithContinuation, heroCaused: !state.context.mon_moving,
            finishMonsterKill: finishHeroMonsterKill,
            finishMonsterDeath: async (monster, options = {}) => {
                if (state.context.mon_moving)
                    return await finishEnvironmentalMonsterDeath(monster, state, options);
                if (options.deathMessage)
                    await plineWithContinuation(options.deathMessage);
                const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, { showKillMessage: false, publish: plineWithContinuation });
                return { survived: !death.killed, heroDied: death.heroDied };
            },
        });
        if (state.program_state.gameover)
            return;
    }
}
// C pickup.c:in_container() names the trigger before either bag blows up.
export async function explodeBag(container, trigger, state, { tipping = false, triggerHeld = true, rebillTrigger = false } = {}) {
    observeObjectForNaming(trigger, { state });
    await plineWithContinuation(tipping ? `As ${objectDescription(trigger)} ${trigger.quan === 1 ? 'tumbles' : 'tumble'} inside, you are blasted by a magical explosion!`
        : `As you put ${objectDescription(trigger)} inside, you are blasted by a magical explosion!`, { urgent: true });
    if (rebillTrigger)
        await addShopObjectToBill(trigger, state, { ininv: false, silent: true });
    if (trigger.otyp === BAG_OF_HOLDING)
        await scatterBagContents(trigger, state, triggerHeld);
    if (state.program_state.gameover)
        return { moved: false, stop: true, message: null };
    await deleteObject(trigger, state);
    const held = container.where === 'inventory';
    if (!held && costlySpot(container.ox, container.oy, state)) {
        const noCharge = container.no_charge;
        await addShopObjectToBill(container, state, { ininv: false });
        if (noCharge === undefined)
            delete container.no_charge;
        else
            container.no_charge = noCharge;
    }
    await scatterBagContents(container, state, held);
    if (state.program_state.gameover)
        return { moved: false, stop: true, message: null };
    if (held)
        await useUpInventoryStack(container, state);
    else
        await useUpFloorObject(container, container.quan, { state });
    await loseHeroHp(d(6, 6), 'magical explosion', { state });
    if (!tipping)
        await bot();
    return { moved: false, destroyedContainer: true, message: null };
}
// C mbag_item_gone(): announce before settling the loss and freeing the item.
export async function loseMagicBagItem(object, held, state = game, silent = false) {
    if (!silent) {
        const known = object.dknown;
        // The message uses prior knowledge, but doname() observes the item.
        observeObjectForNaming(object, { state });
        const name = objectDescription(object);
        await plineWithContinuation(known
            ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${objectNameIsPlural(object, state) ? 'have' : 'has'} vanished!`
            : `You ${heroIsBlind(state) ? 'notice' : 'see'} ${name} disappear!`);
    }
    const keeper = currentShopResident(state);
    const loss = keeper && (held ? object.unpaid : costlySpot(state.u.ux, state.u.uy, state))
        ? await stolenValue(object, state.u.ux, state.u.uy, keeper.mpeaceful, { state, silent: true }) : 0;
    await deleteObject(object, state);
    return loss;
}
async function loseCursedBagContents(container, state) {
    if (container.otyp !== BAG_OF_HOLDING || !container.cursed
        || !container.contents?.length)
        return 0;
    let loss = 0;
    for (const object of [...container.contents]) {
        if (rn2(13) !== 0)
            continue;
        unlinkObject(object, state);
        loss += await loseMagicBagItem(object, container.where === 'inventory', state);
    }
    return loss;
}
function ageStoresFuel(object) {
    return [BRASS_LANTERN, OIL_LAMP, CANDELABRUM_OF_INVOCATION,
        TALLOW_CANDLE, WAX_CANDLE, POT_OIL].includes(object.otyp);
}
function freezeObject(object, state) {
    if (ageStoresFuel(object) || object.ageRelative)
        return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = true;
    if (object.otyp === CORPSE) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.ROT_CORPSE);
        stopObjectTimer(object, OBJECT_TIMER_KIND.REVIVE_MON);
        const traits = object.oextra?.omonst;
        if (object.corpsenm === MONSTER_NAME.indexOf('ice troll') && traits)
            traits.mcan = 0;
    }
    else if (object.globby) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.SHRINK_GLOB);
    }
}
export function thawObject(object, state) {
    if (ageStoresFuel(object))
        return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = false;
    if (object.otyp === CORPSE) {
        object.norevive = (object.oextra?.omonst?.mnum ?? object.corpsenm)
            !== MONSTER_NAME.indexOf('ice troll');
        startCorpseTimeout(object);
    }
    else if (object.globby) {
        startGlobTimeout(object, state, state.moves ?? 0);
    }
}
function cannotFit(object) {
    if ([LARGE_BOX, CHEST, ICE_BOX, BOULDER].includes(object.otyp))
        return true;
    return object.otyp === STATUE
        && (object.corpsenm === undefined ? 0 : MONSTER_SIZE[object.corpsenm] ?? 0) >= 3;
}
function weldedPrimary(object, state) {
    const primary = state.uwep || state.u?.uwep;
    return object === primary && willWeld(object);
}
function rejectedPutMessage(container, object, state) {
    if (object === state.uball || object === state.uchain
        || object === state.u?.uball || object === state.u?.uchain) {
        return 'You must be kidding.';
    }
    if (object === container)
        return 'That would be an interesting topological exercise.';
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))
        return `You cannot ${container.otyp === ICE_BOX ? 'refrigerate' : 'stash'} something you are wearing.`;
    if (object.otyp === LOADSTONE && object.cursed) {
        object.bknown = true;
        return `The stone${quantity(object) === 1 ? '' : 's'} won't leave your person.`;
    }
    if (FORBIDDEN_CONTENTS.has(object.otyp)) {
        return `The ${objectCombatName(object, { state })} cannot be confined in such trappings.`;
    }
    if (object.otyp === LEASH && object.leashmon) {
        observeObjectForNaming(object, { state });
        return `The ${objectCombatName(object, { state })} ${quantity(object) === 1 ? 'is' : 'are'} attached to your pet.`;
    }
    if (weldedPrimary(object, state)) {
        object.bknown = true;
        observeObjectForNaming(object, { state });
        const hand = heroHandName(state);
        return `${ownedObjectAction(object, 'are', state)} welded to your ${OBJECT_BIMANUAL[object.otyp] ? makePlural(hand) : hand}!`;
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
    if (!split)
        return { object, parent: null };
    // splitObjectStack already carried the bill across the split.
    return { object: split, parent: object };
}
// C unsplitobj(): a failed merge leaves the split piece beside its parent.
async function restoreRejectedSplit(transfer, state) {
    if (transfer.parent)
        await rejoinObjectStack(transfer.parent, transfer.object, state);
}
export async function putIntoContainer(container, object, state = game, count = -1) {
    const transfer = splitForTransfer(object, count, state);
    object = transfer.object;
    const rejected = rejectedPutMessage(container, object, state);
    if (rejected) {
        await restoreRejectedSplit(transfer, state);
        return { moved: false, message: rejected };
    }
    if (state.uwep === object)
        await setPrimaryWeapon(null, state);
    if (state.uswapwep === object)
        await setSecondaryWeapon(null, state);
    if (state.uquiver === object)
        await setQuiverObject(null, state);
    if (await touchPetrifyingCorpse(object)) {
        await restoreRejectedSplit(transfer, state);
        return { moved: false, stop: true, message: null };
    }
    if (cannotFit(object)) {
        const message = `You cannot fit the ${objectCombatName(object, { state })} into the ${objectCombatName(container, { state })}.`;
        await restoreRejectedSplit(transfer, state);
        return { moved: false, message };
    }
    state.inventory = state.inventory.filter(candidate => candidate !== object);
    object.where = 'free';
    await finishInventoryRemoval(object, state);
    if (state.program_state?.gameover)
        return { moved: false, stop: true, message: null };
    if (objectShedsLight(object))
        await snuffLitObject(object, state);
    const floorShop = container.where !== 'inventory' && costlySpot(state.u.ux, state.u.uy, state);
    const wasUnpaid = object.unpaid;
    if (floorShop && object.oclass !== 12)
        await sellHeroDroppedObject(object, state.u.ux, state.u.uy, state);
    if (container.otyp === ICE_BOX)
        freezeObject(object, state);
    else if (container.otyp === BAG_OF_HOLDING
        && magicBagExplodes(object)) {
        return await explodeBag(container, object, state, { rebillTrigger: !!(wasUnpaid && floorShop) });
    }
    observeObjectForNaming(container, { state });
    observeObjectForNaming(object, { state });
    const message = `You put ${objectDescription(object)} into the ${objectCombatName(container, { state })}.`;
    await plineWithContinuation(message);
    if (floorShop && object.oclass === 12)
        await sellHeroDroppedObject(object, container.ox, container.oy, state);
    await addObjectToContainer(container, object, state);
    container.cknown = true;
    updateContainerWeights(container);
    state._capacityDirty = true;
    await bot();
    return {
        moved: true,
        message,
    };
}
export async function takeFromContainer(container, object, state = game, count = -1, { resetJustPicked = false, previousCapacity = 0 } = {}) {
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
    // C out_container(): a loadstone is never split here.
    if (object.otyp !== LOADSTONE)
        object = splitForTransfer(object, lift.count, state).object;
    unlinkObject(object, state);
    if (container.otyp === ICE_BOX)
        thawObject(object, state);
    if (!object.unpaid && container.where !== 'inventory'
        && costlySpot(container.ox, container.oy, state)) {
        object.ox = container.ox;
        object.oy = container.oy;
        await addShopObjectToBill(object, state, { ininv: false });
    }
    await warnAboutRemovedPick(object, state);
    if (resetJustPicked)
        clearJustPicked(state);
    const { object: carried, count: addedCount } = await addPickedInventoryObject(object);
    container.cknown = true;
    updateContainerWeights(container);
    state._capacityDirty = true;
    observeObjectForNaming(carried, { state });
    const capacity = nearCapacity(state);
    const prefix = capacity === previousCapacity ? '' : pickupLoadPrefix(capacity);
    const added = { ...carried, quan: addedCount, quantity: addedCount };
    const merged = addedCount < quantity(carried);
    const total = merged ? state.flags.verbose === false ? ''
        : ` (${quantity(carried)} in total).` : '.';
    const description = `${carried.invlet || '$'} - ${objectDescription(added, inventoryPrimaryHandDetail(carried))}${total}`;
    return {
        moved: true,
        message: prefix ? `${prefix} removing ${description}` : description,
    };
}
async function takeSelectedObjects(container, resetPicked) {
    if (!container.contents?.length)
        return { results: [], spentTime: false };
    const categories = await chooseCategories('Take out what type of objects?', container.contents);
    const eligible = matchingObjects(container.contents, categories.matchers);
    if (categories.matchers.length)
        container.cknown = true;
    const selected = categories.autoSelect
        ? eligible.map(value => ({ value, count: -1 }))
        : await chooseObjects('Take out what?', eligible, false);
    const results = [];
    let resetJustPicked = resetPicked;
    let previousCapacity = 0;
    for (const selection of selected) {
        const transfer = splitForTransfer(selection.value, selection.count, game);
        const result = await takeFromContainer(container, transfer.object, game, -1, { resetJustPicked, previousCapacity });
        if (!result.moved)
            await restoreRejectedSplit(transfer, game);
        results.push(result);
        if (result.message)
            await plineWithContinuation(result.message);
        if (result.moved) {
            resetJustPicked = false;
            previousCapacity = nearCapacity(game);
            if (selection.value.oclass === 12)
                await bot();
        }
        if (result.stop)
            break;
    }
    return { results, spentTime: categories.autoSelect
            ? results.some(result => result.moved) : selected.length > 0 };
}
async function putSelectedObjects(container, stashOne = false) {
    // menu_loot queries the whole inventory; only stash-one uses ck_bag.
    const candidates = stashOne
        ? game.inventory.filter(object => object !== container) : game.inventory;
    if (!candidates.some(object => object !== container))
        return { results: [], spentTime: false };
    let selected;
    let spentTime = false;
    if (stashOne) {
        const letters = compactInventoryLetters(candidates.map(object => object.invlet).join(''));
        const choice = await promptInventoryObject(`What do you want to stash? [${letters} or ?*] `, game.inventory, { verb: 'stash', allowCount: true, allowGold: true, allowMenu: true,
            menuItems: candidates, classify: object => object === container ? GETOBJ_EXCLUDE_SELECTABLE : GETOBJ_SUGGEST });
        const object = choice.gold ? heroGoldObject(game) : choice.object;
        if (choice.cancelled || !object)
            return { results: [], spentTime: false };
        // getobj() leaves unsplittable objects whole for in_container's refusal.
        const unsplittable = (object.otyp === LOADSTONE && object.cursed) || weldedPrimary(object, game);
        const count = unsplittable ? -1 : choice.count ?? -1;
        selected = [{ value: object, count }];
    }
    else {
        const categories = await chooseCategories('Put in what type of objects?', candidates);
        const eligible = matchingObjects(candidates, categories.matchers);
        const onePicked = categories.justPickedCount !== undefined
            && candidates.filter(object => object.pickup_prev).length === 1
            ? candidates.find(object => object.pickup_prev) : null;
        if (!categories.autoSelect && onePicked) {
            // menu_loot's single just-picked path keeps a rejected split
            // and charges a turn regardless of in_container's result.
            const transfer = splitForTransfer(onePicked, categories.justPickedCount ?? -1, game);
            const result = await putIntoContainer(container, transfer.object);
            if (!result.moved && result.message)
                await plineWithContinuation(result.message);
            return { results: [result], spentTime: true };
        }
        selected = categories.autoSelect
            ? eligible.map(value => ({ value, count: -1 }))
            : await chooseObjects('Put in what?', eligible, true);
        // The ordinary menu path also charges a turn for a selected item,
        // including a rejection; auto-selection counts successful transfers.
        spentTime = !categories.autoSelect && selected.length > 0;
    }
    const results = [];
    for (const selection of selected) {
        const result = await putIntoContainer(container, selection.value, game, selection.count);
        results.push(result);
        if (!result.moved && result.message)
            await plineWithContinuation(result.message);
        // Stashing one item costs a turn even when it destroys the bag.
        if (stashOne && (result.destroyedContainer || result.stop))
            spentTime = true;
        if (result.destroyedContainer || result.stop)
            break;
    }
    return { results, spentTime: spentTime || results.some(result => result.moved) };
}
function actionKeys() {
    const menuStyle = game.flags.menu_style ?? MENU_FULL;
    return game.flags.lootabc && (menuStyle === MENU_PARTIAL || menuStyle === MENU_FULL)
        ? { takeOut: 'a', putIn: 'b', both: 'c', reverse: 'd', stash: 'e' }
        : { takeOut: 'o', putIn: 'i', both: 'b', reverse: 'r', stash: 's' };
}
async function chooseAction(container, usedTime, moreContainers) {
    const keys = actionKeys();
    const hasContents = !!container.contents?.length;
    const mayTakeOut = hasContents || !container.cknown;
    const mayPutIn = (game.inventory || []).some(object => object !== container);
    const title = mayTakeOut
        ? `Do what with ${ownedObjectName(container, game, { capitalized: false })}?`
        : `${ownedObjectName(container)} is empty.  Do what with it?`;
    const menuStyle = game.flags.menu_style ?? MENU_FULL;
    if (menuStyle === MENU_TRADITIONAL || menuStyle === MENU_COMBINATION) {
        const visibleChoices = `:${mayTakeOut ? 'o' : ''}${mayPutIn ? 'i' : ''}`
            + `${mayTakeOut ? 'b' : ''}${mayPutIn ? 'rs' : ''} ${moreContainers ? 'n' : ''}q`
            + ((game.flags.cmdassist ?? true) ? ' or ?' : '');
        return await promptChoice(title, [':', 'o', 'i', 'b', 'r', 's', 'n', 'q', '?'], moreContainers ? 'n' : 'q', { visibleChoices });
    }
    if (!mayTakeOut && !mayPutIn)
        return keys.both;
    const simpleName = definiteName(simpleObjectName(container));
    const entries = [{ key: ':', text: `Look inside ${simpleName}` }];
    if (mayTakeOut)
        entries.push({ key: keys.takeOut, text: 'take something out' });
    if (mayPutIn)
        entries.push({ key: keys.putIn, text: 'put something in' });
    if (mayTakeOut)
        entries.push({
            key: keys.both, text: `${mayPutIn ? 'both; ' : ''}take out, then put in`,
        });
    if (mayPutIn) {
        entries.push({
            key: keys.reverse, text: `${mayTakeOut ? 'both reversed; ' : ''}put in, then take out`,
        });
        entries.push({ key: keys.stash, text: `stash one item into ${simpleName}` });
    }
    entries.push('');
    if (moreContainers)
        entries.push({ key: 'n', marker: '*', text: 'loot next container' });
    entries.push({ key: 'q', marker: moreContainers ? '-' : '*', text: usedTime ? 'done' : 'do nothing' });
    const valid = [10, 13, 27, 32, 58, 63, 110, 113,
        ...Object.values(keys).map(key => key.charCodeAt(0))];
    const chosen = await showChoiceWindow({
        title,
        entries,
        validKeys: valid,
    });
    if ([10, 13, 32].includes(chosen))
        return moreContainers ? 'n' : 'q';
    return chosen === 27 ? 'q' : String.fromCharCode(chosen);
}
export async function useContainer(container, { held = false, moreContainers = false, underlay = null, resetJustPicked = false, } = {}) {
    setSellDisposition(container.no_charge ? SELL_DONTSELL : SELL_DELIBERATE);
    try {
        return await useContainerActions(container, { held, moreContainers, underlay, resetJustPicked });
    }
    finally {
        setSellDisposition(SELL_NORMAL);
    }
}
async function useContainerActions(container, { held = false, moreContainers = false, underlay = null, resetJustPicked = false, } = {}) {
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
        await plineWithContinuation(`The ${containerNoun(container)} is locked.`);
        if (held)
            await pline('You must put it down to unlock.');
        return { spentTime: false, container };
    }
    if (container.otrapped) {
        const trap = await triggerChestTrap(container);
        return {
            spentTime: true,
            stopLooting: true,
            heroDied: !!trap && 'died' in trap && trap.died,
            container: trap?.destroyed ? null : container,
        };
    }
    const quantumCat = isQuantumBox(container);
    let spentTime = await observeQuantumCat(container);
    let tookOut = false;
    const cursedBag = container.otyp === BAG_OF_HOLDING && container.cursed && container.contents.length > 0;
    const loss = await loseCursedBagContents(container, game);
    if (loss) {
        spentTime = true;
        await plineWithContinuation(`You owe ${loss} ${currency(loss)} for lost merchandise.`);
        updateContainerWeights(container);
    }
    const emptyMessage = container.contents.length ? ''
        : `${ownedSimpleObjectName(container)} is ${quantumCat || cursedBag ? 'now ' : ''}empty.`;
    const keys = actionKeys();
    let action;
    for (;;) {
        action = await chooseAction(container, spentTime, moreContainers);
        if (action === '?') {
            const help = ['Container actions:', '',
                ' : -- Look: examine contents', ' o -- Out: take things out', ' i -- In: put things in',
                ' b -- Both: first take things out, then put things in',
                ' r -- Reversed: put things in, then take things out',
                ' s -- Stash: put one item in', '',
                ...(moreContainers ? [' n -- Next: loot next selected container'] : []),
                ' q -- Quit: finished', ' ? -- Help: display this text.', ''];
            await showTextWindow(help);
            continue;
        }
        if (action !== ':')
            break;
        if (!container.cknown)
            spentTime = true;
        await containerContents([container], false, false, true);
        if (underlay)
            restoreMenuUnderlay(underlay);
    }
    const takeOut = [keys.takeOut, keys.both, keys.reverse].includes(action);
    const putIn = [keys.putIn, keys.both, keys.reverse].includes(action);
    const putInFirst = action === keys.reverse;
    if (takeOut && !putInFirst) {
        if (!container.contents.length) {
            if (!container.cknown)
                spentTime = true;
            container.cknown = true;
            await pline(emptyMessage);
        }
        else {
            const transfer = await takeSelectedObjects(container, resetJustPicked);
            if (transfer.spentTime)
                spentTime = true;
            tookOut = transfer.results.some(result => result.moved);
        }
    }
    if (!game.program_state.gameover && (putIn || action === keys.stash)) {
        const hasOtherInventory = (game.inventory || [])
            .some(object => object !== container);
        if (!hasOtherInventory) {
            await pline(`You don't have anything else to ${action === keys.stash ? 'stash' : 'put in'}.`);
        }
        else {
            const transfer = await putSelectedObjects(container, action === keys.stash);
            const results = transfer.results;
            if (transfer.spentTime)
                spentTime = true;
            if (results.some(result => result.destroyedContainer)) {
                return { spentTime, container: null };
            }
        }
    }
    if (!game.program_state.gameover && takeOut && putInFirst) {
        if (!container.contents.length) {
            if (!container.cknown)
                spentTime = true;
            container.cknown = true;
            await pline(emptyMessage);
        }
        else {
            const transfer = await takeSelectedObjects(container, resetJustPicked);
            if (transfer.spentTime)
                spentTime = true;
            tookOut = transfer.results.some(result => result.moved);
        }
    }
    if (game.program_state.gameover)
        return { spentTime: true, container, heroDied: true };
    if (spentTime)
        container.cknown = true;
    if (underlay)
        restoreMenuUnderlay(underlay);
    await redrawMap();
    await bot();
    await flush_screen(1);
    return { spentTime, container, tookOut, stopLooting: action === 'q' || action === '\x1b' };
}
//# sourceMappingURL=container.js.map