// objnam.js — Object wish-name parsing, weighted lookup, and visible naming.
// C refs: objnam.c readobjnam(), rnd_otyp_by_namedesc(), xname().

import { game } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { mkobj, mksobj, rndClass } from './mklev.js';
import { SPE_LIM } from './const.js';
import { heroHandName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { deleteObject } from './object_delete.js';
import { nameToMonster } from './mondata.js';
import { MONSTER_NAME } from './monster_data.js';
import { isLauncherAmmunition, isMissileObject, isWeaponTool } from './object_properties.js';
import { promptYesNo } from './query.js';
import { objectWeight } from './weight.js';
import {
    artifactByName, artifactExistCount, nameArtifact, uncreateArtifact,
} from './artifacts.js';
import {
    CRYSKNIFE, DILITHIUM_CRYSTAL, FLINT, GOLD_PIECE, JADE, LENSES, ROCK,
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, TALLOW_CANDLE, WAX_CANDLE,
    ACID_VENOM, AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, BLINDING_VENOM,
    CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, CRYSTAL_BALL, FAKE_AMULET_OF_YENDOR,
    FIGURINE, HEAVY_IRON_BALL, IRON_CHAIN, LARGE_BOX, MAGIC_LAMP, OIL_LAMP,
    SKELETON_KEY, SLIME_MOLD, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, STATUE,
    TIN, TOWEL, WAN_WISHING,
    OBJECT_BASES,
    OBJECT_DESCRIPTIONS,
    OBJECT_NAMES, OBJECT_PROB, OBJECT_MERGE, OBJECT_NOWISH, OBJECT_CHARGED,
    OBJECT_MATERIAL, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL,
    OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import { armorUsesPairGrammar, makePlural } from './object_grammar.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const SCROLL_OF_MAIL = OBJECT_NAMES.indexOf('mail');

const CLASS_PRESENTATION = {
    [WEAPON_CLASS]: 'Weapons',
    [ARMOR_CLASS]: 'Armor',
    [RING_CLASS]: 'Rings',
    [AMULET_CLASS]: 'Amulets',
    [TOOL_CLASS]: 'Tools',
    [FOOD_CLASS]: 'Comestibles',
    [POTION_CLASS]: 'Potions',
    [SCROLL_CLASS]: 'Scrolls',
    [SPBOOK_CLASS]: 'Spellbooks',
    [WAND_CLASS]: 'Wands',
    [COIN_CLASS]: 'Coins',
    [GEM_CLASS]: 'Gems/Stones',
    [ROCK_CLASS]: 'Boulders',
};

function objectClass(otyp) {
    for (let cls = 2; cls < OBJECT_BASES.length - 1; cls++) {
        if (otyp >= OBJECT_BASES[cls] && otyp < OBJECT_BASES[cls + 1])
            return cls;
    }
    return 1;
}

// C objnam.c:xname_flags(): several shuffled-description classes collapse to
// their class noun when this particular object has not been seen.  Global
// type knowledge does not override `dknown` here; a blind hero can know which
// ring was wished for without knowing that this copy looks like an engagement
// ring.
export function unseenObjectNoun(object) {
    switch (object?.oclass) {
    case AMULET_CLASS: return 'amulet';
    case RING_CLASS: return 'ring';
    case POTION_CLASS: return 'potion';
    case SCROLL_CLASS: return 'scroll';
    case SPBOOK_CLASS:
        return OBJECT_NAMES[object?.otyp] === 'novel' ? 'book' : 'spellbook';
    case WAND_CLASS: return 'wand';
    case GEM_CLASS:
        return OBJECT_MATERIAL[object?.otyp] === 21 ? 'stone' : 'gem';
    default:
        return object?.name || OBJECT_NAMES[object?.otyp] || 'object';
    }
}

function normalizeName(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^(?:an?|the)\s+/i, '')
        .toLowerCase();
}

function classQualifiedName(otyp) {
    const name = OBJECT_NAMES[otyp];
    switch (objectClass(otyp)) {
    case RING_CLASS: return `ring of ${name}`;
    case POTION_CLASS: return `potion of ${name}`;
    case SCROLL_CLASS: return `scroll of ${name}`;
    case SPBOOK_CLASS: return `spellbook of ${name}`;
    case WAND_CLASS: return `wand of ${name}`;
    default: return name;
    }
}

function currentDescription(otyp) {
    return game.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp];
}

