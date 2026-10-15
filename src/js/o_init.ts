// o_init.js — Object initialization.
// C ref: o_init.c — shuffle gem colors, potion descriptions, etc.
//
// The live init_objects() boundary owns per-game knowledge reset and the
// Fisher-Yates description/color shuffles.  Other startup owners remain
// partial; the implementation below is the source of truth.
import { game } from './gstate.js';
import type { TextMenuEntry, TextPage } from './windows.js';
import { rn2 } from './rng.js';
import { bot, docrt, flush_screen, plineWithContinuation } from './display.js';
import { NHW_MENU, PICK_ONE } from './const.js';
import { callObjectType, objectTypeIsCallable } from './object_call.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu,
    tty_select_menu, tty_start_menu,
} from './tty_menu.js';
import type { GameObject } from './object_types.js';
import { ATR_INVERSE, showTextPages } from './windows.js';
import {
    FLINT,
    MAGIC_HARP,
    WOODEN_HARP,
    SPE_NOVEL,
    OBJECT_COLOR,
    OBJECT_DESCRIPTIONS,
    OBJECT_MATERIAL,
    OBJECT_NAMES,
    OBJECT_TOUGH,
    OBJECT_INITIAL_KNOWN,
    OBJECT_USES_KNOWN,
    OBJECT_UNIQUE,
    requireObjectData,
} from './object_data.js';
import {
    OBJECT_CLASS_LABELS,
    objectClassForType,
    priceQuoteSuffix,
} from './object_knowledge.js';
import { japaneseItemName } from './objnam.js';
import { armorPresentationName } from './object_grammar.js';
import { inventoryClassOrder } from './object_sort.js';

export function init_objects(): (string | null)[] {
    // o_init.c initializes per-game object-class knowledge and disco[] along
    // with the shuffled descriptions.  Never inherit a prior game's order.
    game._objectDiscoveryOrder = [];
    game._encounteredObjectTypes = new Set();
    game._knownObjectTypes = new Set();
    game._objectCallNames = {};
    game._objectPriceQuotes = {};
    return initializeObjectDescriptions();
}

function objectId(name: string): number {
    const index = OBJECT_NAMES.indexOf(name);
    if (index < 0) throw new Error(`object metadata missing ${name}`);
    return index;
}

// C refs: o_init.c randomize_gem_colors(), shuffle(), and shuffle_all().
// Store the shuffled description index because both readobjnam() and doname()
// use it after startup.
export function initializeObjectDescriptions(): (string | null)[] {
    const descriptionIndex = OBJECT_DESCRIPTIONS.map((_, index) => index);
    const colors = OBJECT_COLOR.slice();
    const materials = OBJECT_MATERIAL.slice();
    const toughness = OBJECT_TOUGH.slice();

    const sapphire = objectId('sapphire');
    if (rn2(2)) {
        descriptionIndex[objectId('turquoise')] = requireObjectData(descriptionIndex, sapphire);
        colors[objectId('turquoise')] = requireObjectData(colors, sapphire);
    }
    if (rn2(2)) {
        descriptionIndex[objectId('aquamarine')] = requireObjectData(descriptionIndex, sapphire);
        colors[objectId('aquamarine')] = requireObjectData(colors, sapphire);
    }
    const fluoriteSource = [
        objectId('fluorite'),
        sapphire,
        objectId('diamond'),
        objectId('emerald'),
    ][rn2(4)];
    if (fluoriteSource === undefined) throw new RangeError('Invalid fluorite color selection');
    descriptionIndex[objectId('fluorite')] = requireObjectData(descriptionIndex, fluoriteSource);
    colors[objectId('fluorite')] = requireObjectData(colors, fluoriteSource);

    function shuffle(low: number, high: number, shuffleMaterial: boolean): void {
        for (let current = low; current <= high; current++) {
            // Objects without an unidentified description are pre-known and
            // skipped by C without drawing.
            if (requireObjectData(OBJECT_DESCRIPTIONS, current) === null) continue;
            let picked;
            do picked = current + rn2(high - current + 1);
            while (requireObjectData(OBJECT_DESCRIPTIONS, picked) === null);
            swapObjectField(descriptionIndex, current, picked);
            swapObjectField(colors, current, picked);
            swapObjectField(toughness, current, picked);
            if (shuffleMaterial) swapObjectField(materials, current, picked);
        }
    }

    // Whole-class ranges, then the four shuffled armor sub-ranges.
    shuffle(201, 211, true); // amulets (exclude fake/real Amulet of Yendor)
    shuffle(297, 321, true); // potions (exclude fixed clear water)
    shuffle(173, 200, true); // rings
    shuffle(323, 363, true); // magical scrolls and extra labels
    shuffle(366, 406, true); // spellbooks through chain lightning
    shuffle(410, 437, true); // wands, including unnamed appearances
    shuffle(478, 480, true); // venoms
    shuffle(97, 100, false); // randomized helms
    shuffle(159, 162, false); // gloves
    shuffle(146, 149, false); // magical cloaks
    shuffle(166, 172, false); // magical boots

    game.objectDescriptionIndex = descriptionIndex;
    game.objectDescriptions = descriptionIndex.map((index) =>
        requireObjectData(OBJECT_DESCRIPTIONS, index),
    );
    game.objectColors = colors;
    game.objectMaterials = materials;
    game.objectToughness = toughness;
    game.wandNothingDirection = rn2(2);
    return game.objectDescriptions;
}

