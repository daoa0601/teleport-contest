// weapon.js — weapon.c: hero weapon skills and the #enhance command,
// weapon to-hit/damage bonuses, monster weapon selection and wielding,
// and towel wetness. One TS owner per weapon.c function, in C order.
// mwepgone() and setmnotwielded() share unwieldMonsterWeapon(): TS callers
// of setmnotwielded (uhitm.c:991, apply.c:3177) rely on the weapon_check
// reset that mwepgone performs.
// spell.c:skill_based_spellbook_id() lives in spell.ts (identifySpellbooks);
// u_init.c:skills_for_role()/restricted_spell_discipline() live in u_init.ts.

import { WEAPON_CLASS, TOOL_CLASS, GEM_CLASS, BALL_CLASS, CHAIN_CLASS } from './objclass.js';
import { greatestErosion, is_spear } from './object_properties.js';
import { OBJ_NAME, oc_wldam, oc_wsdam,
    objectClassForType, objectBaseWeight, objectSkill, objectBimanual, AKLYS, AXE, BATTLE_AXE, BOULDER, BOW,
    BULLWHIP, CLUB, CORPSE, CREAM_PIE, CROSSBOW, DART, DWARVISH_MATTOCK, EGG, ELVEN_BOW, LOADSTONE,
    OBJECT_NAMES, ORCISH_BOW, PICK_AXE, SLING, YUMI, HEAVY_IRON_BALL, TIN_OPENER, TOWEL,
    TRIDENT, FLINT, GRAPPLING_HOOK, LUCKSTONE,
    ROCK, STATUE, TIN, TOUCHSTONE,
    oc_hitbon,
} from './object_data.js';
import { bypassObject } from './worn.js';
import { NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE, NEED_RANGED_WEAPON, NEED_WEAPON, NO_WEAPON_WANTED, P_BOW, P_CROSSBOW, P_SLING, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_RINGL, W_RINGR, W_WEP, AKLYS_LIM, A_STR, A_DEX, P_AXE, P_PICK_AXE, Upolyd, WT_IRON_BALL_INCR, P_FLAIL, MAXULEV, MENU_ITEMFLAGS_SKIPMENUCOLORS, PICK_NONE, PICK_ONE, P_BASIC, P_EXPERT, P_FIRST_SPELL, P_ISRESTRICTED, P_LAST_SPELL, P_LAST_WEAPON, P_NONE, P_SKILLED, P_SKILL_LIMIT, P_BARE_HANDED_COMBAT, P_RIDING, P_TWO_WEAPON_COMBAT, P_UNSKILLED, TIP_ENHANCE, STR18, HAND } from './const.js';
import {
    definiteObjectAction, objectName, objectNameIsPlural, observeObjectForNaming,
    observeDistantObjectForNaming, ownedObjectName, makePlural, makeSingular,
} from './objnam.js';
import { artifactById, artifactEmitsLight, monsterCanTouchArtifact, artifactDamageBonus, shadeGlare, artifactToHitBonus } from './artifact.js';
import { canSeeMonster, newsym } from './display.js';
import { formatFeltMessage, plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import { applyFloorEffects } from './do.js';
import { game, requireLiveGame } from './gstate.js';
import { inventoryItemDescription, stack_object } from './invent.js';
import { beginObjectBurn, endObjectBurn } from './timeout.js';
import { equipmentLightDescription } from './light.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { monsterCanTouchObject } from './mon.js';
import { unlinkMonsterObject, placeObject } from './mkobj.js';
import { adjustedMonsterLevel } from './makemon.js';
import { monsterName } from './do_name.js';
import {
    monsterPossessive as perceivedPossessivePronoun, likes_gems, monsterHatesBlessings, monsterHatesLight,
    monsterHatesSilver, monsterIsAnimal, monsterIsBig, monsterIsGiant, monsterIsMindless, monsterIsShade,
    monsterIsSwimmer, monsterIsThickSkinned, monsterIsWooden, monsterPassesWalls, monsterSpeciesHatesSilver,
    monsterThrowsRocks, speciesHasWeaponAttack, strongmonst, monsterHasStoneResistance, touchPetrifies,
} from './mondata.js';
import { monsterSentenceSubject } from './sounds.js';
import { isBimanualObject, isWetTowel, type WeaponCandidate, isLauncherAmmunition } from './object_properties.js';
import { rn2, d, rnd } from './rng.js';
import { cansee, couldsee } from './vision.js';
import { possessiveName } from './hacklib.js';
import { willWeld } from './wield.js';
import { flushPendingTopline } from './topl.js';
import { promptYesNo } from './query.js';
import { showInventoryWindow } from './windows.js';
import { ATR_INVERSE } from './terminal.js';
import { objectMaterial } from './o_init.js';
import { isPoolAt } from './dbridge.js';
import { currentAttribute } from './attrib.js';
import { heroSpecies, mbodypart } from './polyself.js';
import { roleMaximums } from './u_init.js';
import { identifySpellbooks } from './spell.js';
import type { MessagePublisher } from './pline.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { ArtifactDefender } from './artifact.js';
import { requireInitializedHero, type HeroSkill } from './hero_types.js';
import type { Hero } from './hero_types.js';
import type { RoleKey } from './role.js';
import type { InventoryMenuItem } from './windows.js';

interface WeaponMessageOptions {
    publish?: MessagePublisher;
}

interface UnwieldOptions extends WeaponMessageOptions {
    weapon?: GameObject | null;
}

interface PolymorphWeaponOptions extends WeaponMessageOptions {
    polyspot?: boolean;
}

export interface MonsterRangedWeapon {
    weapon: GameObject;
    launcher: GameObject | null;
}

const S_KOP = 37;
const PM_BALROG = MONSTER_NAME.indexOf('balrog');

// C weapon.c:skill_names_indices[]/odd_skill_names[] with weapon.c:P_NAME():
// the skill names table. Entry 35 is read through skillName(), which reports
// "martial arts" for the martial-arts roles (barehands_or_martial[]).
export const SKILL_NAMES = [
    'no skill',
    'dagger', 'knife', 'axe', 'pick-axe', 'short sword', 'broadsword',
    'long sword', 'two-handed sword', 'saber', 'club', 'mace',
    'morning star', 'flail', 'hammer', 'quarterstaff', 'polearms', 'spear',
    'trident', 'lance', 'bow', 'sling', 'crossbow', 'dart', 'shuriken',
    'boomerang', 'whip', 'unicorn horn',
    'attack spells', 'healing spells', 'divination spells',
    'enchantment spells', 'clerical spells', 'escape spells',
    'matter spells',
    'bare handed combat', 'two weapon combat', 'riding',
];

export const SKILL_GROUPS = [
    { heading: 'Fighting Skills', first: 35, last: 37 },
    { heading: 'Weapon Skills', first: 1, last: 27 },
    { heading: 'Spellcasting Skills', first: 28, last: 34 },
];

// C weapon.c:skill_level_name()'s level names, indexed by skill level.
export const SKILL_LEVEL_NAMES = [
    'Unknown', 'Unskilled', 'Basic', 'Skilled', 'Expert', 'Master', 'Grand Master',
];

// weapon.c's skill_init() grants these magic skills independently of the
// weapons carried (healer/monk healing, cleric clerical, wizard attack and
// enchantment).
const ROLE_STARTING_MAGIC_SKILLS: Partial<Record<RoleKey, readonly number[]>> = {
    healer: [29], monk: [29], priest: [32], wizard: [28, 31],
};

// C skills.h:practice_needed_to_advance() macro: ((level) * (level) * 20).
export function practiceNeededToAdvance(level: number): number {
    return level * level * 20;
}

// C weapon.c:give_may_advance_msg().
async function giveMayAdvanceMessage(skill: number, state: GameState): Promise<void> {
    const kind = skill === P_NONE ? '' : skill <= P_LAST_WEAPON ? 'weapon '
        : skill <= P_LAST_SPELL ? 'spell casting ' : 'fighting ';
    await plineWithContinuation(formatFeltMessage(`more confident in your ${kind}skills.`, state));
    const tip = 1 << TIP_ENHANCE;
    if (state.flags.tips !== false && !((state.context.tips ?? 0) & tip)) {
        state.context.tips = (state.context.tips || 0) | tip;
        await plineWithContinuation('(Tip: use the #enhance command to advance them.)');
    }
}

// C weapon.c:weapon_descr(). Describe the kind of weapon without knowledge,
// enchantment, material, or a personal name.

const CLASS_NAMES = [
    'strange object', 'strange object', 'weapon', 'armor', 'ring', 'amulet',
    'tool', 'food', 'potion', 'scroll', 'spellbook', 'wand', 'coin', 'gem',
    'large rock', 'iron ball', 'chain', 'venom',
];

// C weapon.c:weapon_descr()
export function weaponDescription(object: GameObject): string {
    const skill = [WEAPON_CLASS, TOOL_CLASS, GEM_CLASS].includes(object.oclass)
        ? Math.abs(objectSkill(object.otyp)) : 0;
    let description = SKILL_NAMES[skill];
    if (skill === 0) {
        if ([CORPSE, TIN, EGG, STATUE, BOULDER, TOWEL, TIN_OPENER].includes(object.otyp))
            description = OBJ_NAME(object.otyp) ?? undefined;
        else description = object.globby ? 'glob' : CLASS_NAMES[object.oclass];
    } else if (skill === P_SLING && isLauncherAmmunition(object)) {
        description = [ROCK, LUCKSTONE, LOADSTONE, TOUCHSTONE, FLINT].includes(object.otyp)
            ? 'stone' : object.oclass === GEM_CLASS ? 'gem' : CLASS_NAMES[object.oclass];
    } else if (skill === P_BOW && isLauncherAmmunition(object)) description = 'arrow';
    else if (skill === P_CROSSBOW && isLauncherAmmunition(object)) description = 'bolt';
    else if (skill === P_FLAIL && object.otyp === GRAPPLING_HOOK) description = 'hook';
    else if (skill === P_PICK_AXE && object.otyp === DWARVISH_MATTOCK) description = 'mattock';
    if (!description) throw new Error(`No weapon description for object type ${object.otyp}`);
    return makeSingular(description);
}

// C weapon.c:hitval(): the "to hit" bonuses of the object against the
// defender, including dothrow.c:omon_adj()'s artifact adjectives.

const S_DRAGON = 30;
const S_GIANT = 34;
const S_JABBERWOCK = 36;
const S_NAGA = 40;
const S_SNAKE = 45;
const S_XORN = 50;
const S_EEL = 57;

export interface WeaponAccuracyOptions {
    state?: GameState;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
}

// Port only: distinguish a hero defender from a monster defender by identity.
function heroTarget(defender: Hero | Monster, state: GameState): defender is Hero {
    return defender === state.u;
}
// C weapon.c:hitval()
export function weaponHitValue(object: GameObject, defender: Hero | Monster, {
    state = game, random = rn2, rollOne = rnd,
}: WeaponAccuracyOptions = {}): number {
    const hero = heroTarget(defender, state);
    let target: { mnum: number; mx: number; my: number; cham?: number };
    if (heroTarget(defender, state)) {
        requireInitializedHero(defender);
        target = { mnum: defender.umonnum, mx: defender.ux, my: defender.uy };
    } else target = defender;
    const skill = objectSkill(object.otyp);
    const weapon = object.oclass === WEAPON_CLASS
        || (object.oclass === TOOL_CLASS && skill !== 0);
    const symbol = MONSTER_SYMBOL[target.mnum];
    const flags = MONSTER_FLAGS1[target.mnum];
    let bonus = oc_hitbon(object.otyp);
    if (bonus === undefined)
        throw new RangeError(`Unknown weapon type ${object.otyp}`);
    if (symbol === undefined || flags === undefined)
        throw new RangeError(`Unknown weapon defender species ${target.mnum}`);
    if (weapon) {
        if (object.spe === undefined)
            throw new Error(`Weapon ${object.otyp} has no enchantment value.`);
        bonus += object.spe;
    }
    if (weapon && object.blessed && monsterHatesBlessings(target)) bonus += 2;

    if (is_spear(object)
        && [S_XORN, S_DRAGON, S_JABBERWOCK, S_NAGA, S_GIANT].includes(symbol)) {
        bonus += 2;
    }
    if (object.otyp === TRIDENT && monsterIsSwimmer(target.mnum)) {
        if (isPoolAt(target.mx, target.my, state)) bonus += 4;
        else if (symbol === S_EEL || symbol === S_SNAKE) bonus += 2;
    }
    if (weapon && skill === P_PICK_AXE
        && monsterPassesWalls(target.mnum) && monsterIsThickSkinned({ mnum: target.mnum })) {
        bonus += 2;
    }
    if (object.oartifact) {
        bonus += artifactToHitBonus(object, target, rollOne, { hero, random, state });
    }
    return bonus;
}

// Shared physical weapon die, enchantment, and erosion.
// C refs: weapon.c:dmgval(). rollPhysicalWeaponDamage() is the port; the helpers
// below are dmgval()'s blocks in C order (die switch, enchantment, target
// base rules, the blessed/silver/light bonus, erosion).

export interface PhysicalWeaponDamageOptions {
    state?: GameState;
    hero?: boolean;
    rollOne?: (sides: number) => number;
    rollDice?: (count: number, sides: number) => number;
    hatesBlessings?: boolean;
    hatesSilver?: boolean;
}

const LEATHER = 7;
const SILVER = 14;

// Port only: resolve object names into a set of metadata indices.
function objectTypes(names: readonly string[]): Set<number> {
    return new Set(names.map(name => OBJECT_NAMES.indexOf(name))
        .filter(otyp => otyp >= 0));
}

const LARGE_FIXED_ONE = objectTypes([
    'iron chain', 'crossbow bolt', 'morning star', 'partisan', 'runesword',
    'elven broadsword', 'broadsword',
]);
const LARGE_RND4 = objectTypes(['flail', 'ranseur', 'voulge']);
const LARGE_RND6 = objectTypes([
    'splash of acid venom', 'halberd', 'spetum',
]);
const LARGE_2D4 = objectTypes(['battle-axe', 'bardiche', 'trident']);
const LARGE_2D6 = objectTypes([
    'tsurugi', 'dwarvish mattock', 'two-handed sword',
]);

const SMALL_FIXED_ONE = objectTypes([
    'iron chain', 'crossbow bolt', 'mace', 'silver mace', 'war hammer',
    'flail', 'spetum', 'trident',
]);
const SMALL_RND4 = objectTypes([
    'battle-axe', 'bardiche', 'bill-guisarme', 'guisarme', 'lucern hammer',
    'morning star', 'ranseur', 'broadsword', 'elven broadsword', 'runesword',
    'voulge',
]);
const SMALL_RND6 = objectTypes(['splash of acid venom']);

// Part of C weapon.c:dmgval(): select the size-dependent base damage dice.
function damageProfile(object: GameObject, monster: ArtifactDefender) {
    const large = monsterIsBig(monster.mnum);
    const otyp = object.otyp;
    const range = (large ? oc_wldam(otyp) : oc_wsdam(otyp))
        ?? 0;
    const fixed = (large ? LARGE_FIXED_ONE : SMALL_FIXED_ONE).has(otyp)
        ? 1 : 0;
    const random4 = (large ? LARGE_RND4 : SMALL_RND4).has(otyp);
    const random6 = (large ? LARGE_RND6 : SMALL_RND6).has(otyp);
    const twoD4 = large && LARGE_2D4.has(otyp);
    const twoD6 = large && LARGE_2D6.has(otyp);
    return { range, fixed, random4, random6, twoD4, twoD6 };
}

// Port only: read the object's stored enchantment value.
function enchantment(object: GameObject): number {
    return object.spe ?? object.enchantment ?? 0;
}

// Part of C weapon.c:dmgval(): add weapon enchantment and clamp negative damage.
function addWeaponEnchantment(object: GameObject, damage: number): number {
    const objectClass = object.oclass || objectClassForType(object.otyp);
    const weaponLike = objectClass === WEAPON_CLASS
        || (objectClass === TOOL_CLASS
            && objectSkill(object.otyp) !== 0);
    if (!weaponLike) return damage;
    damage += enchantment(object);
    return Math.max(0, damage);
}

// Part of C weapon.c:dmgval(): select classes eligible for target-specific bonuses.
function canHaveTargetDamageBonus(object: GameObject): boolean {
    const objectClass = object.oclass || objectClassForType(object.otyp);
    return objectClass === WEAPON_CLASS
        || (objectClass === TOOL_CLASS
            && objectSkill(object.otyp) !== 0)
        || objectClass === GEM_CLASS
        || objectClass === BALL_CLASS
        || objectClass === CHAIN_CLASS;
}

// Part of C weapon.c:dmgval() and uhitm.c:hmon_hitmon_potion(): suppress
// ordinary base damage against shades (C shade_glare()).
export function shadeBlocksWeaponBaseDamage(
    object: GameObject, monster: ArtifactDefender, state: GameState = game,
): boolean {
    return monsterIsShade(monster) && !shadeGlare(object, state);
}

// Part of C weapon.c:dmgval(): apply thick skin, shades, and heavy iron-ball weight.
function applyTargetBaseRules(
    object: GameObject, monster: ArtifactDefender, damage: number,
    rollOne: (sides: number) => number, state: GameState,
): number {
    const material = objectMaterial(object, state);
    if (material !== undefined && material <= LEATHER && monsterIsThickSkinned(monster)) damage = 0;
    if (shadeBlocksWeaponBaseDamage(object, monster, state)) damage = 0;

    if (object.otyp === HEAVY_IRON_BALL && damage > 0) {
        const baseWeight = objectBaseWeight(HEAVY_IRON_BALL);
        const extraWeight = Math.max(0, (object.owt ?? baseWeight) - baseWeight);
        const increments = Math.trunc(extraWeight / WT_IRON_BALL_INCR);
        if (increments > 0) {
            damage += rollOne(4 * increments);
            damage = Math.min(damage, 25);
        }
    }
    return damage;
}

// Part of C weapon.c:dmgval(): apply blessed, material, wooden-target, and artifact-light bonuses.
function targetDamageBonus(
    object: GameObject, monster: ArtifactDefender,
    { hatesBlessings, hatesSilver, hero }: {
        hatesBlessings: boolean; hatesSilver: boolean; hero: boolean;
    },
    rollOne: (sides: number) => number,
    state: GameState,
) {
    if (!canHaveTargetDamageBonus(object)) return 0;
    let bonus = 0;
    if (object.blessed && hatesBlessings) bonus += rollOne(4);
    if (Math.abs(objectSkill(object.otyp)) === P_AXE
        && monsterIsWooden(monster)) bonus += rollOne(4);
    if (objectMaterial(object, state) === SILVER && hatesSilver)
        bonus += rollOne(20);
    if (artifactEmitsLight(object) && object.lamplit
        && monsterHatesLight(monster)) bonus += rollOne(8);
    // dmgval probes spec_dbon with 25 damage. An artifact with its own
    // damage die still performs that probe even when it will not double.
    return bonus > 1 && object.oartifact
        && artifactDamageBonus(object, monster, 25, rollOne, { hero, state }) >= 25
        ? Math.trunc((bonus + 1) / 2) : bonus;
}

// Part of C weapon.c:dmgval(): reduce positive damage by erosion, retaining one point.
function applyErosion(object: GameObject, damage: number): number {
    if (damage > 0) damage = Math.max(1, damage - greatestErosion(object));
    return damage;
}

// C weapon.c:dmgval().
export function rollPhysicalWeaponDamage(
    object: GameObject, monster: ArtifactDefender, {
        state = game,
        hero = false,
        rollOne = rnd,
        hatesBlessings = monsterHatesBlessings(monster),
        hatesSilver = monsterHatesSilver(monster),
        rollDice = d,
    }: PhysicalWeaponDamageOptions = {},
): number {
    if (object.otyp === CREAM_PIE) return 0;
    const profile = damageProfile(object, monster);
    let damage = profile.range > 0 ? rollOne(profile.range) : 0;
    damage += profile.fixed;
    if (profile.random4) damage += rollOne(4);
    if (profile.random6) damage += rollOne(6);
    if (profile.twoD4) damage += rollDice(2, 4);
    if (profile.twoD6) damage += rollDice(2, 6);
    damage = addWeaponEnchantment(object, damage);
    damage = applyTargetBaseRules(object, monster, damage, rollOne, state);
    damage += targetDamageBonus(
        object, monster, { hatesBlessings, hatesSilver, hero }, rollOne, state,
    );
    return applyErosion(object, damage);
}

// Port only: adapt the hero's current form to the weapon-damage defender contract.
// At native dmgval call sites using youmonst, the defender is the hero's form.
export function rollPhysicalWeaponDamageAgainstHero(
    object: GameObject, state: GameState, options: PhysicalWeaponDamageOptions = {},
): number {
    // C dmgval(obj, &youmonst) asks mon_hates_silver() about the hero's
    // current form; lycanthropy (Hate_silver) only adds the searing line.
    const species = heroSpecies(state);
    return rollPhysicalWeaponDamage(
        object,
        { mnum: species },
        { ...options, state, hero: true, hatesSilver: monsterSpeciesHatesSilver(species) },
    );
}

export interface SpecialContactDamageOptions {
    state?: GameState;
}

export interface SpecialContactDamageResult {
    damage: number;
    silverMask: number;
}

type ContactActor = Hero | Monster;
type ArmorSlot = 'uarm' | 'uarmc' | 'uarmh' | 'uarms' | 'uarmg' | 'uarmf' | 'uarmu';
type RingContact = readonly [selected: boolean, slot: 'uleft' | 'uright', mask: number];

const ARMOR_SLOTS = new Map<number, ArmorSlot>([
    [W_ARM, 'uarm'], [W_ARMC, 'uarmc'], [W_ARMH, 'uarmh'],
    [W_ARMS, 'uarms'], [W_ARMG, 'uarmg'], [W_ARMF, 'uarmf'], [W_ARMU, 'uarmu'],
]);
const STRANGE_OBJECT = 0;

// C weapon.c:special_dmgval(): blessed and/or silver damage for non-weapon hit.
export function specialContactDamage(
    attacker: ContactActor, defender: ContactActor, mask: number,
    { state = game }: SpecialContactDamageOptions = {},
): SpecialContactDamageResult {
    const left = !!(mask & W_RINGL);
    const right = !!(mask & W_RINGR);
    const target = contactDefender(defender, state);
    let armor = null;
    if (mask & (W_ARMC | W_ARM | W_ARMU)) {
        for (const layer of [W_ARMC, W_ARM, W_ARMU]) {
            if (!(mask & layer)) continue;
            armor = wornArmor(attacker, layer, state);
            if (armor) {
                mask = layer;
                break;
            }
        }
    } else if (mask & (W_ARMG | W_RINGL | W_RINGR)) {
        armor = wornArmor(attacker, W_ARMG, state);
        mask = armor ? W_ARMG : 0;
    } else armor = wornArmor(attacker, mask, state);

    let damage = 0;
    let silverMask = 0;
    if (armor) {
        if (armor.blessed && monsterHatesBlessings(target)) damage += rnd(4);
        if (objectMaterial(armor, state) === SILVER && monsterHatesSilver(target)) {
            damage += rnd(20);
            silverMask = mask;
        }
    } else if ((left || right) && attacker === state.u) {
        const rings: readonly RingContact[] = [
            [left, 'uleft', W_RINGL], [right, 'uright', W_RINGR],
        ];
        for (const [selected, slot, ringMask] of rings) {
            const ring = state[slot] || state.u[slot];
            if (selected && ring && objectMaterial(ring, state) === SILVER
                && monsterHatesSilver(target)) {
                if (!silverMask) damage += rnd(20);
                silverMask |= ringMask;
            }
        }
    }
    return { damage, silverMask };
}

// Port only: defender view of Hero|Monster for the mon_hates_* checks.
function contactDefender(actor: ContactActor, state: GameState): Pick<Monster, 'mnum' | 'cham'> {
    if ('mnum' in actor) return actor;
    if (actor !== state.u)
        throw new Error('Contact damage requires the hero from its game state.');
    const body: Pick<Monster, 'mnum' | 'cham'> = { mnum: heroSpecies(state) };
    if (state.u.mcham !== undefined) body.cham = state.u.mcham;
    return body;
}

// Part of C worn.c:which_armor(): hero-slot and monster-inventory armor lookup.
function wornArmor(actor: ContactActor, mask: number, state: GameState): GameObject | null {
    if (actor !== state.u) {
        if (!('mnum' in actor))
            throw new Error('Contact damage requires the hero from its game state.');
        return (actor.minvent || []).find(object =>
            (object.owornmask || 0) & mask) || null;
    }
    const slot = ARMOR_SLOTS.get(mask);
    return slot ? state[slot] || state.u[slot] || null : null;
}

// C weapon.c:silver_sears(): the hero's silver rings searing the target.
export async function showHeroSilverContact(
    monster: Monster, silverMask: number,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState; publish?: MessagePublisher;
    } = {},
): Promise<void> {
    if (!(silverMask & (W_RINGL | W_RINGR))) return;
    const left = state.uleft || state.u.uleft;
    const right = state.uright || state.u.uright;
    const leftType = left && (silverMask & W_RINGL) ? left.otyp : STRANGE_OBJECT;
    const rightType = right && (silverMask & W_RINGR) ? right.otyp : STRANGE_OBJECT;
    const leftKnown = !!left?.dknown;
    const rightKnown = !!right?.dknown;
    const leftSilver = objectMaterial(leftType, state) === SILVER && leftKnown;
    const rightSilver = objectMaterial(rightType, state) === SILVER && rightKnown;
    const both = (leftType === rightType && leftKnown === rightKnown) || (leftSilver && rightSilver);
    const material = leftSilver || rightSilver ? 'silver '
        : both ? '' : silverMask & W_RINGL ? 'left ' : 'right ';
    await publish(`Your ${material}ring${both ? 's sear' : ' sears'} ${monsterName(monster, { state })}!`);
}


