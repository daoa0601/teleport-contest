// C objnam.c:readobjnam_postparse1-3(), wishymatch(), and the two
// object-type lotteries. Lookup preserves the class before falling back to
// random generation; a class-qualified failed description is still a wish.
import { P_HAMMER, P_POLEARMS } from './const.js';
import { game } from './gstate.js';
import { rndClass } from './mklev.js';
import * as objects from './object_data.js';
import { makeSingular } from './object_grammar.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType } from './object_knowledge.js';
import { rn2 } from './rng.js';
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
export function lookupWishType(parsed, { wizardWish = false, state = game, } = {}) {
    const original = parsed.name;
    let name = original;
    const callName = parsed.callName;
    let description = parsed.description;
    const result = (type, oclass = 0) => ({ name, type, oclass: type === null ? oclass : objectClassForType(type) });
    if (/^glob of /i.test(name)) {
        const type = randomTypeByDescription(name, FOOD_CLASS, 1, state)
            ?? randomTypeByDescription(callName, FOOD_CLASS, 1, state);
        return result(type, FOOD_CLASS);
    }
    // C recognizes called ranges before singularizing the object noun.
    const callRange = callName
        ? ranges.find(([range]) => range === parsed.calledNoun?.toLowerCase()) : null;
    if (callRange) {
        const calledType = randomTypeByDescription(callName, callRange[1], 1, state);
        const type = calledType ?? randomTypeByDescription(original, callRange[1], 1, state);
        return result(type, callRange[1]);
    }
    const amulet = /(?:^| )Amulet of Yendor/i.exec(name);
    if (amulet)
        return result(/^(?:cheap |plastic |imitation )/i.test(name)
            ? objects.FAKE_AMULET_OF_YENDOR : objects.AMULET_OF_YENDOR);
    const alias = alternateSpellings.find(([alias]) => wishMatches(name, alias, true));
    if (alias)
        return result(alias[1]);
    name = name.replace(/^grey spell/i, 'gray spell').replace(/armour/i, 'armor');
    if (/^paperback(?:$| book)/i.test(name))
        return result(objects.SPE_NOVEL);
    if (/^paperback/i.test(name))
        return result(null);
    if (/orange$/i.test(name))
        return result(objects.ORANGE);
    const classSymbol = name.length === 1 ? OBJECT_CLASS_SYMBOLS.indexOf(name) : -1;
    if (classSymbol > 1 && (classSymbol !== VENOM_CLASS || wizardWish))
        return result(null, classSymbol);
    let oclass = 0;
    let actual = null;
    const wrapperException = /^(?:enchant |destroy |detect food|food detection|ring mail|studded leather armor|leather armor|tooled horn|food ration|meat ring)/i;
    if (!wrapperException.test(name)) {
        for (const [wrapper, cls] of wrappers) {
            if (name.toLowerCase().startsWith(wrapper)) {
                oclass = cls;
                if (cls === AMULET_CLASS)
                    actual = name;
                else {
                    name = name.slice(wrapper.length);
                    if (/^ of /i.test(name))
                        actual = name.slice(4);
                }
                break;
            }
            if (name.toLowerCase().endsWith(wrapper)) {
                oclass = cls;
                if (cls === AMULET_CLASS) {
                    if (/^versus poison /i.test(name))
                        return result(objectType('amulet versus poison'));
                    const shape = name.slice(0, -wrapper.length).trimEnd();
                    const shapeType = randomTypeByDescription(shape, cls, 0, state);
                    if (shapeType !== null)
                        return result(shapeType);
                }
                else
                    name = name.slice(0, -wrapper.length).trimEnd();
                actual = description = name;
                break;
            }
        }
    }
    let retryingArmor = false;
    for (;;) {
        if (!oclass || retryingArmor) {
            const range = ranges.find(([range]) => range === name.toLowerCase());
            if (range)
                return result(rndClass(range[2], range[3]));
            if (/ (?:stone|gem)$/i.test(name)) {
                name = name.replace(/ (?:stone|gem)$/i, '');
                oclass = GEM_CLASS;
            }
            else if (/ glass$/i.test(name) || /^glass$/i.test(name)) {
                if (parsed.lock === 'broken' || /broken/i.test(name))
                    return result(null);
                const glass = name.replace(/^worthless /i, '').replace(/^piece of /i, '')
                    .replace(/^colou?red /i, '');
                if (glass.toLowerCase() === 'glass')
                    return result(objects.WORTHLESS_PIECE_OF_WHITE_GLASS + rn2(9));
                name = `worthless piece of ${glass}`;
            }
            actual = name;
            description ??= actual;
        }
        if (!oclass && actual) {
            for (let type = objects.DILITHIUM_CRYSTAL; type <= objects.JADE; type++)
                if (actual.toLowerCase() === objects.OBJECT_NAMES[type]?.toLowerCase())
                    return result(type);
            if (actual.toLowerCase() === 'tin')
                return result(objects.TIN);
        }
        const candidates = [actual, description !== actual ? description : null, callName,
            original !== actual ? original : null];
        for (const candidate of candidates) {
            const type = randomTypeByDescription(candidate, oclass, 1, state);
            if (type !== null)
                return result(type, oclass);
        }
        if (oclass === ARMOR_CLASS && !/mail/i.test(name)) {
            // C retries postparse2 with the chosen class still in effect.
            name += ' mail';
            retryingArmor = true;
            continue;
        }
        const classAlias = alternateSpellings.find(([alias, type]) => objectClassForType(type) === oclass && wishMatches(name, alias, true));
        if (classAlias)
            return result(classAlias[1]);
        if (!oclass && /^polearm/i.test(name))
            return result(randomWeaponBySkill(P_POLEARMS));
        if (!oclass && /^hammer/i.test(name))
            return result(randomWeaponBySkill(P_HAMMER));
        return result(null, oclass);
    }
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