function swapObjectField<T>(table: T[], first: number, second: number): void {
    const firstValue = requireObjectData(table, first);
    const secondValue = requireObjectData(table, second);
    table[first] = secondValue;
    table[second] = firstValue;
}

const PLAIN_GEMSTONE_NAMES = new Set([
    'dilithium crystal',
    'ruby',
    'diamond',
    'sapphire',
    'black opal',
    'emerald',
    'opal',
]);

function gemStoneGrammar(otyp: number, name: string): string {
    // objnam.c:GemStone() appends the class noun to flint and to the
    // non-precious GEMSTONE-material objects.  Their generated metadata keeps
    // just the base object name, so reproduce obj_typename() at this boundary.
    const needsStone =
        otyp === FLINT || (OBJECT_MATERIAL[otyp] === 20 && !PLAIN_GEMSTONE_NAMES.has(name));
    return needsStone ? `${name} stone` : name;
}

function discoveryBaseName(
    otyp: number, known: boolean, actualName: string, appearance: string | null | undefined,
): string {
    switch (objectClassForType(otyp)) {
        case 3:
            return armorPresentationName(
                known ? actualName : appearance || actualName, OBJECT_NAMES[otyp],
            );
        case 4:
            return known ? `ring of ${actualName}` : 'ring';
        case 5:
            return known ? actualName : 'amulet';
        case 8:
            return known ? `potion of ${actualName}` : 'potion';
        case 9:
            return known ? `scroll of ${actualName}` : 'scroll';
        case 10:
            if (otyp === SPE_NOVEL) return known ? 'novel' : 'book';
            if (known && OBJECT_UNIQUE[otyp]) return actualName;
            return known ? `spellbook of ${actualName}` : 'spellbook';
        case 11:
            return known ? `wand of ${actualName}` : 'wand';
        case 13:
            return known ? gemStoneGrammar(otyp, actualName)
                : `${appearance || actualName} ${OBJECT_MATERIAL[otyp] === 21 ? 'stone' : 'gem'}`;
        default:
            return known ? actualName : appearance || actualName;
    }
}

function formattedDiscovery(otyp: number): string | null {
    const known = !!OBJECT_INITIAL_KNOWN[otyp] || !!game._knownObjectTypes?.has(otyp);
    const encountered = !!game._encounteredObjectTypes?.has(otyp);
    const callName = game._objectCallNames?.[otyp];
    const ordinaryName = OBJECT_NAMES[otyp] || 'object';
    const japaneseName = game.urole?.key === 'samurai' ? japaneseItemName(otyp) : undefined;
    const harp = otyp === WOODEN_HARP || otyp === MAGIC_HARP;
    const appearance = japaneseName && harp ? 'koto'
        : game.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp];
    // C interesting_to_discover(): Japanese names need an explanation even
    // when there is no unidentified appearance to list.
    if (!japaneseName && !callName && !((known || encountered) && appearance)) return null;

    let name = discoveryBaseName(otyp, known, japaneseName || ordinaryName, appearance);
    if (japaneseName) name += ` [${harp && !known ? 'harp' : ordinaryName}]`;
    if (callName) name += ` called ${callName}`;
    // obj_typename() includes descriptions after class nouns and known
    // names; an unknown weapon, tool, or armor already uses its appearance.
    if (appearance && (known || [4, 5, 8, 9, 10, 11].includes(objectClassForType(otyp))))
        name += ` (${appearance})`;
    const prefix = encountered ? '  ' : '* ';
    return `${prefix}${name}${priceQuoteSuffix(otyp)}`;
}

