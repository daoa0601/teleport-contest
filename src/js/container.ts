import type { ChoiceMenuEntry } from './windows.js';
// Container use and object transfer.
// C refs: pickup.c use_container(), in_container(), out_container().

import { withIndefiniteArticle } from './object_grammar.js';
import { bot, redrawMap, flush_screen, pline, plineWithContinuation } from './display.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { loseHeroHp } from './hero_damage.js';
import { triggerChestTrap } from './chest_trap.js';
import { game } from './gstate.js';
import { startGlobTimeout } from './glob.js';
import { addHeroGoldObject } from './hero_gold.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { setPrimaryWeapon, setSecondaryWeapon, setQuiverObject } from './weapon_slots.js';
import { nhgetch } from './input.js';
import { inventoryItemDescription, inventoryPrimaryHandDetail } from './invent.js';
import { observeObjectForNaming } from './objnam.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType } from './object_knowledge.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import { liftObject } from './lift_object.js';
import { endObjectBurn } from './light.js';
import { addObjectToContainer } from './object_container.js';
import { placeObject } from './floor_object.js';
import { startCorpseTimeout } from './mklev.js';
import { MONSTER_SIZE } from './monster_data.js';
import { deleteObject } from './object_delete.js';
import {
    AMULET_OF_YENDOR, BAG_OF_HOLDING, BELL_OF_OPENING, BOULDER,
    BAG_OF_TRICKS, CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, GOLD_PIECE,
    ICE_BOX,
    LARGE_BOX, LEASH, LOADSTONE, OBJECT_NAMES,
    OILSKIN_SACK, SACK, SPE_BOOK_OF_THE_DEAD, STATUE, WAN_CANCELLATION,
} from './object_data.js';
import { unlinkObject } from './object_location.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import {
    objectQuantity, rejoinObjectStack, splitObjectStack,
} from './object_stack.js';
import {
    OBJECT_TIMER_KIND, stopObjectTimer,
} from './object_timers.js';
import { heroHasNoHands } from './polyself.js';
import { observeQuantumCat } from './quantum_cat.js';
import { d, rn2 } from './rng.js';

import { getLine, promptChoice } from './query.js';
import { touchPetrifyingCorpse } from './stoning.js';
import { NO_COLOR } from './terminal.js';
import { assignInventoryLetter } from './u_init.js';
import { objectWeight } from './weight.js';
import { heroHasFreeHand } from './weapon_type.js';
import {
    restoreMenuUnderlay, showChoiceWindow,
    showMultiSelectWindow,
} from './windows.js';
import {
    MENU_FULL, MENU_ITEMFLAGS_SKIPINVERT, PARANOID_AUTOALL, PARANOID_CONFIRM,
    W_ACCESSORY, W_ARMOR,
} from './const.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { CountedSelection, MenuUnderlay, MultiSelectItem, MultiSelectSection, SelectableMenuItem } from './windows.js';

type ObjectMatcher = (object: GameObject) => boolean;
interface ContainerCategory {
    matches: ObjectMatcher;
    filter: 'auto' | 'all' | 'class' | 'buc' | 'unpaid' | 'picked';
}
interface CategorySelection {
    matchers: ObjectMatcher[];
    autoSelect: boolean;
    justPickedCount?: number;
}
interface TransferStack { object: GameObject; parent: GameObject | null }
export type ContainerTransferResult =
    | { moved: true; message: string; stop?: never; destroyedContainer?: never }
    | { moved: false; message: string | null; stop?: boolean; destroyedContainer?: never }
    | { moved: false; message: null; stop?: never; destroyedContainer: true };
export interface ContainerUseResult {
    spentTime: boolean;
    container: GameObject | null;
    heroDied?: boolean;
}
interface ContainerUseOptions {
    held?: boolean;
    moreContainers?: boolean;
    underlay?: MenuUnderlay | null;
}

export const CONTAINER_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, BAG_OF_HOLDING, OILSKIN_SACK,
]);

const FORBIDDEN_CONTENTS = new Set([
    AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION,
    BELL_OF_OPENING,
    SPE_BOOK_OF_THE_DEAD,
]);

export function isContainer(object: Pick<GameObject, 'otyp'> | null | undefined): boolean {
    return !!object && CONTAINER_TYPES.has(object.otyp);
}

