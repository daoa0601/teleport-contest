// object_grammar.js — Shared source-level noun grammar for object names.
// C refs: obj.h pair_of(), objnam.c armor_simple_name()/obj_typename().

export function armorUsesPairGrammar(actualName) {
    return /(?:gloves|gauntlets|boots|shoes)(?: of .+)?$/
        .test(String(actualName || ''));
}

export function armorPresentationName(name, actualName = name) {
    if (armorUsesPairGrammar(actualName)) return `pair of ${name}`;
    if (/dragon scales$/.test(String(actualName || '')))
        return `set of ${name}`;
    return name;
}

// C ref: objnam.c:makeplural().  This owner is also used for hallucinated
// monster names, so it retains native compound and irregular suffix rules
// rather than assuming an object-facing "append s" grammar.
const PLURAL_COMPOUNDS = [
    ' of ', ' labeled ', ' called ', ' named ', ' above', ' versus ',
    ' from ', ' in ', ' on ', ' a la ', ' with', ' de ', " d'", ' du ',
    ' au ', '-in-', '-at-',
];

const PLURAL_ONE_OFF = [
    ['child', 'children'], ['cubus', 'cubi'], ['culus', 'culi'],
    ['Cyclops', 'Cyclopes'], ['djinni', 'djinn'], ['erinys', 'erinyes'],
    ['foot', 'feet'], ['fungus', 'fungi'], ['goose', 'geese'],
    ['knife', 'knives'], ['labrum', 'labra'], ['louse', 'lice'],
    ['mouse', 'mice'], ['mumak', 'mumakil'], ['nemesis', 'nemeses'],
    ['ovum', 'ova'], ['ox', 'oxen'], ['passerby', 'passersby'],
    ['rtex', 'rtices'], ['serum', 'sera'], ['staff', 'staves'],
    ['tooth', 'teeth'],
];

const PLURAL_AS_IS = [
    'boots', 'shoes', 'gloves', 'lenses', 'scales', 'eyes', 'gauntlets',
    'iron bars', 'bison', 'deer', 'elk', 'fish', 'fowl', 'tuna', 'yaki',
    '-hai', 'krill', 'manes', 'moose', 'ninja', 'sheep', 'ronin', 'roshi',
    'shito', 'tengu', 'ki-rin', 'Nazgul', 'gunyoki', 'piranha', 'samurai',
    'shuriken', 'haggis', 'Bordeaux', 'ae', 'eaux', 'matzot',
];

const NO_MEN_PREFIXES = [
    'albu', 'antihu', 'anti', 'ata', 'auto', 'bildungsro', 'cai', 'cay',
    'ceru', 'corner', 'decu', 'des', 'dura', 'fir', 'hanu', 'het',
    'infrahu', 'inhu', 'nonhu', 'otto', 'out', 'prehu', 'protohu',
    'subhu', 'superhu', 'talis', 'unhu', 'sha', 'hu', 'un', 'le', 're',
    'so', 'to', 'at', 'a',
];

const CH_K_SUFFIXES = [
    'monarch', 'poch', 'tech', 'mech', 'stomach', 'psych', 'amphibrach',
    'anarch', 'atriarch', 'azedarach', 'broch', 'gastrotrich', 'isopach',
    'loch', 'oligarch', 'peritrich', 'sandarach', 'sumach', 'symposiarch',
];

function hasSuffix(text, suffix) {
    return text.toLowerCase().endsWith(suffix.toLowerCase());
}

function caseLike(source, replacement) {
    if (source === source.toUpperCase()) return replacement.toUpperCase();
    if (source[0] === source[0]?.toUpperCase())
        return replacement[0].toUpperCase() + replacement.slice(1);
    return replacement.toLowerCase();
}

function replacePluralSuffix(text, singular, plural) {
    const source = text.slice(-singular.length);
    return text.slice(0, -singular.length) + caseLike(source, plural);
}

function badManPlural(text) {
    const lower = text.toLowerCase();
    return NO_MEN_PREFIXES.some(prefix => {
        const suffix = `${prefix}man`;
        if (!lower.endsWith(suffix)) return false;
        const start = lower.length - suffix.length;
        return start === 0 || lower[start - 1] === ' ';
    });
}

