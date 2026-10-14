// objnam.js — Object wish-name parsing, weighted lookup, and visible naming.
// C refs: objnam.c readobjnam(), rnd_otyp_by_namedesc(), xname().

import { game } from './gstate.js';
import type { GameState, Fruit } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Artifact } from './artifacts.js';
import { fruitFromIndex, fruitFromName, matchWishedFruit } from './fruit.js';
import { objectOwnershipPrefix, objectTypeKnown } from './shk.js';
import { rn2, rnd } from './rng.js';
import { mkobj, mksobj, rndClass } from './mklev.js';
import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC, SPE_LIM } from './const.js';
import { heroHandName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { deleteObject } from './object_delete.js';
import { nameToMonster } from './mondata.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { possessiveName } from './monster_name.js';
import { tinDetails } from './tin.js';
import { isLauncherAmmunition, isMissileObject, isPoisonableObject, isWeaponTool } from './object_properties.js';
import { promptYesNo } from './query.js';
import { objectWeight } from './weight.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import {
    artifactById, artifactByName, artifactExistCount, findArtifact, nameArtifact, uncreateArtifact,
} from './artifacts.js';
import {
    CRYSKNIFE, DILITHIUM_CRYSTAL, FLINT, GOLD_PIECE, JADE, LENSES, ROCK,
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, TALLOW_CANDLE, WAX_CANDLE,
    ACID_VENOM, AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, BLINDING_VENOM,
    BOULDER, CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, CRYSTAL_BALL, FAKE_AMULET_OF_YENDOR,
    FIGURINE, HEAVY_IRON_BALL, IRON_CHAIN, LARGE_BOX, MAGIC_LAMP, OIL_LAMP,
    SKELETON_KEY, SLIME_MOLD, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, STATUE,
    POT_WATER, TIN, TOWEL, WAN_WISHING,
    OBJECT_BASES, requireObjectData,
    OBJECT_DESCRIPTIONS,
    OBJECT_NAMES, OBJECT_PROB, OBJECT_MERGE, OBJECT_NOWISH, OBJECT_CHARGED, OBJECT_MAGIC,
    OBJECT_UNIQUE, OBJECT_USES_KNOWN,
    OBJECT_MATERIAL, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL,
    OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import { armorPresentationName, withIndefiniteArticle, makePlural, makeSingular, verbForSubject } from './object_grammar.js';
import { armorSimpleName } from './armor.js';
import { isContainer } from './container.js';
import { objectClassForType, observeBucForNaming, observeObject } from './object_knowledge.js';
import { getObjectLocation } from './object_location.js';
import { objectDisclosureText } from './object_inscription.js';
import { cansee } from './vision.js';
import { BOGUS_MONSTERS } from './random_text_data.js';
import { lookupWishType, randomTypeByDescription } from './wish_lookup.js';
import { parseWishText, type ParsedWish } from './wish_parse.js';
import { applyWishProperties, finishWishWeight, lightWishedObject } from './wish_properties.js';
import { applyWishSpecies, applyWishedTinVariety, substituteWishedGlob } from './wish_species.js';
export { parseWishText } from './wish_parse.js';
export type { ParsedWish } from './wish_parse.js';

// Detection and minimal_xname supply a naming view without allocating a game object.
export type ObjectNameView = Pick<GameObject, 'otyp' | 'oclass'> & Partial<Pick<GameObject,
    'name' | 'known' | 'dknown' | 'bknown' | 'cknown' | 'lknown' | 'rknown'
    | 'typeKnown' | 'overrideIdentified' | 'oartifact' | 'oextra' | 'oname'
    | 'spe' | 'quan' | 'quantity' | 'corpsenm' | 'owt' | 'globby'
    | 'blessed' | 'cursed' | 'odiluted' | 'opoisoned' | 'o_id' | 'oeroded' | 'oeroded2' | 'oeaten'>>;

type CorpseNameView = Pick<GameObject, 'otyp'> & Partial<Pick<GameObject,
    'corpsenm' | 'spe' | 'globby' | 'quan' | 'quantity'>>;

export type ObjectWishResult =
    | { noWish: true; parsed: ParsedWish }
    | {
        noWish?: false;
        object: GameObject;
        parsed: ParsedWish;
        lookupOtyp: number;
        finalOtyp: number;
        isGold?: boolean;
        artifact?: Artifact | null;
    };

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

const JAPANESE_ITEM_NAMES = new Map<number, string>([
    [OBJECT_NAMES.indexOf('short sword'), 'wakizashi'],
    [OBJECT_NAMES.indexOf('broadsword'), 'ninja-to'],
    [OBJECT_NAMES.indexOf('flail'), 'nunchaku'],
    [OBJECT_NAMES.indexOf('glaive'), 'naginata'],
    [OBJECT_NAMES.indexOf('lock pick'), 'osaku'],
    [OBJECT_NAMES.indexOf('wooden harp'), 'koto'],
    [OBJECT_NAMES.indexOf('magic harp'), 'magic koto'],
    [OBJECT_NAMES.indexOf('knife'), 'shito'],
    [OBJECT_NAMES.indexOf('plate mail'), 'tanko'],
    [OBJECT_NAMES.indexOf('helmet'), 'kabuto'],
    [OBJECT_NAMES.indexOf('leather gloves'), 'yugake'],
    [OBJECT_NAMES.indexOf('food ration'), 'gunyoki'],
    [OBJECT_NAMES.indexOf('booze'), 'sake'],
]);

export function japaneseItemName(otyp: number): string | undefined {
    return JAPANESE_ITEM_NAMES.get(otyp);
}

// C xname_flags() observation, kept separate from reusable name formatting.
// distant_name() suppresses new appearance knowledge, not existing knowledge.
export function observeObjectForNaming(object: GameObject, {
    distant = false, source = object, state = game,
}: {
    distant?: boolean;
    source?: Pick<GameObject, 'where' | 'ox' | 'oy'>;
    state?: GameState;
} = {}): void {
    if (OBJECT_UNIQUE[object.otyp] && OBJECT_USES_KNOWN[object.otyp]
        && !objectTypeKnown(object, state)) object.known = false;
    if (!distant && !heroIsBlind(state)) observeObject(object, state);
    observeBucForNaming(object, state);
    findArtifact(object, { source, state });
}

// C distant_name(): only the appearance-observation step depends on distance.
export function observeDistantObjectForNaming(object: GameObject, state: GameState = game): void {
    const location = getObjectLocation(object, state);
    const range = Math.max(state.u.xray_range ?? -1, 2);
    const nearDistance = range * range * 2 - range;
    const visible = location && cansee(location.x, location.y);
    const close = location && (location.x - state.u.ux) ** 2
        + (location.y - state.u.uy) ** 2 <= nearDistance;
    observeObjectForNaming(object, {
        distant: !visible || (!object.oartifact && !close), state,
    });
}

// objnam.c:xname() visible name without inventory annotations.
// Unlike doname(), this omits quantity, beatitude, enchantment, and article.
export function objectName(
    object: ObjectNameView, state: GameState = game, { minimal = false } = {},
): string {
    const personalName = object.oextra?.oname || object.oname;
    if (!minimal && personalName && objectHasPersonalName(object, state))
        return personalName.replace(/^the /i, '');
    const oclass = object.oclass;
    const overrideIdentity = !!(state.iflags?.override_ID || object.overrideIdentified);
    if (!overrideIdentity && !object.dknown
        && [RING_CLASS, AMULET_CLASS, POTION_CLASS, SCROLL_CLASS,
            SPBOOK_CLASS, WAND_CLASS, GEM_CLASS].includes(oclass))
        return unseenObjectNoun(object);
    const ordinaryName = OBJECT_NAMES[object.otyp] || object.name || 'object';
    const samurai = state.urole?.key === 'samurai';
    const trueName = actualObjectTypeName(object, state);
    const appearance = samurai && ['wooden harp', 'magic harp'].includes(ordinaryName)
        ? 'koto' : state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
    const known = overrideIdentity || (objectTypeKnown(object, state)
        && (object.dknown || !minimal && ![WEAPON_CLASS, TOOL_CLASS].includes(oclass)));
    const callName = !minimal && !known && (object.dknown || overrideIdentity)
        ? state._objectCallNames?.[object.otyp] : undefined;
    let noun: string;
    if (object.otyp === SLIME_MOLD) {
        noun = object.spe === undefined ? 'fruit' : fruitFromIndex(object.spe, state)?.fname || 'fruit';
    } else if (oclass === ARMOR_CLASS) {
        noun = armorObjectName(object, state, { minimal });
    } else if (oclass === GEM_CLASS) {
        noun = gemObjectName(object, state, { minimal });
    } else if (oclass === AMULET_CLASS) {
        if (object.otyp === AMULET_OF_YENDOR || object.otyp === FAKE_AMULET_OF_YENDOR) {
            // Discovering the type does not identify each real or fake Amulet.
            noun = overrideIdentity || object.known ? trueName : appearance ?? trueName;
        } else if (known) {
            noun = trueName;
        } else {
            const callName = minimal ? null : state._objectCallNames?.[object.otyp];
            noun = callName ? `amulet called ${callName}` : `${appearance ?? trueName} amulet`;
        }
    } else if (known) {
        if (oclass === RING_CLASS) noun = `ring of ${trueName}`;
        else if (oclass === POTION_CLASS) noun = `potion of ${trueName}`;
        else if (oclass === SCROLL_CLASS) noun = `scroll of ${trueName}`;
        else if (oclass === SPBOOK_CLASS) noun = object.otyp === SPE_BOOK_OF_THE_DEAD
            || trueName === 'novel' ? trueName : `spellbook of ${trueName}`;
        else if (oclass === WAND_CLASS) noun = `wand of ${trueName}`;
        else noun = trueName;
    } else if (oclass === RING_CLASS) noun = callName
        ? `ring called ${callName}` : `${appearance || 'unknown'} ring`;
    else if (oclass === POTION_CLASS) noun = callName
        ? `potion called ${callName}` : `${appearance || 'unknown'} potion`;
    else if (oclass === SCROLL_CLASS) noun = callName ? `scroll called ${callName}` : OBJECT_MAGIC[object.otyp]
        ? `scroll labeled ${appearance || 'unknown'}` : `${appearance || trueName} scroll`;
    else if (oclass === SPBOOK_CLASS) noun = callName
        ? `${ordinaryName === 'novel' ? 'novel' : 'spellbook'} called ${callName}`
        : `${appearance || 'unknown'} ${ordinaryName === 'novel' ? 'book' : 'spellbook'}`;
    else if (oclass === WAND_CLASS) noun = callName
        ? `wand called ${callName}` : `${appearance || 'unknown'} wand`;
    else noun = appearance || trueName;

    if (callName && (oclass === WEAPON_CLASS || oclass === TOOL_CLASS))
        noun += ` called ${callName}`;

    if (object.otyp === LENSES) noun = `pair of ${noun}`;
    if (object.otyp === TOWEL && object.spe !== undefined && object.spe > 0) {
        noun = `${object.spe < 3 ? 'moist' : 'wet'} ${noun}`;
        if (state.flags.debug) noun += ` (${object.spe})`;
    }
    if (!minimal && oclass === WEAPON_CLASS && object.opoisoned && isPoisonableObject(object))
        noun = `poisoned ${noun}`;
    if (!minimal) noun = physicalObjectNoun(object, noun, state);
    if (!minimal && oclass === FOOD_CLASS && object.otyp !== SLIME_MOLD
        && state.iflags.partly_eaten_hack && object.oeaten)
        noun = `partly eaten ${noun}`;
    if (minimal) return noun.replace(/^the /i, '');
    noun += objectDisclosureText(object, state);
    const individualName = object.oextra?.oname || object.oname;
    const showIndividualName = object.dknown || overrideIdentity;
    if (!individualName || !showIndividualName) return noun.replace(/^the /i, '');
    const name = object.oartifact ? individualName.replace(/^The /, 'the ')
        : individualName;
    return `${noun} named ${name}`.replace(/^the /i, '');
}

// C objnam.c:singular(otmp, xname) retains corpse species while describing
// one item. Ordinary objectName() already omits the stack quantity.
export function singularObjectName(object: ObjectNameView, state: GameState = game): string {
    return object.otyp === CORPSE ? corpseName(object, { singular: true })
        : objectName(object, state);
}

// C cxname()/xname(): contact feedback observes the object and retains its
// quantity, poison, physical details, and personal name without a count prefix.
export function objectCombatName(object: GameObject, {
    state = game, includeCorpseSpecies = true,
}: { state?: GameState; includeCorpseSpecies?: boolean } = {}): string {
    observeObjectForNaming(object, { state });
    if (objectHasPersonalName(object, state)) {
        const name = object.oextra?.oname || object.oname;
        if (!name) throw new Error('A personally named artifact needs its name');
        return name.replace(/^the /iu, '');
    }
    if (object.otyp === CORPSE && includeCorpseSpecies) return corpseName(object);
    let name = objectName(object, state);
    if ((object.quan ?? object.quantity ?? 1) !== 1) name = pluralizeObjectNoun(object, name);
    return name.replace(/^the /iu, '');
}

// C eat.c:food_xname(): eating describes one item, even in a larger stack.
export function foodObjectName(object: GameObject, {
    state = game, definite = false,
}: { state?: GameState; definite?: boolean } = {}): string {
    if (object.otyp === CORPSE)
        return corpseName(object, { singular: true, definite });
    const name = objectName(object, state);
    return definite ? definiteName(name, state) : name;
}

// invent.c:loot_xname() ignores counts and individual user names. Its
// temporary adjustments group water, towels, and globs without altering them.
export function lootObjectName(object: GameObject, state: GameState = game): string {
    const view: GameObject = { ...object, quan: 1, quantity: 1,
        blessed: object.otyp === POT_WATER ? false : object.blessed,
        cursed: object.otyp === POT_WATER ? false : object.cursed,
        spe: object.otyp === TOWEL ? 0 : object.spe,
        owt: object.globby ? 20 : object.owt,
    };
    if (object.oclass === POTION_CLASS) view.odiluted = false;
    if (!object.oartifact) {
        delete view.oname;
        if (view.oextra) {
            view.oextra = { ...view.oextra };
            delete view.oextra.oname;
        }
    }
    const nameState = { ...state, flags: { ...state.flags, debug: false } };
    let name = object.otyp === CORPSE ? corpseName(view, { singular: true })
        : objectName(view, nameState);
    if (object.otyp === TOWEL) name += object.spe >= 3 ? 'x' : object.spe > 0 ? 'y' : 'z';
    if (object.globby) name += object.owt <= 100 ? 'a' : object.owt <= 300 ? 'b'
        : object.owt <= 500 ? 'c' : 'd';
    return name;
}

// C objnam.c:killer_xname()/bare_artifactname(). Death causes describe the
// actual object without teaching the living hero or changing its user names.
export function killerObjectName(object: GameObject, state: GameState = game): string {
    if (object.oartifact) {
        const artifact = artifactById(object.oartifact, state);
        if (!artifact) throw new RangeError(`Unknown killer artifact ${object.oartifact}`);
        return artifact.name.replace(/^The /, 'the ');
    }
    const view = {
        ...object, known: true, dknown: true, typeKnown: true,
        bknown: object.otyp === POT_WATER, rknown: false, greased: false,
        blessed: object.otyp === POT_WATER && !!object.blessed,
        cursed: object.otyp === POT_WATER && !!object.cursed,
        opoisoned: false,
        oextra: object.oextra ? { ...object.oextra, oname: null } : null,
    };
    delete view.oname;
    const quantity = object.quan ?? object.quantity ?? 1;
    const callNames = { ...state._objectCallNames };
    delete callNames[object.otyp];
    const nameState = { ...state, _objectCallNames: callNames };
    let name: string;
    if (object.otyp === CORPSE) {
        name = corpseName(view);
    } else if (object.otyp === SLIME_MOLD) {
        name = `deadly slime mold${quantity === 1 ? '' : 's'}`;
    } else {
        name = objectName(view, nameState);
        if (quantity !== 1) name = makePlural(name);
    }
    // A possessive unique monster name already supplies its own article.
    if (quantity !== 1 || /(?:'s |s' )/i.test(name)) return name;
    return OBJECT_UNIQUE[object.otyp] ? definiteName(name, state)
        : withIndefiniteArticle(name);
}

// C do_name.c:obj_pmname(): object gender describes the depicted creature,
// independently of any saved traits used when a corpse revives.
export function objectMonsterName(object: CorpseNameView): string {
    let species = object.corpsenm;
    if (species === undefined) return 'thing';
    const gender = (object.spe || 0) & 3;
    if (MONSTER_NAME[species] === 'aligned cleric' && gender === 0)
        species = MONSTER_NAME.indexOf('cleric');
    return gender === 1 || gender === 2
        ? monsterTypeName(species, gender === CORPSTAT_FEMALE)
        : MONSTER_NAME[species] || 'thing';
}

function corpseMonsterIsUnique(species: number | undefined): boolean {
    if (species === undefined) return false;
    return !!((MONSTER_GENO[species] ?? 0) & 0x1000)
        && !['high cleric', 'long worm tail'].includes(MONSTER_NAME[species] ?? '');
}

// C corpse_xname(): corpse species is visible even when the object type has
// not been discovered. Possessive species put adjectives after their name.
export function corpseName(object: CorpseNameView, {
    adjective = '', includeArticle = false, singular = false, definite = false, omitPrefix = false,
}: { adjective?: string; includeArticle?: boolean; singular?: boolean; definite?: boolean; omitPrefix?: boolean } = {}): string {
    const glob = object.otyp !== CORPSE && object.globby;
    let name = glob ? requireObjectName(object.otyp) : objectMonsterName(object);
    const personal = !glob && object.corpsenm !== undefined
        && !!((MONSTER_FLAGS2[object.corpsenm] ?? 0) & 0x00080000);
    const unique = !glob && corpseMonsterIsUnique(object.corpsenm);
    if (personal || unique) name = possessiveName(name);
    if (adjective) name = personal || unique
        ? `${name} ${adjective}` : `${adjective} ${name}`;
    name = name.trim().replace(/\s+/g, ' ');
    if (!omitPrefix && !personal && (unique || definite)) name = `the ${name}`;
    const plural = !glob && !singular && (object.quan ?? object.quantity ?? 1) > 1;
    if (!glob) name += ` corpse${plural ? 's' : ''}`;
    return !omitPrefix && includeArticle && !personal && !unique && !definite && !plural
        && !/^\d/.test(adjective) ? withIndefiniteArticle(name) : name;
}

function physicalObjectNoun(object: ObjectNameView, noun: string, state: GameState): string {
    const override = state.iflags.override_ID || object.overrideIdentified;
    if (object.otyp === TIN && (object.known || override)) {
        return tinDetails({
            o_id: object.o_id ?? 0, spe: object.spe ?? 0,
            corpsenm: object.corpsenm ?? -1,
            blessed: object.blessed ?? false, cursed: object.cursed ?? false,
            cknown: object.cknown ?? false, overrideIdentified: !!override,
        }, object.corpsenm ?? -1, { state });
    }
    if (object.otyp === FIGURINE && object.corpsenm !== undefined && object.corpsenm >= 0)
        return `${noun} of ${withIndefiniteArticle(objectMonsterName(object))}`;
    if (object.otyp === STATUE && object.corpsenm !== undefined && object.corpsenm >= 0) {
        const name = objectMonsterName(object);
        const personal = !!((MONSTER_FLAGS2[object.corpsenm] ?? 0) & 0x00080000);
        const monster = personal ? name : corpseMonsterIsUnique(object.corpsenm)
            ? `the ${name}` : withIndefiniteArticle(name);
        const historic = state.urole?.key === 'archeologist'
            && !!((object.spe ?? 0) & CORPSTAT_HISTORIC);
        return `${historic ? 'historic ' : ''}statue of ${monster}`;
    }
    if (object.otyp === HEAVY_IRON_BALL)
        return `${(object.owt ?? 0) > requireObjectData(OBJECT_WEIGHT, object.otyp) ? 'very ' : ''}heavy iron ball`;
    if (object.otyp === BOULDER && object.corpsenm === 1) {
        object.corpsenm = 0;
        return 'next boulder';
    }
    if (object.globby) {
        const weight = object.owt ?? 0;
        const size = weight <= 100 ? 'small' : weight <= 300 ? 'medium'
            : weight <= 500 ? 'large' : 'very large';
        return `${size} ${actualObjectTypeName(object, state)}`;
    }
    if (object.otyp === POT_WATER && (override || object.dknown && object.bknown)
        && (override || objectTypeKnown(object, state)) && (object.blessed || object.cursed))
        noun = `potion of ${object.blessed ? 'holy' : 'unholy'} water`;
    if (object.oclass === POTION_CLASS && object.odiluted && (object.dknown || override))
        noun = `diluted ${noun}`;
    return noun;
}

// C objnam.c:the(): fruit and compound object names need articles; personal names do not.
export function definiteName(name: string, state: GameState = game): string {
    if (!name) return 'the []';
    if (/^the /iu.test(name)) return `t${name.slice(1)}`;
    if (!/^[A-Z]/u.test(name) || capitalizedMonsterTitle(name)) return `the ${name}`;
    if (fruitFromName(name, { exact: true, state })) {
        const artifact = artifactByName(name, state);
        // the() uses artifact_name(..., FALSE), so fuzzy wish matches do not
        // turn an ordinary fruit label into an artifact's personal name.
        if (!artifact || /^the /iu.test(artifact.name)
            || artifact.name.toLowerCase() !== name.toLowerCase()) return `the ${name}`;
    }
    const lastSpace = name.lastIndexOf(' ');
    const separator = lastSpace >= 0 ? lastSpace : name.lastIndexOf('-');
    if (separator < 0) return name;
    if (!/^[A-Z]/u.test(name.slice(separator + 1)))
        return name.includes("'") ? name : `the ${name}`;
    if (name.indexOf(' ') >= separator) return name;
    const lower = name.toLowerCase();
    const named = lower.indexOf(' named ');
    const called = lower.indexOf(' called ');
    const suffix = named < 0 ? called : called < 0 ? named : Math.min(named, called);
    const of = lower.indexOf(' of ');
    if (of >= 0 && (suffix < 0 || of < suffix)
        || suffix < 0 && name.endsWith('Platinum Yendorian Express Card')) return `the ${name}`;
    return name;
}

// Native rumors.c:CapitalMon() includes capitalized species names and titles,
// but excludes individual names in both the real and hallucinatory tables.
const CAPITALIZED_MONSTER_TITLES = [
    ...MONSTER_NAME.flatMap((name, species) => {
        const unique = !!((MONSTER_GENO[species] ?? 0) & 0x1000);
        const personal = !!((MONSTER_FLAGS2[species] ?? 0) & 0x00080000);
        if (unique && (personal || name === 'high cleric' || name === 'long worm tail')) return [];
        return [name, monsterTypeName(species), monsterTypeName(species, true)];
    }),
    ...BOGUS_MONSTERS.flatMap(name => {
        const code = name.charAt(0);
        if (code && '-+='.includes(code)) return [];
        return ['_', '|'].includes(code) ? [name.slice(1)] : [name];
    }),
].filter(name => /^[A-Z]/u.test(name));

function capitalizedMonsterTitle(name: string): boolean {
    return CAPITALIZED_MONSTER_TITLES.some(title => name.startsWith(title)
        && (name.length === title.length || [' ', "'"].includes(name.charAt(title.length))));
}

// C simple_typename()/obj_typename(): type knowledge alone selects the name.
// Potions, rings, scrolls, wands and spellbooks retain their generic noun
// until identified; other unknown types use their appearance.
export function simpleObjectTypeName(otyp: number, state: GameState = game): string {
    const oclass = objectClassForType(otyp);
    const object = { otyp, oclass };
    const actual = actualObjectTypeName(object, state);
    const known = objectTypeKnown(object, state);
    let className: string | null = null;
    switch (oclass) {
    case COIN_CLASS: return actual;
    case AMULET_CLASS: return known ? actual : 'amulet';
    case RING_CLASS: className = 'ring'; break;
    case POTION_CLASS: className = 'potion'; break;
    case SCROLL_CLASS: className = 'scroll'; break;
    case WAND_CLASS: className = 'wand'; break;
    case SPBOOK_CLASS:
        if (OBJECT_NAMES[otyp] === 'novel') return known ? 'novel' : 'book';
        className = 'spellbook';
        break;
    }
    if (className) {
        if (!known) return className;
        return OBJECT_UNIQUE[otyp] ? actual : `${className} of ${actual}`;
    }

    const appearance = state.urole?.key === 'samurai'
        && ['wooden harp', 'magic harp'].includes(OBJECT_NAMES[otyp] ?? '')
        ? 'koto' : state.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp] ?? actual;
    const name = known ? actual : appearance;
    if (oclass === ARMOR_CLASS) return armorPresentationName(name, OBJECT_NAMES[otyp]);
    if (oclass === GEM_CLASS) return gemPresentationName(otyp, actual, known ? null : appearance);
    return name;
}