function candidateNames(otyp) {
    const name = OBJECT_NAMES[otyp];
    const description = currentDescription(otyp);
    const names = [name, classQualifiedName(otyp)];
    if (description) {
        names.push(description);
        const cls = objectClass(otyp);
        if (cls === RING_CLASS) names.push(`${description} ring`);
        else if (cls === AMULET_CLASS) names.push(`${description} amulet`);
        else if (cls === POTION_CLASS) names.push(`${description} potion`);
        else if (cls === SCROLL_CLASS) names.push(`scroll labeled ${description}`);
        else if (cls === SPBOOK_CLASS) names.push(`${description} spellbook`);
        else if (cls === WAND_CLASS) names.push(`${description} wand`);
    }
    return names.filter(Boolean).map(normalizeName);
}

function singularizeObjectName(value) {
    const requested = normalizeName(value);
    const isExactCandidate = candidate => OBJECT_NAMES.some((name, otyp) =>
        name && candidateNames(otyp).includes(candidate));
    if (isExactCandidate(requested)) return requested;

    const alternatives = [];
    // readobjnam_postparse2() accepts plural class-qualified wishes even
    // when the object name itself is not plural ("scrolls of punishment").
    // Normalize the class noun before applying ordinary trailing-s rules.
    const classSingular = requested.replace(
        /^(rings|amulets|potions|scrolls|spellbooks|wands) of\s+/,
        prefix => `${prefix.slice(0, -5)} of `,
    );
    if (classSingular !== requested) alternatives.push(classSingular);
    if (requested.startsWith('scrolls labeled '))
        alternatives.push(`scroll labeled ${requested.slice(16)}`);
    if (/[^aeiou]ies$/.test(requested))
        alternatives.push(`${requested.slice(0, -3)}y`);
    if (/(?:ches|shes|sses|xes|zes)$/.test(requested))
        alternatives.push(requested.slice(0, -2));
    if (requested.endsWith('s')) alternatives.push(requested.slice(0, -1));
    return alternatives.find(isExactCandidate) || requested;
}

const GENERIC_SCALE_MAIL = OBJECT_NAMES.findIndex(name => name === 'scale mail');
const DRAGON_SCALE_MAIL_REMAP = new Map(
    OBJECT_NAMES.map((name, otyp) => [normalizeName(name), otyp])
        .filter(([name]) => /^[a-z]+ dragon scale mail$/.test(name)),
);

// C readobjnam_postparse1() recognizes a leading monster name before object
// lookup.  For "blue dragon scale mail", name_to_monplus() retains the blue
// dragon index and leaves "scale mail" for rnd_otyp_by_namedesc(); only after
// constructing generic SCALE_MAIL does readobjnam() remap it to blue DSM.
function namedLookupPlan(name) {
    const requested = normalizeName(name)
        .replace(/^pairs? of\s+/, '')
        .replace(/^sets? of\s+/, '');
    const finalType = DRAGON_SCALE_MAIL_REMAP.get(requested);
    return finalType === undefined
        ? { requested, lookupName: requested, finalType: null }
        : { requested, lookupName: 'scale mail', finalType };
}