// C weapon.c:oselect()
// C oselect(): keep inventory order among items of the same type.
export function selectMonsterWeaponOfType(
    monster: Monster, type: number, state: GameState = game,
): GameObject | null {
    return (monster.minvent || monster.inventory || []).find(object =>
        object.otyp === type
        && (![CORPSE, EGG].includes(type)
            || (object.corpsenm !== undefined && touchPetrifies(object.corpsenm)))
        && monsterCanTouchObject(monster, object, state)) || null;
}

// C weapon.c:rwep[] order. A melee weapon is not automatically a missile.
const RANGED_WEAPON_PREFERENCE = [
    'dwarvish spear', 'silver spear', 'elven spear', 'spear', 'orcish spear',
    'javelin', 'shuriken', 'ya', 'silver arrow', 'elven arrow', 'arrow',
    'orcish arrow', 'crossbow bolt', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'knife', 'flint', 'rock', 'loadstone',
    'luckstone', 'dart', 'cream pie',
].map(name => OBJECT_NAMES.indexOf(name));

// C weapon.c:pwep[], the polearms, in preference order.
const POLEARM_PREFERENCE = [
    'halberd', 'bardiche', 'spetum', 'bill-guisarme', 'voulge', 'ranseur',
    'guisarme', 'glaive', 'lucern hammer', 'bec de corbin', 'fauchard',
    'partisan', 'lance',
].map(name => OBJECT_NAMES.indexOf(name));

