// C objnam.c:readobjnam_postparse1-3(), wishymatch(), and the two
// object-type lotteries. Lookup preserves the class before falling back to
// random generation; a class-qualified failed description is still a wish.
import { P_HAMMER, P_POLEARMS } from './const.js';
import { game } from './gstate.js';
import { artifactByName } from './artifacts.js';
import { matchWishedFruit } from './fruit.js';
import { japaneseWishType } from './japanese_item_name.js';
import { rndClass } from './mklev.js';
import * as objects from './object_data.js';
import { makeSingular } from './object_grammar.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType } from './object_knowledge.js';
import { rn2 } from './rng.js';
import { parseWishNoun } from './wish_parse.js';
import { wizardTrapRequest } from './wish_terrain.js';
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const GEM_CLASS = 13;
const VENOM_CLASS = 17;
const wrappers = [
    ['wand', 11], ['ring', 4], ['potion', 8], ['scroll', 9], ['gem', GEM_CLASS],
    ['amulet', AMULET_CLASS], ['spellbook', 10], ['spell book', 10],
    ['weapon', WEAPON_CLASS], ['armor', ARMOR_CLASS], ['tool', TOOL_CLASS],
    ['food', FOOD_CLASS], ['comestible', FOOD_CLASS],
];
const ranges = [
    ['bag', TOOL_CLASS, objects.SACK, objects.BAG_OF_TRICKS],
    ['lamp', TOOL_CLASS, objects.OIL_LAMP, objects.MAGIC_LAMP],
    ['candle', TOOL_CLASS, objects.TALLOW_CANDLE, objects.WAX_CANDLE],
    ['horn', TOOL_CLASS, objects.TOOLED_HORN, objects.HORN_OF_PLENTY],
    ['shield', ARMOR_CLASS, objects.SMALL_SHIELD, objects.SHIELD_OF_REFLECTION],
    ['hat', ARMOR_CLASS, objects.FEDORA, objects.DUNCE_CAP],
    ['helm', ARMOR_CLASS, objects.ELVEN_LEATHER_HELM, objectType('helm of telepathy')],
    ['gloves', ARMOR_CLASS, objects.LEATHER_GLOVES, objectType('gauntlets of dexterity')],
    ['gauntlets', ARMOR_CLASS, objects.LEATHER_GLOVES, objectType('gauntlets of dexterity')],
    ['boots', ARMOR_CLASS, objectType('low boots'), objects.LEVITATION_BOOTS],
    ['shoes', ARMOR_CLASS, objectType('low boots'), objects.IRON_SHOES],
    ['cloak', ARMOR_CLASS, objects.MUMMY_WRAPPING, objects.CLOAK_OF_DISPLACEMENT],
    ['shirt', ARMOR_CLASS, objects.HAWAIIAN_SHIRT, objectType('T-shirt')],
    ['dragon scales', ARMOR_CLASS, objects.GRAY_DRAGON_SCALES, objects.YELLOW_DRAGON_SCALES],
    ['dragon scale mail', ARMOR_CLASS, objects.GRAY_DRAGON_SCALE_MAIL, objects.YELLOW_DRAGON_SCALE_MAIL],
    ['sword', WEAPON_CLASS, objects.SHORT_SWORD, objects.KATANA],
    ['venom', VENOM_CLASS, objects.BLINDING_VENOM, objects.ACID_VENOM],
    ['gray stone', GEM_CLASS, objects.LUCKSTONE, objects.FLINT],
    ['grey stone', GEM_CLASS, objects.LUCKSTONE, objects.FLINT],
];
const alternateSpellings = [
    ['pickax', objects.PICK_AXE], ['whip', objects.BULLWHIP],
    ['saber', objectType('silver saber')], ['silver sabre', objectType('silver saber')],
    ['smooth shield', objects.SHIELD_OF_REFLECTION],
    ['grey dragon scale mail', objects.GRAY_DRAGON_SCALE_MAIL],
    ['grey dragon scales', objects.GRAY_DRAGON_SCALES],
    ['iron ball', objects.HEAVY_IRON_BALL], ['lantern', objects.BRASS_LANTERN],
    ['mattock', objects.DWARVISH_MATTOCK],
    ['amulet of poison resistance', objectType('amulet versus poison')],
    ['amulet of protection', objects.AMULET_OF_GUARDING],
    ['amulet of telepathy', objectType('amulet of ESP')],
    ['helm of esp', objectType('helm of telepathy')],
    ['gauntlets of ogre power', objects.GAUNTLETS_OF_POWER],
    ['gauntlets of giant strength', objects.GAUNTLETS_OF_POWER],
    ['elven chain mail', objects.ELVEN_MITHRIL_COAT],
    ['silver shield', objects.SHIELD_OF_REFLECTION],
    ['potion of sleep', objects.POT_SLEEPING],
    ['scroll of recharging', objectType('charging')], ['recharging', objectType('charging')],
    ['stone', objects.ROCK], ['camera', objects.EXPENSIVE_CAMERA],
    ['tee shirt', objectType('T-shirt')], ['can', objects.TIN], ['can opener', objects.TIN_OPENER],
    ['kelp', objects.KELP_FROND], ['eucalyptus', objects.EUCALYPTUS_LEAF],
    ['lembas', objects.LEMBAS_WAFER], ['tripe', objects.TRIPE_RATION],
    ['cookie', objects.FORTUNE_COOKIE], ['pie', objects.CREAM_PIE],
    ['huge meatball', objects.ENORMOUS_MEATBALL], ['huge chunk of meat', objects.ENORMOUS_MEATBALL],
    ['marker', objects.MAGIC_MARKER], ['hook', objects.GRAPPLING_HOOK],
    ['grappling iron', objects.GRAPPLING_HOOK], ['grapnel', objects.GRAPPLING_HOOK],
    ['grapple', objects.GRAPPLING_HOOK],
    ['protection from shape shifters', objects.RIN_PROTECTION_FROM_SHAPE_CHANGERS],
    ['accuracy', objectType('increase accuracy')], ['box', objects.LARGE_BOX],
    ['luck stone', objects.LUCKSTONE], ['load stone', objects.LOADSTONE],
    ['touch stone', objects.TOUCHSTONE], ['flintstone', objects.FLINT],
];
// Follow readobjnam's jumps: an early type or rejection ends lookup; class
// parsing goes directly to name search; only unclassified nouns try ranges.
export function lookupWishType(parsed, { wizardWish = false, state = game, } = {}) {
    // C recognizes called ranges before singularizing the object noun.
    const callRange = parsed.callName
        ? ranges.find(([range]) => range === parsed.calledNoun?.toLowerCase()) : null;
    if (callRange) {
        return searchWishNames(parsed, {
            name: parsed.name, originalName: parsed.originalName, oclass: callRange[1],
            actual: null, description: null, descriptionUsesNoun: false,
        }, state);
    }
    if (/(?:^| )Amulet of Yendor/i.test(parsed.name))
        return foundWishType(parsed.fakeAmulet || /^(?:cheap |plastic |imitation )/i.test(parsed.name)
            ? objects.FAKE_AMULET_OF_YENDOR : objects.AMULET_OF_YENDOR);
    const noun = parseWishNoun(parsed);
    if (noun === 'direct' && parsed.directType !== null)
        return foundWishType(parsed.directType);
    const search = {
        name: parsed.name, originalName: parsed.originalName, oclass: 0,
        actual: null, description: parsed.description, descriptionUsesNoun: false,
    };
    if (noun === 'glob') {
        search.oclass = FOOD_CLASS;
        search.actual = search.name;
        search.description = null;
        return searchWishNames(parsed, search, state);
    }
    const alias = alternateSpellings.find(([alias]) => wishMatches(search.name, alias, true));
    if (alias)
        return foundWishType(alias[1]);
    rewriteSearchNoun(search, search.name.replace(/^grey spell/i, 'gray spell').replace(/armour/i, 'armor'));
    if (parsed.directType !== null)
        return foundWishType(parsed.directType);
    if (/holy water$/i.test(search.name)) {
        parsed.buc = /unholy water$/i.test(search.name) ? 'cursed' : 'blessed';
        return foundWishType(objects.POT_WATER);
    }
    if (/^paperback(?:$| book)/i.test(search.name))
        return foundWishType(objects.SPE_NOVEL);
    if (/^paperback/i.test(search.name))
        return { kind: 'rejected' };
    if (parsed.unlabeled && /scroll$/i.test(search.name))
        return foundWishType(objects.SCR_BLANK_PAPER);
    if (parsed.unlabeled && /spellbook$/i.test(search.name))
        return foundWishType(objects.SPE_BLANK_PAPER);
    if (/orange$/i.test(search.name) && parsed.monsterSpecies === null)
        return foundWishType(objects.ORANGE);
    if (/gold piece$|zorkmid$|^(?:gold|money|coin)$|^\$/i.test(search.name))
        return { kind: 'gold' };
    const classSymbol = search.name.length === 1 ? OBJECT_CLASS_SYMBOLS.indexOf(search.name) : -1;
    if (classSymbol > 1 && (classSymbol !== VENOM_CLASS || wizardWish))
        return { kind: 'random', oclass: classSymbol };
    const classResult = parseWishClass(search, state);
    if (classResult)
        return classResult;
    if (search.oclass)
        return searchWishNames(parsed, search, state);
    if (wizardWish) {
        parsed.name = search.name.toLowerCase();
        const trapType = wizardTrapRequest(parsed);
        if (parsed.directType !== null)
            return foundWishType(parsed.directType);
        if (trapType !== null)
            return { kind: 'terrain', trapType };
    }
    const rangeResult = parseWishRange(parsed, search);
    return rangeResult ?? searchWishNames(parsed, search, state);
}
function parseWishClass(search, state) {
    const wrapperException = /^(?:enchant |destroy |detect food|food detection|ring mail|studded leather armor|leather armor|tooled horn|food ration|meat ring)/i;
    if (wrapperException.test(search.name))
        return null;
    for (const [wrapper, cls] of wrappers) {
        if (search.name.toLowerCase().startsWith(wrapper)) {
            search.oclass = cls;
            if (cls === AMULET_CLASS)
                search.actual = search.name;
            else {
                // Advancing bp leaves the class prefix in origbp.
                search.name = search.name.slice(wrapper.length);
                if (/^ of /i.test(search.name))
                    search.actual = search.name.slice(4);
            }
            return null;
        }
        if (search.name.toLowerCase().endsWith(wrapper)) {
            search.oclass = cls;
            if (cls === AMULET_CLASS) {
                if (/^versus poison /i.test(search.name))
                    return foundWishType(objectType('amulet versus poison'));
                const shape = search.name.slice(0, -wrapper.length).trimEnd();
                const shapeType = randomTypeByDescription(shape, cls, 0, state);
                if (shapeType !== null)
                    return foundWishType(shapeType);
            }
            else {
                rewriteSearchNoun(search, search.name.slice(0, -wrapper.length).trimEnd());
            }
            search.actual = search.description = search.name;
            search.descriptionUsesNoun = true;
            return null;
        }
    }
    return null;
}
// C postparse2 is also the armor retry target, even with a class selected.
function parseWishRange(parsed, search) {
    const range = ranges.find(([range]) => range === search.name.toLowerCase());
    if (range)
        return foundWishType(rndClass(range[2], range[3]));
    if (/ (?:stone|gem)$/i.test(search.name)) {
        rewriteSearchNoun(search, search.name.replace(/ (?:stone|gem)$/i, ''));
        search.oclass = GEM_CLASS;
        search.actual = search.description = search.name;
        search.descriptionUsesNoun = true;
        return null;
    }
    if (search.name.toLowerCase() !== 'looking glass' && /(?:^| )glass$/i.test(search.name)) {
        if (parsed.lock === 'broken' || /broken/i.test(search.name))
            return { kind: 'rejected' };
        const glass = search.name.replace(/^worthless /i, '').replace(/^piece of /i, '')
            .replace(/^colou?red /i, '');
        if (glass.toLowerCase() === 'glass')
            return foundWishType(objects.WORTHLESS_PIECE_OF_WHITE_GLASS + rn2(9));
        rewriteSearchNoun(search, `worthless piece of ${glass}`);
    }
    search.actual = search.name;
    if (search.description === null) {
        search.description = search.name;
        search.descriptionUsesNoun = true;
    }
    return null;
}
function searchWishNames(parsed, search, state) {
    for (;;) {
        if (!search.oclass && search.actual) {
            for (let type = objects.DILITHIUM_CRYSTAL; type <= objects.JADE; type++)
                if (search.actual.toLowerCase() === objects.OBJECT_NAMES[type]?.toLowerCase())
                    return foundWishType(type);
            if (search.actual.toLowerCase() === 'tin')
                return foundWishType(objects.TIN);
        }
        const candidates = [search.actual,
            search.description !== search.actual ? search.description : null, parsed.callName,
            search.originalName !== search.actual ? search.originalName : null];
        for (const candidate of candidates) {
            const type = randomTypeByDescription(candidate, search.oclass, 1, state);
            if (type !== null)
                return foundWishType(type);
        }
        const japaneseType = japaneseWishType(search.actual);
        if (japaneseType !== null)
            return foundWishType(japaneseType);
        if (search.oclass === ARMOR_CLASS && !/mail/i.test(search.name)) {
            rewriteSearchNoun(search, `${search.name} mail`);
            if (search.descriptionUsesNoun)
                search.description = search.name;
            const retryResult = parseWishRange(parsed, search);
            if (retryResult)
                return retryResult;
            continue;
        }
        break;
    }
    if (search.name.toLowerCase() === 'spinach') {
        parsed.spinach = true;
        parsed.empty = false;
        return foundWishType(objects.TIN);
    }
    const fruit = matchWishedFruit(parsed.fruit.name, state);
    if (fruit) {
        parsed.count = parsed.fruit.count ?? fruit.count;
        parsed.buc = parsed.fruit.buc;
        parsed.partlyEaten = parsed.fruit.partlyEaten;
        return { kind: 'object', type: objects.SLIME_MOLD, fruit: fruit.fruit, artifact: null };
    }
    if (!search.oclass && search.actual) {
        const artifact = artifactByName(search.actual);
        if (artifact)
            return { kind: 'object', type: artifact.baseType, fruit: null, artifact };
    }
    if (search.oclass) {
        const alias = alternateSpellings.find(([alias, type]) => objectClassForType(type) === search.oclass && wishMatches(search.name, alias, true));
        return alias ? foundWishType(alias[1]) : { kind: 'random', oclass: search.oclass };
    }
    return { kind: 'unresolved', name: search.name };
}
function foundWishType(type) {
    return { kind: 'object', type, fruit: null, artifact: null };
}
function rewriteSearchNoun(search, name) {
    if (name === search.name)
        return;
    search.originalName = search.originalName.slice(0, search.originalName.length - search.name.length) + name;
    search.name = name;
}
// Native tries these only after wizard terrain lookup fails.
export function randomUnqualifiedWishType(name) {
    if (/^polearm/i.test(name))
        return randomWeaponBySkill(P_POLEARMS);
    if (/^hammer/i.test(name))
        return randomWeaponBySkill(P_HAMMER);
    return null;
}
export function randomTypeByDescription(name, oclass = 0, extraProbability = 1, state = game) {
    if (!name)
        return null;
    const checkOf = !/ of /i.test(name);
    const matches = [];
    for (let type = objects.ARROW; type < objects.OBJECT_NAMES.length; type++) {
        const actual = objects.OBJECT_NAMES[type];
        if (!actual || oclass && objectClassForType(type) !== oclass)
            continue;
        const description = state.objectDescriptions?.[type] ?? objects.OBJECT_DESCRIPTIONS[type];
        const callName = state._objectCallNames?.[type];
        const partialName = checkOf && type !== objects.BELL_OF_OPENING
            && (type < objects.GLOB_OF_GRAY_OOZE || type > objects.GLOB_OF_BLACK_PUDDING)
            ? actual.split(/ of /i).slice(1).join(' of ') : '';
        const partialDescription = checkOf ? description?.split(/ of /i).slice(1).join(' of ') : '';
        if (wishMatches(name, actual, true) || partialName && wishMatches(name, partialName, false)
            || description && wishMatches(name, description, false)
            || partialDescription && wishMatches(name, partialDescription, false)
            || callName && wishMatches(name, callName, false))
            matches.push({ type, probability: objects.requireObjectData(objects.OBJECT_PROB, type) + extraProbability });
    }
    const total = matches.reduce((sum, match) => sum + match.probability, 0);
    if (!total)
        return null;
    let roll = rn2(total);
    for (const match of matches) {
        roll -= match.probability;
        if (roll < 0)
            return match.type;
    }
    return matches.at(-1)?.type ?? null;
}
function randomWeaponBySkill(skill) {
    const matches = objects.OBJECT_NAMES.flatMap((name, type) => name
        && objectClassForType(type) === WEAPON_CLASS && objects.OBJECT_SUBTYPE[type] === skill ? [type] : []);
    return matches.length ? matches[rn2(matches.length)] ?? null : null;
}
function fuzzyEqual(first, second) {
    return first.replace(/[ -]/g, '').toLowerCase() === second.replace(/[ -]/g, '').toLowerCase();
}
function invertedName(name) {
    const index = name.toLowerCase().indexOf(' of ');
    return index < 0 ? null : `${name.slice(index + 4)} ${name.slice(0, index)}`;
}
function wishMatches(request, canonical, invert) {
    if (fuzzyEqual(request, canonical))
        return true;
    if (invert) {
        const requestedOf = invertedName(request), canonicalOf = invertedName(canonical);
        if (requestedOf && !canonicalOf && fuzzyEqual(requestedOf, canonical)
            || canonicalOf && !requestedOf && fuzzyEqual(request, canonicalOf))
            return true;
    }
    if (canonical.startsWith('dwarvish '))
        return /^dwarven /i.test(request) && fuzzyEqual(request.slice(8), canonical.slice(9));
    if (canonical.startsWith('elven '))
        return /^(?:elvish |elfin )/i.test(request)
            && fuzzyEqual(request.replace(/^(?:elvish |elfin )/i, ''), canonical.slice(6));
    if (/helm/i.test(canonical) && /helmet/i.test(request))
        return wishMatches(request.replace(/helmet/i, 'helm'), canonical, true);
    if (/gauntlets/i.test(canonical) && /gloves/i.test(request))
        return wishMatches(request.replace(/gloves/i, 'gauntlets'), canonical, true);
    if (canonical.startsWith('detect ') && / detection$/i.test(request)) {
        const subject = request.slice(0, -10);
        return fuzzyEqual(`detect ${subject.toLowerCase() === 'monster' ? 'monsters' : subject}`, canonical);
    }
    if (/ detection/i.test(canonical) && /^detect /i.test(request))
        return fuzzyEqual(`${makeSingular(request.slice(7))} detection`, canonical);
    if (/ability/i.test(canonical) && /abilities$/i.test(request))
        return fuzzyEqual(request.replace(/abilities$/i, 'ability'), canonical);
    return canonical === 'aluminum' && request.toLowerCase() === 'aluminium';
}
function objectType(name) {
    const type = objects.OBJECT_NAMES.indexOf(name);
    if (type < 0)
        throw new RangeError(`Missing wish object type: ${name}`);
    return type;
}
//# sourceMappingURL=wish_lookup.js.map