export function parseWishText(text) {
    let remaining = String(text || '').trim().replace(/\s+/g, ' ');
    const parsed = {
        count: 1,
        globSize: 0,
        enchantment: null,
        buc: null,
        recharged: null,
        charges: null,
        erodeproof: false,
        eroded: null,
        eroded2: null,
        greased: false,
    };

    const chargeMatch = remaining.match(/\s*\((?:(-?\d+):)?(-?\d+)\)\s*$/);
    if (chargeMatch) {
        remaining = remaining.slice(0, chargeMatch.index).trim();
    }

    let erosionIntensity = 0;
    for (;;) {
        let match;
        if ((match = remaining.match(/^(?:an?|the)\s+/i))) {
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(/^(\d+)\s+/))) {
            parsed.count = Math.max(1, Number(match[1]));
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(
            /^(very large|large|medium|small)\s+(?=.*\bglobs?\b)/i,
        ))) {
            parsed.globSize = ['small', 'medium', 'large', 'very large']
                .indexOf(match[1].toLowerCase()) + 1;
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(/^([+-])(\d+)\s+/))) {
            parsed.enchantment = Number(match[2]) * (match[1] === '-' ? -1 : 1);
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(/^(blessed|holy)\s+/i))) {
            parsed.buc = 'blessed';
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(/^(cursed|unholy)\s+/i))) {
            parsed.buc = 'cursed';
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(/^uncursed\s+/i))) {
            parsed.buc = 'uncursed';
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(
            /^(?:rustproof|erodeproof|corrodeproof|fixed|fireproof|rotproof|tempered|crackproof)\s+/i,
        ))) {
            parsed.erodeproof = true;
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(/^greased\s+/i))) {
            parsed.greased = true;
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(
            /^(very|thoroughly)\s+(?=(?:rusty|rusted|burnt|burned|cracked|corroded|rotted)\s+)/i,
        ))) {
            erosionIntensity = match[1].toLowerCase() === 'very' ? 1 : 2;
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(
            /^(?:rusty|rusted|burnt|burned|cracked)\s+/i,
        ))) {
            parsed.eroded = 1 + erosionIntensity;
            erosionIntensity = 0;
            remaining = remaining.slice(match[0].length);
        } else if ((match = remaining.match(
            /^(?:corroded|rotted)\s+/i,
        ))) {
            parsed.eroded2 = 1 + erosionIntensity;
            erosionIntensity = 0;
            remaining = remaining.slice(match[0].length);
        } else {
            break;
        }
    }

    if (chargeMatch) {
        // C's parenthesized charge parser consumes digits, not minus signs.
        // A malformed suffix clears its numbers but preserves a prefix sign.
        const malformed = chargeMatch.slice(1).some(value => value?.startsWith('-'));
        if (malformed) {
            parsed.recharged = 0;
            if (parsed.enchantment !== null) {
                const negative = parsed.enchantment < 0 || Object.is(parsed.enchantment, -0);
                parsed.charges = negative ? -0 : 0;
            }
        } else {
            const recharge = Number(chargeMatch[1] || 0);
            parsed.recharged = recharge > 7 ? 7 : recharge;
            parsed.charges = Math.min(SPE_LIM, Number(chargeMatch[2]));
        }
    }
    const requestedName = normalizeName(remaining);
    parsed.name = singularizeObjectName(requestedName);
    if (parsed.name !== requestedName && parsed.count === 1)
        parsed.count = 2;
    return parsed;
}

// C refs: objnam.c:erosion_matters(), objclass.h:is_damageable(), and
// mkobj.c:is_flammable()/is_rottable().  Wished proof applies only where the
// object instance can retain erosion state; an ordinary non-weapon tool does
// not become proof merely because its material could otherwise decay.
function erosionMatters(object) {
    if ([WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS]
        .includes(object.oclass)) return true;
    return object.oclass === TOOL_CLASS
        && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0;
}

function objectIsDamageable(object) {
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const flammable = (material > 1 && material <= 8) || material === 18;
    const rottable = (material > 1 && material <= 8) || material === 10;
    const rustprone = material === 11;
    const corrodeable = material === 11 || material === 13;
    const crackable = material === 19 && object.oclass === ARMOR_CLASS;
    return flammable || rottable || rustprone || corrodeable || crackable;
}

function objectAcceptsPrimaryErosion(object) {
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const flammable = (material > 1 && material <= 8) || material === 18;
    const rustprone = material === 11;
    const crackable = material === 19 && object.oclass === ARMOR_CLASS;
    return flammable || rustprone || crackable;
}