// C weapon.c:autoreturn_weapon(). The pinned game only includes the aklys.
export function returningWeaponRangeSquared(object: WeaponCandidate): number | null {
    return object?.otyp === AKLYS ? AKLYS_LIM * AKLYS_LIM : null;
}

// C weapon.c:select_rwep()
// C select_rwep(). Keep the selected weapon and launcher together instead of
// storing the launcher in C's global propellor.
export function selectMonsterRangedWeapon(
    monster: Monster, state: GameState = game,
): MonsterRangedWeapon | null {
    const inventory = monster.minvent || monster.inventory || [];

    const egg = selectMonsterWeaponOfType(monster, EGG, state);
    if (egg) return { weapon: egg, launcher: null };
    if (MONSTER_SYMBOL[monster.mnum] === S_KOP) {
        const pie = selectMonsterWeaponOfType(monster, CREAM_PIE, state);
        if (pie) return { weapon: pie, launcher: null };
    }
    if (monsterThrowsRocks(monster.mnum)) {
        const boulder = selectMonsterWeaponOfType(monster, BOULDER, state);
        if (boulder) return { weapon: boulder, launcher: null };
    }

    const current = monsterWieldedWeapon(monster);
    const cannotSwitch = willWeld(current) && monster.weaponCheck === NO_WEAPON_WANTED;
    const distance = monster.mux === undefined || monster.muy === undefined
        ? null : (monster.mx - monster.mux) ** 2 + (monster.my - monster.muy) ** 2;
    if (distance !== null && distance <= 13 && couldsee(monster.mx, monster.my)) {
        if (current && artifactById(current.oartifact, state)?.name === 'Snickersnee')
            return { weapon: current, launcher: current };
        const twoHands = strongmonst(monster.mnum)
            && !((monster.misc_worn_check ?? 0) & W_ARMS);
        for (const type of POLEARM_PREFERENCE) {
            // C weapon.c:574 reads objects[pwep[i]].oc_bimanual raw on the
            // otyp table; the class guard does not apply to table entries.
            if (objectBimanual(type) && !twoHands) continue;
            const polearm = selectMonsterWeaponOfType(monster, type, state);
            if (polearm && (polearm === current || !cannotSwitch))
                return { weapon: polearm, launcher: polearm };
        }
    }
    if (!cannotSwitch && !(monsterIsMindless(monster.mnum) || monsterIsAnimal({ mnum: monster.mnum }))) {
        const aklys = selectMonsterWeaponOfType(monster, AKLYS, state);
        const range = returningWeaponRangeSquared(aklys);
        if (aklys && range !== null && distance !== null && distance <= range
            && couldsee(monster.mx, monster.my)) return { weapon: aklys, launcher: aklys };
    }
    for (const type of RANGED_WEAPON_PREFERENCE) {
        if (type === DART && !likes_gems(monster.mnum)) {
            const sling = inventory.find(object => object.otyp === SLING);
            if (sling) {
                const gem = inventory.find(object => object.oclass === GEM_CLASS
                    && (object.otyp !== LOADSTONE || !object.cursed));
                if (gem) return { weapon: gem, launcher: sling };
            }
        }

        // C select_rwep()'s propellor switch: bow, sling, or crossbow to
        // launch this missile.
        const skill = objectSkill(type);
        let launcher: GameObject | null = null;
        if (skill === -P_BOW || skill === -P_SLING || skill === -P_CROSSBOW) {
            const launcherTypes = skill === -P_BOW ? [YUMI, ELVEN_BOW, BOW, ORCISH_BOW]
                : skill === -P_SLING ? [SLING] : [CROSSBOW];
            for (const launcherType of launcherTypes) {
                launcher = selectMonsterWeaponOfType(monster, launcherType, state);
                if (launcher) break;
            }
        }
        const needsLauncher = skill >= -P_CROSSBOW && skill <= -P_BOW;
        if (needsLauncher && !launcher) continue;
        if (skill < 0 && cannotSwitch && launcher !== current) continue;
        if (type === LOADSTONE) {
            const stone = inventory.find(object => object.otyp === LOADSTONE && !object.cursed);
            if (stone) return { weapon: stone, launcher };
        } else {
            const missile = selectMonsterWeaponOfType(monster, type, state);
            if (missile && !missile.oartifact
                && !(missile === current && willWeld(missile))) return { weapon: missile, launcher };
        }
    }
    return null;
}