// C minimal_xname() builds a bare object so personal names, call names,
// quantity, and statue identity cannot reveal more than the known type.
export function minimalObjectName(object: ObjectNameView, state: GameState = game): string {
    const bare = {
        otyp: object.otyp,
        oclass: object.oclass,
        dknown: !!object.dknown,
        typeKnown: !!object.dknown && objectTypeKnown(object, state),
        known: object.oclass === AMULET_CLASS
            ? !!object.known : !OBJECT_USES_KNOWN[object.otyp],
        quan: 1,
        corpsenm: object.otyp === BOULDER ? 0 : -1,
        spe: object.otyp === SLIME_MOLD ? object.spe ?? 0 : 0,
    };
    return objectName(bare, state, { minimal: true });
}

function actualObjectTypeName(object: ObjectNameView, state: GameState): string {
    const ordinaryName = OBJECT_NAMES[object.otyp] || object.name || 'object';
    return state.urole?.key === 'samurai'
        ? japaneseItemName(object.otyp) || ordinaryName : ordinaryName;
}

// C xname_flags() GEM_CLASS. Inventory adds quantity and individual names;
// minimal_xname suppresses only the user-supplied type call name here.
export function gemObjectName(
    object: ObjectNameView, state: GameState = game, { minimal = false } = {},
): string {
    const classNoun = OBJECT_MATERIAL[object.otyp] === 21 ? 'stone' : 'gem';
    const overrideIdentity = !!state.iflags.override_ID;
    if (!object.dknown && !overrideIdentity) return classNoun;
    const actualName = actualObjectTypeName(object, state);
    if (overrideIdentity || objectTypeKnown(object, state))
        return gemPresentationName(object.otyp, actualName, null);
    const callName = minimal ? null : state._objectCallNames?.[object.otyp];
    if (callName) return `${classNoun} called ${callName}`;
    const appearance = state.objectDescriptions?.[object.otyp]
        ?? OBJECT_DESCRIPTIONS[object.otyp] ?? actualName;
    return gemPresentationName(object.otyp, actualName, appearance);
}