function objectAcceptsSecondaryErosion(object) {
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const rottable = (material > 1 && material <= 8) || material === 10;
    const corrodeable = material === 11 || material === 13;
    return rottable || corrodeable;
}

function erosionDegree(level) {
    return level >= 3 ? 'thoroughly ' : level === 2 ? 'very ' : '';
}

// C objnam.c:add_erosion_words().  Primary and secondary damage are visible
// independently of type knowledge, so wish receipt and later inventory prose
// must retain the per-identity adjectives even when +N remains unknown.
export function objectStatePrefix(object) {
    let prefix = object?.greased ? 'greased ' : '';
    if ((object?.oeroded ?? 0) > 0 && object.otyp !== CRYSKNIFE) {
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const adjective = material === 11 ? 'rusty '
            : material === 19 && object.oclass === ARMOR_CLASS
                ? 'cracked ' : 'burnt ';
        prefix += `${erosionDegree(object.oeroded)}${adjective}`;
    }
    if ((object?.oeroded2 ?? 0) > 0 && object.otyp !== CRYSKNIFE) {
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const adjective = material === 11 || material === 13
            ? 'corroded ' : 'rotted ';
        prefix += `${erosionDegree(object.oeroded2)}${adjective}`;
    }
    return prefix;
}

// C adds xtra_prob=1 for readobjnam() so 0%-generation objects remain
// wishable.  The draw is over total probability, not candidate count.
export function rndObjectTypeByName(name, xtraProb = 1) {
    const target = namedLookupPlan(name).lookupName;
    const matches = [];
    for (let otyp = OBJECT_BASES[WEAPON_CLASS]; otyp < OBJECT_NAMES.length; otyp++) {
        if (!OBJECT_NAMES[otyp]) continue;
        if (candidateNames(otyp).some(candidate => candidate === target))
            matches.push(otyp);
    }
    if (!matches.length) return null;

    const total = matches.reduce(
        (sum, otyp) => sum + OBJECT_PROB[otyp] + xtraProb, 0,
    );
    if (total <= 0) return null;
    let roll = rn2(total);
    for (const otyp of matches) {
        roll -= OBJECT_PROB[otyp] + xtraProb;
        if (roll < 0) return otyp;
    }
    return matches.at(-1);
}

// C objnam.c:readobjnam_postparse3() checks exact canonical real-gem names
// before the combined name/description lottery.  This disambiguates requests
// such as bare "ruby" from a potion whose shuffled description is "ruby".
function exactRealGemType(name) {
    for (let otyp = DILITHIUM_CRYSTAL; otyp <= JADE; otyp++) {
        if (normalizeName(OBJECT_NAMES[otyp]) === name) return otyp;
    }
    return null;
}