// C o_init.c:rename_disco(). The selection is a type, not a newly made
// object: its temporary prompt view must not allocate an object identity.
export async function renameDiscoveredType(): Promise<void> {
    const window = tty_create_nhwindow<number>(NHW_MENU);
    try {
        await tty_start_menu(window);
        let discoveries = 0, nameable = 0;
        for (const oclass of inventoryClassOrder()) {
            let heading = false;
            for (const type of game._objectDiscoveryOrder ?? []) {
                if (objectClassForType(type) !== oclass) continue;
                const description = formattedDiscovery(type);
                if (!description) continue;
                discoveries++;
                if (!objectTypeIsCallable({ otyp: type, oclass })) continue;
                if (!heading) {
                    tty_add_menu(window, { identifier: null, text: OBJECT_CLASS_LABELS[oclass] ?? 'Objects', attr: ATR_INVERSE });
                    heading = true;
                }
                nameable++;
                tty_add_menu(window, { identifier: type, text: description.slice(2) });
            }
        }
        if (!discoveries) {
            await plineWithContinuation("You haven't discovered anything yet...");
            return;
        }
        if (!nameable) {
            await plineWithContinuation('None of your discoveries can be assigned names...');
            return;
        }
        tty_end_menu(window, 'Pick an object type to name');
        const result = await tty_select_menu(window, PICK_ONE);
        const type = result.selections[0]?.identifier;
        if (type === undefined) return;
        const sample: GameObject = {
            otyp: type, oclass: objectClassForType(type), o_id: 0, ox: 0, oy: 0,
            quan: 1, where: 'free', age: 0, owt: 0, spe: 0, recharged: 0,
            dknown: true, known: !OBJECT_USES_KNOWN[type], blessed: false,
            cursed: false, olocked: false, artifact: false,
        };
        await callObjectType(sample);
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

// C ref: o_init.c dodiscovered() — show discoveries grouped by object class.
export async function dodiscovered(): Promise<void> {
    const classOrder = [...inventoryClassOrder(), 17];
    const grouped = new Map<number, string[]>(classOrder.map((oclass) => [oclass, []]));
    for (const otyp of game._objectDiscoveryOrder || []) {
        const oclass = objectClassForType(otyp);
        const line = formattedDiscovery(otyp);
        if (line) grouped.get(oclass)?.push(line);
    }

    const body: TextMenuEntry[] = [];
    for (const oclass of classOrder) {
        const entries = grouped.get(oclass);
        if (!entries?.length) continue;
        const heading = OBJECT_CLASS_LABELS[oclass];
        if (heading === undefined)
            throw new Error(`Missing discovery heading for object class ${oclass}`);
        body.push({ text: heading, attr: ATR_INVERSE });
        body.push(...entries);
    }

    // The tty text-window backend paginates the continuous putstr() stream
    // into 23 content rows, reserving the last terminal row for --More--.
    // Only the first page carries the title and its following blank line.
    const rows: TextMenuEntry[] = [
        'Discoveries, by order of discovery within each class',
        '',
        ...body,
    ];
    const pages: TextPage[] = [];
    for (let offset = 0; offset < rows.length; offset += 23) {
        const lines = Array<TextMenuEntry>(24).fill('');
        const pageRows = rows.slice(offset, offset + 23);
        for (const [row, line] of pageRows.entries()) lines[row] = line;
        lines[23] = '--More--';
        pages.push({ lines, cursor: [8, 23] });
    }
    await showTextPages(pages);
    // A full-screen tty text window owns docrt() when it is destroyed.
    await docrt();
    await bot();
    await flush_screen(1);
    game.context.move = 0;
}