// C weapon.c:monmightthrowwep(). This is the native missile preference set.
export function monsterMightThrowWeapon(object: GameObject): boolean {
    return RANGED_WEAPON_PREFERENCE.includes(object.otyp);
}

// C weapon.c:hwep[], in preference order.
const HAND_TO_HAND_WEAPONS = [
    'corpse', 'tsurugi', 'runesword', 'dwarvish mattock', 'two-handed sword',
    'battle-axe', 'katana', 'unicorn horn', 'crysknife', 'trident',
    'long sword', 'elven broadsword', 'broadsword', 'scimitar',
    'silver saber', 'morning star', 'elven short sword',
    'dwarvish short sword', 'short sword', 'orcish short sword',
    'silver mace', 'mace', 'axe', 'dwarvish spear', 'silver spear',
    'elven spear', 'spear', 'orcish spear', 'flail', 'bullwhip',
    'quarterstaff', 'javelin', 'aklys', 'club', 'pick-axe',
    'rubber hose', 'war hammer', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'athame', 'scalpel', 'knife', 'worm tooth',
].map(name => OBJECT_NAMES.indexOf(name));

// C weapon.c:select_hwep().
export function selectHandToHandWeapon(
    monster: Monster, state: GameState = game,
): GameObject | null {
    const inventory = monster.minvent || monster.inventory || [];

    const canUseBothHands = strongmonst(monster.mnum)
        && !((monster.misc_worn_check ?? 0) & W_ARMS);
    // Artifact preference uses touch_artifact(), not the material check below.
    for (const object of inventory) {
        if (object.oclass === WEAPON_CLASS && object.oartifact
            && monsterCanTouchArtifact(monster, object, state)
            // C weapon.c:717 reads oc_bimanual raw for the artifact (already
            // restricted to WEAPON_CLASS by the loop guard above).
            && (canUseBothHands || !objectBimanual(object.otyp))) return object;
    }

    let favorite: number | null = null;
    if (monsterIsGiant(monster.mnum)) favorite = CLUB;
    else if (monster.mnum === PM_BALROG && (state.uwep || state.u?.uwep))
        favorite = BULLWHIP;
    if (favorite !== null) {
        const object = selectMonsterWeaponOfType(monster, favorite, state);
        if (object) return object;
    }

    for (const type of HAND_TO_HAND_WEAPONS) {
        // C weapon.c:733 reads objects[hwep[i]].oc_bimanual raw on the table.
        if (objectBimanual(type) && !canUseBothHands) continue;
        if (type === CORPSE && !((monster.misc_worn_check ?? 0) & W_ARMG)
            && !monsterHasStoneResistance(monster)) continue;
        const object = selectMonsterWeaponOfType(monster, type, state);
        if (object) return object;
    }
    return null;
}