export async function readObjectName(text, { wizardWish = false } = {}) {
    const parsed = parseWishText(text);
    normalizeGlobWish(parsed);
    if (['nothing', 'nil', 'none'].includes(parsed.name))
        return { noWish: true, parsed };
    if (['gold piece', 'gold', 'money', 'coin', 'zorkmid'].includes(parsed.name)
        || parsed.name.startsWith('$')) {
        const object = mksobj(GOLD_PIECE, false, false);
        object.quan = object.quantity = wizardWish
            ? parsed.count : Math.min(5000, parsed.count);
        object.owt = objectWeight(object);
        return {
            object, parsed, lookupOtyp: GOLD_PIECE,
            finalOtyp: GOLD_PIECE, isGold: true,
        };
    }

    const artifact = artifactByName(parsed.name);
    let lookupOtyp;
    let object;
    let finalType = null;
    if (!parsed.name) {
        // C's empty request selects a class and retains the generated count.
        const wishClasses = [
            WAND_CLASS, RING_CLASS, POTION_CLASS, SCROLL_CLASS, GEM_CLASS,
            AMULET_CLASS, SPBOOK_CLASS, SPBOOK_CLASS, WEAPON_CLASS,
            ARMOR_CLASS, TOOL_CLASS, FOOD_CLASS, FOOD_CLASS,
        ];
        parsed.count = 0;
        object = mkobj(wishClasses[rn2(wishClasses.length)], false);
        lookupOtyp = object.otyp;
    } else {
        const lookup = namedLookupPlan(parsed.name);
        lookupOtyp = artifact?.baseType ?? exactRealGemType(lookup.lookupName)
            ?? rndObjectTypeByName(lookup.lookupName, 1);
        if (lookupOtyp === null) return null;
        finalType = lookup.finalType;
        const type = wizardWish ? lookupOtyp : permittedWishType(lookupOtyp);
        if (type === null) return null;
        object = mksobj(type, true, false);
    }

    await applyWishQuantity(object, parsed, wizardWish);
    const luck = (game.u.uluck || 0) + (game.u.moreluck || 0);
    const enchantmentSign = applyWishEnchantment(object, parsed, wizardWish, luck);
    if (finalType !== null && lookupOtyp === GENERIC_SCALE_MAIL) {
        object.otyp = finalType;
        object.oclass = objectClass(finalType);
    }
    applyWishBlessing(object, parsed, wizardWish, luck, enchantmentSign);
    if (erosionMatters(object)) {
        object.oeroded = object.oeroded2 = 0;
        if (parsed.eroded !== null && objectAcceptsPrimaryErosion(object))
            object.oeroded = Math.min(3, parsed.eroded);
        if (parsed.eroded2 !== null && objectAcceptsSecondaryErosion(object))
            object.oeroded2 = Math.min(3, parsed.eroded2);
        if (parsed.erodeproof && (objectIsDamageable(object) || object.otyp === CRYSKNIFE))
            object.oerodeproof = luck >= 0 || wizardWish;
    }
    if (object.oclass === WAND_CLASS) {
        object.recharged = object.otyp === WAN_WISHING && !wizardWish
            ? 1 : parsed.recharged ?? 0;
    }
    if (parsed.greased) object.greased = true;

    if (artifact) {
        nameArtifact(object, artifact);
        object.quan = 1;
        game.u.uconduct ||= {};
        game.u.uconduct.wisharti = (game.u.uconduct.wisharti || 0) + 1;
    }
    const deniedArtifact = object.oartifact
        && (artifact.questArtifact || rn2(artifactExistCount()) > 1);
    if (deniedArtifact && !wizardWish) {
        uncreateArtifact(object);
        deleteObject(object);
        await plineWithContinuation(
            `For a moment, you feel something in your ${makePlural(heroHandName())}, but it disappears!`,
        );
        return { noWish: true, parsed };
    }
    object.quantity = object.quan;
    object.owt = objectWeight(object);
    return {
        object, parsed, lookupOtyp, finalOtyp: object.otyp, artifact,
    };
}

function permittedWishType(type) {
    switch (type) {
    case AMULET_OF_YENDOR: return FAKE_AMULET_OF_YENDOR;
    case CANDELABRUM_OF_INVOCATION: return rndClass(TALLOW_CANDLE, WAX_CANDLE);
    case BELL_OF_OPENING: return BELL;
    case SPE_BOOK_OF_THE_DEAD: return SPE_BLANK_PAPER;
    case MAGIC_LAMP: return OIL_LAMP;
    default: return OBJECT_NOWISH[type] ? null : type;
    }
}