// C xname_flags() ARMOR_CLASS. The concrete type owns pair/set grammar.
export function armorObjectName(
    object: ObjectNameView, state: GameState, { minimal = false } = {},
): string {
    const actualName = actualObjectTypeName(object, state);
    const ordinaryName = OBJECT_NAMES[object.otyp];
    const overrideIdentity = !!state.iflags?.override_ID;
    const descriptionKnown = object.dknown || overrideIdentity;
    if (/ dragon scales$/.test(actualName))
        return armorPresentationName(actualName, actualName);
    if (!descriptionKnown) {
        if (['elven shield', 'Uruk-hai shield', 'orcish shield'].includes(actualName))
            return 'shield';
        if (actualName === 'shield of reflection') return 'smooth shield';
    }
    const typeKnown = overrideIdentity
        || ((!minimal || descriptionKnown) && objectTypeKnown(object, state));
    const callName = minimal ? null : state._objectCallNames?.[object.otyp];
    const noun = typeKnown ? actualName
        : callName ? `${armorSimpleName(object, state)} called ${callName}`
            : state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp] ?? actualName;
    return armorPresentationName(noun, ordinaryName);
}

// C simpleonames(): suppress personal/call names and the quantity prefix.
export function simpleObjectName(object: ObjectNameView, state: GameState = game): string {
    const noun = minimalObjectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    return quantity === 1 ? noun : pluralizeObjectNoun(object, noun);
}