// C weapon.c:possibly_unwield(). Called after polymorphing a monster,
// robbing it, etc.; monsters otherwise never unwield stuff on their own.
// Also C wield.c:mwelded(): inlined here as the W_WEP and willWeld test.
export async function updateMonsterWeaponAfterPolymorph(monster: Monster, state: GameState = game, {
    polyspot = false,
    publish = plineWithContinuation,
}: PolymorphWeaponOptions = {}): Promise<GameObject | null> {
    const weapon = monsterWieldedWeapon(monster);
    if (!weapon) return null;

    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.includes(weapon)) {
        monster.mw = null;
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }

    if (!speciesHasWeaponAttack(monster.mnum)) {
        await unwieldMonsterWeapon(monster, state, { weapon, publish });
        monster.weaponCheck = NO_WEAPON_WANTED;
        if (cansee(monster.mx, monster.my)) {
            observeDistantObjectForNaming(weapon, state);
            const description = await inventoryItemDescription(weapon);
            await publish(`${monsterSentenceSubject(monster)} drops ${description}.`);
            await newsym(monster.mx, monster.my);
        }
        // C possibly_unwield(): raw extraction after setmnotwielded(),
        // not extract_from_minvent() and its separate release.
        unlinkMonsterObject(monster, weapon);
        const landing = await applyFloorEffects(
            weapon, monster.mx, monster.my, { state, publish },
        );
        if (landing.finished) return landing.object;
        if (polyspot) {
            bypassObject(weapon, state);
        }
        // Weapon drops can follow hero-caused unwields: awaited placement.
        await placeObject(weapon, monster.mx, monster.my, state);
        return await stack_object(weapon, state);
    }

    const welded = willWeld(weapon) && ((weapon.owornmask ?? 0) & W_WEP);
    if (!(welded && monster.weaponCheck === NO_WEAPON_WANTED))
        monster.weaponCheck = NEED_WEAPON;
    return null;
}

// C weapon.c:mon_wield_item()
// C mon_wield_item(): returns whether the attempt spent the monster's action.
export async function wieldMonsterWeapon(monster: Monster, state: GameState = game, {
    publish = plineWithContinuation,
}: WeaponMessageOptions = {}): Promise<boolean> {
    if (monster.weaponCheck === NO_WEAPON_WANTED) return false;
    const digging = monster.weaponCheck !== undefined
        && [NEED_PICK_AXE, NEED_AXE, NEED_PICK_OR_AXE].includes(monster.weaponCheck);
    // C mon_wield_item()'s switch over weapon_check; NEED_RANGED_WEAPON
    // reads the propellor (the launcher) as in select_rwep().
    const inventory = monster.minvent || monster.inventory || [];
    // C m_carrying(): the monster's first carried object of a type.
    const carriedObjectOfType = (type: number) => inventory.find(object => object.otyp === type) ?? null;
    const shield = !!((monster.misc_worn_check ?? 0) & W_ARMS);
    let weapon: GameObject | null;
    switch (monster.weaponCheck) {
    case NEED_HTH_WEAPON:
        weapon = selectHandToHandWeapon(monster, state);
        break;
    case NEED_RANGED_WEAPON:
        weapon = selectMonsterRangedWeapon(monster, state)?.launcher ?? null;
        break;
    case NEED_PICK_AXE:
        weapon = carriedObjectOfType(PICK_AXE) || (shield ? null : carriedObjectOfType(DWARVISH_MATTOCK));
        break;
    case NEED_AXE:
        weapon = (shield ? null : carriedObjectOfType(BATTLE_AXE)) || carriedObjectOfType(AXE);
        break;
    case NEED_PICK_OR_AXE:
        weapon = (!shield && (carriedObjectOfType(DWARVISH_MATTOCK) || carriedObjectOfType(BATTLE_AXE)))
            || carriedObjectOfType(PICK_AXE) || carriedObjectOfType(AXE);
        break;
    case undefined:
    default:
        throw new Error(`Unknown monster weapon request: ${monster.weaponCheck}`);
    }
    const previous = monsterWieldedWeapon(monster);
    if (!weapon || previous?.otyp === weapon.otyp) {
        monster.weaponCheck = NEED_WEAPON;
        return false;
    }
    if (previous && willWeld(previous)) {
        if (canSeeMonster(monster)) {
            const hand = wieldingHand(monster, previous);
            const pronoun = perceivedPossessivePronoun(monster, { state });
            const plural = (previous.quan ?? previous.quantity ?? 1) > 1;
            const welded = `${plural ? 'are' : 'is'} welded to ${pronoun} ${hand}`;
            if (weapon.otyp === PICK_AXE) {
                await publish(`Since ${monsterPossessive(monster, state)} weapon${plural ? 's' : ''} ${welded},`);
                // C weapon.c:mon_wield_item() starts this line with mon_nam(), uncapitalized.
                observeObjectForNaming(weapon, { state });
                await publish(`${monsterName(monster, { state })} cannot wield that ${objectName(weapon, state)}.`);
            } else {
                observeObjectForNaming(weapon, { state });
                const description = await inventoryItemDescription(weapon);
                await publish(`${monsterName(monster, { state, capitalized: true })} tries to wield ${description}.`);
                observeObjectForNaming(previous, { state });
                await publish(`${ownedObjectName(previous, state)} ${welded}!`);
            }
            previous.bknown = true;
        }
        monster.weaponCheck = NO_WEAPON_WANTED;
        return true;
    }

    monster.mw = weapon;
    if (previous)
        await unwieldMonsterWeapon(monster, state, { weapon: previous, publish });
    monster.weaponCheck = NEED_WEAPON;
    if (canSeeMonster(monster)) {
        observeObjectForNaming(weapon, { state });
        const description = await inventoryItemDescription(weapon);
        await publish(`${monsterName(monster, { state, capitalized: true })} wields ${description}${digging ? '.' : '!'}`);
        if (weapon.otyp === AKLYS)
            await publish(`${monsterName(monster, { state, capitalized: true })} secures the tether on the ${objectName(weapon, state)}.`);
        if (willWeld(weapon)) {
            const plural = (weapon.quan ?? weapon.quantity ?? 1) > 1;
            const hand = wieldingHand(monster, weapon);
            const welding = plural ? 'weld themselves' : 'welds itself';
            await publish(`${definiteObjectAction(weapon, null, state)} ${welding} to ${monsterPossessive(monster, state)} ${hand}!`);
            weapon.bknown = true;
        }
    }
    if (artifactEmitsLight(weapon) && !weapon.lamplit) {
        beginObjectBurn(weapon, state);
        if (canSeeMonster(monster)) {
            const hand = mbodypart(monster.mnum, HAND);
            const brightness = equipmentLightDescription(weapon, state);
            await publish(`${definiteObjectAction(weapon, null, state)} shines ${brightness} in ${monsterPossessive(monster, state)} ${hand}!`);
        } else if (cansee(monster.mx, monster.my)) {
            const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
            await publish(`Light begins shining ${distance <= 25 ? 'nearby' : 'in the distance'}.`);
        }
    }
    weapon.owornmask = W_WEP;
    weapon.wielded = true;
    weapon.worn = true;
    return true;
}

// Part of C weapon.c:mon_wield_item(): choose singular or plural hand wording.
// C mon_wield_item checks bimanual at both the welded message (866) and
// the welds-itself message (910): the monster's hand name, pluralized.
function wieldingHand(monster: Monster, weapon: GameObject): string {
    const hand = mbodypart(monster.mnum, HAND);
    return isBimanualObject(weapon) ? makePlural(hand) : hand;
}

// C hack.h:mhis()/s_suffix(mon_nam()) in the wield messages.
function monsterPossessive(monster: Monster, state: GameState): string {
    const name = monsterName(monster, { state });
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

// C hack.h:MON_WEP(): the monster's wielded weapon, by mw or the W_WEP bit.
export function monsterWieldedWeapon(
    monster: Partial<Pick<Monster, 'mnum' | 'mw' | 'minvent' | 'inventory'>> | null | undefined,
): GameObject | undefined {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded
                || ((object?.owornmask ?? 0) & W_WEP));
}