function applyWishEnchantment(object, parsed, wizardWish, luck) {
    const requested = parsed.charges ?? parsed.enchantment;
    // A request for -0 still curses the item, as a negative C spesgn does.
    let sign = 0;
    if (requested !== null)
        sign = requested < 0 || Object.is(requested, -0) ? -1 : 1;
    let value = requested === null ? object.spe
        : Math.min(SPE_LIM, Math.abs(requested));
    if (requested !== null && !wizardWish) {
        const enchantable = object.oclass === ARMOR_CLASS || object.oclass === WEAPON_CLASS
            || isWeaponTool(object) || (object.oclass === RING_CLASS && OBJECT_CHARGED[object.otyp]);
        if (enchantable) {
            if (value > rnd(5) && value > object.spe) value = 0;
            if (value > 2 && luck < 0) sign = -1;
        } else {
            const cancelable = object.oclass === WAND_CLASS || object.otyp === CRYSTAL_BALL;
            if (sign < 0) value = Math.min(value, cancelable ? 1 : 0);
            if (value > object.spe) value = object.spe;
        }
    }
    if (sign < 0) value = -value;
    switch (object.otyp) {
    case TIN:
        object.spe = 0;
        break;
    case TOWEL:
    case SLIME_MOLD:
    case SKELETON_KEY:
    case CHEST:
    case LARGE_BOX:
    case HEAVY_IRON_BALL:
    case IRON_CHAIN:
    case STATUE:
    case FIGURINE:
    case CORPSE:
        break;
    case ACID_VENOM:
    case BLINDING_VENOM:
    case SCROLL_OF_MAIL:
        object.spe = 1;
        break;
    case WAN_WISHING:
        object.spe = wizardWish ? value : rn2(10) ? -1 : 0;
        break;
    default:
        object.spe = value;
    }
    return sign;
}

function applyWishBlessing(object, parsed, wizardWish, luck, enchantmentSign) {
    if (parsed.buc === 'cursed') {
        object.blessed = false;
        object.cursed = true;
    } else if (parsed.buc === 'uncursed' || parsed.buc === 'blessed') {
        object.blessed = parsed.buc === 'blessed' && (luck >= 0 || wizardWish);
        object.cursed = luck < 0 && !wizardWish;
    } else if (enchantmentSign < 0) {
        object.blessed = false;
        object.cursed = true;
    }
}

// C readobjnam_postparse1(): globs accept both "glob of gray ooze" and
// "gray ooze glob". Unknown monster names request a random glob species.
function normalizeGlobWish(parsed) {
    const match = parsed.name.match(/^globs?(?: of (.+))?$/)
        || parsed.name.match(/^(.+) globs?$/);
    if (!match) return;
    const monster = nameToMonster(match[1] || '');
    if (monster < 0) {
        const type = GLOB_OF_GRAY_OOZE
            + rn2(GLOB_OF_BLACK_PUDDING - GLOB_OF_GRAY_OOZE);
        parsed.name = OBJECT_NAMES[type];
    } else {
        parsed.name = `glob of ${MONSTER_NAME[monster]}`;
    }
    if (/\bglobs\b/.test(match[0]) && parsed.count < 2) parsed.count = 2;
}

async function applyWishQuantity(object, parsed, wizardWish) {
    let count = parsed.count;
    if (object.globby) {
        object.quan = 1;
        if (parsed.globSize > 1)
            object.owt *= 6 + (parsed.globSize - 2) * 10;
        if (count > 1) {
            const limit = Math.min(rn2(5) + 2, 6 - parsed.globSize);
            if (count > limit) {
                const override = wizardWish && !game.program_state?.wizkit_wishing
                    && await promptYesNo('Override glob weight limit? [yn] (n) ') === 'y';
                if (!override) count = limit;
            }
            object.owt *= count;
        }
        return;
    }
    if (count <= 0 || !OBJECT_MERGE[object.otyp]) return;
    // The random allowance is checked even when a later ammunition or
    // candle exception grants the whole request.
    const allowed = wizardWish || count < rnd(6)
        || (count <= 7 && [TALLOW_CANDLE, WAX_CANDLE].includes(object.otyp))
        || (count <= 20 && (object.otyp === ROCK || object.otyp === FLINT
            || isMissileObject(object)
            || (object.oclass === WEAPON_CLASS && isLauncherAmmunition(object))));
    if (allowed) object.quan = count;
}

