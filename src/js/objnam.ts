// objnam.js — Object wish-name parsing, weighted lookup, and visible naming.
// C refs: objnam.c readobjnam(), rnd_otyp_by_namedesc(), xname().

import { game, requireGameLevel } from './gstate.js';
import { objectProb, objectMaterial } from './o_init.js';
import type { GameState } from './game_state.js';
import type { GameObject, ObjectBlessing } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Artifact } from './artifacts.js';
import { fruitFromIndex, fruitFromName, matchWishedFruit } from './fruit.js';
import { objectOwnershipPrefix, objectTypeKnown, deleteObject, deleteObjectContents } from './shk.js';
import { rn2, rnd } from './rng.js';
import { mkobj, mksobj, set_corpsenm, unlinkObject } from './mkobj.js';
import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE, Align2amask, ALTAR, BEAR_TRAP, CLOUD, COLNO, CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_RANDOM, CORR, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER, DBWALL, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DOOR, DRAWBRIDGE_UP, F_LOOTED, FOUNTAIN, G_GENOD, G_NOCORPSE, GRAVE, HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, IS_DRAWBRIDGE, IS_FURNITURE, IS_WALL, is_hole, Is_rogue_level, LANDMINE, LAVAPOOL, LAVAWALL, M_AP_OBJECT, M_AP_TYPE, MAGIC_PORTAL, MOAT, P_HAMMER, P_POLEARMS, PL_PSIZ, POOL, QBUFSZ, ROCKTRAP, ROOM, ROWNO, SCORR, SDOOR, SINK, SPE_LIM, S_LDWASHER, S_LPUDDING, S_LRING, THRONE, T_LOOTED, TRAPNUM, TREE, TREE_LOOTED, TREE_SWARM, TT_LAVA, VWALL, WATER, WM_MASK, W_NONDIGGABLE, W_NONPASSWALL, WT_IRON_BALL_INCR, OBJECT_TIMER_KIND, LEVEL_TIMER_KIND } from './const.js';
import { heroHandName } from './body_parts.js';
import { plineWithContinuation } from './pline.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, monsterClassSymbol,
    monsterIsVerySmall, monsterTypeName,
} from './monster_data.js';
import { possessiveName } from './hacklib.js';
import { parseTinPreparation, setTinVariety, tinDetails } from './tin.js';
import { isLauncherAmmunition, isMissileObject, isPoisonableObject, isWeaponTool } from './object_properties.js';
import { promptYesNo } from './query.js';
import { objectWeight } from './weight.js';
import { heroIsBlind } from './senses.js';
import {
    artifactById, artifactByName, artifactExistCount, findArtifact, nameArtifact, uncreateArtifact,
} from './artifacts.js';
import {
    CRYSKNIFE, FLINT, GOLD_PIECE, LENSES, ROCK,
    TALLOW_CANDLE, WAX_CANDLE,
    ACID_VENOM, AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, BLINDING_VENOM,
    BOULDER, CANDELABRUM_OF_INVOCATION, CHEST, CORPSE, CRYSTAL_BALL, FAKE_AMULET_OF_YENDOR,
    FIGURINE, HEAVY_IRON_BALL, IRON_CHAIN, LARGE_BOX, MAGIC_LAMP, OIL_LAMP,
    SKELETON_KEY, SLIME_MOLD, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, STATUE,
    POT_WATER, TIN, TOWEL, WAN_WISHING,
    SPE_NOVEL,
    OBJECT_BASES, requireObjectData,
    OBJECT_DESCRIPTIONS,
    OBJECT_NAMES, OBJECT_MERGE, OBJECT_NOWISH, OBJECT_CHARGED, OBJECT_MAGIC,
    OBJECT_UNIQUE, OBJECT_USES_KNOWN,
    OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL,
    OBJECT_SUBTYPE, OBJECT_WEIGHT,
} from './object_data.js';
import { armorPresentationName, withIndefiniteArticle, makePlural, makeSingular, verbForSubject } from './object_grammar.js';
import { armorSimpleName } from './armor.js';
import { isContainer } from './container.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType, observeBucForNaming, observeObject } from './object_knowledge.js';
import { objectDisclosureText } from './object_inscription.js';
import { cansee } from './vision.js';
import { BOGUS_MONSTERS } from './random_text_data.js';
import * as objects from './object_data.js';
import {
    nameToMonster, resolveMonsterNamePrefix,
    type MonsterNameGender, type MonsterNamePrefix,
} from './mondata.js';
import { japaneseItemName, japaneseWishType } from './japanese_item_name.js';
import {
    EGG, GRAY_DRAGON_SCALE_MAIL, GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, GRAY_DRAGON_SCALES,
    YELLOW_DRAGON_SCALES, BEARTRAP, LAND_MINE, BAG_OF_TRICKS, BRASS_LANTERN, HORN_OF_PLENTY, POT_OIL,
} from './object_data.js';
import { scheduleObjectTimer, stopLevelTimer } from './timeout.js';
import { consumeRemainingFood, foodNutrition } from './food_lifecycle.js';
import { placeCreatedObject } from './floor_object.js';
import { beginObjectBurn } from './light.js';
import { hatchableEggSpecies } from './egg_species.js';
import { counterWereSpecies } from './were.js';
import { applyHeroLiquidEffects } from './hack.js';
import { docrt, feel_newsym } from './display.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import { deleteEngravingAt } from './engrave.js';
import { fireDamageChain } from './fire_damage.js';
import type { MapLocation } from './map_types.js';
import { canFallThrough, countLevelFeatures, make_grave, maketrap } from './mklev.js';
import { fix_wall_spines } from './mkmaze.js';
import { propertyIsActive } from './properties.js';
import { canOverwriteTerrain, isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { waterbodyName } from './terrain_name.js';
import { resetHeroTrap, switchHeroTerrain } from './terrain_movement.js';
import { deleteTrap, trapName, waterDamageObject } from './trap.js';
import { vision_note_blocker_change } from './vision.js';
import { startMeltIceTimer, getObjectLocation } from './zap.js';
import { lookupNovelTitle } from './novel_titles.js';
import type { Fruit } from './game_state.js';
export { japaneseItemName } from './japanese_item_name.js';

// Detection and minimal_xname supply a naming view without allocating a game object.
export type ObjectNameView = Pick<GameObject, 'otyp' | 'oclass'> & Partial<Pick<GameObject,
    'name' | 'known' | 'dknown' | 'bknown' | 'cknown' | 'lknown' | 'rknown'
    | 'overrideIdentified' | 'oartifact' | 'oextra' | 'oname'
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

const STRANGE_OBJECT = 0;
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

// C distant_name() also suppresses inscriptions during final map browsing.
// Restore the identity before returning; it still selects inventory text.
export async function distantObjectName(object: GameObject, format: (object: GameObject) => string | Promise<string>,
    state: GameState = game): Promise<string> {
    const identity = object.o_id;
    if (state.program_state.gameover) object.o_id = 0;
    try {
        observeDistantObjectForNaming(object, state);
        return await format(object);
    } finally {
        object.o_id = identity;
    }
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
    if (object.otyp === CORPSE && includeCorpseSpecies) return corpseName(object);
    observeObjectForNaming(object, { state });
    if (objectHasPersonalName(object, state)) {
        const name = object.oextra?.oname || object.oname;
        if (!name) throw new Error('A personally named artifact needs its name');
        return name.replace(/^the /iu, '');
    }
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
        ...object, known: true, dknown: true,
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
    const knownTypes = new Set(state._knownObjectTypes);
    knownTypes.add(object.otyp);
    const nameState = { ...state, _objectCallNames: callNames, _knownObjectTypes: knownTypes };
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

// C rumors.c:CapitalMon().
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

// C objnam.c:mimic_obj_name(): discovery describes the apparent object,
// while the earlier meal message describes the shape the hero takes.
export function mimicObjectName(monster: Pick<Monster, 'm_ap_type' | 'mappearance'>, state: GameState = game): string {
    const appearance = monster.mappearance;
    if (M_AP_TYPE(monster) !== M_AP_OBJECT || appearance === undefined || appearance === STRANGE_OBJECT)
        return 'whatcha-may-callit';
    return appearance === GOLD_PIECE ? 'gold' : simpleObjectTypeName(appearance, state);
}

// C obj_typename(): discoveries-style type name, call name, and appearance.
export function objectTypeName(otyp: number, state: GameState = game): string {
    const oclass = objectClassForType(otyp);
    let name = simpleObjectTypeName(otyp, state);
    if (oclass === COIN_CLASS) return name;
    const callName = state._objectCallNames?.[otyp];
    if (callName) name += ` called ${callName}`;
    const ordinaryName = OBJECT_NAMES[otyp];
    const appearance = state.urole?.key === 'samurai'
        && ['wooden harp', 'magic harp'].includes(ordinaryName ?? '')
        ? 'koto' : state.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp];
    const classHasAppearance = [AMULET_CLASS, POTION_CLASS, SCROLL_CLASS,
        WAND_CLASS, SPBOOK_CLASS, RING_CLASS].includes(oclass);
    if (appearance && (classHasAppearance || objectTypeKnown({ otyp, oclass }, state)))
        name += ` (${appearance})`;
    return name;
}

// C minimal_xname() builds a bare object so personal names, call names,
// quantity, and statue identity cannot reveal more than the known type.
export function minimalObjectName(object: ObjectNameView, state: GameState = game): string {
    const bare = {
        otyp: object.otyp,
        oclass: object.oclass,
        dknown: !!object.dknown,
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
    const classNoun = objectMaterial(object.otyp) === 21 ? 'stone' : 'gem';
    const overrideIdentity = !!(state.iflags.override_ID || object.overrideIdentified);
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
    const overrideIdentity = !!(state.iflags.override_ID || object.overrideIdentified);
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

// C the_unique_obj(): an unidentified imitation must look like the real Amulet.
export function objectLooksUnique(object: ObjectNameView, state: GameState = game): boolean {
    const override = !!state.iflags.override_ID;
    if (!object.dknown && !override) return false;
    const known = object.known || override;
    if (object.otyp === FAKE_AMULET_OF_YENDOR && !known) return true;
    return !!OBJECT_UNIQUE[object.otyp] && (!!known || object.otyp === AMULET_OF_YENDOR);
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
    object: GameObject, state: GameState = game,
    { capitalized = true, includeQuantity = false } = {},
): string {
    if (object.otyp !== CORPSE) observeObjectForNaming(object, { state });
    // yname() omits ownership for most personal artifacts; quest artifacts retain it.
    const omitOwner = object.where === 'inventory'
        && objectHasPersonalName(object, state)
        && (object.oartifact ?? 0) < requiredArtifact('The Orb of Detection', state).id;
    const prefix = omitOwner ? '' : objectOwnershipPrefix(object, state, { capitalized });
    const quantity = object.quan ?? object.quantity ?? 1;
    // yobjnam() adds the count; yname() leaves it out.
    const count = includeQuantity && quantity !== 1 ? `${quantity} ` : '';
    // yname() uses cxname(): corpses retain their species and plural suffix.
    const noun = object.otyp === CORPSE ? corpseName(object) : objectName(object, state);
    const name = `${prefix}${count}${quantity === 1 || object.otyp === CORPSE
        ? noun : pluralizeObjectNoun(object, noun)}`;
    return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// C ysimple_name()/Ysimple_name2(): ownership with only the known type name.
export function ownedSimpleObjectName(
    object: GameObject, state: GameState = game, { capitalized = true } = {},
): string {
    return objectOwnershipPrefix(object, state, { capitalized }) + minimalObjectName(object, state);
}

export async function ownedObjectQuestion(
    object: GameObject,
    { prefix, suffix, fallback, capitalized }: {
        prefix: string; suffix: string; fallback: string; capitalized: boolean;
    },
    state: GameState = game,
): Promise<string> {
    return await objectQuestion(object, {
        prefix, suffix, fallback,
        format: (item, nameState) => ownedObjectName(item, nameState, { capitalized }),
        shortFormat: (item, nameState) => ownedSimpleObjectName(item, nameState, { capitalized }),
    }, state);
}

// C safe_qbuf()/short_oname(): reserve the question before shortening names.
// `reserve` models a standalone short_oname() call whose length limit comes
// from a fixed worst-case prompt rather than this question's own text.
export async function objectQuestion(
    object: GameObject,
    { prefix, suffix, fallback, format, shortFormat, reserve = 0 }: {
        prefix: string;
        suffix: string;
        fallback?: string;
        format: (object: GameObject, state: GameState) => string | Promise<string>;
        shortFormat: (object: GameObject, state: GameState) => string;
        reserve?: number;
    },
    state: GameState = game,
): Promise<string> {
    const limit = QBUFSZ - 1 - prefix.length - suffix.length - reserve;
    const question = (name: string): string => `${prefix}${name}${suffix}`;
    if (fallback !== undefined && fallback.length > limit) return question(fallback).slice(0, QBUFSZ - 1);
    let name = await format(object, state);
    if (name.length <= limit) return question(name);

    const callName = state._objectCallNames?.[object.otyp];
    const personalName = object.oextra?.oname || object.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...state, _objectCallNames: {
            ...state._objectCallNames, [object.otyp]: `${callName.slice(0, 8)}...`,
        } } : state;
    const shortPersonalName = personalName && personalName.length >= 12
        ? `${personalName.slice(0, 8)}...` : null;

    // short_oname() changes the live object while formatting it. Keep its
    // identity so equipment and dressing annotations still find their owner.
    async function formatName({ nameState = state, shortenName = false, stripAttributes = false } = {}): Promise<string> {
        const saved = {
            oextra: object.oextra,
            bknown: object.bknown, buc: object.buc, rknown: object.rknown, greased: object.greased,
            oeroded: object.oeroded, oeroded2: object.oeroded2,
            orotten: object.orotten, odiluted: object.odiluted, norevive: object.norevive,
        };
        if (shortenName && shortPersonalName)
            object.oextra = { ...object.oextra, oname: shortPersonalName };
        if (stripAttributes) {
            object.bknown = object.rknown = object.greased = false;
            object.oeroded = object.oeroded2 = 0;
            object.orotten = object.norevive = object.odiluted = false;
            // objnam.c:xname() re-sets bknown for priests (objnam.c:629-630)
            // while formatting, so short_oname()'s strip step cannot remove
            // the beatitude adjective from a cleric's shortened question.
            observeBucForNaming(object, nameState);
        }
        try {
            const formatted = await format(object, nameState);
            return stripAttributes && formatted.length > limit
                ? shortFormat(object, nameState) : formatted;
        } finally {
            if (shortenName) {
                if (saved.oextra === undefined) delete object.oextra;
                else object.oextra = saved.oextra;
            }
            if (stripAttributes) {
                if (saved.bknown === undefined) delete object.bknown;
                else object.bknown = saved.bknown;
                if (saved.buc === undefined) delete object.buc;
                else object.buc = saved.buc;
                if (saved.rknown === undefined) delete object.rknown;
                else object.rknown = saved.rknown;
                if (saved.greased === undefined) delete object.greased;
                else object.greased = saved.greased;
                if (saved.oeroded === undefined) delete object.oeroded;
                else object.oeroded = saved.oeroded;
                if (saved.oeroded2 === undefined) delete object.oeroded2;
                else object.oeroded2 = saved.oeroded2;
                if (saved.orotten === undefined) delete object.orotten;
                else object.orotten = saved.orotten;
                if (saved.odiluted === undefined) delete object.odiluted;
                else object.odiluted = saved.odiluted;
                if (saved.norevive === undefined) delete object.norevive;
                else object.norevive = saved.norevive;
            }
        }
    }

    if (shortCallState !== state) {
        name = await formatName({ nameState: shortCallState });
        if (name.length <= limit) return question(name);
    }
    if (shortPersonalName) {
        name = await formatName({ shortenName: true });
        if (name.length <= limit) return question(name);
    }
    const shortenBoth = shortCallState !== state && shortPersonalName !== null;
    if (shortenBoth) {
        name = await formatName({ nameState: shortCallState, shortenName: true });
        if (name.length <= limit) return question(name);
    }

    // Native retains shortened names during attribute removal only after
    // the combined attempt. Each separate attempt restores the full names.
    name = await formatName({
        nameState: shortenBoth ? shortCallState : state,
        shortenName: shortenBoth, stripAttributes: true,
    });
    return question(name.length <= limit ? name : fallback ?? name);
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
    if (!object.known || !object.dknown
        || (!object.bknown && object.otyp !== SCROLL_OF_MAIL)
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

// C aobjnam(): cxname with a stack count and an optional conjugated verb.
export function objectAction(object: GameObject, verb: string | null, state: GameState = game): string {
    const name = objectCombatName(object, { state });
    const quantity = object.quan ?? object.quantity ?? 1;
    const subject = quantity === 1 ? name : `${quantity} ${name}`;
    return objectActionText(object, subject, verb, state);
}

// C Tobjnam(): The(xname), without a count or corpse species.
export function definiteObjectAction(object: GameObject, verb: string | null, state: GameState = game): string {
    const name = definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state);
    const subject = name.charAt(0).toUpperCase() + name.slice(1);
    return objectActionText(object, subject, verb, state);
}

function objectActionText(object: GameObject, subject: string, verb: string | null, state: GameState): string {
    if (!verb) return subject;
    return `${subject} ${objectNameIsPlural(object, state) ? verb : verbForSubject(null, verb)}`;
}

export function ownedObjectAction(
    object: GameObject, verb: string | null, state: GameState = game, { capitalized = true } = {},
): string {
    if (object.otyp !== CORPSE) observeObjectForNaming(object, { state });
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
        return objectMaterial(object?.otyp) === 21 ? 'stone' : 'gem';
    default:
        return object?.name || OBJECT_NAMES[object?.otyp] || 'object';
    }
}

function currentDescription(otyp: number): string | null | undefined {
    return game.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp];
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
    const material = objectMaterial(object.otyp);
    const flammable = (material > 1 && material <= 8) || material === 18;
    const rottable = (material > 1 && material <= 8) || material === 10;
    const rustprone = material === 11;
    const corrodeable = material === 11 || material === 13;
    const crackable = material === 19 && object.oclass === ARMOR_CLASS;
    return flammable || rottable || rustprone || corrodeable || crackable;
}

function objectAcceptsPrimaryErosion(object: Pick<GameObject, 'otyp' | 'oclass'>): boolean {
    const material = objectMaterial(object.otyp);
    const flammable = (material > 1 && material <= 8) || material === 18;
    const rustprone = material === 11;
    const crackable = material === 19 && object.oclass === ARMOR_CLASS;
    return flammable || rustprone || crackable;
}

function objectAcceptsSecondaryErosion(object: Pick<GameObject, 'otyp'>): boolean {
    const material = objectMaterial(object.otyp);
    const rottable = (material > 1 && material <= 8) || material === 10;
    const corrodeable = material === 11 || material === 13;
    return rottable || corrodeable;
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
    if (['nothing', 'nil', 'none'].includes(text.trim().toLowerCase()))
        return { noWish: true, parsed };

    let artifact: Artifact | null = null;
    let lookupOtyp: number;
    let object: GameObject;
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
        const lookup = lookupWishType(parsed, { wizardWish });
        if (lookup.kind === 'rejected') return null;
        if (lookup.kind === 'terrain') {
            if (game.program_state.wizkit_wishing) return null;
            await wishForWizardTrap(lookup.trapType);
            return { noWish: true, parsed };
        }
        if (lookup.kind === 'gold') {
            object = await mksobj(GOLD_PIECE, false, false);
            object.quan = object.quantity = wizardWish ? parsed.count : Math.min(5000, parsed.count);
            object.owt = objectWeight(object);
            return { object, parsed, lookupOtyp: GOLD_PIECE, finalOtyp: GOLD_PIECE, isGold: true };
        }
        if (lookup.kind === 'random') {
            object = await mkobj(lookup.oclass, false);
            lookupOtyp = object.otyp;
        } else {
            let matchedType: number | null;
            if (lookup.kind === 'unresolved') {
                parsed.name = lookup.name.toLowerCase();
                if (wizardWish && !game.program_state.wizkit_wishing
                    && await tryWizardTerrainWish(parsed)) return { noWish: true, parsed };
                matchedType = randomUnqualifiedWishType(lookup.name);
                if (matchedType === null) return null;
            } else {
                matchedType = lookup.type;
                artifact = lookup.artifact;
            }
            lookupOtyp = substituteWishedGlob(matchedType, parsed);
            const type = wizardWish ? lookupOtyp : permittedWishType(lookupOtyp);
            if (type === null) return null;
            object = await mksobj(type, true, false);
            if (lookup.kind === 'object' && lookup.fruit) object.spe = lookup.fruit.fid;
        }
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

    const personalName = artifact?.name ?? parsed.personalName;
    if (personalName) {
        const namedArtifact = artifactByName(personalName);
        if (namedArtifact?.baseType === object.otyp) {
            artifact = namedArtifact;
            nameArtifact(object, artifact, { origin: 'wish' });
            object.quan = 1;
            game.u.uconduct ||= {};
            game.u.uconduct.wisharti = (game.u.uconduct.wisharti || 0) + 1;
        } else if (!object.oartifact) {
            const name = object.otyp === SPE_NOVEL
                ? lookupNovelTitle(personalName, object) ?? personalName : personalName;
            object.oextra = { ...object.oextra, oname: name.slice(0, PL_PSIZ - 1) };
        }
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
        const classNoun = objectMaterial(otyp) === 21 ? 'stone' : 'gem';
        return `${description} ${classNoun}`;
    }
    const needsStone = otyp === FLINT
        || (objectMaterial(otyp) === 20
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

// C ref: objnam.c rnd_class().  Object probabilities are absolute weights
// within the requested inclusive type range rather than a uniform index.
export function rndClass(first: number, last: number): number {
    if (first >= last) return first === last ? first : 0;
    let total = 0;
    for (let otyp = first; otyp <= last; otyp++)
        total += objectProb[otyp] ?? 0;
    if (!total) return first + rn2(last - first + 1);
    let roll = rnd(total);
    for (let otyp = first; otyp <= last; otyp++) {
        roll -= objectProb[otyp] ?? 0;
        if (roll <= 0) return otyp;
    }
    return last;
}
// ---------------------------------------------------------------------------
// C objnam.c:readobjnam_preparse() and readobjnam_parse_charges().
// The remaining text is interpreted by object lookup after its modifiers
// have been collected. Wetness draws happen here, before object generation.
// ---------------------------------------------------------------------------

interface ParsedFruitWish {
    readonly name: string;
    readonly count: number | null;
    readonly buc: ObjectBlessing | null;
    readonly partlyEaten: boolean;
}

export interface ParsedWish {
    count: number;
    explicitCount: number | null;
    globSize: number;
    enchantment: number | null;
    buc: ObjectBlessing | null;
    recharged: number | null;
    charges: number | null;
    erodeproof: boolean;
    eroded: number | null;
    eroded2: number | null;
    greased: boolean;
    fruit: ParsedFruitWish;
    name: string;
    // Native origbp retains consumed prefixes while edits to the noun buffer
    // (singularization, suffix removal, and armor retry) remain visible.
    originalName: string;
    lit: boolean;
    wetness: number;
    unlabeled: boolean;
    poisoned: boolean;
    trapped: 'trapped' | 'untrapped' | null;
    lock: 'locked' | 'unlocked' | 'broken' | null;
    partlyEaten: boolean;
    historic: boolean;
    diluted: boolean;
    empty: boolean;
    heavy: boolean;
    fakeAmulet: boolean;
    personalName: string | null;
    callName: string | null;
    calledNoun: string | null;
    description: string | null;
    gender: MonsterNameGender | null;
    monsterSpecies: number | null;
    directType: number | null;
    tinVariety: number | null;
    spinach: boolean;
    zombifying: boolean;
    looted: boolean;
    door: 'open' | 'closed' | 'doorless' | null;
    undiggable: boolean;
    unphaseable: boolean;
}

export function parseWishText(text: string): ParsedWish {
    const original = text.trim().replace(/\s+/g, ' ');
    const parsed: ParsedWish = {
        count: 1, explicitCount: null, globSize: 0, enchantment: null,
        buc: null, recharged: null, charges: null, erodeproof: false,
        eroded: null, eroded2: null, greased: false, fruit: parseFruitWish(original), name: '',
        originalName: original,
        lit: false, wetness: 0, unlabeled: false, poisoned: false,
        trapped: null, lock: null, partlyEaten: false, historic: false,
        diluted: false, empty: false, heavy: false, fakeAmulet: false,
        personalName: null, callName: null, calledNoun: null, description: null,
        gender: null, monsterSpecies: null, directType: null,
        tinVariety: null, spinach: false, zombifying: false,
        looted: false, door: null, undiggable: false, unphaseable: false,
    };
    let remaining = original;
    let intensity = 0;
    for (;;) {
        const match = /^(\S+) +(.*)$/.exec(remaining);
        const word = match?.[1]?.toLowerCase();
        const rest = match?.[2];
        if (word === undefined || rest === undefined) break;
        if (word === 'a' || word === 'an') {
            parsed.count = 1;
            parsed.explicitCount = 1;
        } else if (word === 'the') {
            // The definite article does not set a count in C.
        } else if (/^\d+$/.test(word) && !parsed.explicitCount) {
            parsed.count = Number(word);
            parsed.explicitCount = parsed.count;
        } else if (/^[+-]\d*$/.test(word)) {
            parsed.enchantment = Number(word.slice(1)) * (word.startsWith('-') ? -1 : 1);
        } else if (word === 'blessed' || word === 'holy') parsed.buc = 'blessed';
        else if (word === 'cursed' || word === 'unholy') parsed.buc = 'cursed';
        else if (word === 'uncursed') parsed.buc = 'uncursed';
        else if (['rustproof', 'erodeproof', 'corrodeproof', 'fixed', 'fireproof',
            'rotproof', 'tempered', 'crackproof'].includes(word)) parsed.erodeproof = true;
        else if (word === 'lit' || word === 'burning') parsed.lit = true;
        else if (word === 'unlit' || word === 'extinguished') parsed.lit = false;
        else if (word === 'wet') parsed.wetness = 3 + rn2(3);
        else if (word === 'moist') parsed.wetness = rnd(2);
        else if (['unlabeled', 'unlabelled', 'blank'].includes(word)) parsed.unlabeled = true;
        else if (word === 'poisoned') parsed.poisoned = true;
        else if (word === 'trapped' || word === 'untrapped') parsed.trapped = word;
        else if (word === 'locked' || word === 'unlocked' || word === 'broken') {
            parsed.lock = word;
            parsed.door = word === 'broken' ? null : 'closed';
        } else if (word === 'open' || word === 'closed' || word === 'doorless') {
            parsed.door = word;
            if (word === 'doorless' || parsed.lock !== 'unlocked') parsed.lock = null;
        } else if (word === 'looted' || word === 'disturbed') parsed.looted = true;
        else if (word === 'greased') parsed.greased = true;
        else if (word === 'male') parsed.gender = 0;
        else if (word === 'female') parsed.gender = 1;
        else if (word === 'neuter') parsed.gender = 2;
        else if (word === 'zombifying') parsed.zombifying = true;
        else if (word === 'very') intensity = 1;
        else if (word === 'thoroughly') intensity = 2;
        else if (['rusty', 'rusted', 'burnt', 'burned', 'cracked'].includes(word)) {
            parsed.eroded = intensity + 1;
            intensity = 0;
        } else if (word === 'corroded' || word === 'rotted') {
            parsed.eroded2 = intensity + 1;
            intensity = 0;
        } else if ((word === 'partly' || word === 'partially') && /^eaten /i.test(rest)) {
            parsed.partlyEaten = true;
            remaining = rest.slice(6);
            continue;
        } else if (word === 'historic') parsed.historic = true;
        else if (word === 'diluted') parsed.diluted = true;
        else if (word === 'empty') parsed.empty = true;
        else if (word === 'medium') parsed.globSize = 2;
        else if (word === 'small' || word === 'large') {
            if (!/^glob/i.test(rest) && !/ glob/i.test(rest)) break;
            parsed.globSize = word === 'small' ? 1 : intensity === 1 ? 4 : 3;
        } else if (word === 'fake') parsed.fakeAmulet = true;
        else if (word !== 'real') break;
        remaining = rest;
    }
    if (!parsed.count) parsed.count = 1;
    parsed.heavy = intensity > 0;
    const prefixes = original.slice(0, original.length - remaining.length);
    remaining = parseWishCharges(remaining, parsed);
    const named = remaining.search(/ named /i);
    if (named >= 0) {
        parsed.personalName = remaining.slice(named + 7);
        remaining = remaining.slice(0, named);
    }
    const called = remaining.search(/ called /i);
    if (called >= 0) {
        parsed.callName = remaining.slice(called + 8);
        remaining = remaining.slice(0, called);
        parsed.calledNoun = remaining;
    }
    const label = / label(?:l)?ed /i.exec(remaining);
    if (label) {
        parsed.description = remaining.slice(label.index + label[0].length);
        remaining = remaining.slice(0, label.index);
    }
    const spinach = remaining.search(/ of spinach/i);
    if (spinach >= 0) {
        parsed.spinach = true;
        parsed.empty = false;
        remaining = remaining.slice(0, spinach);
    }
    parsed.name = remaining;
    parsed.originalName = prefixes + remaining;
    return parsed;
}

// Called ranges and the Amulet rule skip this part of postparse1. The lookup
// owner decides when to advance here rather than parsing every noun eagerly.
export function parseWishNoun(parsed: ParsedWish): 'lookup' | 'direct' | 'glob' {
    let remaining = parsed.name;
    if (/^pair of /i.test(remaining)) {
        parsed.count *= 2;
        remaining = remaining.slice(8);
    } else if (/^pairs of /i.test(remaining)) {
        if (parsed.count > 1) parsed.count *= 2;
        remaining = remaining.slice(9);
    } else remaining = remaining.replace(/^sets? of /i, '');
    const glob = remaining.match(/^globs?(?: of (.+))?$/i)
        || remaining.match(/^(.+) globs?$/i);
    if (glob) {
        const species = nameToMonster(glob[1] ?? '');
        if (species < 0) {
            const type = GLOB_OF_GRAY_OOZE + rn2(GLOB_OF_BLACK_PUDDING - GLOB_OF_GRAY_OOZE);
            const name = OBJECT_NAMES[type];
            if (!name) throw new RangeError(`Missing glob name for object type ${type}`);
            parsed.name = name;
        } else parsed.name = `glob of ${MONSTER_NAME[species]}`;
        if (/\bglobs\b/i.test(glob[0]) && parsed.count < 2) parsed.count = 2;
        return 'glob';
    }
    remaining = parseWishSpecies(remaining, parsed);
    if (parsed.directType === TIN) {
        parsed.name = remaining;
        return 'direct';
    }
    const singular = ['tricks', 'clothes'].includes(remaining.toLowerCase())
        ? remaining : makeSingular(remaining);
    if (singular !== remaining && parsed.count === 1) parsed.count = 2;
    rewriteOriginalNoun(parsed, remaining, singular);
    parsed.name = singular;
    // C wall properties use the remaining name and match case sensitively.
    parsed.undiggable = remaining.includes('undiggable ') || remaining.includes('nondiggable ');
    parsed.unphaseable = remaining.includes('unphaseable ') || remaining.includes('nonpasswall ');
    return 'lookup';
}

// Fruit names can contain ordinary object modifiers. C reparses only food
// prefixes and restores these values after a case-sensitive fruit match.
function parseFruitWish(text: string): ParsedFruitWish {
    let name = text;
    let count = 0;
    let blessed = false;
    let cursed = false;
    let uncursed = false;
    let partlyEaten = false;
    for (;;) {
        const lower = name.toLowerCase();
        const number = /^\d+/.exec(name);
        let prefixLength: number;
        if (lower.startsWith('a ') || lower.startsWith('an ')) {
            count = 1;
            prefixLength = lower.startsWith('an ') ? 3 : 2;
        } else if (!count && number) {
            count = Number(number[0]);
            name = name.slice(number[0].length).trimStart();
            continue;
        } else if (lower.startsWith('blessed ')) {
            blessed = true;
            prefixLength = 8;
        } else if (lower.startsWith('cursed ')) {
            cursed = true;
            prefixLength = 7;
        } else if (lower.startsWith('uncursed ')) {
            uncursed = true;
            prefixLength = 9;
        } else if (lower.startsWith('partly eaten ') || lower.startsWith('partially eaten ')) {
            partlyEaten = true;
            prefixLength = lower.startsWith('partly eaten ') ? 13 : 16;
        } else break;
        name = name.slice(prefixLength);
    }
    return { name, count: count || null, partlyEaten,
        buc: cursed ? 'cursed' : uncursed ? 'uncursed' : blessed ? 'blessed' : null };
}

function parseWishSpecies(text: string, parsed: ParsedWish): string {
    const depicted = /^(corpse|statue|figurine) of (?:an? |the )?(male|female|neuter) (.+)$/i.exec(text);
    if (depicted) {
        parsed.gender = depicted[2]?.toLowerCase() === 'male' ? 0
            : depicted[2]?.toLowerCase() === 'female' ? 1 : 2;
        const noun = `${depicted[1]} of ${depicted[3]}`;
        rewriteOriginalNoun(parsed, text, noun);
        text = noun;
    }
    // Globs have their own canonicalization and are never corpse species.
    if (/\bglobs?\b/i.test(text)) return text;
    if (!/(?:wand |spellbook |gauntlets |gloves |finger )/i.test(text)) {
        const tin = /tin of (.+)/i.exec(text);
        if (tin?.[1]) {
            const preparation = parseTinPreparation(tin[1]);
            parsed.tinVariety = preparation.variety;
            const match = resolveMonsterNamePrefix(preparation.remaining);
            if (match) recordWishSpecies(parsed, match);
            parsed.directType = TIN;
            return 'tin';
        }
        const of = / of (.+)/i.exec(text);
        if (of?.[1]) {
            const match = resolveMonsterNamePrefix(of[1]);
            if (match) {
                recordWishSpecies(parsed, match);
                const noun = text.slice(0, of.index);
                rewriteOriginalNoun(parsed, text, noun);
                text = noun;
            }
        }
    }
    if (parsed.monsterSpecies === null
        && !/^(?:samurai sword|wizard lock|death wand|master key|ninja-to|magenta)/i.test(text)) {
        const match = resolveMonsterNamePrefix(text);
        if (match?.remainder) {
            recordWishSpecies(parsed, match);
            text = match.remainder.replace(/^(?:es |s |'s |' | )/i, '');
        }
    }
    const species = parsed.monsterSpecies;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    const lastDragon = MONSTER_NAME.indexOf('yellow dragon');
    if (text.toLowerCase() === 'scales' && species !== null && species >= firstDragon && species <= lastDragon) {
        const type = GRAY_DRAGON_SCALES + species - firstDragon;
        if (type <= YELLOW_DRAGON_SCALES) {
            parsed.directType = type;
            parsed.monsterSpecies = null;
        }
    }
    return text;
}

function rewriteOriginalNoun(parsed: ParsedWish, before: string, after: string): void {
    if (before === after) return;
    parsed.originalName = parsed.originalName.slice(0, -before.length) + after;
}

function recordWishSpecies(parsed: ParsedWish, match: MonsterNamePrefix): void {
    parsed.monsterSpecies = match.mnum;
    // C aliases always replace the hint; canonical neutral names preserve it.
    if (match.overridesGender || parsed.gender === null || match.gender !== 2)
        parsed.gender = match.gender;
}

function parseWishCharges(text: string, parsed: ParsedWish): string {
    const index = text.lastIndexOf('(');
    if (text.length <= 1 || index < 0) return text;
    const before = text.slice(0, index).trimEnd();
    const suffix = text.slice(index + 1);
    if (/^lit\)/i.test(suffix)) {
        parsed.lit = true;
        return before + suffix.slice(4);
    }
    const match = /^(?:(\d*):)?(\d*)\)(.*)$/.exec(suffix);
    if (!match) {
        parsed.recharged = 0;
        if (parsed.enchantment !== null)
            parsed.charges = parsed.enchantment < 0 || Object.is(parsed.enchantment, -0) ? -0 : 0;
        return before;
    }
    parsed.recharged = Math.min(7, Number(match[1] ?? 0));
    parsed.charges = Math.min(SPE_LIM, Number(match[2] ?? 0));
    return before + (match[3] ?? '');
}

// ---------------------------------------------------------------------------
// C objnam.c:readobjnam_postparse1-3(), wishymatch(), and the two
// object-type lotteries. Lookup preserves the class before falling back to
// random generation; a class-qualified failed description is still a wish.
// ---------------------------------------------------------------------------

const VENOM_CLASS = 17;

const wrappers: readonly (readonly [string, number])[] = [
    ['wand', 11], ['ring', 4], ['potion', 8], ['scroll', 9], ['gem', GEM_CLASS],
    ['amulet', AMULET_CLASS], ['spellbook', 10], ['spell book', 10],
    ['weapon', WEAPON_CLASS], ['armor', ARMOR_CLASS], ['tool', TOOL_CLASS],
    ['food', FOOD_CLASS], ['comestible', FOOD_CLASS],
];

const ranges: readonly (readonly [string, number, number, number])[] = [
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

const alternateSpellings: readonly (readonly [string, number])[] = [
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

export type WishLookup =
    | { readonly kind: 'object'; readonly type: number;
        readonly fruit: Fruit | null; readonly artifact: Artifact | null }
    | { readonly kind: 'random'; readonly oclass: number }
    | { readonly kind: 'gold' }
    | { readonly kind: 'rejected' }
    | { readonly kind: 'terrain'; readonly trapType: number }
    | { readonly kind: 'unresolved'; readonly name: string };

interface WishSearch {
    name: string;
    originalName: string;
    oclass: number;
    actual: string | null;
    description: string | null;
    descriptionUsesNoun: boolean;
}

// Follow readobjnam's jumps: an early type or rejection ends lookup; class
// parsing goes directly to name search; only unclassified nouns try ranges.
export function lookupWishType(parsed: ParsedWish, {
    wizardWish = false, state = game,
}: { wizardWish?: boolean; state?: GameState } = {}): WishLookup {
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
    if (noun === 'direct' && parsed.directType !== null) return foundWishType(parsed.directType);
    const search: WishSearch = {
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
    if (alias) return foundWishType(alias[1]);
    rewriteSearchNoun(search, search.name.replace(/^grey spell/i, 'gray spell').replace(/armour/i, 'armor'));
    if (parsed.directType !== null) return foundWishType(parsed.directType);
    if (/holy water$/i.test(search.name)) {
        parsed.buc = /unholy water$/i.test(search.name) ? 'cursed' : 'blessed';
        return foundWishType(objects.POT_WATER);
    }
    if (/^paperback(?:$| book)/i.test(search.name)) return foundWishType(objects.SPE_NOVEL);
    if (/^paperback/i.test(search.name)) return { kind: 'rejected' };
    if (parsed.unlabeled && /scroll$/i.test(search.name)) return foundWishType(objects.SCR_BLANK_PAPER);
    if (parsed.unlabeled && /spellbook$/i.test(search.name)) return foundWishType(objects.SPE_BLANK_PAPER);
    if (/orange$/i.test(search.name) && parsed.monsterSpecies === null) return foundWishType(objects.ORANGE);
    if (/gold piece$|zorkmid$|^(?:gold|money|coin)$|^\$/i.test(search.name)) return { kind: 'gold' };

    const classSymbol = search.name.length === 1 ? OBJECT_CLASS_SYMBOLS.indexOf(search.name) : -1;
    if (classSymbol > 1 && (classSymbol !== VENOM_CLASS || wizardWish))
        return { kind: 'random', oclass: classSymbol };

    const classResult = parseWishClass(search, state);
    if (classResult) return classResult;
    if (search.oclass) return searchWishNames(parsed, search, state);

    if (wizardWish) {
        parsed.name = search.name.toLowerCase();
        const trapType = wizardTrapRequest(parsed);
        if (parsed.directType !== null) return foundWishType(parsed.directType);
        if (trapType !== null) return { kind: 'terrain', trapType };
    }
    const rangeResult = parseWishRange(parsed, search);
    return rangeResult ?? searchWishNames(parsed, search, state);
}

function parseWishClass(search: WishSearch, state: GameState): WishLookup | null {
    const wrapperException = /^(?:enchant |destroy |detect food|food detection|ring mail|studded leather armor|leather armor|tooled horn|food ration|meat ring)/i;
    if (wrapperException.test(search.name)) return null;
    for (const [wrapper, cls] of wrappers) {
        if (search.name.toLowerCase().startsWith(wrapper)) {
            search.oclass = cls;
            if (cls === AMULET_CLASS) search.actual = search.name;
            else {
                // Advancing bp leaves the class prefix in origbp.
                search.name = search.name.slice(wrapper.length);
                if (/^ of /i.test(search.name)) search.actual = search.name.slice(4);
            }
            return null;
        }
        if (search.name.toLowerCase().endsWith(wrapper)) {
            search.oclass = cls;
            if (cls === AMULET_CLASS) {
                if (/^versus poison /i.test(search.name)) return foundWishType(objectType('amulet versus poison'));
                const shape = search.name.slice(0, -wrapper.length).trimEnd();
                const shapeType = randomTypeByDescription(shape, cls, 0, state);
                if (shapeType !== null) return foundWishType(shapeType);
            } else {
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
function parseWishRange(parsed: ParsedWish, search: WishSearch): WishLookup | null {
    const range = ranges.find(([range]) => range === search.name.toLowerCase());
    if (range) return foundWishType(rndClass(range[2], range[3]));
    if (/ (?:stone|gem)$/i.test(search.name)) {
        rewriteSearchNoun(search, search.name.replace(/ (?:stone|gem)$/i, ''));
        search.oclass = GEM_CLASS;
        search.actual = search.description = search.name;
        search.descriptionUsesNoun = true;
        return null;
    }
    if (search.name.toLowerCase() !== 'looking glass' && /(?:^| )glass$/i.test(search.name)) {
        if (parsed.lock === 'broken' || /broken/i.test(search.name)) return { kind: 'rejected' };
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

function searchWishNames(parsed: ParsedWish, search: WishSearch, state: GameState): WishLookup {
    for (;;) {
        if (!search.oclass && search.actual) {
            for (let type = objects.DILITHIUM_CRYSTAL; type <= objects.JADE; type++)
                if (search.actual.toLowerCase() === objects.OBJECT_NAMES[type]?.toLowerCase())
                    return foundWishType(type);
            if (search.actual.toLowerCase() === 'tin') return foundWishType(objects.TIN);
        }
        const candidates = [search.actual,
            search.description !== search.actual ? search.description : null, parsed.callName,
            search.originalName !== search.actual ? search.originalName : null];
        for (const candidate of candidates) {
            const type = randomTypeByDescription(candidate, search.oclass, 1, state);
            if (type !== null) return foundWishType(type);
        }
        const japaneseType = japaneseWishType(search.actual);
        if (japaneseType !== null) return foundWishType(japaneseType);
        if (search.oclass === ARMOR_CLASS && !/mail/i.test(search.name)) {
            rewriteSearchNoun(search, `${search.name} mail`);
            if (search.descriptionUsesNoun) search.description = search.name;
            const retryResult = parseWishRange(parsed, search);
            if (retryResult) return retryResult;
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
        // Native replaces d.name even when the artifact lookup fails.
        // Skill-category wishes reach this search before choosing a weapon.
        parsed.personalName = artifact?.name ?? null;
        if (artifact) return { kind: 'object', type: artifact.baseType, fruit: null, artifact };
    }
    if (search.oclass) {
        const alias = alternateSpellings.find(([alias, type]) =>
            objectClassForType(type) === search.oclass && wishMatches(search.name, alias, true));
        return alias ? foundWishType(alias[1]) : { kind: 'random', oclass: search.oclass };
    }
    return { kind: 'unresolved', name: search.name };
}

function foundWishType(type: number): WishLookup {
    return { kind: 'object', type, fruit: null, artifact: null };
}

function rewriteSearchNoun(search: WishSearch, name: string): void {
    if (name === search.name) return;
    search.originalName = search.originalName.slice(0, search.originalName.length - search.name.length) + name;
    search.name = name;
}

// Native tries these only after wizard terrain lookup fails.
export function randomUnqualifiedWishType(name: string): number | null {
    if (/^polearm/i.test(name)) return randomWeaponBySkill(P_POLEARMS);
    if (/^hammer/i.test(name)) return randomWeaponBySkill(P_HAMMER);
    return null;
}

// C objnam.c:rnd_otyp_by_namedesc().
export function randomTypeByDescription(name: string | null, oclass = 0, extraProbability = 1,
    state: GameState = game): number | null {
    if (!name) return null;
    const checkOf = !/ of /i.test(name);
    const matches: { type: number; probability: number }[] = [];
    for (let type = objects.ARROW; type < objects.OBJECT_NAMES.length; type++) {
        // options.c:initoptions_finish() renames the slime mold object to
        // "fruit" once the preferred fruit is registered, so its original
        // name never matches a wish (rnd_otyp_by_namedesc sees "fruit").
        const actual = type === objects.SLIME_MOLD ? 'fruit' : objects.OBJECT_NAMES[type];
        if (!actual || oclass && objectClassForType(type) !== oclass) continue;
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
    if (!total) return null;
    let roll = rn2(total);
    for (const match of matches) {
        roll -= match.probability;
        if (roll < 0) return match.type;
    }
    return matches.at(-1)?.type ?? null;
}

function randomWeaponBySkill(skill: number): number | null {
    const matches = objects.OBJECT_NAMES.flatMap((name, type) => name
        && objectClassForType(type) === WEAPON_CLASS && objects.OBJECT_SUBTYPE[type] === skill ? [type] : []);
    return matches.length ? matches[rn2(matches.length)] ?? null : null;
}

function fuzzyEqual(first: string, second: string): boolean {
    return first.replace(/[ -]/g, '').toLowerCase() === second.replace(/[ -]/g, '').toLowerCase();
}

function invertedName(name: string): string | null {
    const index = name.toLowerCase().indexOf(' of ');
    return index < 0 ? null : `${name.slice(index + 4)} ${name.slice(0, index)}`;
}

// C objnam.c:wishymatch().
function wishMatches(request: string, canonical: string, invert: boolean): boolean {
    if (fuzzyEqual(request, canonical)) return true;
    if (invert) {
        const requestedOf = invertedName(request), canonicalOf = invertedName(canonical);
        if (requestedOf && !canonicalOf && fuzzyEqual(requestedOf, canonical)
            || canonicalOf && !requestedOf && fuzzyEqual(request, canonicalOf)) return true;
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

function objectType(name: string): number {
    const type = objects.OBJECT_NAMES.indexOf(name);
    if (type < 0) throw new RangeError(`Missing wish object type: ${name}`);
    return type;
}

// ---------------------------------------------------------------------------
// C objnam.c:readobjnam(), physical modifiers after object generation.
// ---------------------------------------------------------------------------

export function lightWishedObject(object: GameObject, parsed: ParsedWish): void {
    if (!parsed.lit || ![OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN,
        TALLOW_CANDLE, WAX_CANDLE, POT_OIL].includes(object.otyp)) return;
    placeCreatedObject(object, game.u.ux, game.u.uy);
    beginObjectBurn(object);
    unlinkObject(object);
}

export async function applyWishProperties(object: GameObject, parsed: ParsedWish,
    wizardWish: boolean, luck: number): Promise<void> {
    if (object.otyp === TOWEL && parsed.wetness) object.spe = parsed.wetness;
    if (parsed.poisoned) {
        if (isPoisonableObject(object)) object.opoisoned = luck >= 0;
        else if (object.oclass === 7) object.age = 1;
    }
    if (parsed.trapped && (wizardWish || parsed.trapped === 'untrapped')
        && (object.otyp === CHEST || object.otyp === LARGE_BOX || object.otyp === TIN))
        object.otrapped = parsed.trapped === 'trapped';
    if (parsed.empty) {
        if (object.otyp === BAG_OF_TRICKS || object.otyp === HORN_OF_PLENTY) {
            if (object.spe > 0) object.spe = 0;
        } else if (object.contents?.length) await deleteObjectContents(object);
    }
    if (object.otyp === CHEST || object.otyp === LARGE_BOX) {
        if (parsed.lock) {
            object.olocked = parsed.lock === 'locked';
            object.obroken = parsed.lock === 'broken';
        }
        if (object.obroken) object.otrapped = false;
    }
    if (parsed.greased) object.greased = true;
    if (parsed.diluted && object.oclass === 8) object.odiluted = object.otyp !== POT_WATER;
}

export async function finishWishWeight(object: GameObject, parsed: ParsedWish): Promise<void> {
    if (parsed.partlyEaten && object.oclass === 7) {
        const nutrition = foodNutrition(object);
        if (nutrition > 1) {
            object.oeaten = nutrition;
            await consumeRemainingFood(object, 1);
        }
    }
    object.owt = objectWeight(object);
    if (parsed.heavy && object.otyp === HEAVY_IRON_BALL) object.owt += WT_IRON_BALL_INCR;
}

// ---------------------------------------------------------------------------
// C objnam.c:readobjnam(), depicted gender, species admission, and food
// contents. Species changes use the normal corpse and egg timer owner.
// ---------------------------------------------------------------------------

const M2_WERE = 0x00000004;
const M2_HUMAN = 0x00000008;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const G_UNIQ = 0x1000;
const PM_GRAY_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const PM_YELLOW_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
const SCALE_MAIL = OBJECT_NAMES.indexOf('scale mail');

export function substituteWishedGlob(type: number, parsed: ParsedWish): number {
    const species = parsed.monsterSpecies;
    if (type !== CORPSE || species === null || monsterClassSymbol(species) !== 'P') return type;
    parsed.monsterSpecies = null;
    return GLOB_OF_GRAY_OOZE + species - MONSTER_NAME.indexOf('gray ooze');
}

export async function applyWishSpecies(object: GameObject, parsed: ParsedWish,
    wizardWish: boolean): Promise<void> {
    const requestedSpecies = parsed.monsterSpecies;
    if ([STATUE, FIGURINE, CORPSE].includes(object.otyp)) {
        object.spe = wishedGender(requestedSpecies, parsed);
        if (parsed.historic && object.otyp === STATUE) object.spe |= CORPSTAT_HISTORIC;
    }
    if (object.otyp === TIN && (parsed.empty || parsed.spinach)) {
        object.corpsenm = -1;
        object.spe = parsed.spinach ? 1 : 0;
    }
    if (requestedSpecies === null) return;
    let species = requestedSpecies === MONSTER_NAME.indexOf('long worm tail')
        ? MONSTER_NAME.indexOf('long worm') : requestedSpecies;
    let flags = MONSTER_FLAGS2[species] ?? 0;
    const noCorpse = (MONSTER_GENO[species] ?? 0) & G_NOCORPSE
        || (game.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE;
    if (object.otyp !== FIGURINE && flags & M2_WERE && noCorpse) {
        species = counterWereSpecies(species) ?? species;
        flags = MONSTER_FLAGS2[species] ?? 0;
    }
    const unique = !!((MONSTER_GENO[species] ?? 0) & G_UNIQ);
    const leavesCorpse = !((MONSTER_GENO[species] ?? 0) & G_NOCORPSE)
        && !((game.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE);
    switch (object.otyp) {
    case TIN:
        if ((game.mvitals?.[species]?.mvflags ?? 0) & G_GENOD) object.corpsenm = -1;
        else if ((!unique || wizardWish) && leavesCorpse && (MONSTER_BODY_META[species]?.[1] ?? 0))
            object.corpsenm = species;
        break;
    case CORPSE:
        if ((!unique || wizardWish) && leavesCorpse) {
            if (MONSTER_SOUND[species] === 38) species = guardianGenus(species);
            set_corpsenm(object, species);
        }
        // C tests zombie_form() as a boolean; NON_PM is -1, so a corpse
        // without a zombie form also gets this timer and rots when it fires.
        if (parsed.zombifying)
            scheduleObjectTimer(object, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves + 10 + rn2(5));
        break;
    case EGG:
        set_corpsenm(object, hatchableEggSpecies(species));
        break;
    case FIGURINE:
        if (!unique && (!(flags & M2_HUMAN) || flags & M2_WERE)
            && species !== MONSTER_NAME.indexOf('mail daemon')) object.corpsenm = species;
        break;
    case STATUE:
        object.corpsenm = species;
        if (object.contents?.length && monsterIsVerySmall(species)) await deleteObjectContents(object);
        break;
    case SCALE_MAIL:
        if (species >= PM_GRAY_DRAGON && species <= PM_YELLOW_DRAGON)
            object.otyp = GRAY_DRAGON_SCALE_MAIL + species - PM_GRAY_DRAGON;
        break;
    }
}

export function applyWishedTinVariety(object: GameObject, parsed: ParsedWish, wizardWish: boolean): void {
    if (object.otyp === TIN && parsed.tinVariety !== null && (rn2(4) || wizardWish))
        setTinVariety(object, parsed.tinVariety);
}

function wishedGender(species: number | null, parsed: ParsedWish): number {
    if (species === null) return CORPSTAT_RANDOM;
    const flags = MONSTER_FLAGS2[species] ?? 0;
    if (flags & M2_NEUTER) return CORPSTAT_NEUTER;
    if (parsed.gender === 1 && !(flags & M2_MALE)) return CORPSTAT_FEMALE;
    if (parsed.gender === 0 && !(flags & M2_FEMALE)) return CORPSTAT_MALE;
    if (flags & M2_MALE) return CORPSTAT_MALE;
    if (flags & M2_FEMALE) return CORPSTAT_FEMALE;
    return rn2(2) ? CORPSTAT_MALE : CORPSTAT_FEMALE;
}

function guardianGenus(species: number): number {
    const guardians: ReadonlyMap<string, string> = new Map([
        ['student', 'archeologist'], ['chieftain', 'barbarian'], ['neanderthal', 'cave dweller'],
        ['attendant', 'healer'], ['page', 'knight'], ['abbot', 'monk'], ['acolyte', 'cleric'],
        ['hunter', 'ranger'], ['thug', 'rogue'], ['roshi', 'samurai'], ['guide', 'tourist'],
        ['apprentice', 'wizard'], ['warrior', 'valkyrie'],
    ]);
    const genus = guardians.get(MONSTER_NAME[species] ?? '');
    return genus ? MONSTER_NAME.indexOf(genus) : species;
}

// ---------------------------------------------------------------------------
// C objnam.c:wizterrainwish(). Terrain wishes use the ordinary map, trap,
// light, and liquid-effect owners, then refresh the hero's changed square.
// ---------------------------------------------------------------------------

// Bear traps and mines are objects unless explicitly armed or followed by
// a suffix other than " object". "Untrapped" always asks for the object.
export function wizardTrapRequest(parsed: ParsedWish): number | null {
    const match = /^(bear ?trap|land ?mine)(.*)$/i.exec(parsed.name);
    if (!match) return null;
    const bear = match[1]?.startsWith('bear');
    const suffix = match[2] ?? '';
    if (parsed.trapped === 'untrapped' || suffix === ' object') {
        parsed.directType = bear ? BEARTRAP : LAND_MINE;
        return null;
    }
    if (parsed.trapped !== 'trapped' && !suffix) return null;
    const type = bear ? BEAR_TRAP : LANDMINE;
    parsed.name = trapName(type, { ignoreHallucination: true });
    return type;
}

export async function wishForWizardTrap(type: number): Promise<void> {
    const { ux: x, uy: y } = game.u;
    if (is_hole(type) && !canFallThrough()) type = ROCKTRAP;
    const trap = await maketrap(x, y, type);
    const name = trapName(trap?.ttyp ?? type, { ignoreHallucination: true });
    await say(trap ? `${withIndefiniteArticle(name)}${trap.ttyp === MAGIC_PORTAL ? ' to nowhere' : ''}.`
        : `Creation of ${withIndefiniteArticle(name)} failed.`);
}

export async function tryWizardTerrainWish(parsed: ParsedWish): Promise<boolean> {
    const name = parsed.name;
    for (let type = 1; type < TRAPNUM; type++) {
        if (name.startsWith(trapName(type, { ignoreHallucination: true }))) {
            await wishForWizardTrap(type);
            return true;
        }
    }
    const level = requireGameLevel();
    const { ux: x, uy: y } = game.u;
    const location = level.requireAt(x, y);
    const previousType = location.typ;
    const bridge = IS_DRAWBRIDGE(previousType);
    let changed = true;
    if (name.endsWith('fountain')) {
        location.typ = FOUNTAIN;
        if (previousType !== FOUNTAIN) level.flags.nfountains++;
        setLooted(location, parsed.looted ? F_LOOTED : 0);
        location.blessedftn = parsed.buc === 'blessed' || name.startsWith('magic ');
        location.horizontal = !!location.blessedftn;
        await say(`A ${location.blessedftn ? 'magic ' : ''}fountain.`);
    } else if (name.endsWith('throne')) {
        location.typ = THRONE;
        setLooted(location, parsed.looted ? T_LOOTED : 0);
        await say('A throne.');
    } else if (name.endsWith('sink')) {
        location.typ = SINK;
        if (previousType !== SINK) level.flags.nsinks++;
        setLooted(location, parsed.looted ? S_LPUDDING | S_LDWASHER | S_LRING : 0);
        await say('A sink.');
    } else if (name.endsWith('pool') || name.endsWith('moat') || name.endsWith('wall of water')) {
        if (bridge) setBridgeSurface(location, DB_MOAT);
        else {
            location.typ = name.endsWith('pool') ? POOL : name.endsWith('moat') ? MOAT : WATER;
            clearMapFlags(location);
        }
        deleteEngravingAt(x, y);
        if (bridge) await bridgeMessage('Moat', previousType);
        else {
            const nameState = { ...game, u: { ...game.u, hallucinationResistance: true } };
            await say(`${withIndefiniteArticle(waterbodyName(x, y, nameState))}.`);
        }
        for (const object of [...(level.objects[x]?.[y] ?? [])])
            await waterDamageObject(object, [], game, { force: false, publish: plineWithContinuation });
    } else if (name.endsWith('lava')) {
        if (bridge) setBridgeSurface(location, DB_LAVA);
        else {
            location.typ = name.endsWith('wall of lava') ? LAVAWALL : LAVAPOOL;
            clearMapFlags(location);
        }
        deleteEngravingAt(x, y);
        if (bridge) await bridgeMessage('Lava', previousType);
        else {
            await say(`A ${location.typ === LAVAPOOL ? 'pool' : 'wall'} of molten lava.`);
            if (location.typ === LAVAWALL || !propertyIsActive('levitation') && !propertyIsActive('flying'))
                await applyHeroLiquidEffects();
        }
        await fireDamageChain(level.objects[x]?.[y], { force: true, publish: plineWithContinuation, x, y });
    } else if (name.endsWith('ice')) {
        if (bridge) setBridgeSurface(location, DB_ICE);
        else {
            location.typ = ICE;
            setMapFlags(location, previousType === ROOM ? ICED_POOL : ICED_MOAT);
        }
        deleteEngravingAt(x, y);
        if (name.startsWith('melting ')) startMeltIceTimer(x, y);
        if (bridge) await bridgeMessage('Ice', previousType);
        else await say(`${iceDescriptionAt(x, y)}.`);
    } else if (name.endsWith('altar')) {
        const alignment = name.startsWith('chaotic ') ? A_CHAOTIC
            : name.startsWith('neutral ') ? A_NEUTRAL
                : name.startsWith('lawful ') ? A_LAWFUL
                    : name.startsWith('unaligned ') ? A_NONE
                        : !rn2(6) ? A_NONE : rn2(3) - 1;
        location.typ = ALTAR;
        setMapFlags(location, Align2amask(alignment));
        const word = alignment === A_CHAOTIC ? 'chaotic' : alignment === A_NEUTRAL ? 'neutral'
            : alignment === A_LAWFUL ? 'lawful' : 'unaligned';
        await say(`${withIndefiniteArticle(word)} altar.`);
    } else if (name.endsWith('grave') || name.endsWith('headstone')) {
        make_grave(x, y, null);
        if (location.typ !== GRAVE) {
            await say("Can't place a grave here.");
            return true;
        }
        setLooted(location, 0);
        location.disturbed = location.horizontal = parsed.looted;
        await say(`A ${parsed.looted ? 'disturbed ' : ''}grave.`);
    } else if (name.endsWith('tree')) {
        location.typ = TREE;
        clearMapFlags(location);
        setLooted(location, parsed.looted ? TREE_LOOTED | TREE_SWARM : 0);
        setWallProperties(location, parsed);
        await say('A tree.');
    } else if (name.endsWith('bars')) {
        location.typ = IRONBARS;
        clearMapFlags(location);
        setWallProperties(location, parsed);
        await say('Iron bars.');
    } else if (name.endsWith('cloud')) {
        location.typ = CLOUD;
        clearMapFlags(location);
        deleteEngravingAt(x, y);
        await say('A cloud.');
    } else if (name.endsWith('door') || parsed.door === 'doorless' && name.endsWith('doorway')) {
        const secret = name.endsWith('secret door');
        if (previousType !== DOOR && previousType !== SDOOR
            && (!IS_WALL(previousType) || previousType === DBWALL) && previousType !== IRONBARS) {
            await say(`${secret ? 'Secret door' : 'Door'} requires door or wall location.`);
            return true;
        }
        makeWishedDoor(location, parsed, secret, previousType);
        await say(`${withIndefiniteArticle(describeWishedDoor(location, secret))}.`);
    } else if (/(?:^| )wall$/.test(name)) {
        location.typ = [level.at(x, y - 1), level.at(x, y + 1)]
            .some(neighbor => neighbor && IS_WALL(neighbor.typ)) ? VWALL : HWALL;
        clearMapFlags(location);
        setWallProperties(location, parsed);
        fix_wall_spines(Math.max(0, x - 1), Math.max(0, y - 1), Math.min(COLNO - 1, x + 1), Math.min(ROWNO - 1, y + 1));
        await say('A wall.');
    } else if (name.endsWith('secret corridor')) {
        if (previousType !== CORR) {
            await say('Secret corridor requires corridor location.');
            return true;
        }
        location.typ = SCORR;
        await say('Secret corridor.');
    } else if (name.endsWith('room') || name.endsWith('floor') || name.endsWith('ground')) {
        if (previousType === ROOM || IS_FURNITURE(previousType) && canOverwriteTerrain(previousType)
            || previousType === ICE || isPoolAt(x, y) || isLavaAt(x, y)) {
            location.typ = ROOM;
            await say('Room floor.');
            if (IS_FURNITURE(previousType)) countLevelFeatures();
            const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
            if (trap && trap.ttyp !== MAGIC_PORTAL) deleteTrap(trap);
        } else if (bridge) {
            setBridgeSurface(location, DB_FLOOR);
            await bridgeMessage('Floor', previousType);
        } else {
            await say('Room|floor|ground not allowed here.');
            return true;
        }
    } else changed = false;
    if (!changed) return false;
    await feel_newsym(x, y);
    if (game.u.uinwater && !isPoolAt(game.u.ux, game.u.uy)) {
        game.u.uinwater = false;
        game.underwater = game.u.underwater = false;
        await switchHeroTerrain();
        await docrt();
    } else {
        if (game.u.utrap && game.u.utraptype === TT_LAVA && !isLavaAt(game.u.ux, game.u.uy))
            await resetHeroTrap(false);
        vision_note_blocker_change(x, y);
    }
    if (previousType === FOUNTAIN || previousType === SINK) countLevelFeatures();
    if (!isIceAt(x, y)) stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    if ((previousType === FOUNTAIN || previousType === GRAVE || IS_WALL(previousType)
        || previousType === IRONBARS || previousType === DOOR || previousType === SDOOR)
        && ![FOUNTAIN, GRAVE, DOOR, SDOOR].includes(location.typ)) location.horizontal = false;
    await switchHeroTerrain();
    return true;
}

function makeWishedDoor(location: MapLocation, parsed: ParsedWish, secret: boolean, previousType: number): void {
    const wallInfo = previousType === DOOR ? 0 : location.wall_info;
    location.typ = secret ? SDOOR : DOOR;
    clearMapFlags(location);
    const rogue = Is_rogue_level(game.u.uz);
    location.doormask = !rogue && parsed.lock === 'locked' ? D_LOCKED
        : rogue || parsed.door === 'doorless' || secret ? D_NODOOR
            : parsed.door === 'open' ? D_ISOPEN : parsed.lock === 'broken' ? D_BROKEN : D_CLOSED;
    if (parsed.trapped === 'trapped' && (secret || location.doormask & (D_LOCKED | D_CLOSED)))
        location.doormask |= D_TRAPPED;
    location.wall_info = secret ? wallInfo & WM_MASK : 0;
    setMapFlags(location, location.doormask | location.wall_info);
}

function describeWishedDoor(location: MapLocation, secret: boolean): string {
    const mask = location.doormask;
    const prefix = `${mask & D_TRAPPED ? 'trapped ' : ''}${mask & D_LOCKED ? 'locked ' : ''}`;
    if (secret) return `${prefix}secret door`;
    const state = mask & D_CLOSED ? 'closed ' : mask & D_ISOPEN ? 'open ' : mask & D_BROKEN ? 'broken ' : '';
    return `${prefix}${state}${(mask & ~D_TRAPPED) === D_NODOOR ? 'doorless doorway' : 'door'}`;
}

function setLooted(location: MapLocation, flags: number): void {
    setMapFlags(location, flags);
}

function clearMapFlags(location: MapLocation): void {
    setMapFlags(location, 0);
}

// C rm.h stores these terrain-specific views in the same five flag bits.
function setMapFlags(location: MapLocation, flags: number): void {
    location.flags = location.doormask = location.wall_info = location.icedpool = flags;
    location.looted = location.ladder = location.drawbridgemask = location.altarmask = flags;
    location.emptygrave = flags !== 0;
}

function setBridgeSurface(location: MapLocation, surface: number): void {
    location.drawbridgemask = ((location.drawbridgemask ?? location.flags) & ~DB_UNDER) | surface;
    setMapFlags(location, location.drawbridgemask);
}

// C objnam.c:set_wallprop_from_str().
function setWallProperties(location: MapLocation, parsed: ParsedWish): void {
    location.wall_info |= (parsed.undiggable ? W_NONDIGGABLE : 0)
        | (parsed.unphaseable ? W_NONPASSWALL : 0);
    setMapFlags(location, location.flags | location.wall_info);
}

// C objnam.c:dbterrainmesg().
async function bridgeMessage(surface: string, type: number): Promise<void> {
    await say(`${surface} ${type === DRAWBRIDGE_UP ? 'in front of' : 'under'} the drawbridge.`);
}

async function say(message: string): Promise<void> {
    await plineWithContinuation(message.charAt(0).toUpperCase() + message.slice(1));
}