// C weapon.c:mwepgone(), with weapon.c:setmnotwielded() inlined: TS callers
// of setmnotwielded rely on the weapon_check reset (see the module header).
export async function unwieldMonsterWeapon(monster: Monster, state: GameState = game, {
    weapon = monsterWieldedWeapon(monster),
    publish = plineWithContinuation,
}: UnwieldOptions = {}): Promise<GameObject | null> {
    if (!weapon) return null;

    if (weapon.lamplit && artifactEmitsLight(weapon)) {
        endObjectBurn(weapon, state);
        if (canSeeMonster(monster)) {
            const hand = mbodypart(monster.mnum, HAND);
            await publish(`${definiteObjectAction(weapon, null, state)} in ${monsterPossessive(monster, state)} ${hand} ${objectNameIsPlural(weapon, state) ? 'stop' : 'stops'} shining.`);
        }
    }
    if (monster.mw === weapon) monster.mw = null;
    weapon.owornmask = (weapon.owornmask ?? 0) & ~W_WEP;
    weapon.wielded = false;
    weapon.worn = weapon.owornmask !== 0;
    monster.weaponCheck = NEED_WEAPON;
    return weapon;
}

// C weapon.c:abon(). A polymorphed hero uses the form's adjusted level
// (including dungeon difficulty); humans use the Strength ladder plus the
// low-level tuning kludge and the Dexterity ladder. dig.c:digmon() and
// uhitm.c read the same bonus.
export function heroAttackBonus(state: GameState): number {
    if (Upolyd(state.u)) return adjustedMonsterLevel(heroSpecies(state)) - 3;
    const strength = currentAttribute(A_STR, state);
    const dexterity = currentAttribute(A_DEX, state);
    let bonus = strength < 6 ? -2 : strength < 8 ? -1 : strength < 17 ? 0
        : strength < STR18(50) ? 1 : strength < STR18(100) ? 2 : 3;
    if ((state.u.ulevel ?? 1) < 3) bonus++;
    return bonus + (dexterity < 4 ? -3 : dexterity < 6 ? -2
        : dexterity < 8 ? -1 : dexterity < 14 ? 0 : dexterity - 14);
}

// Part of C weapon.c:dbon(): the human Strength damage ladder.
// Strength values above 18 retain NetHack's internal encoding (19 == 18/01,
// 93 == 18/75, 118 == 18/**), matching botl.js:formatStrength.
export function strengthDamageBonus(strength: number): number {
    if (strength < 6) return -1;
    if (strength < 16) return 0;
    if (strength < 18) return 1;
    if (strength === 18) return 2;
    if (strength <= 93) return 3;
    if (strength <= 108) return 4;
    if (strength < 118) return 5;
    return 6;
}

// C weapon.c:dbon(). Monster forms do not use the human Strength score.
export function heroStrengthDamageBonus(state: GameState): number {
    return Upolyd(state?.u)
        ? 0 : strengthDamageBonus(currentAttribute(A_STR, state));
}

interface TowelChangeOptions {
    state?: GameState;
    verbose?: boolean;
    publish?: MessagePublisher | null;
}

// C weapon.c:finish_towel_change().
function finishTowelChange(object: GameObject, wetness: number, state: GameState): void {
    object.spe = Math.max(0, Math.min(7, wetness));
    if (object === state.uwep || object === state.u.uwep) state._unweapon = !isWetTowel(object);
}

// C weapon.c:wet_a_towel().
export async function wetTowel(
    object: GameObject, amount: number,
    { state = game, verbose = false, publish = pline }: TowelChangeOptions = {},
): Promise<void> {
    const wetness = amount <= 0 ? object.spe - amount : amount;
    if (wetness > object.spe && verbose && publish) {
        const adjective = wetness < 3 ? object.spe ? 'damper' : 'damp'
            : object.spe ? 'wetter' : 'wet';
        await reportTowelChange(object, `gets ${adjective}.`, state, publish);
    }
    if (wetness !== object.spe) finishTowelChange(object, wetness, state);
}

// C weapon.c:dry_a_towel().
export async function dryTowel(
    object: GameObject, amount: number,
    { state = game, verbose = false, publish = pline }: TowelChangeOptions = {},
): Promise<void> {
    const wetness = amount < 0 ? object.spe + amount : amount;
    if (wetness < object.spe && verbose && publish)
        await reportTowelChange(object, `dries${wetness ? '' : ' out'}.`, state, publish);
    if (wetness !== object.spe) finishTowelChange(object, wetness, state);
}

// Part of C weapon.c:wet_a_towel(), weapon.c:dry_a_towel(): report a carried towel's wetness change.
// wet_a_towel/dry_a_towel share the carried-or-monster report.
async function reportTowelChange(
    object: GameObject, change: string, state: GameState, publish: MessagePublisher,
): Promise<void> {
    if (object.where === 'inventory') {
        await publish(`${ownedObjectName(object, state, { includeQuantity: true })} ${change}`);
    } else if (object.where === 'minvent' && object.ocarry && canSeeMonster(object.ocarry)) {
        const owner = possessiveName(monsterName(object.ocarry, { state, capitalized: true }));
        await publish(`${owner} ${objectName(object, state)} ${change}`);
    }
}

// C weapon.c:skill_name(): P_NAME(skill), with weapon.c's
// barehands_or_martial[martial_bonus()] for the martial-arts roles.
export function skillName(skill: number, state: GameState = game): string {
    if (skill === 35
        && (state.urole?.key === 'monk' || state.urole?.key === 'samurai')) {
        return 'martial arts';
    }
    const name = SKILL_NAMES[skill];
    if (name === undefined) throw new RangeError(`Hero skill ${skill} has no name`);
    return name;
}

// C weapon.c:slots_required().
function slotsRequiredToAdvance(skill: number, level: number): number {
    if (skill <= 27 || skill === 36) return level;
    return Math.trunc((level + 1) / 2);
}

// C weapon.c:can_advance().
export function canAdvanceHeroSkill(skill: number, { state = game, speedy = false }: { state?: GameState; speedy?: boolean } = {}): boolean {
    const proficiency = ensureHeroSkills(state)?.[skill];
    if (!proficiency || proficiency.skill === P_ISRESTRICTED
        || proficiency.skill >= proficiency.maxSkill
        || (state.u.skillRecord?.length || 0) >= P_SKILL_LIMIT) return false;
    if (state.flags.debug && speedy) return true;
    return proficiency.advance >= practiceNeededToAdvance(proficiency.skill)
        && (state.u.weapon_slots || 0) >= slotsRequiredToAdvance(skill, proficiency.skill);
}

// C weapon.c:could_advance().
function couldAdvanceSkill(skill: number, state: GameState): boolean {
    const proficiency = state.u.weaponSkills?.[skill];
    return !!proficiency && proficiency.skill !== P_ISRESTRICTED && proficiency.skill < proficiency.maxSkill
        && (state.u.skillRecord?.length || 0) < P_SKILL_LIMIT
        && proficiency.advance >= practiceNeededToAdvance(proficiency.skill);
}

// C weapon.c:peaked_skill().
function skillHasPeaked(skill: number, state: GameState): boolean {
    const proficiency = state.u.weaponSkills?.[skill];
    return !!proficiency && proficiency.skill !== P_ISRESTRICTED && proficiency.skill >= proficiency.maxSkill
        && proficiency.advance >= practiceNeededToAdvance(proficiency.skill);
}

// C weapon.c:skill_advance(), reached only through a selectable #enhance entry.
export async function advanceHeroSkill(state: GameState, skill: number, { speedy = false }: { speedy?: boolean } = {}): Promise<HeroSkill | null> {
    requireLiveGame(state);
    if (!canAdvanceHeroSkill(skill, { state, speedy })) return null;
    const proficiency = requiredSkill(initializedSkills(state), skill);
    state.u.weapon_slots = (state.u.weapon_slots || 0)
        - slotsRequiredToAdvance(skill, proficiency.skill);
    proficiency.skill++;
    (state.u.skillRecord ||= []).push(skill);
    const degree = proficiency.skill >= proficiency.maxSkill ? 'most' : 'more';
    await plineWithContinuation(`You are now ${degree} skilled in ${skillName(skill, state)}.`);
    if (skill >= P_FIRST_SPELL && skill <= P_LAST_SPELL)
        identifySpellbooks(state);
    return proficiency;
}

