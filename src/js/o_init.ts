// o_init.js — Object initialization.
// C ref: o_init.c — shuffle gem colors, potion descriptions, etc.
//
// The live init_objects() boundary owns per-game knowledge reset and the
// Fisher-Yates description/color shuffles.  Other startup owners remain
// partial; the implementation below is the source of truth.
import { game } from './gstate.js';
import { artifactById } from './artifacts.js';
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
import type { DiscoverySortMode } from './flags.js';
import { heroIsBlind } from './senses.js';
import { ATR_INVERSE, addMenuHeading, showTextPages } from './windows.js';
import {
    FLINT,
    AMULET_OF_YENDOR, BELL_OF_OPENING, SPE_BOOK_OF_THE_DEAD,
    CANDELABRUM_OF_INVOCATION,
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
    observeObject,
    priceQuoteSuffix,
} from './object_knowledge.js';
import { japaneseItemName, simpleObjectTypeName } from './objnam.js';
import { armorPresentationName } from './object_grammar.js';
import { classifyLoot, inventoryClassOrder } from './object_sort.js';
import { MENU_ITEMFLAGS_SELECTED } from './const.js';

const DISCOVERY_ORDERS: Readonly<Record<DiscoverySortMode, string>> = {
    o: 'by order of discovery within each class',
    s: 'sortloot order (by class with some sub-class groupings)',
    c: 'alphabetical within each class',
    a: 'alphabetical across all classes',
};

export function discoverySortDescription(): string {
    return DISCOVERY_ORDERS[game.flags.discosort ?? 'o'];
}

export async function chooseDiscoverySort(mode: 0 | 1 | 2): Promise<boolean> {
    const previous = game.flags.discosort ?? 'o';
    const window = tty_create_nhwindow<DiscoverySortMode>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const key of ['o', 's', 'c', 'a'] as const)
            tty_add_menu(window, { identifier: key, selector: key, text: DISCOVERY_ORDERS[key],
                itemflags: key === previous ? MENU_ITEMFLAGS_SELECTED : 0 });
        if (mode === 2) {
            for (const text of ['',
                'Note: full alphabetical and alphabetical within class',
                '      are equivalent for single class discovery, but',
                '      will matter for future use of total discoveries.'])
                tty_add_menu(window, { identifier: null, text });
        }
        tty_end_menu(window, 'Ordering of discoveries');
        const result = await tty_select_menu(window, PICK_ONE);
        if (result.cancelled) return false;
        const chosen = result.selections.find(selection => selection.identifier !== previous)
            ?? result.selections[0];
        game.flags.discosort = chosen?.identifier ?? previous;
        return true;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

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
                    addMenuHeading(window, OBJECT_CLASS_LABELS[oclass] ?? 'Objects');
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
    game.flags.discosort ??= 'o';
    if (game.iflags.menu_requested && !await chooseDiscoverySort(1)) return;
    const order = game.flags.discosort;

    const body: TextMenuEntry[] = [];
    const relics = discoveredRelics();
    if (relics.length) {
        body.push(discoveryHeading('Unique items or Relics'));
        body.push(...relics);
    }
    const artifacts = discoveredArtifacts();
    if (artifacts.length) {
        body.push(discoveryHeading('Artifacts'));
        body.push(...artifacts);
    }
    const alphabetical: string[] = [];
    for (const oclass of discoveryClassOrder()) {
        const entries = classDiscoveries(oclass, order);
        if (!entries.length) continue;
        if (order === 'a') {
            alphabetical.push(...entries);
            continue;
        }
        const heading = OBJECT_CLASS_LABELS[oclass];
        if (heading === undefined)
            throw new Error(`Missing discovery heading for object class ${oclass}`);
        body.push(discoveryHeading(heading));
        body.push(...entries);
    }
    if (alphabetical.length) {
        if (relics.length || artifacts.length) body.push(discoveryHeading('Discovered items'));
        body.push(...alphabetical.sort(compareDiscoveryNames));
    }

    if (!body.length) {
        await plineWithContinuation("You haven't discovered anything yet...");
        return;
    }

    // The tty text-window backend paginates the continuous putstr() stream
    // into 23 content rows, reserving the last terminal row for --More--.
    // Only the first page carries the title and its following blank line.
    const rows: TextMenuEntry[] = [
        `Discoveries, ${DISCOVERY_ORDERS[order]}`,
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

function discoveryClassOrder(): number[] {
    const classes = inventoryClassOrder();
    return classes.includes(17) ? classes : [...classes, 17];
}

function classDiscoveries(oclass: number, order: DiscoverySortMode): string[] {
    const entries = [];
    for (const type of game._objectDiscoveryOrder ?? []) {
        if (objectClassForType(type) !== oclass) continue;
        const line = formattedDiscovery(type);
        if (!line) continue;
        const sample = { otyp: type, oclass, dknown: true };
        if (order === 's' && !heroIsBlind()) observeObject(sample);
        entries.push({ line, classification: classifyLoot(sample) });
    }
    if (order !== 'o') entries.sort((left, right) =>
        (order === 's' ? left.classification.subclass - right.classification.subclass
            || left.classification.discovery - right.classification.discovery : 0)
        || compareDiscoveryNames(left.line, right.line));
    return entries.map(entry => entry.line);
}

function compareDiscoveryNames(left: string, right: string): number {
    const a = left.slice(2).toLowerCase(), b = right.slice(2).toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
}

function discoveryHeading(text: string): TextMenuEntry {
    return { text, attr: game.iflags.menu_headings?.attr ?? ATR_INVERSE };
}

function discoveredRelics(): string[] {
    const lines: string[] = [];
    for (const type of [AMULET_OF_YENDOR, BELL_OF_OPENING,
        SPE_BOOK_OF_THE_DEAD, CANDELABRUM_OF_INVOCATION]) {
        const known = !!game._knownObjectTypes?.has(type);
        if (!known && (type === AMULET_OF_YENDOR || !game._encounteredObjectTypes?.has(type)))
            continue;
        const name = known ? requireObjectData(OBJECT_NAMES, type)
            : game.objectDescriptions?.[type] ?? requireObjectData(OBJECT_DESCRIPTIONS, type);
        lines.push(`  ${name}${!known && type === SPE_BOOK_OF_THE_DEAD ? ' spellbook' : ''}`);
    }
    return lines;
}

function discoveredArtifacts(): string[] {
    return (game._artifactDiscoveries ?? []).map(id => {
        const artifact = artifactById(id);
        if (!artifact) throw new Error(`Unknown discovered artifact ${id}`);
        const alignment = artifact.alignment === 1 ? 'lawful'
            : artifact.alignment === 0 ? 'neutral'
                : artifact.alignment === -1 ? 'chaotic' : 'non-aligned';
        return `  ${artifact.name} [${alignment} ${simpleObjectTypeName(artifact.baseType)}]`;
    });
}