function pluralizePair(name) {
    if (name.startsWith('pair of '))
        return `pairs of ${name.slice('pair of '.length)}`;
    const ofClass = name.match(
        /^(ring|amulet|potion|scroll|spellbook|wand) of (.+)$/,
    );
    if (ofClass) return `${ofClass[1]}s of ${ofClass[2]}`;
    if (name.startsWith('scroll labeled '))
        return `scrolls labeled ${name.slice('scroll labeled '.length)}`;
    if (/(?:ring|amulet|potion|scroll|spellbook|wand)$/.test(name))
        return name.replace(/(ring|amulet|potion|scroll|spellbook|wand)$/,
            '$1s');
    return `${name}s`;
}

const PLAIN_GEMSTONE_NAMES = new Set([
    'dilithium crystal', 'ruby', 'diamond', 'sapphire',
    'black opal', 'emerald', 'opal',
]);

function gemPresentationName(otyp, realName, description) {
    if (description) {
        const classNoun = OBJECT_MATERIAL[otyp] === 21 ? 'stone' : 'gem';
        return `${description} ${classNoun}`;
    }
    const needsStone = otyp === FLINT
        || (OBJECT_MATERIAL[otyp] === 20
            && !PLAIN_GEMSTONE_NAMES.has(realName));
    return needsStone ? `${realName} stone` : realName;
}

export function wishedObjectPresentation(otyp) {
    const cls = objectClass(otyp);
    const realName = OBJECT_NAMES[otyp];
    // xname() consults o_init.c's class knowledge independently of the
    // individual object's charge/enchantment `known` bit.  Keep the wished
    // object's appearance only while its concrete type is still unknown.
    const description = game._knownObjectTypes?.has(otyp)
        ? null : currentDescription(otyp);
    let name;
    if (cls === ARMOR_CLASS) {
        // objnam.c:armor_simple_name() uses the shuffled description for
        // every still-unknown armor type, not just boots and gloves.  Pair
        // grammar is determined by the concrete armor slot, so names such as
        // "gauntlets of power" still render as "a pair of padded gloves"
        // while an unknown cloak renders as its shuffled cape appearance.
        const noun = description || realName;
        const usesPair = armorUsesPairGrammar(realName);
        name = usesPair ? `pair of ${noun}` : noun;
    } else if (cls === RING_CLASS) {
        name = description ? `${description} ring` : `ring of ${realName}`;
    } else if (cls === AMULET_CLASS) {
        name = description ? `${description} amulet` : realName;
    } else if (cls === TOOL_CLASS) {
        name = otyp === LENSES ? 'pair of lenses' : description || realName;
    } else if (cls === POTION_CLASS) {
        name = description ? `${description} potion` : `potion of ${realName}`;
    } else if (cls === SCROLL_CLASS) {
        name = otyp === 364 ? `${description} scroll`
            : description === 'unlabeled' ? 'unlabeled scroll'
            : description ? `scroll labeled ${description}` : `scroll of ${realName}`;
    } else if (cls === SPBOOK_CLASS) {
        name = description ? `${description} spellbook` : `spellbook of ${realName}`;
    } else if (cls === WAND_CLASS) {
        name = description ? `${description} wand` : `wand of ${realName}`;
    } else if (cls === GEM_CLASS) {
        name = gemPresentationName(otyp, realName, description);
    } else {
        name = realName;
    }
    return {
        class: CLASS_PRESENTATION[cls] || 'Other',
        name,
        plural: pluralizePair(name),
        enchanted: cls === WEAPON_CLASS || cls === ARMOR_CLASS,
        showBuc: false,
        // readobjnam() only chooses and constructs the object.  The spell
        // identity remains ordinary objects[] metadata which spell.c's
        // study_book() consults after the wished book enters inventory.
        spellName: cls === SPBOOK_CLASS ? realName : undefined,
        spellLevel: cls === SPBOOK_CLASS
            ? OBJECT_SPELL_LEVEL[otyp] : undefined,
        spellCategory: cls === SPBOOK_CLASS
            ? OBJECT_SPELL_CATEGORY[otyp] : undefined,
    };
}