// Port only: require an initialized hero skill entry.
// C skills.h P_SKILL/P_MAX_SKILL with the port's initialized-skill check.
export function requiredSkill(skills: readonly HeroSkill[], skill: number): HeroSkill {
    const proficiency = skills[skill];
    if (!proficiency) throw new RangeError(`Hero skill ${skill} is missing`);
    return proficiency;
}

// Port only: require initialized hero skills for the current role.
export function initializedSkills(state: GameState): HeroSkill[] {
    const skills = ensureHeroSkills(state);
    if (!skills) throw new Error('Hero skills require an initialized role');
    return skills;
}

// C weapon.c:add_skills_to_menu(): the skill rows and their "*"/"#"
// annotations. Also emits enhance_weapon_skill()'s legend counts.
function enhancementMenu(speedy: boolean, state: GameState): { items: InventoryMenuItem<number>[]; available: number } {
    const skills = initializedSkills(state);
    const available = skills.filter((_proficiency, skill) =>
        canAdvanceHeroSkill(skill, { state, speedy })).length;
    const waiting = skills.filter((_proficiency, skill) =>
        !canAdvanceHeroSkill(skill, { state, speedy }) && couldAdvanceSkill(skill, state)).length;
    const peaked = skills.filter((_proficiency, skill) =>
        !canAdvanceHeroSkill(skill, { state, speedy }) && !couldAdvanceSkill(skill, state)
        && skillHasPeaked(skill, state)).length;
    const marked = available + waiting + peaked > 0;
    const items: InventoryMenuItem<number>[] = [];
    if (waiting) {
        const heroLevel = state.u.ulevel;
        if (heroLevel === undefined) throw new Error('Skill advancement requires the hero experience level');
        const when = heroLevel < MAXULEV ? "when you're more experienced"
            : 'if skill slots become available';
        items.push({ text: `(Skill${waiting === 1 ? '' : 's'} flagged by "*" may be enhanced ${when}.)` });
    }
    if (peaked) items.push({ text: `(Skill${peaked === 1 ? '' : 's'} flagged by "#" cannot be enhanced any further.)` });
    if (waiting || peaked) items.push({ text: '' });
    const longest = Math.max(...skills.map((proficiency, skill) =>
        proficiency.skill ? skillName(skill, state).length : 0));
    for (const group of SKILL_GROUPS) {
        // C weapon.c:add_skills_to_menu() emits the group heading through
        // add_menu_heading(), which skips menu coloring.
        items.push({ text: group.heading, attr: ATR_INVERSE, itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS });
        for (let skill = group.first; skill <= group.last; skill++) {
            const proficiency = requiredSkill(skills, skill);
            if (proficiency.skill === P_ISRESTRICTED) continue;
            const selectable = canAdvanceHeroSkill(skill, { state, speedy });
            const prefix = !marked || selectable ? '' : couldAdvanceSkill(skill, state) ? '  * '
                : skillHasPeaked(skill, state) ? '  # ' : '    ';
            const name = skillName(skill, state);
            const level = SKILL_LEVEL_NAMES[proficiency.skill];
            if (level === undefined) throw new RangeError(`Unknown proficiency level ${proficiency.skill}`);
            let text;
            if (state.flags.debug) {
                const practice = `${String(proficiency.advance).padStart(5)}(${String(practiceNeededToAdvance(proficiency.skill)).padStart(4)})`;
                text = state.iflags.menu_tab_sep ? ` ${prefix}${name}\t${level}\t${practice}`
                    : ` ${prefix}${name.padEnd(longest)} ${level.padEnd(12)} ${practice}`;
            } else {
                text = state.iflags.menu_tab_sep ? ` ${prefix}${name}\t[${level}]`
                    : ` ${prefix} ${name.padEnd(longest)} [${level}]`;
            }
            items.push(selectable ? { text, value: skill } : { text });
        }
    }
    return { items, available };
}

// C weapon.c:enhance_weapon_skill(): the #enhance extended command.
export async function doenhance() {
    game.context.tips = (game.context.tips || 0) | (1 << TIP_ENHANCE);
    let speedy = false;
    if (game.flags.debug) {
        await flushPendingTopline();
        speedy = await promptYesNo('Advance skills without practice?') === 'y';
    }
    game.context.move = 0;
    for (;;) {
        const { items, available } = enhancementMenu(speedy, game);
        let title = available ? 'Pick a skill to advance:' : 'Current skills:';
        if (game.flags.debug && !speedy) {
            const slots = game.u.weapon_slots || 0;
            title += `  (${slots} slot${slots === 1 ? '' : 's'} available)`;
        }
        const selection = await showInventoryWindow([{ items }], {
            title, pickMode: available ? PICK_ONE : PICK_NONE,
        });
        if (selection.value === undefined) return;
        await advanceHeroSkill(game, selection.value, { speedy });
        const more = initializedSkills(game).some((_proficiency, skill) =>
            canAdvanceHeroSkill(skill, { speedy }));
        if (!more) return;
        if (!speedy) {
            await plineWithContinuation(formatFeltMessage('you could be more dangerous!'));
            return;
        }
    }
}

// C weapon.c:unrestrict_weapon_skill().
export function unrestrictHeroSkill(type: number, state: GameState = game): void {
    const skill = ensureHeroSkills(state)?.[type];
    if (skill && skill.skill === 0) {
        skill.skill = 1;
        skill.maxSkill = 2;
        skill.advance = 0;
    }
}

