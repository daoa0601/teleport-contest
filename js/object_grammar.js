// object_grammar.js — Shared source-level noun grammar for object names.
// C refs: obj.h pair_of(), objnam.c armor_simple_name()/obj_typename().
export function armorUsesPairGrammar(actualName) {
    return /(?:gloves|gauntlets|boots|shoes)(?: of .+)?$/
        .test(String(actualName || ''));
}
export function armorPresentationName(name, actualName = name) {
    if (armorUsesPairGrammar(actualName))
        return `pair of ${name}`;
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
function replacePluralSuffix(text, singular, plural) {
    return replaceWithMatchingCase(text, text.length - singular.length, plural);
}
// Native Strcasecpy() preserves each overwritten character's case. Once it
// reaches the old end, it continues the case of the last written character.
function replaceWithMatchingCase(text, start, replacement) {
    let result = text.slice(0, start);
    for (let index = 0; index < replacement.length; index++) {
        const previous = text.charAt(start + index) || result.charAt(result.length - 1);
        const next = replacement.charAt(index);
        result += /[a-z]/.test(previous) ? next.toLowerCase()
            : /[A-Z]/.test(previous) ? next.toUpperCase() : next;
    }
    return result;
}
function caseLike(source, replacement) {
    return replaceWithMatchingCase(source, 0, replacement);
}
function badManPlural(text) {
    const lower = text.toLowerCase();
    return NO_MEN_PREFIXES.some(prefix => {
        const suffix = `${prefix}man`;
        if (!lower.endsWith(suffix))
            return false;
        const start = lower.length - suffix.length;
        return start === 0 || lower[start - 1] === ' ';
    });
}
function pluralCompoundIndex(text) {
    let result = -1;
    const lower = text.toLowerCase();
    for (const compound of PLURAL_COMPOUNDS) {
        const index = lower.indexOf(compound.toLowerCase());
        if (index >= 0 && (result < 0 || index < result))
            result = index;
    }
    return result;
}
export function makePlural(value) {
    const text = (value ?? '').replace(/^ +/, '');
    if (!text)
        return 's';
    const pronouns = new Map([
        ['he', 'they'], ['she', 'they'], ['it', 'they'],
        ['him', 'them'], ['her', 'them'],
        ['his', 'their'], ['its', 'their'],
    ]);
    const pronoun = pronouns.get(text.toLowerCase());
    if (pronoun)
        return text.charAt(0) === text.charAt(0).toUpperCase()
            ? pronoun.charAt(0).toUpperCase() + pronoun.slice(1) : pronoun;
    if (/^pair of /i.test(text))
        return text;
    const compoundIndex = pluralCompoundIndex(text);
    const excess = compoundIndex >= 0 ? text.slice(compoundIndex) : '';
    const stem = (compoundIndex >= 0 ? text.slice(0, compoundIndex) : text)
        .replace(/ +$/, '');
    if (stem.length === 1 || !/[A-Za-z]$/.test(stem))
        return `${stem}'s${excess}`;
    if (PLURAL_AS_IS.some(suffix => hasSuffix(stem, suffix)))
        return stem + excess;
    if (stem.length > 5 && hasSuffix(stem, 'craft'))
        return stem + excess;
    if (/^(?:slice|mongoose)$/i.test(stem))
        return replacePluralSuffix(stem, '', 's') + excess;
    if (stem.length > 2 && hasSuffix(stem, 'ox')
        && !(stem.length > 5 && hasSuffix(stem, 'muskox'))) {
        return replacePluralSuffix(stem, '', 'es') + excess;
    }
    if (hasSuffix(stem, 'man') && badManPlural(stem))
        return replacePluralSuffix(stem, '', 's') + excess;
    for (const [singular, plural] of PLURAL_ONE_OFF) {
        if (hasSuffix(stem, plural))
            return stem + excess;
        if (hasSuffix(stem, singular))
            return replacePluralSuffix(stem, singular, plural) + excess;
    }
    // Native treats the Japanese arrow noun as invariant only as a word,
    // including compounds such as "ya named Needle", never as a suffix.
    if (/(?:^| )ya$/i.test(stem))
        return stem + excess;
    if (hasSuffix(stem, 'man'))
        return replacePluralSuffix(stem, 'man', 'men') + excess;
    if (hasSuffix(stem, 'f') && stem.length >= 2) {
        const before = stem.charAt(stem.length - 2).toLowerCase();
        if (!hasSuffix(stem, 'erf') && /[aeioulr]/.test(before))
            return replacePluralSuffix(stem, 'f', 'ves') + excess;
    }
    if (hasSuffix(stem, 'ium'))
        return replacePluralSuffix(stem, 'ium', 'ia') + excess;
    if (/(?:alga|hypha|larva|amoeba|vertebra)$/i.test(stem))
        return replacePluralSuffix(stem, '', 'e') + excess;
    if (stem.length > 3 && hasSuffix(stem, 'us')
        && !/(?:lotus|wumpus)$/i.test(stem)) {
        return replacePluralSuffix(stem, 'us', 'i') + excess;
    }
    if (hasSuffix(stem, 'sis'))
        return replacePluralSuffix(stem, 'sis', 'ses') + excess;
    if (hasSuffix(stem, 'eau') && !hasSuffix(stem, 'bureau'))
        return replacePluralSuffix(stem, '', 'x') + excess;
    if (/(?:matzoh|matzah)$/i.test(stem))
        return stem.slice(0, -2) + caseLike(stem.slice(-2), 'ot') + excess;
    if (/(?:matzo|matza)$/i.test(stem))
        return stem.slice(0, -1) + caseLike(stem.slice(-1), 'ot') + excess;
    if (stem.length >= 5 && /(?:dex|dix|tex)$/i.test(stem) && !hasSuffix(stem, 'index'))
        return stem.slice(0, -2) + caseLike(stem.slice(-2), 'ices') + excess;
    const chKSound = hasSuffix(stem, 'ch')
        && CH_K_SUFFIXES.some(suffix => hasSuffix(stem, suffix));
    if (/[zxs]$/i.test(stem)
        || (/(?:ch|sh)$/i.test(stem) && !chKSound)
        || stem.length >= 4 && /ato$/i.test(stem) || /dingo$/i.test(stem)) {
        return replacePluralSuffix(stem, '', 'es') + excess;
    }
    if (/[^aeiou]y$/i.test(stem))
        return stem.slice(0, -1) + caseLike(stem.slice(-1), 'ies') + excess;
    return replacePluralSuffix(stem, '', 's') + excess;
}
// C objnam.c:just_an(). The prefix includes its trailing space, or is empty.
export function indefiniteArticlePrefix(text) {
    const word = text.toLowerCase();
    if (word.length === 1 || word[1] === ' ')
        return 'aefhilmnosx'.includes(word.charAt(0)) ? 'an ' : 'a ';
    if (word.startsWith('the ') || word === 'molten lava'
        || word === 'iron bars' || word === 'ice')
        return '';
    const vowelSound = /^[aeiou]/.test(word)
        && !/^one(?:[-_ ]|$)/.test(word)
        && !/^(?:eu|uke|ukulele|unicorn|uranium|useful)/.test(word);
    return vowelSound || /^x[^aeiou]/.test(word) ? 'an ' : 'a ';
}
export function withIndefiniteArticle(text) {
    return indefiniteArticlePrefix(text) + text;
}
const SINGULAR_SUBJECTS = [
    'erinys', 'manes', 'cyclops', 'hippocrates', 'pelias', 'aklys',
    'amnesia', 'detect monsters', 'paralysis', 'shape changers', 'nemesis',
];
// C objnam.c:makesingular(). Fruit registration and name lookup share the
// same suffix and compound decisions as ordinary object grammar.
export function makeSingular(value) {
    const text = (value ?? '').replace(/^ +/, '');
    if (!text)
        return '';
    const pronoun = new Map([['they', 'it'], ['them', 'it'], ['their', 'its']]).get(text.toLowerCase());
    if (pronoun)
        return text.charAt(0) === text.charAt(0).toUpperCase()
            ? pronoun.charAt(0).toUpperCase() + pronoun.slice(1) : pronoun;
    const index = pluralCompoundIndex(text);
    const excess = index >= 0 ? text.slice(index) : '';
    const stem = index >= 0 ? text.slice(0, index) : text;
    const finish = (result) => result + excess;
    const same = PLURAL_AS_IS.filter(suffix => !['ae', 'eaux', 'matzot'].includes(suffix))
        .concat(SINGULAR_SUBJECTS);
    if (same.some(suffix => hasSuffix(stem, suffix))
        || stem.length > 5 && hasSuffix(stem, 'craft')
        || /^(?:slice|mongoose)$/i.test(stem))
        return finish(stem);
    const noManPrefixes = [
        'abdo', 'acu', 'agno', 'ceru', 'cogno', 'cycla', 'fleh', 'grava',
        'hegu', 'preno', 'sonar', 'speci', 'dai', 'exa', 'fla', 'sta', 'teg',
        'tegu', 'vela', 'da', 'hy', 'lu', 'no', 'nu', 'ra', 'ru', 'se', 'vi',
        'ya', 'o', 'a',
    ];
    if (hasSuffix(stem, 'men') && noManPrefixes.some(prefix => {
        const suffix = `${prefix}men`;
        return stem.toLowerCase() === suffix || stem.toLowerCase().endsWith(` ${suffix}`);
    }))
        return finish(stem);
    for (const [singular, plural] of PLURAL_ONE_OFF) {
        if (hasSuffix(stem, singular))
            return finish(stem);
        if (hasSuffix(stem, plural))
            return finish(replacePluralSuffix(stem, plural, singular));
    }
    if (hasSuffix(stem, 's')) {
        if (hasSuffix(stem, 'es')) {
            if (hasSuffix(stem, 'ies')) {
                if (/cookies$|(?:^| )pies$|(?:^| )genies$|mbies$|yries$/i.test(stem))
                    return finish(stem.slice(0, -1));
                return finish(replacePluralSuffix(stem, 'ies', 'y'));
            }
            if (/[lraeiou]ves$/i.test(stem) && !/(?:cloves|nerves)$/i.test(stem))
                return finish(replacePluralSuffix(stem, 'ves', 'f'));
            if (/(?:eses|oxes|nxes|ches|uses|shes|sses|atoes|dingoes|aleaxes)$/i.test(stem))
                return finish(stem.slice(0, -2));
        }
        else if (hasSuffix(stem, 'us') && !/(?:tengus|hezrous)$/i.test(stem)
            || hasSuffix(stem, 'ss') || /(?:^| )lens$/i.test(stem))
            return finish(stem);
        return finish(stem.slice(0, -1));
    }
    if (hasSuffix(stem, 'men'))
        return finish(replacePluralSuffix(stem, 'men', 'man'));
    if (/(?:matzot|ae|eaux)$/i.test(stem))
        return finish(stem.slice(0, -1));
    if (/e[lr]ia$/i.test(stem))
        return finish(replacePluralSuffix(stem, 'a', 'um'));
    return finish(stem);
}
// C objnam.c:vtense(). The input verb is plural; null requests singular.
export function verbForSubject(subject, verb) {
    if (subject !== null) {
        const noun = subject.toLowerCase();
        const stem = noun.split(/ (?:of|from|called|named|labeled) /u, 1)[0] ?? '';
        const singular = SINGULAR_SUBJECTS.some(word => stem === word || stem.endsWith(` ${word}`));
        const plural = /(?:[^us]s|eeth|feet|ia|ae)$/u.test(stem) && !singular;
        if (!/^(?:a|an) /u.test(noun)
            && (plural || noun === 'they' || noun === 'you'))
            return verb;
    }
    if (verb.toLowerCase() === 'are')
        return caseLike(verb, 'is');
    if (verb.toLowerCase() === 'have')
        return verb.slice(0, -2) + caseLike(verb.slice(-2), 's');
    if (/(?:[zxs]|[cs]h)$/iu.test(verb) || /^.o$/iu.test(verb))
        return verb + caseLike(verb.slice(-1), 'es');
    if (/[^aeiou]y$/iu.test(verb))
        return verb.slice(0, -1) + caseLike(verb.slice(-1), 'ies');
    return verb + caseLike(verb.slice(-1), 's');
}
//# sourceMappingURL=object_grammar.js.map