function pluralCompoundIndex(text) {
    let result = -1;
    const lower = text.toLowerCase();
    for (const compound of PLURAL_COMPOUNDS) {
        const index = lower.indexOf(compound.toLowerCase());
        if (index >= 0 && (result < 0 || index < result)) result = index;
    }
    return result;
}

export function makePlural(value) {
    const text = String(value ?? '').trimStart();
    if (!text) return 's';

    const pronouns = new Map([
        ['he', 'they'], ['she', 'they'], ['it', 'they'],
        ['him', 'them'], ['her', 'them'],
        ['his', 'their'], ['hers', 'their'], ['its', 'their'],
    ]);
    const pronoun = pronouns.get(text.toLowerCase());
    if (pronoun) return caseLike(text, pronoun);
    if (/^pair of /i.test(text)) return text;

    const compoundIndex = pluralCompoundIndex(text);
    const excess = compoundIndex >= 0 ? text.slice(compoundIndex) : '';
    let stem = (compoundIndex >= 0 ? text.slice(0, compoundIndex) : text)
        .trimEnd();
    if (stem.length === 1 || !/[A-Za-z]$/.test(stem)) return `${stem}'s${excess}`;

    if (PLURAL_AS_IS.some(suffix => hasSuffix(stem, suffix)))
        return stem + excess;
    if (stem.length > 5 && hasSuffix(stem, 'craft')) return stem + excess;
    if (/^(?:slice|mongoose)$/i.test(stem)) return `${stem}s${excess}`;
    if (stem.length > 2 && hasSuffix(stem, 'ox')
        && !(stem.length > 5 && hasSuffix(stem, 'muskox'))) {
        return `${stem}es${excess}`;
    }
    if (hasSuffix(stem, 'man') && badManPlural(stem))
        return `${stem}s${excess}`;

    for (const [singular, plural] of PLURAL_ONE_OFF) {
        if (hasSuffix(stem, plural)) return stem + excess;
        if (hasSuffix(stem, singular))
            return replacePluralSuffix(stem, singular, plural) + excess;
    }

    if (hasSuffix(stem, 'man'))
        return replacePluralSuffix(stem, 'man', 'men') + excess;
    if (hasSuffix(stem, 'f') && stem.length >= 2) {
        const before = stem.at(-2).toLowerCase();
        if (!hasSuffix(stem, 'erf') && /[aeioulr]/.test(before))
            return replacePluralSuffix(stem, 'f', 'ves') + excess;
    }
    if (hasSuffix(stem, 'ium'))
        return replacePluralSuffix(stem, 'ium', 'ia') + excess;
    if (/(?:alga|hypha|larva|amoeba|vertebra)$/i.test(stem))
        return `${stem}e${excess}`;
    if (stem.length > 3 && hasSuffix(stem, 'us')
        && !/(?:lotus|wumpus)$/i.test(stem)) {
        return replacePluralSuffix(stem, 'us', 'i') + excess;
    }
    if (hasSuffix(stem, 'sis'))
        return replacePluralSuffix(stem, 'sis', 'ses') + excess;
    if (hasSuffix(stem, 'eau') && !hasSuffix(stem, 'bureau'))
        return `${stem}x${excess}`;
    if (/(?:matzoh|matzah)$/i.test(stem))
        return stem.slice(0, -2) + caseLike(stem.slice(-2), 'ot') + excess;
    if (/(?:matzo|matza)$/i.test(stem))
        return stem.slice(0, -1) + caseLike(stem.slice(-1), 'ot') + excess;
    if (/(?:dex|dix|tex)$/i.test(stem) && !hasSuffix(stem, 'index'))
        return stem.slice(0, -2) + caseLike(stem.slice(-2), 'ices') + excess;

    const chKSound = hasSuffix(stem, 'ch')
        && CH_K_SUFFIXES.some(suffix => hasSuffix(stem, suffix));
    if (/[zxs]$/i.test(stem)
        || (/(?:ch|sh)$/i.test(stem) && !chKSound)
        || /ato$/i.test(stem) || /dingo$/i.test(stem)) {
        return `${stem}es${excess}`;
    }
    if (/[^aeiou]y$/i.test(stem))
        return stem.slice(0, -1) + caseLike(stem.at(-1), 'ies') + excess;
    return `${stem}s${excess}`;
}