// C weapon.c:use_skill(). Practice can accumulate at a role's ceiling;
// only the transition into eligibility produces advancement feedback.
export async function useHeroSkill(skill: number, degree = 1, { state = game }: { state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    const proficiency = ensureHeroSkills(state)?.[skill];
    if (skill === P_NONE || !proficiency || proficiency.skill === P_ISRESTRICTED) return;
    const wasEligible = canAdvanceHeroSkill(skill, { state });
    // Native P_ADVANCE is an unsigned short, including on very long games.
    proficiency.advance = (proficiency.advance + degree) & 0xffff;
    if (!wasEligible && canAdvanceHeroSkill(skill, { state }))
        await giveMayAdvanceMessage(skill, state);
}

// C weapon.c:add_weapon_skill(). Skill slots gained report a newly
// advanceable skill through give_may_advance_msg(P_NONE).
export async function addHeroWeaponSkillSlots(change: number, state: GameState = game): Promise<void> {
    const hero = state.u;
    if (!hero || !Number.isInteger(change) || change <= 0) return;
    if (hero.weapon_slots === undefined || !Number.isInteger(hero.weapon_slots)) hero.weapon_slots = 0;

    const skills = initializedSkills(state);
    const available = () => skills.filter((_proficiency, skill) =>
        canAdvanceHeroSkill(skill, { state })).length;
    const before = available();
    hero.weapon_slots += change;
    if (available() > before) await giveMayAdvanceMessage(P_NONE, state);
}

// C weapon.c:lose_weapon_skill(). Refunded slots can train another skill.
export async function loseHeroWeaponSkillSlots(change: number, state: GameState = game): Promise<void> {
    const hero = state.u;
    if (!hero || !Number.isInteger(change) || change <= 0) return;
    if (hero.weapon_slots === undefined || !Number.isInteger(hero.weapon_slots)) hero.weapon_slots = 0;

    const skills = ensureHeroSkills(state);
    const record = hero.skillRecord || (hero.skillRecord = []);
    for (let remaining = change; remaining > 0; remaining--) {
        if (hero.weapon_slots > 0) {
            hero.weapon_slots--;
            continue;
        }
        const skill = record.pop();
        if (skill === undefined) continue;
        const skillState = skills?.[skill];
        if (!skillState || skillState.skill <= 1) continue;
        skillState.skill--;
        hero.weapon_slots = slotsRequiredToAdvance(
            skill, skillState.skill,
        ) - 1;
    }
}

// C weapon.c:drain_weapon_skill(). Refunded slots can train another skill.
export async function drainHeroWeaponSkills(count: number, state: GameState = game): Promise<void> {
    const skills = initializedSkills(state);
    const record = state.u.skillRecord ||= [];
    const forgotten = new Set<number>();
    for (let remaining = count; remaining > 0 && record.length; remaining--) {
        const [skill] = record.splice(rn2(record.length), 1);
        if (skill === undefined) throw new Error('The drained skill record is missing');
        const proficiency = requiredSkill(skills, skill);
        if (proficiency.skill <= 1)
            throw new Error(`Cannot drain unadvanced skill ${skill}`);
        proficiency.skill--;
        state.u.weapon_slots = (state.u.weapon_slots || 0)
            + slotsRequiredToAdvance(skill, proficiency.skill);
        const current = practiceNeededToAdvance(proficiency.skill);
        const previous = practiceNeededToAdvance(proficiency.skill - 1);
        if (proficiency.advance >= current)
            proficiency.advance = previous + rn2(current - previous);
        forgotten.add(skill);
    }
    for (const skill of [...forgotten].sort((left, right) => left - right)) {
        const amount = requiredSkill(skills, skill).skill >= P_BASIC ? 'some of ' : '';
        await plineWithContinuation(`You forget ${amount}your training in ${skillName(skill, state)}.`);
    }
}

// C weapon.c:weapon_type().
export function weaponSkillType(weapon: GameObject | null): number {
    if (!weapon) return P_BARE_HANDED_COMBAT;
    if (![WEAPON_CLASS, TOOL_CLASS, GEM_CLASS].includes(weapon.oclass)) return P_NONE;
    const skill = objectSkill(weapon.otyp);
    return Math.abs(skill);
}

// C weapon.c:uwep_skill_type(). Dual wielding uses the two-weapon skill;
// otherwise the wielded item's own class decides (apply.c:calc_pole_range()
// and hack.c read the hero's reach through this).
export function uwepSkillType(weapon: GameObject | null, state: GameState): number {
    if (state.u?.twoweap) return P_TWO_WEAPON_COMBAT;
    if (!weapon) return P_NONE;
    if (
        weapon.oclass !== WEAPON_CLASS &&
        weapon.oclass !== TOOL_CLASS &&
        weapon.oclass !== GEM_CLASS
    )
        return P_NONE;
    return Math.abs(objectSkill(weapon.otyp));
}

// Part of C weapon.c:weapon_hit_bonus(), weapon.c:weapon_dam_bonus(): choose two-weapon or ordinary attack skill.
// weapon_hit_bonus and weapon_dam_bonus share the attack-skill choice:
// two-weapon skill only when attacking with a wielded weapon.
function attackSkillType(weapon: GameObject | null, state: GameState): number {
    return state.u.twoweap && weapon !== null
        && (weapon === (state.uwep || state.u.uwep)
            || weapon === (state.uswapwep || state.u.uswapwep))
        ? P_TWO_WEAPON_COMBAT : weaponSkillType(weapon);
}

// Port only: read a validated proficiency from initialized hero skills.
// C skills.h P_SKILL: the skill's current proficiency level.
function proficiency(skill: number, state: GameState): number {
    const entry = ensureHeroSkills(state)?.[skill];
    if (!entry) throw new Error(`Hero combat requires initialized skill ${skill}`);
    return entry.skill;
}

// C you.h:martial_bonus(): the Monk and Samurai martial-arts roles.
function usesMartialArts(state: GameState): boolean {
    return state.urole?.key === 'monk' || state.urole?.key === 'samurai';
}

// C weapon.c:weapon_hit_bonus().
export function weaponSkillHitBonus(weapon: GameObject | null, state: GameState = game): number {
    const weaponSkill = weaponSkillType(weapon);
    const skill = attackSkillType(weapon, state);
    let bonus = 0;
    if (skill !== P_NONE && skill <= P_LAST_WEAPON) {
        const level = proficiency(skill, state);
        bonus = level <= P_UNSKILLED ? -4 : level === P_BASIC ? 0
            : level === P_SKILLED ? 2 : level === P_EXPERT ? 3 : -4;
    } else if (skill === P_TWO_WEAPON_COMBAT) {
        const level = Math.min(proficiency(skill, state), proficiency(weaponSkill, state));
        bonus = level <= P_UNSKILLED ? -9 : level === P_BASIC ? -7
            : level === P_SKILLED ? -5 : level === P_EXPERT ? -3 : -9;
    } else if (skill === P_BARE_HANDED_COMBAT) {
        const level = Math.max(proficiency(skill, state), P_UNSKILLED);
        bonus = Math.trunc((level + 1) * (usesMartialArts(state) ? 2 : 1) / 2);
    }
    if (state.u.usteed) {
        const riding = proficiency(P_RIDING, state);
        if (riding <= P_UNSKILLED) bonus -= 2;
        else if (riding === P_BASIC) bonus--;
        if (state.u.twoweap) bonus -= 2;
    }
    return bonus;
}

// C weapon.c:weapon_dam_bonus().
export function weaponSkillDamageBonus(weapon: GameObject | null, state: GameState = game): number {
    const weaponSkill = weaponSkillType(weapon);
    const skill = attackSkillType(weapon, state);
    let bonus = 0;
    if (skill !== P_NONE && skill <= P_LAST_WEAPON) {
        const level = proficiency(skill, state);
        bonus = level <= P_UNSKILLED ? -2 : level === P_BASIC ? 0
            : level === P_SKILLED ? 1 : level === P_EXPERT ? 2 : -2;
    } else if (skill === P_TWO_WEAPON_COMBAT) {
        const level = Math.min(proficiency(skill, state), proficiency(weaponSkill, state));
        bonus = level <= P_UNSKILLED ? -3 : level === P_BASIC ? -1
            : level === P_SKILLED ? 0 : level === P_EXPERT ? 1 : -3;
    } else if (skill === P_BARE_HANDED_COMBAT) {
        const level = Math.max(proficiency(skill, state), P_UNSKILLED);
        bonus = Math.trunc(level * (usesMartialArts(state) ? 3 : 1) / 2);
    }
    if (state.u.usteed && skill !== P_TWO_WEAPON_COMBAT) {
        const riding = proficiency(P_RIDING, state);
        if (riding === P_SKILLED) bonus++;
        else if (riding === P_EXPERT) bonus += 2;
    }
    return bonus;
}

// C weapon.c:skill_init().
// Also C u_init.c:pauper_reinit(): inlined here for skill resets and two free slots.
export function ensureHeroSkills(game: GameState): HeroSkill[] | null {
    if (game.u.weaponSkills) return game.u.weaponSkills;
    const maximums = roleMaximums(game);
    if (!maximums) return null;

    const skills: HeroSkill[] = Array.from({ length: SKILL_NAMES.length }, () => ({
        skill: 0, maxSkill: 0, advance: 0,
    }));
    for (const [skill, maxSkill] of maximums) {
        const proficiency = requiredSkill(skills, skill);
        proficiency.skill = 1;
        proficiency.maxSkill = maxSkill;
    }

    const startingMagic = game.urole ? ROLE_STARTING_MAGIC_SKILLS[game.urole.key] ?? [] : [];
    for (const skill of startingMagic) {
        const proficiency = requiredSkill(skills, skill);
        proficiency.skill = Math.max(proficiency.skill, 2);
    }

    // skill_init() observes the startup inventory once.  weapon_type()
    // accepts weapons, weapon-tools, and gems, then normalizes negative
    // missile skills; is_ammo() excludes only launcher ammunition
    // (bow/sling/crossbow), not darts, shuriken, or boomerangs.
    for (const item of game.inventory || []) {
        if (!item._startingInventory) continue;
        if (![WEAPON_CLASS, TOOL_CLASS, GEM_CLASS].includes(item.oclass)) continue;
        const subtype = objectSkill(item.otyp);
        if (!Number.isInteger(subtype) || subtype === 0) continue;
        const skill = Math.abs(subtype);
        if (subtype < 0 && skill >= 20 && skill <= 22) continue;
        const proficiency = skills[skill];
        if (!proficiency?.maxSkill) continue;
        proficiency.skill = Math.max(proficiency.skill, 2);
    }
    // High-potential fighters begin Basic in unarmed/martial combat.
    const unarmed = requiredSkill(skills, 35);
    if (unarmed.maxSkill > 4) unarmed.skill = 2;
    // Knight's starting pony grants Basic riding.
    const riding = requiredSkill(skills, 37);
    if (game.urole?.key === 'knight' && riding.maxSkill) riding.skill = 2;

    // u_init.c:pauper_reinit() removes every initially Basic-or-better
    // proficiency while retaining the role's advancement ceiling.
    if (game.u?.uroleplay?.pauper) {
        for (const state of skills) {
            if (state.skill > 1) {
                state.skill = 1;
                state.advance = 0;
            }
        }
        game.u.weapon_slots = 2;
    }

    for (const state of skills.slice(1)) {
        if (!state.skill) continue;
        state.advance = practiceNeededToAdvance(state.skill - 1);
    }
    game.u.weaponSkills = skills;
    game.u.skillRecord = [];
    if (!game.u.uroleplay?.pauper) identifySpellbooks(game);
    return skills;
}
