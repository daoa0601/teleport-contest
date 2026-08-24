// o_init.js — Object initialization.
// C ref: o_init.c — shuffle gem colors, potion descriptions, etc.
//
// The live init_objects() boundary owns per-game knowledge reset and the
// Fisher-Yates description/color shuffles.  Other startup owners remain
// partial and are tracked in docs/architecture/c-lua-ownership.json.
import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { bot, docrtRecalc, flush_screen } from './display.js';
import { ATR_INVERSE, showTextPages } from './windows.js';
import {
    FLINT, OBJECT_COLOR, OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES,
} from './object_data.js';
import {
    DISCOVERY_CLASS_ORDER, OBJECT_CLASS_LABELS, objectClassForType,
    resolveLegacyDiscoveryType,
} from './object_knowledge.js';
import { armorPresentationName } from './object_grammar.js';

export function init_objects() {
    // o_init.c initializes per-game object-class knowledge and disco[] along
    // with the shuffled descriptions.  Never inherit a prior game's order.
    game._objectDiscoveryOrder = [];
    game._encounteredObjectTypes = new Set();
    game._knownObjectTypes = new Set();
    game._objectCallNames = {};
    game._objectPriceQuotes = {};
    return initializeObjectDescriptions();
}

function objectId(name) {
    const index = OBJECT_NAMES.indexOf(name);
    if (index < 0) throw new Error(`object metadata missing ${name}`);
    return index;
}

// C refs: o_init.c randomize_gem_colors(), shuffle(), and shuffle_all().
// The original fast-forward consumed these calls but discarded their state.
// Preserve the shuffled description index because both readobjnam() and
// doname() consult it after startup.
export function initializeObjectDescriptions() {
    const descriptionIndex = OBJECT_DESCRIPTIONS.map((_, index) => index);
    const colors = OBJECT_COLOR.slice();

    const sapphire = objectId('sapphire');
    if (rn2(2)) {
        descriptionIndex[objectId('turquoise')] = descriptionIndex[sapphire];
        colors[objectId('turquoise')] = colors[sapphire];
    }
    if (rn2(2)) {
        descriptionIndex[objectId('aquamarine')] = descriptionIndex[sapphire];
        colors[objectId('aquamarine')] = colors[sapphire];
    }
    const fluoriteSource = [
        objectId('fluorite'), sapphire, objectId('diamond'), objectId('emerald'),
    ][rn2(4)];
    descriptionIndex[objectId('fluorite')] = descriptionIndex[fluoriteSource];
    colors[objectId('fluorite')] = colors[fluoriteSource];

    function shuffle(low, high) {
        for (let current = low; current <= high; current++) {
            // Objects without an unidentified description are pre-known and
            // skipped by C without drawing.
            if (OBJECT_DESCRIPTIONS[current] === null) continue;
            let picked;
            do picked = current + rn2(high - current + 1);
            while (OBJECT_DESCRIPTIONS[picked] === null);
            [descriptionIndex[current], descriptionIndex[picked]] =
                [descriptionIndex[picked], descriptionIndex[current]];
            [colors[current], colors[picked]] =
                [colors[picked], colors[current]];
        }
    }

    // Whole-class ranges, then the four shuffled armor sub-ranges.
    shuffle(201, 211); // amulets (exclude fake/real Amulet of Yendor)
    shuffle(297, 321); // potions (exclude fixed clear water)
    shuffle(173, 200); // rings
    shuffle(323, 363); // magical scrolls and extra labels
    shuffle(366, 406); // spellbooks through chain lightning
    shuffle(410, 437); // wands, including unnamed appearances
    shuffle(478, 480); // venoms
    shuffle(97, 100);  // randomized helms
    shuffle(159, 162); // gloves
    shuffle(146, 149); // magical cloaks
    shuffle(166, 172); // magical boots

    game.objectDescriptionIndex = descriptionIndex;
    game.objectDescriptions = descriptionIndex.map(
        index => OBJECT_DESCRIPTIONS[index],
    );
    game.objectColors = colors;
    game.wandNothingDirection = rn2(2);
    return game.objectDescriptions;
}

const PLAIN_GEMSTONE_NAMES = new Set([
    'dilithium crystal', 'ruby', 'diamond', 'sapphire',
    'black opal', 'emerald', 'opal',
]);

function gemStoneGrammar(otyp, name) {
    // objnam.c:GemStone() appends the class noun to flint and to the
    // non-precious GEMSTONE-material objects.  Their generated metadata keeps
    // just the base object name, so reproduce obj_typename() at this boundary.
    const needsStone = otyp === FLINT
        || (OBJECT_MATERIAL[otyp] === 20
            && !PLAIN_GEMSTONE_NAMES.has(name));
    return needsStone ? `${name} stone` : name;
}

function actualDiscoveryName(otyp) {
    const name = OBJECT_NAMES[otyp] || 'object';
    switch (objectClassForType(otyp)) {
    case 3: return armorPresentationName(name);
    case 4: return `ring of ${name}`;
    case 8: return `potion of ${name}`;
    case 9: return `scroll of ${name}`;
    case 10: return `spellbook of ${name}`;
    case 11: return `wand of ${name}`;
    case 13: return gemStoneGrammar(otyp, name);
    default: return name;
    }
}