const quantity = objectQuantity;

function containerNoun(container: GameObject): string {
    if ([SACK, OILSKIN_SACK, BAG_OF_HOLDING].includes(container.otyp))
        return 'bag';
    return OBJECT_NAMES[container.otyp] || container.name || 'container';
}

function containerReference(container: GameObject, held: boolean): string {
    return `${held ? 'your' : 'the'} ${containerNoun(container)}`;
}

function objectDescription(object: GameObject, primaryHandDetail: ReturnType<typeof inventoryPrimaryHandDetail> = null): string {
    if (object.otyp === GOLD_PIECE) {
        const amount = quantity(object);
        return `${amount} gold piece${amount === 1 ? '' : 's'}`;
    }
    return inventoryItemDescription(object, { primaryHandDetail });
}

function className(object: GameObject): string {
    return objectClassHeading(object.oclass || objectClassForType(object.otyp));
}

function objectsByClass(objects: readonly GameObject[]): { name: string; members: GameObject[] }[] {
    const groups = new Map<string, GameObject[]>();
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

function bucCategory(object: GameObject): 'B' | 'C' | 'U' | 'X' {
    if (object.oclass === 12)
        return game.flags?.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest') object.bknown = true;
    if (!object.bknown) return 'X';
    if (object.blessed) return 'B';
    if (object.cursed) return 'C';
    return 'U';
}

// C pickup.c:query_category(), for menu_loot's ALL_TYPES/UNPAID/BUCX/
// CHOOSE_ALL/JUSTPICKED flags. Special filters stay out of menu inversion.
function categoryChoices(objects: readonly GameObject[]): MultiSelectItem<ContainerCategory>[] {
    const groups = objectsByClass(objects);
    const showAll = groups.length > 1;
    const verifyAll = !!((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL);
    const choices: MultiSelectItem<ContainerCategory>[] = [{
        key: 'A', text: 'Auto-select every relevant item',
        itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
        value: { matches: () => false, filter: 'auto' },
    }];
    const firstHint = verifyAll ? !game._autoAllImpliedHintShown : !game._autoAllHintShown;
    if (firstHint || game.flags.cmdassist !== false) {
        if (!verifyAll || showAll) choices.push({ selectable: false, text: verifyAll
            ? "    (if no other choices are picked, 'a' is implied)"
            : '    (ignored unless some other choices are also picked)' });
    }
    if (verifyAll) game._autoAllImpliedHintShown = true;
    else game._autoAllHintShown = true;
    choices.push({ selectable: false, text: '' });
    if (showAll) choices.push({
        key: 'a', text: 'All types', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
        value: { matches: () => true, filter: 'all' },
    });
    choices.push(...groups.map((group, index): SelectableMenuItem<ContainerCategory> => ({
        key: String.fromCharCode((showAll ? 98 : 97) + index),
        text: group.name,
        groupAccelerator: OBJECT_CLASS_SYMBOLS[group.members[0]?.oclass ?? 0] || '',
        value: { matches: (object: GameObject) => className(object) === group.name, filter: 'class' },
    })));
    const special: SelectableMenuItem<ContainerCategory>[] = [];
    if (objects.some(hasUnpaidContents)) special.push({
        key: 'u', text: 'Unpaid items', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
        value: { matches: hasUnpaidContents, filter: 'unpaid' },
    });
    const bucNames = {
        B: 'Items known to be Blessed', C: 'Items known to be Cursed',
        U: 'Items known to be Uncursed', X: 'Items of unknown Bless/Curse status',
    };
    for (const category of ['B', 'C', 'U', 'X'] as const) {
        if (objects.some(object => bucCategory(object) === category)) special.push({
            key: category, text: bucNames[category], itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: object => bucCategory(object) === category, filter: 'buc' },
        });
    }
    const justPicked = objects.filter(object => object.pickup_prev);
    const onePicked = justPicked.length === 1 ? justPicked[0] : null;
    if (justPicked.length) special.push({
        key: 'P', text: onePicked ? `Just picked up: ${objectDescription(onePicked)}`
            : 'Items you just picked up', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
        value: { matches: object => !!object.pickup_prev, filter: 'picked' },
    });
    if (special.length) choices.push({ selectable: false, text: '' }, ...special);
    return choices;
}

function hasUnpaidContents(object: GameObject): boolean {
    return !!object.unpaid || !!object.contents?.some(hasUnpaidContents);
}

// allow_category(): match one selection in every active filter group.
// Selecting coins by class takes precedence over the other filters.
function categoryMatcher(filters: readonly ContainerCategory[]): ObjectMatcher {
    if (filters.some(filter => filter.filter === 'all')) return () => true;
    const classes = filters.filter(filter => filter.filter === 'class');
    const groups = ['class', 'buc', 'unpaid', 'picked'] as const;
    return object => {
        if (object.otyp === GOLD_PIECE && classes.length)
            return classes.some(filter => filter.matches(object));
        return groups.every(group => {
            const members = filters.filter(filter => filter.filter === group);
            return !members.length || members.some(filter => filter.matches(object));
        });
    };
}

async function confirmAutoSelection(): Promise<'y' | 'n' | 'q'> {
    if (!((game.flags.paranoia_bits ?? 0) & PARANOID_CONFIRM))
        return promptChoice('Really autoselect All?', ['y', 'n', 'q'], 'n');
    let prefix = '';
    for (let tries = 0; tries < 6; tries++) {
        const answer = (await getLine(`${prefix}Really autoselect All? [yes|no]`,
            (_character, key) => key >= 32 && key < 127))?.trim().toLowerCase();
        if (answer === 'yes') return 'y';
        if (answer === 'no') return 'n';
        if (answer === undefined || answer === 'quit') return 'q';
        prefix = '"Yes" or "No": ';
    }
    return 'n';
}

async function chooseCategories(title: string, objects: readonly GameObject[]): Promise<CategorySelection> {
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
    const matchers: ObjectMatcher[] = filters.length ? [categoryMatcher(filters)] : [];
    if (autoSelect) {
        if ((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL) {
            const answer = await confirmAutoSelection();
            if (answer === 'q') return { matchers: [], autoSelect: false };
            autoSelect = answer === 'y';
            if (!matchers.length) matchers.push(() => true);
        } else if (!matchers.length) {
            await plineWithContinuation('No relevant items selected.');
            autoSelect = false;
        }
    }
    return { matchers, autoSelect, ...(picked ? { justPickedCount: Math.max(0, picked.count) } : {}) };
}

function matchingObjects(objects: readonly GameObject[], matchers: readonly ObjectMatcher[]): GameObject[] {
    if (!matchers.length) return [];
    return objects.filter(object => matchers.some(matches => matches(object)));
}

function selectionSections(objects: readonly GameObject[], useInventoryLetters: boolean): MultiSelectSection<GameObject>[] {
    const ordered = sortObjects(objects, {
        mode: lootSortMode({ inventoryLetters: useInventoryLetters }),
    });
    for (const object of ordered) observeObjectForNaming(object);
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

async function chooseObjects(title: string, objects: readonly GameObject[], useInventoryLetters: boolean): Promise<CountedSelection<GameObject>[]> {
    if (!objects.length) return [];
    return showMultiSelectWindow({
        title,
        sections: selectionSections(objects, useInventoryLetters),
        omitHeadings: game.flags.sortpack === false,
        returnCounts: true,
    });
}

function updateContainerWeights(container: GameObject): void {
    let current: GameObject | null | undefined = container;
    const visited = new Set<GameObject>();
    while (current && !visited.has(current)) {
        visited.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained' ? current.container : null;
    }
}

function magicBagExplodes(object: GameObject, depth = 0): boolean {
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

async function scatterBagContents(container: GameObject, state: GameState): Promise<void> {
    const contents = [...(container.contents || [])];
    container.contents = [];
    for (const object of contents) {
        // C obj_extract_self(): a scattered content becomes truly free
        // before its arbitrary release placement.
        object.container = null;
        object.where = 'free';
        if (rn2(13) === 0) {
            await deleteObject(object, state);
            continue;
        }
        await placeObject(object, state.u.ux, state.u.uy, state);
    }
}

// C pickup.c:in_container() names the trigger before either bag blows up.
async function explodeBag(container: GameObject, trigger: GameObject, state: GameState): Promise<ContainerTransferResult> {
    observeObjectForNaming(trigger, { state });
    await plineWithContinuation(
        `As you put ${objectDescription(trigger)} inside, you are blasted by a magical explosion!`,
        { urgent: true },
    );
    if (trigger.otyp === BAG_OF_HOLDING)
        await scatterBagContents(trigger, state);
    await deleteObject(trigger, state);
    await scatterBagContents(container, state);
    await deleteObject(container, state);
    await loseHeroHp(d(6, 6), 'magical explosion', { state });
    return { moved: false, destroyedContainer: true, message: null };
}

async function loseCursedBagContents(container: GameObject, state: GameState): Promise<boolean> {
    if (container.otyp !== BAG_OF_HOLDING || !container.cursed
        || !container.contents?.length) return false;
    const vanished: string[] = [];
    for (const object of [...container.contents]) {
        if (rn2(13) !== 0) continue;
        observeObjectForNaming(object, { state });
        vanished.push(objectDescription(object));
        await deleteObject(object, state);
    }
    if (!vanished.length) return false;
    updateContainerWeights(container);
    for (const description of vanished) {
        await plineWithContinuation(
            `${description.charAt(0).toUpperCase()}${description.slice(1)} vanished!`,
        );
    }
    return true;
}

async function addToInventory(object: GameObject, state: GameState): Promise<GameObject> {
    const existing = (state.inventory || []).find(candidate =>
        mergable(candidate, object, state));
    if (existing) {
        const merged = await mergeObjectStacks(existing, object, state);
        if (!merged) throw new Error('A matching inventory stack must accept the container item');
        return markJustPicked(merged);
    }
    assignInventoryLetter(object);
    object.where = 'inventory';
    state.inventory ||= [];
    state.inventory.push(object);
    return markJustPicked(object);
}

function freezeObject(object: GameObject, state: GameState): void {
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

export function thawObject(object: GameObject, state: GameState): void {
    if (!object.ageRelative) return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = false;
    if (object.otyp === CORPSE) {
        object.norevive = object.corpsenm !== 221;
        startCorpseTimeout(object);
    } else if (object.globby) {
        startGlobTimeout(object, state, state.moves ?? 0);
    }
}

function cannotFit(object: GameObject): boolean {
    if ([LARGE_BOX, CHEST, ICE_BOX, BOULDER].includes(object.otyp))
        return true;
    return object.otyp === STATUE
        && (object.corpsenm === undefined ? 0 : MONSTER_SIZE[object.corpsenm] ?? 0) >= 3;
}

function weldedPrimary(object: GameObject, state: GameState): boolean {
    const primary = state.uwep || state.u?.uwep;
    return object === primary && !!object.cursed;
}

function rejectedPutMessage(container: GameObject, object: GameObject, state: GameState): string | null {
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
        const noun = OBJECT_NAMES[object.otyp] || object.name || 'object';
        return `${withIndefiniteArticle(noun)} cannot be confined in such trappings.`;
    }
    if (object.otyp === LEASH && object.leashmon) {
        observeObjectForNaming(object, { state });
        return `${objectDescription(object)} is attached to your pet.`;
    }
    if (weldedPrimary(object, state)) {
        object.bknown = true;
        observeObjectForNaming(object, { state });
        return `${objectDescription(object)} is welded to your hand!`;
    }
    if (cannotFit(object)) {
        observeObjectForNaming(object, { state });
        observeObjectForNaming(container, { state });
        return `You cannot fit ${objectDescription(object)} into the ${
            containerNoun(container)}.`;
    }
    return null;
}

function transferQuantity(object: GameObject, count: number): number {
    const total = quantity(object);
    return count > 0 ? Math.min(Math.trunc(count), total) : total;
}

function splitForTransfer(object: GameObject, count: number, state: GameState): TransferStack {
    const amount = transferQuantity(object, count);
    const split = splitObjectStack(object, amount, state);
    if (!split) return { object, parent: null };
    // splitObjectStack already carried the bill across the split.
    return { object: split, parent: object };
}

// C unsplitobj(): a failed merge leaves the split piece beside its parent.
async function restoreRejectedSplit(transfer: TransferStack, state: GameState): Promise<void> {
    if (transfer.parent) await rejoinObjectStack(transfer.parent, transfer.object, state);
}

export async function putIntoContainer(
    container: GameObject, object: GameObject, state: GameState = game, count = -1,
): Promise<ContainerTransferResult> {
    const transfer = splitForTransfer(object, count, state);
    object = transfer.object;
    if (await touchPetrifyingCorpse(object)) {
        await restoreRejectedSplit(transfer, state);
        return { moved: false, stop: true, message: null };
    }
    const rejected = rejectedPutMessage(container, object, state);
    if (rejected) {
        await restoreRejectedSplit(transfer, state);
        return { moved: false, message: rejected };
    }

    if (state.uwep === object) await setPrimaryWeapon(null, state);
    if (state.uswapwep === object) await setSecondaryWeapon(null, state);
    if (state.uquiver === object) await setQuiverObject(null, state);
    state.inventory = state.inventory.filter(candidate => candidate !== object);
    object.where = 'free';
    await finishInventoryRemoval(object, state);
    if (state.program_state?.gameover)
        return { moved: false, stop: true, message: null };
    if (object.lamplit) endObjectBurn(object, state, state.moves ?? 0);
    if (container.otyp === ICE_BOX) freezeObject(object, state);
    else if (container.otyp === BAG_OF_HOLDING
        && magicBagExplodes(object)) {
        return await explodeBag(container, object, state);
    }

    observeObjectForNaming(container, { state });
    observeObjectForNaming(object, { state });
    const message = `You put ${objectDescription(object)} into the ${
        containerNoun(container)}.`;
    await addObjectToContainer(container, object, state);
    container.cknown = true;
    updateContainerWeights(container);
    state._capacityDirty = true;
    return {
        moved: true,
        message,
    };
}

export async function takeFromContainer(
    container: GameObject, object: GameObject, state: GameState = game, count = -1,
    { resetJustPicked = false }: { resetJustPicked?: boolean } = {},
): Promise<ContainerTransferResult> {
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
    if (object.otyp !== LOADSTONE) object = splitForTransfer(object, lift.count, state).object;
    unlinkObject(object, state);
    if (container.otyp === ICE_BOX) thawObject(object, state);
    if (resetJustPicked) clearJustPicked(state);

    let carried;
    if (object.otyp === GOLD_PIECE) {
        carried = addHeroGoldObject(state, object).object;
        if (!carried) throw new Error('Taken gold must enter the hero inventory');
    } else {
        carried = await addToInventory(object, state);
    }
    container.cknown = true;
    updateContainerWeights(container);
    state._capacityDirty = true;
    observeObjectForNaming(carried, { state });
    return {
        moved: true,
        message: `${carried.invlet || '$'} - ${objectDescription(carried)}.`,
    };
}

async function takeSelectedObjects(container: GameObject): Promise<ContainerTransferResult[]> {
    if (!container.contents?.length) return [];
    const categories = await chooseCategories(
        'Take out what type of objects?', container.contents,
    );
    const eligible = matchingObjects(container.contents, categories.matchers);
    const selected = categories.autoSelect
        ? eligible.map(value => ({ value, count: -1 }))
        : await chooseObjects('Take out what?', eligible, false);
    const results: ContainerTransferResult[] = [];
    let resetJustPicked = true;
    for (const selection of selected) {
        const result = await takeFromContainer(
            container, selection.value, game, selection.count,
            { resetJustPicked },
        );
        results.push(result);
        if (result.message) await plineWithContinuation(result.message);
        if (result.moved) resetJustPicked = false;
        if (result.stop) break;
    }
    return results;
}

async function putSelectedObjects(container: GameObject, stashOne = false): Promise<ContainerTransferResult[]> {
    const candidates = (game.inventory || [])
        .filter(object => object !== container);
    if (!candidates.length) return [];
    let selected: CountedSelection<GameObject>[];
    if (stashOne) {
        selected = await chooseObjects('What do you want to stash?', candidates, true);
        selected = selected.slice(0, 1);
    } else {
        const categories = await chooseCategories(
            'Put in what type of objects?', candidates,
        );
        const eligible = matchingObjects(candidates, categories.matchers);
        const onePicked = categories.justPickedCount !== undefined
            && candidates.filter(object => object.pickup_prev).length === 1
            ? candidates.find(object => object.pickup_prev) : null;
        selected = categories.autoSelect
            ? eligible.map(value => ({ value, count: -1 }))
            : onePicked
                ? [{ value: onePicked, count: categories.justPickedCount ?? -1 }]
                : await chooseObjects('Put in what?', eligible, true);
    }
    const results: ContainerTransferResult[] = [];
    for (const selection of selected) {
        const result = await putIntoContainer(
            container, selection.value, game, selection.count,
        );
        results.push(result);
        if (result.message) await plineWithContinuation(result.message);
        if (result.destroyedContainer || result.stop) break;
    }
    return results;
}

function contentLines(container: GameObject): string[] {
    return sortObjects(container.contents || [], { mode: lootSortMode() })
        .map(object => `  ${objectDescription(object)}`);
}

async function showContents(container: GameObject): Promise<void> {
    container.cknown = true;
    if (!container.contents?.length) {
        await pline(`The ${containerNoun(container)} is empty.`);
        return;
    }
    const display = game.nhDisplay;
    if (!display) return;
    const left = 41;
    for (const object of container.contents) observeObjectForNaming(object);
    const lines = [
        `Contents of the ${containerNoun(container)}:`,
        '',
        ...contentLines(container),
        '--More--',
    ];
    for (const [row, line] of lines.entries()) {
        if (row >= display.rows) break;
        for (let col = 38; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < line.length; col++)
            display.setCell(left + col, row, line.charAt(col), NO_COLOR, 0);
    }
    display.setCursor(left + 8, Math.min(lines.length - 1, display.rows - 1));
    await nhgetch();
}

function actionKeys() {
    return game.flags?.lootabc
        ? { takeOut: 'a', putIn: 'b', both: 'c', reverse: 'd', stash: 'e' }
        : { takeOut: 'o', putIn: 'i', both: 'b', reverse: 'r', stash: 's' };
}

async function chooseAction(container: GameObject, held: boolean, usedTime: boolean, moreContainers: boolean): Promise<string> {
    const keys = actionKeys();
    const hasContents = !!container.contents?.length;
    const mayTakeOut = hasContents || !container.cknown;
    const mayPutIn = (game.inventory || []).some(object => object !== container);
    const entries: ChoiceMenuEntry[] = [{ key: ':', text: `Look inside the ${containerNoun(container)}` }];
    if (mayTakeOut) entries.push({ key: keys.takeOut, text: 'take something out' });
    if (mayPutIn) entries.push({ key: keys.putIn, text: 'put something in' });
    if (mayTakeOut) entries.push({
        key: keys.both, text: `${mayPutIn ? 'both; ' : ''}take out, then put in`,
    });
    if (mayPutIn) {
        entries.push({
            key: keys.reverse, text: `${mayTakeOut ? 'both reversed; ' : ''}put in, then take out`,
        });
        entries.push({ key: keys.stash, text: `stash one item into the ${containerNoun(container)}` });
    }
    entries.push('');
    if (moreContainers) entries.push({ key: 'n', text: 'loot next container' });
    entries.push({ key: 'q', marker: '*', text: usedTime ? 'done' : 'do nothing' });
    const valid = [27, 58, 63, 110, 113,
        ...Object.values(keys).map(key => key.charCodeAt(0))];
    const title = mayTakeOut
        ? `Do what with ${containerReference(container, held)}?`
        : `The ${containerNoun(container)} is empty.  Do what with it?`;
    return String.fromCharCode(await showChoiceWindow({
        title,
        entries,
        validKeys: valid,
    }));
}

export async function useContainer(container: GameObject, {
    held = false,
    moreContainers = false,
    underlay = null,
}: ContainerUseOptions = {}): Promise<ContainerUseResult> {
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
            heroDied: !!trap && 'died' in trap && trap.died,
            container: trap?.destroyed ? null : container,
        };
    }

    let spentTime = await observeQuantumCat(container);
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

    if (game.program_state?.gameover) return { spentTime: true, container };
    if (spentTime) container.cknown = true;
    if (underlay) restoreMenuUnderlay(underlay);
    await redrawMap();
    await bot();
    await flush_screen(1);
    return { spentTime, container };
}
