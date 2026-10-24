// Inventory and loot ordering. C refs: invent.c:sortloot()/loot_classify().
import { objectMaterial } from './object_material.js';
import { objectTypeKnown } from './shk.js';
import { game } from './gstate.js';
import type { GameFlags } from './flags.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import {
    SORTLOOT_PACK, SORTLOOT_INVLET, SORTLOOT_LOOT, SORTLOOT_INUSE, SORTLOOT_PETRIFY,
    P_BOW, P_CROSSBOW, P_SPEAR, P_DAGGER, P_KNIFE,
    W_ACCESSORY, W_ARMOR, W_WEAPONS, W_ARM, W_ARMC, W_ARMH, W_ARMS,
    W_ARMG, W_ARMF, W_ARMU, W_WEP, W_SWAPWEP, W_QUIVER, W_TOOL,
    W_RINGL, W_RINGR, W_AMUL,
} from './const.js';
import {
    BAG_OF_TRICKS, HORN_OF_PLENTY, WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN,
    FROST_HORN, FIRE_HORN, WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM,
    DRUM_OF_EARTHQUAKE, SLIME_MOLD, TIN, EGG, CORPSE, ROCK, LEASH,
    OBJECT_SUBTYPE, OBJECT_DESCRIPTIONS,
    OBJECT_USES_KNOWN,
} from './object_data.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType, observeObject } from './object_knowledge.js';
import { lootObjectName, observeObjectForNaming } from './objnam.js';
import { isContainer } from './container.js';
import { isPolearm } from './weapon_type.js';
import { heroIsBlind } from './senses.js';
import { touchPetrifies } from './stoning.js';

type InventoryOrderState = { flags: Pick<GameFlags, 'inv_order'> };

interface LootClassification {
    order: number;
    subclass: number;
    discovery: number;
}

type LootView = Pick<GameObject, 'otyp'> & Partial<Pick<GameObject, 'oclass' | 'dknown' | 'globby'>>;

interface LootEntry {
    object: GameObject;
    index: number;
    classification?: LootClassification;
    name?: string;
}

interface ObjectSortOptions {
    mode?: number;
    state?: GameState;
    filter?: ((object: GameObject) => boolean) | null;
}

const DEFAULT_PACK_ORDER = [12, 5, 2, 3, 7, 9, 10, 8, 4, 11, 6, 13, 14, 15, 16];
const DEFAULT_LOOT_ORDER = [12, 5, 4, 11, 8, 9, 10, 13, 7, 6, 2, 3, 14, 15, 16];
const INSTRUMENTS = new Set([WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN,
    FROST_HORN, FIRE_HORN, WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM,
    DRUM_OF_EARTHQUAKE, HORN_OF_PLENTY]);

export function inventoryClassOrder(state: InventoryOrderState = game): number[] {
    return [...(state.flags.inv_order || DEFAULT_PACK_ORDER)];
}

export function objectClassHeading(oclass: number): string {
    return [null, 'Illegal objects', 'Weapons', 'Armor', 'Rings', 'Amulets',
        'Tools', 'Comestibles', 'Potions', 'Scrolls', 'Spellbooks', 'Wands',
        'Coins', 'Gems/Stones', 'Boulders/Statues', 'Iron balls', 'Chains', 'Venoms'][oclass] || 'Other';
}

export function inventoryOrderSymbols(state: InventoryOrderState = game): string {
    return inventoryClassOrder(state).map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
}

// options.c:change_inv_order() keeps valid entries even when others are bad,
// then fills omitted classes using their previous order. Omitted gold leads.
export function changeInventoryOrder(symbols: string, state: InventoryOrderState = game): boolean {
    const change = planInventoryOrder(symbols, state);
    state.flags.inv_order = change.order;
    return change.errors.length === 0;
}