// C ansimpleoname(): add an article to singular simple names.
export function simpleObjectNameWithArticle(object: ObjectNameView, state: GameState = game): string {
    const noun = simpleObjectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity !== 1) return noun;
    const uniqueType = object.otyp === FAKE_AMULET_OF_YENDOR ? AMULET_OF_YENDOR : object.otyp;
    if (OBJECT_UNIQUE[uniqueType] && noun === OBJECT_NAMES[uniqueType])
        return definiteName(noun, state);
    return withIndefiniteArticle(noun);
}

export function ownedObjectName(
    object: GameObject, state: GameState = game, { capitalized = true } = {},
): string {
    // yname() omits ownership for most personal artifacts; quest artifacts retain it.
    const omitOwner = object.where === 'inventory'
        && objectHasPersonalName(object, state)
        && (object.oartifact ?? 0) < requiredArtifact('The Orb of Detection', state).id;
    const prefix = omitOwner ? '' : objectOwnershipPrefix(object, state, { capitalized });
    const quantity = object.quan ?? object.quantity ?? 1;
    // yname() uses cxname(): corpses retain their species and plural suffix.
    const noun = object.otyp === CORPSE ? corpseName(object) : objectName(object, state);
    const name = `${prefix}${quantity === 1 || object.otyp === CORPSE
        ? noun : pluralizeObjectNoun(object, noun)}`;
    return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// Native fruit labels imported from bones can already be plural. xname
// singularizes those labels before pluralizing a multi-object stack.
export function pluralizeObjectNoun(object: Pick<GameObject, 'otyp'>, noun: string): string {
    return makePlural(object.otyp === SLIME_MOLD ? makeSingular(noun) : noun);
}

// C objnam.c:obj_is_pname()/not_fully_identified(). An artifact only uses its
// personal name after its identity and relevant object properties are known.
export function objectHasPersonalName(object: ObjectNameView, state: GameState = game): boolean {
    if (!object.oartifact || !(object.oextra?.oname || object.oname)) return false;
    if (state.program_state?.gameover || state.iflags?.override_ID
        || object.overrideIdentified) return true;
    if (!object.known || !object.dknown || !object.bknown
        || !objectTypeKnown(object, state)
        || !state._artifactDiscoveries?.includes(object.oartifact)) return false;
    if (!object.cknown && (isContainer(object) || object.otyp === STATUE))
        return false;
    if (!object.lknown && [CHEST, LARGE_BOX].includes(object.otyp)) return false;
    const showsProofing = [ARMOR_CLASS, WEAPON_CLASS, BALL_CLASS]
        .includes(object.oclass) || isWeaponTool(object);
    return !!object.rknown || !showsProofing || !objectIsDamageable(object);
}

// C objnam.c:Yobjnam2(), for messages such as "Your 12 arrows glow".
// C obj.h is_plural(): the discovered Eyes are plural even as one object.
export function objectNameIsPlural(object: ObjectNameView, state: GameState = game): boolean {
    return (object.quan ?? object.quantity ?? 1) !== 1
        || (object.oartifact === requiredArtifact('The Eyes of the Overworld', state).id
            && !!state._artifactDiscoveries?.includes(object.oartifact));
}

export function ownedObjectAction(
    object: GameObject, verb: string | null, state: GameState = game, { capitalized = true } = {},
): string {
    const quantity = object.quan ?? object.quantity ?? 1;
    const personalName = object.oextra?.oname || object.oname;
    const personal = !!personalName && objectHasPersonalName(object, state);
    const name = personal && personalName
        ? personalName.replace(/^the /i, '')
        : singularObjectName(object, state);
    const noun = quantity > 1 ? `${quantity} ${pluralizeObjectNoun(object, name)}` : name;
    const firstQuestArtifact = requiredArtifact('The Orb of Detection', state).id;
    const needsOwner = object.where !== 'inventory' || !personal
        || object.oartifact !== undefined && object.oartifact >= firstQuestArtifact;
    const prefix = needsOwner ? objectOwnershipPrefix(object, state, { capitalized }) : '';
    let subject = `${prefix}${noun}`;
    if (capitalized) subject = subject.charAt(0).toUpperCase() + subject.slice(1);
    if (!verb) return subject;
    const action = objectNameIsPlural(object, state) ? verb : verbForSubject(null, verb);
    return `${subject} ${action}`;
}

const CLASS_PRESENTATION: Readonly<Partial<Record<number, string>>> = {
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

function objectClass(otyp: number): number {
    for (let cls = 2; cls < OBJECT_BASES.length - 1; cls++) {
        const first = OBJECT_BASES[cls];
        const last = OBJECT_BASES[cls + 1];
        if (first === undefined || last === undefined)
            throw new RangeError(`Missing object class bounds for class ${cls}`);
        if (otyp >= first && otyp < last) return cls;
    }
    return 1;
}

// C objnam.c:xname_flags(): several shuffled-description classes collapse to
// their class noun when this particular object has not been seen.  Global
// type knowledge does not override `dknown` here; a blind hero can know which
// ring was wished for without knowing that this copy looks like an engagement
// ring.
export function unseenObjectNoun(
    object: Pick<GameObject, 'otyp' | 'oclass' | 'name'> | null | undefined,
): string {
    if (!object) return 'object';
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

function currentDescription(otyp: number): string | null | undefined {
    return game.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp];
}

// C readobjnam_postparse3(): Japanese aliases follow the ordinary name and
// description lottery, regardless of the hero's role, without another draw.
function japaneseWishType(request: string): number | null {
    let name = request;
    for (const wrapper of ['wand', 'ring', 'potion', 'scroll', 'gem', 'spellbook',
        'spell book', 'weapon', 'armor', 'tool', 'food', 'comestible']) {
        const prefix = `${wrapper} of `;
        const suffix = ` ${wrapper}`;
        if (request.startsWith(prefix)) {
            name = request.slice(prefix.length);
            break;
        }
        if (request.endsWith(suffix)) {
            name = request.slice(0, -suffix.length);
            break;
        }
    }
    for (const [type, japaneseName] of JAPANESE_ITEM_NAMES) {
        if (name === japaneseName) return type;
    }
    return null;
}

// C refs: objnam.c:erosion_matters(), objclass.h:is_damageable(), and
// mkobj.c:is_flammable()/is_rottable().  Wished proof applies only where the
// object instance can retain erosion state; an ordinary non-weapon tool does
// not become proof merely because its material could otherwise decay.
function erosionMatters(object: Pick<GameObject, 'otyp' | 'oclass'>): boolean {
    if ([WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS]
        .includes(object.oclass)) return true;
    return object.oclass === TOOL_CLASS
        && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0;
}

function objectIsDamageable(object: Pick<GameObject, 'otyp' | 'oclass'>): boolean {
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const flammable = (material > 1 && material <= 8) || material === 18;
    const rottable = (material > 1 && material <= 8) || material === 10;
    const rustprone = material === 11;
    const corrodeable = material === 11 || material === 13;
    const crackable = material === 19 && object.oclass === ARMOR_CLASS;
    return flammable || rottable || rustprone || corrodeable || crackable;
}

function objectAcceptsPrimaryErosion(object: Pick<GameObject, 'otyp' | 'oclass'>): boolean {
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const flammable = (material > 1 && material <= 8) || material === 18;
    const rustprone = material === 11;
    const crackable = material === 19 && object.oclass === ARMOR_CLASS;
    return flammable || rustprone || crackable;
}

function objectAcceptsSecondaryErosion(object: Pick<GameObject, 'otyp'>): boolean {
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const rottable = (material > 1 && material <= 8) || material === 10;
    const corrodeable = material === 11 || material === 13;
    return rottable || corrodeable;
}

function erosionDegree(level: number): string {
    return level >= 3 ? 'thoroughly ' : level === 2 ? 'very ' : '';
}

// C objnam.c:add_erosion_words().  Primary and secondary damage are visible
// independently of type knowledge, so wish receipt and later inventory prose
// must retain the per-identity adjectives even when +N remains unknown.
export function objectStatePrefix(
    object: Pick<GameObject, 'otyp' | 'oclass' | 'greased' | 'oeroded' | 'oeroded2'> | null | undefined,
): string {
    if (!object) return '';
    const primaryErosion = object.oeroded ?? 0;
    const secondaryErosion = object.oeroded2 ?? 0;
    let prefix = object?.greased ? 'greased ' : '';
    if (primaryErosion > 0 && object.otyp !== CRYSKNIFE) {
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const adjective = material === 11 ? 'rusty '
            : material === 19 && object.oclass === ARMOR_CLASS
                ? 'cracked ' : 'burnt ';
        prefix += `${erosionDegree(primaryErosion)}${adjective}`;
    }
    if (secondaryErosion > 0 && object.otyp !== CRYSKNIFE) {
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const adjective = material === 11 || material === 13
            ? 'corroded ' : 'rotted ';
        prefix += `${erosionDegree(secondaryErosion)}${adjective}`;
    }
    return prefix;
}

// C adds xtra_prob=1 for readobjnam() so 0%-generation objects remain
// wishable.  The draw is over total probability, not candidate count.
export function rndObjectTypeByName(name: string, xtraProb = 1): number | null {
    return randomTypeByDescription(name, 0, xtraProb);
}

export async function readObjectName(
    text: string, { wizardWish = false } = {},
): Promise<ObjectWishResult | null> {
    const parsed = parseWishText(text);
    normalizeGlobWish(parsed);
    if (['nothing', 'nil', 'none'].includes(text.trim().toLowerCase()))
        return { noWish: true, parsed };
    if (['gold piece', 'gold', 'money', 'coin', 'zorkmid'].includes(parsed.name)
        || parsed.name.startsWith('$')) {
        const object = await mksobj(GOLD_PIECE, false, false);
        object.quan = object.quantity = wizardWish
            ? parsed.count : Math.min(5000, parsed.count);
        object.owt = objectWeight(object);
        return {
            object, parsed, lookupOtyp: GOLD_PIECE,
            finalOtyp: GOLD_PIECE, isGold: true,
        };
    }

    const artifact = artifactByName(parsed.name);
    let lookupOtyp: number;
    let object: GameObject;
    let fruit: Fruit | null = null;
    if (!parsed.name) {
        // C's empty request selects a class and retains the generated count.
        const wishClasses = [
            WAND_CLASS, RING_CLASS, POTION_CLASS, SCROLL_CLASS, GEM_CLASS,
            AMULET_CLASS, SPBOOK_CLASS, SPBOOK_CLASS, WEAPON_CLASS,
            ARMOR_CLASS, TOOL_CLASS, FOOD_CLASS, FOOD_CLASS,
        ];
        parsed.count = 0;
        const chosenClass = wishClasses[rn2(wishClasses.length)];
        if (chosenClass === undefined) throw new RangeError('Random wish class is out of bounds');
        object = await mkobj(chosenClass, false);
        lookupOtyp = object.otyp;
    } else {
        const lookup = lookupWishType(parsed.name, { wizardWish });
        const blankType = parsed.unlabeled && /scroll$/.test(parsed.name)
            ? OBJECT_NAMES.indexOf('blank paper')
            : parsed.unlabeled && /spellbook$/.test(parsed.name) ? SPE_BLANK_PAPER : null;
        let matchedType = parsed.directType ?? artifact?.baseType ?? blankType ?? lookup.type
            ?? japaneseWishType(parsed.name);
        if (matchedType === null) {
            const match = matchWishedFruit(parsed.fruitName);
            if (match) {
                fruit = match.fruit;
                if (!parsed.countExplicit) parsed.count = match.count;
                matchedType = SLIME_MOLD;
            }
        }
        if (matchedType === null) {
            if (!lookup.oclass) return null;
            object = await mkobj(lookup.oclass, false);
            lookupOtyp = object.otyp;
        } else {
            lookupOtyp = substituteWishedGlob(matchedType, parsed);
            const type = wizardWish ? lookupOtyp : permittedWishType(lookupOtyp);
            if (type === null) return null;
            object = await mksobj(type, true, false);
        }
        if (fruit) object.spe = fruit.fid;
    }

    await applyWishQuantity(object, parsed, wizardWish);
    lightWishedObject(object, parsed);
    const luck = (game.u.uluck || 0) + (game.u.moreluck || 0);
    const enchantmentSign = applyWishEnchantment(object, parsed, wizardWish, luck);
    await applyWishSpecies(object, parsed, wizardWish);
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
    await applyWishProperties(object, parsed, wizardWish, luck);
    applyWishedTinVariety(object, parsed, wizardWish);

    if (artifact) {
        nameArtifact(object, artifact);
        object.quan = 1;
        game.u.uconduct ||= {};
        game.u.uconduct.wisharti = (game.u.uconduct.wisharti || 0) + 1;
    }
    let deniedArtifact = false;
    if (object.oartifact) {
        if (!artifact) throw new Error(`Wished artifact ${object.oartifact} has no matching name`);
        deniedArtifact = !!artifact.questArtifact || rn2(artifactExistCount()) > 1;
    }
    if (deniedArtifact && !wizardWish) {
        uncreateArtifact(object);
        await deleteObject(object);
        await plineWithContinuation(
            `For a moment, you feel something in your ${makePlural(heroHandName())}, but it disappears!`,
        );
        return { noWish: true, parsed };
    }
    object.quantity = object.quan;
    await finishWishWeight(object, parsed);
    return {
        object, parsed, lookupOtyp, finalOtyp: object.otyp, artifact,
    };
}

function permittedWishType(type: number): number | null {
    switch (type) {
    case AMULET_OF_YENDOR: return FAKE_AMULET_OF_YENDOR;
    case CANDELABRUM_OF_INVOCATION: return rndClass(TALLOW_CANDLE, WAX_CANDLE);
    case BELL_OF_OPENING: return BELL;
    case SPE_BOOK_OF_THE_DEAD: return SPE_BLANK_PAPER;
    case MAGIC_LAMP: return OIL_LAMP;
    default: return OBJECT_NOWISH[type] ? null : type;
    }
}

function applyWishEnchantment(
    object: GameObject, parsed: ParsedWish, wizardWish: boolean, luck: number,
): -1 | 0 | 1 {
    const requested = parsed.charges ?? parsed.enchantment;
    // A request for -0 still curses the item, as a negative C spesgn does.
    let sign: -1 | 0 | 1 = 0;
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

function applyWishBlessing(
    object: GameObject, parsed: ParsedWish, wizardWish: boolean,
    luck: number, enchantmentSign: -1 | 0 | 1,
): void {
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
function normalizeGlobWish(parsed: ParsedWish): void {
    const match = parsed.name.match(/^globs?(?: of (.+))?$/)
        || parsed.name.match(/^(.+) globs?$/);
    if (!match) return;
    const monster = nameToMonster(match[1] || '');
    if (monster < 0) {
        const type = GLOB_OF_GRAY_OOZE
            + rn2(GLOB_OF_BLACK_PUDDING - GLOB_OF_GRAY_OOZE);
        parsed.name = requireObjectName(type);
    } else {
        parsed.name = `glob of ${MONSTER_NAME[monster]}`;
    }
    if (/\bglobs\b/.test(match[0]) && parsed.count < 2) parsed.count = 2;
}

async function applyWishQuantity(
    object: GameObject, parsed: ParsedWish, wizardWish: boolean,
): Promise<void> {
    let count = parsed.count;
    if (object.globby) {
        object.quan = 1;
        if (parsed.globSize > 1)
            object.owt *= 6 + (parsed.globSize - 2) * 10;
        if (count > 1) {
            const limit = Math.min(rn2(5) + 2, 6 - parsed.globSize);
            if (count > limit) {
                const override = wizardWish && !game.program_state?.wizkit_wishing
                    && await promptYesNo('Override glob weight limit?') === 'y';
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

function pluralizePair(name: string): string {
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

function gemPresentationName(
    otyp: number, realName: string, description: string | null | undefined,
): string {
    if (description) {
        const classNoun = OBJECT_MATERIAL[otyp] === 21 ? 'stone' : 'gem';
        return `${description} ${classNoun}`;
    }
    const needsStone = otyp === FLINT
        || (OBJECT_MATERIAL[otyp] === 20
            && !PLAIN_GEMSTONE_NAMES.has(realName));
    return needsStone ? `${realName} stone` : realName;
}

export function wishedObjectPresentation(object: GameObject) {
    const otyp = object.otyp;
    const cls = objectClass(otyp);
    const realName = requireObjectName(otyp);
    // xname() consults o_init.c's class knowledge independently of the
    // individual object's charge/enchantment `known` bit.  Keep the wished
    // object's appearance only while its concrete type is still unknown.
    const description = game._knownObjectTypes?.has(otyp)
        ? null : currentDescription(otyp);
    let name: string;
    if (otyp === SLIME_MOLD) {
        name = fruitFromIndex(object.spe)?.fname || 'fruit';
    } else if (cls === ARMOR_CLASS) {
        name = armorPresentationName(description || realName, realName);
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
        plural: otyp === SLIME_MOLD ? pluralizeObjectNoun(object, name) : pluralizePair(name),
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

function requireObjectName(otyp: number): string {
    const name = requireObjectData(OBJECT_NAMES, otyp);
    if (!name) throw new RangeError(`Object type ${otyp} has no native name`);
    return name;
}

function requiredArtifact(name: string, state: GameState): Artifact {
    const artifact = artifactByName(name, state);
    if (!artifact) throw new RangeError(`No native artifact named ${name}`);
    return artifact;
}

function requiredCapture(match: RegExpMatchArray, group: number): string {
    const value = match[group];
    if (value === undefined) throw new Error(`Missing name capture ${group} in ${match[0]}`);
    return value;
}