function unknownDiscoveryName(otyp, appearance) {
    const actual = OBJECT_NAMES[otyp] || '';
    switch (objectClassForType(otyp)) {
    case 3: return armorPresentationName(appearance, actual);
    // objnam.c:obj_typename() uses the class noun plus parenthesized
    // description for discoveries; this intentionally differs from xname()
    // prose such as "ruby potion" or "scroll labeled ZELGO MER".
    case 4: return `ring (${appearance})`;
    case 5: return `amulet (${appearance})`;
    case 8: return `potion (${appearance})`;
    case 9: return `scroll (${appearance})`;
    case 10: return `spellbook (${appearance})`;
    case 11: return `wand (${appearance})`;
    case 13: return `${appearance} ${OBJECT_MATERIAL[otyp] === 21
        ? 'stone' : 'gem'}`;
    default: return appearance;
    }
}

function calledDiscoveryName(otyp, callName) {
    switch (objectClassForType(otyp)) {
    case 4: return `ring called ${callName}`;
    case 5: return `amulet called ${callName}`;
    case 8: return `potion called ${callName}`;
    case 9: return `scroll called ${callName}`;
    case 10: return `spellbook called ${callName}`;
    case 11: return `wand called ${callName}`;
    default: return `${actualDiscoveryName(otyp)} called ${callName}`;
    }
}

function priceQuoteSuffix(otyp) {
    const quote = game._objectPriceQuotes?.[otyp];
    if (!quote) return '';
    const parts = [];
    for (const kind of ['buy', 'sell']) {
        const min = quote[`${kind}Min`], max = quote[`${kind}Max`];
        if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
        parts.push(min === max ? `${kind} ${min}` : `${kind} ${min}-${max}`);
    }
    return parts.length ? ` {${parts.join(' ')}}` : '';
}

function discoveryRecords() {
    const records = new Map();
    const ordered = [];
    function add(otyp, values = {}) {
        if (!Number.isInteger(otyp) || otyp < 1) return null;
        let record = records.get(otyp);
        if (!record) {
            record = { otyp, known: false, encountered: false };
            records.set(otyp, record);
            ordered.push(record);
        }
        Object.assign(record, values);
        return record;
    }

    for (const legacy of game.discoveries || []) {
        const otyp = resolveLegacyDiscoveryType(legacy);
        if (otyp >= 0) {
            add(otyp, {
                known: true,
                encountered: !legacy.preknown,
                legacy,
            });
        } else {
            ordered.push({ legacyOnly: true, legacy });
        }
    }
    for (const otyp of game._objectDiscoveryOrder || []) add(otyp);
    for (const otyp of game._encounteredObjectTypes || [])
        add(otyp, { encountered: true });
    for (const otyp of game._knownObjectTypes || []) add(otyp, { known: true });
    for (const [key, callName] of Object.entries(game._objectCallNames || {}))
        add(Number(key), { callName });

    return ordered;
}

function formattedDiscovery(record) {
    if (record.legacyOnly) {
        const legacy = record.legacy;
        const appearance = legacy.bracket ? ` [${legacy.bracket}]`
            : legacy.appearance ? ` (${legacy.appearance})` : '';
        return `${legacy.preknown ? '* ' : '  '}${legacy.name}${appearance}`;
    }

    const { otyp } = record;
    const appearance = game.objectDescriptions?.[otyp]
        ?? OBJECT_DESCRIPTIONS[otyp];
    if (!appearance && !record.callName) return null;
    let name;
    if (record.known) name = actualDiscoveryName(otyp);
    else if (record.callName) name = calledDiscoveryName(otyp, record.callName);
    else if (record.encountered) name = unknownDiscoveryName(otyp, appearance);
    else return null;

    if ((record.known || record.callName) && appearance)
        name += ` (${appearance})`;
    const prefix = record.known && !record.encountered ? '* ' : '  ';
    return `${prefix}${name}${priceQuoteSuffix(otyp)}`;
}

// C ref: o_init.c dodiscovered() — show discoveries grouped by object class.
export async function dodiscovered() {
    const grouped = new Map(DISCOVERY_CLASS_ORDER.map(oclass => [oclass, []]));
    for (const record of discoveryRecords()) {
        const oclass = record.legacyOnly
            ? Number(Object.entries(OBJECT_CLASS_LABELS)
                .find(([, label]) => label === record.legacy.class)?.[0] || 0)
            : objectClassForType(record.otyp);
        const line = formattedDiscovery(record);
        if (line && grouped.has(oclass)) grouped.get(oclass).push(line);
    }

    const body = [];
    for (const oclass of DISCOVERY_CLASS_ORDER) {
        const entries = grouped.get(oclass);
        if (!entries?.length) continue;
        body.push({ text: OBJECT_CLASS_LABELS[oclass], attr: ATR_INVERSE });
        body.push(...entries);
    }

    // The tty text-window backend paginates the continuous putstr() stream
    // into 23 content rows, reserving the last terminal row for --More--.
    // Only the first page carries the title and its following blank line.
    const rows = [
        'Discoveries, by order of discovery within each class',
        '',
        ...body,
    ];
    const pages = [];
    for (let offset = 0; offset < rows.length; offset += 23) {
        const lines = Array(24).fill('');
        const pageRows = rows.slice(offset, offset + 23);
        for (let row = 0; row < pageRows.length; row++)
            lines[row] = pageRows[row];
        lines[23] = '--More--';
        pages.push({ lines, cursor: [8, 23] });
    }
    await showTextPages(pages);
    // A full-screen tty text window owns docrt() when it is destroyed.
    await docrtRecalc();
    await bot();
    await flush_screen(1);
    game.context.move = 0;
}