export function planInventoryOrder(symbols: string, state: InventoryOrderState = game): { order: number[]; errors: string[] } {
    const previous = inventoryClassOrder(state);
    const order = symbols.includes('$') ? [] : [12];
    const errors: string[] = [];
    for (const [index, symbol] of [...symbols].entries()) {
        const oclass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
        if (oclass < 1) errors.push(`Not an object class '${symbol}'`);
        else if (!previous.includes(oclass)) errors.push(`Object class '${symbol}' not allowed`);
        else if (symbols.indexOf(symbol, index + 1) !== -1) errors.push(`Duplicate object class '${symbol}'`);
        else {
            order.push(oclass);
        }
    }
    return { order: [...order, ...previous.filter(oclass => !order.includes(oclass))], errors };
}

export function inventorySortMode(state: GameState = game): number {
    return ((state.flags.sortloot ?? 'l') === 'f' ? SORTLOOT_LOOT : SORTLOOT_INVLET)
        | (state.flags.sortpack !== false ? SORTLOOT_PACK : 0);
}

export function lootSortMode({ inventoryLetters = false, state = game }: {
    inventoryLetters?: boolean; state?: GameState;
} = {}): number {
    const sortloot = state.flags.sortloot ?? 'l';
    return (sortloot === 'f' || sortloot === 'l' && !inventoryLetters
        ? SORTLOOT_LOOT : inventoryLetters ? SORTLOOT_INVLET : 0)
        | (state.flags.sortpack !== false ? SORTLOOT_PACK : 0);
}

// Returns a new order without rewriting the inventory or container chain.
// Observation is the native sort boundary; name normalization uses a view.
export function sortObjects(objects: readonly GameObject[], {
    mode = 0, state = game, filter = null,
}: ObjectSortOptions = {}): GameObject[] {
    const keepPetrifying = !!(mode & SORTLOOT_PETRIFY);
    mode &= ~SORTLOOT_PETRIFY;
    const entries: LootEntry[] = objects.filter(object => !filter || filter(object)
        || keepPetrifying && object.otyp === CORPSE && touchPetrifies(object.corpsenm))
        .map((object, index) => ({ object, index }));
    if (!mode || entries.length < 2) return entries.map(entry => entry.object);
    const byClass = !(mode & SORTLOOT_INUSE)
        && (mode & (SORTLOOT_PACK | SORTLOOT_INVLET)) !== SORTLOOT_INVLET;
    if (byClass) {
        for (const entry of entries) {
            if (!heroIsBlind(state)) observeObject(entry.object, state);
            entry.classification = classifyLoot(entry.object, state);
        }
    }
    entries.sort((left, right) => compareLoot(left, right, mode, state));
    return entries.map(entry => entry.object);
}

export function classifyLoot(object: LootView, state: GameState = game): LootClassification {
    const oclass = object.oclass || objectClassForType(object.otyp);
    const classOrder = state.flags.sortpack !== false ? inventoryClassOrder(state) : DEFAULT_LOOT_ORDER;
    const position = classOrder.indexOf(oclass);
    const seen = !!object.dknown;
    const discovered = objectTypeKnown(object, state);
    const description = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
    return {
        order: position >= 0 ? position + 1 : classOrder.length + 1 + Number(oclass !== 17),
        subclass: lootSubclass(object, oclass, seen, discovered),
        discovery: !seen ? 1 : discovered || !description ? 4
            : state._objectCallNames?.[object.otyp] ? 3 : 2,
    };
}

function lootSubclass(object: LootView, oclass: number, seen: boolean, discovered: boolean): number {
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    if (oclass === 3) return [7, 4, 1, 2, 3, 5, 6][skill] ?? 8;
    if (oclass === 2) return skill < 0
        ? skill >= -P_CROSSBOW && skill <= -P_BOW ? 1 : 3
        : skill >= P_BOW && skill <= P_CROSSBOW ? 2
            : [P_SPEAR, P_DAGGER, P_KNIFE].includes(skill) ? 4
                : isPolearm(object) ? 6 : 5;
    if (oclass === 6) {
        if (seen && discovered && [BAG_OF_TRICKS, HORN_OF_PLENTY].includes(object.otyp)) return 2;
        if (isContainer(object) || object.otyp === BAG_OF_TRICKS) return 1;
        return INSTRUMENTS.has(object.otyp) ? 3 : 4;
    }
    if (oclass === 7) {
        if (object.otyp === SLIME_MOLD) return 1;
        if (object.otyp === TIN) return 3;
        if (object.otyp === EGG) return 4;
        if (object.otyp === CORPSE) return 5;
        return object.globby ? 6 : 2;
    }
    if (oclass === 13) {
        const material = objectMaterial(object.otyp);
        if (material === 20 || material === 19) return !seen ? 1 : !discovered ? 2 : material === 20 ? 3 : 4;
        return !seen ? 5 : object.otyp === ROCK ? 8 : !discovered ? 6 : 7;
    }
    return 1;
}

function compareLoot(left: LootEntry, right: LootEntry, mode: number, state: GameState): number {
    const a = left.object, b = right.object;
    if (mode & SORTLOOT_INUSE)
        return inUseRating(b, state) - inUseRating(a, state) || left.index - right.index;
    if (left.classification) {
        const aClass = left.classification, bClass = right.classification;
        if (!bClass) throw new Error('Classified loot requires a classification for both entries');
        const difference = aClass.order - bClass.order;
        if (difference) return difference;
        if (!(mode & SORTLOOT_INVLET)) {
            const detail = aClass.subclass - bClass.subclass || aClass.discovery - bClass.discovery;
            if (detail) return detail;
        }
    }
    if (mode & SORTLOOT_INVLET) {
        const difference = inventoryLetterValue(a.invlet) - inventoryLetterValue(b.invlet);
        if (difference) return difference;
    }
    if (!(mode & SORTLOOT_LOOT)) return left.index - right.index;
    if (left.name === undefined) {
        observeObjectForNaming(a, { state });
        left.name = normalizedLootName(a, state);
    }
    if (right.name === undefined) {
        observeObjectForNaming(b, { state });
        right.name = normalizedLootName(b, state);
    }
    if (left.name !== right.name) return left.name < right.name ? -1 : 1;
    const condition = beatitudeRating(b) - beatitudeRating(a)
        || Number(!!b.greased) - Number(!!a.greased)
        || Math.max(a.oeroded ?? 0, a.oeroded2 ?? 0) - Math.max(b.oeroded ?? 0, b.oeroded2 ?? 0)
        || Number(!!(b.rknown && b.oerodeproof)) - Number(!!(a.rknown && a.oerodeproof));
    if (condition) return condition;
    if (OBJECT_USES_KNOWN[a.otyp] && a.oclass !== 7) {
        const difference = (b.known ? b.spe ?? 0 : -1000) - (a.known ? a.spe ?? 0 : -1000);
        if (difference) return difference;
    }
    return left.index - right.index;
}

function normalizedLootName(object: GameObject, state: GameState): string {
    const name = lootObjectName(object, state);
    if (typeof name !== 'string')
        throw new Error(`Loot object ${object.o_id} has no sortable name`);
    return name.replace(/[A-Z]/g, letter => letter.toLowerCase());
}

function beatitudeRating(object: GameObject): number {
    return object.bknown ? object.blessed ? 3 : object.cursed ? 1 : 2 : 0;
}

function inventoryLetterValue(letter: string | null | undefined): number {
    if (!letter) return 55;
    if (letter >= 'a' && letter <= 'z') return letter.charCodeAt(0) - 95;
    if (letter >= 'A' && letter <= 'Z') return letter.charCodeAt(0) - 37;
    return letter === '$' ? 1 : letter === '#' ? 54 : 55;
}

function inUseRating(object: GameObject, state: GameState): number {
    const mask = (object.owornmask ?? 0) & (W_ACCESSORY | W_WEAPONS | W_ARMOR);
    if (!mask && object.otyp === LEASH && object.leashmon) return 1;
    if (!mask && object.oclass === 6 && object.lamplit) return 2;
    const mainHandRing = state.u.rightHanded === false ? W_RINGL : W_RINGR;
    const ratings = [W_ARMU, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMC, W_ARM,
        W_QUIVER, W_SWAPWEP, W_WEP, W_TOOL,
        mainHandRing === W_RINGR ? W_RINGL : W_RINGR, mainHandRing, W_AMUL];
    const index = ratings.findIndex(slot => mask & slot);
    return index >= 0 ? index + 3 : 0;
}
