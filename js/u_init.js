// u_init.js — Initial hero, pet, inventory, and attribute setup.
// C refs: u_init.c, attrib.c, dog.c, teleport.c, makemon.c.
import { RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, } from './objclass.js';
import { objectSkill, objectUsesKnown, objectMagic, objectCharged, AKLYS, ARROW, CROSSBOW_BOLT, YA, DART, DAGGER, SCALPEL, SPEAR, AXE, BATTLE_AXE, SHORT_SWORD, LONG_SWORD, TWO_HANDED_SWORD, KATANA, LANCE, MACE, CLUB, QUARTERSTAFF, BULLWHIP, BOW, CROSSBOW, YUMI, SLING, HELMET, FEDORA, SPLINT_MAIL, RING_MAIL, LEATHER_ARMOR, LEATHER_JACKET, LEATHER_GLOVES, ROBE, SMALL_SHIELD, HAWAIIAN_SHIRT, CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE, LARGE_BOX, BAG_OF_TRICKS, SACK, CORPSE, STATUE, LOCK_PICK, CREDIT_CARD, EXPENSIVE_CAMERA, TOWEL, LEASH, STETHOSCOPE, TIN_OPENER, MAGIC_MARKER, BLINDFOLD, OIL_LAMP, PICK_AXE, TINNING_KIT, WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP, BELL, BUGLE, LEATHER_DRUM, CRAM_RATION, FOOD_RATION, TRIPE_RATION, TIN, EUCALYPTUS_LEAF, APPLE, ORANGE, PEAR, MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, SLIME_MOLD, CREAM_PIE, CANDY_BAR, FORTUNE_COOKIE, PANCAKE, LEMBAS_WAFER, POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_SICKNESS, POT_OIL, POT_WATER, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SPE_DETECT_MONSTERS, SPE_HEALING, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER, SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, SPE_PROTECTION, WAN_SLEEP, WAN_WISHING, GOLD_PIECE, AMULET_OF_YENDOR, TOUCHSTONE, FLINT, ROCK, OBJECT_NAMES, OBJECT_DESCRIPTIONS, OBJECT_BASES, OBJECT_SPELL_LEVEL, OBJECT_SPELL_CATEGORY, ELVEN_SHORT_SWORD, ELVEN_ARROW, ELVEN_BOW, ELVEN_SPEAR, ELVEN_DAGGER, ELVEN_BROADSWORD, ELVEN_MITHRIL_COAT, ELVEN_LEATHER_HELM, ELVEN_SHIELD, ELVEN_BOOTS, ELVEN_CLOAK, ORCISH_ARROW, ORCISH_SPEAR, ORCISH_DAGGER, ORCISH_SHORT_SWORD, ORCISH_BOW, ORCISH_HELM, ORCISH_CHAIN_MAIL, ORCISH_RING_MAIL, ORCISH_CLOAK, URUK_HAI_SHIELD, ORCISH_SHIELD, DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_MATTOCK, DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT, DWARVISH_CLOAK, DWARVISH_ROUNDSHIELD, CHAIN_MAIL, RIN_LEVITATION, RIN_HUNGER, RIN_AGGRAVATE_MONSTER, RIN_POISON_RESISTANCE, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL, POT_POLYMORPH, WAN_POLYMORPH, SPE_POLYMORPH, SPE_BLANK_PAPER, SPE_NOVEL, WAN_NOTHING, POT_HALLUCINATION, POT_ACID, SCR_AMNESIA, SCR_FIRE, SCR_BLANK_PAPER, SCR_ENCHANT_WEAPON, } from './object_data.js';
import { game } from './gstate.js';
import { createHeroState } from './hero_types.js';
import { isGrayStone } from './object_properties.js';
import { useUpInventoryStack, addCreatedInventoryItem } from './invent.js';
import { useStartingItem } from './starting_equipment.js';
import { japaneseItemName } from './objnam.js';
import { setHeroSpecies } from './polyself.js';
import { seeMonsterCloseup } from './mon.js';
import { setMonsterGivenName } from './do_name.js';
import { impossible } from './diagnostics.js';
import { setMonsterMalign } from './makemon.js';
import { rn2, rnd, d, rne } from './rng.js';
import { enexto_gpflags } from './teleport.js';
import { mkobj, mksobj, deallocateObject } from './mkobj.js';
import { MONSTER_MOVE, MONSTER_NAME, SPECIAL_PM } from './monster_data.js';
import { findArmorClass } from './do_wear.js';
import { ensureQuestStatus } from './quest.js';
import { GP_AVOID_MONPOS, A_CHA, A_CHAOTIC, A_CON, A_STR, COLNO, ROWNO, NOT_HUNGRY, } from './const.js';
import { recordObjectEncounter, recordObjectKnowledge } from './o_init.js';
import { ensureHeroSkills, roleAllowsSpellbook } from './skills.js';
import { hiddenGold } from './vault.js';
import { addHeroGoldObject, setHeroGoldAmount } from './hero_gold.js';
import { syncBlindness, syncDeafness } from './senses.js';
import { putSaddleOnMonster } from './steed.js';
import { grantIntrinsicProperty } from './properties.js';
import { ROLE_LEVEL_ABILITIES, RACE_LEVEL_ABILITIES } from './innate_abilities.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './wield.js';
import { newMonsterHitPoints } from './makemon.js';
import { invWeight } from './hack.js';
import { objectWeight, nextIdent } from './mkobj.js';
const ATTRIBUTE_INDICES = [0, 1, 2, 3, 4, 5];
const UNDEF_BLESS = 2;
const UNDEF_TYP = -1;
const UNDEF_SPE = null;
// C u_init.c inv_subs[].  These numeric object identities come from the
// configured objects.h table; substitution happens before inventory linking
// so presentation, equipment, and combat all observe the same concrete type.
const INITIAL_RACE_SUBSTITUTIONS = new Map([
    [1, new Map([
            [DAGGER, ELVEN_DAGGER], [SPEAR, ELVEN_SPEAR],
            [SHORT_SWORD, ELVEN_SHORT_SWORD], [BOW, ELVEN_BOW],
            [ARROW, ELVEN_ARROW], [HELMET, ELVEN_LEATHER_HELM],
            [CLOAK_OF_DISPLACEMENT, ELVEN_CLOAK],
            [CRAM_RATION, LEMBAS_WAFER],
        ])],
    [4, new Map([
            [DAGGER, ORCISH_DAGGER], [SPEAR, ORCISH_SPEAR],
            [SHORT_SWORD, ORCISH_SHORT_SWORD], [BOW, ORCISH_BOW],
            [ARROW, ORCISH_ARROW], [HELMET, ORCISH_HELM],
            [SMALL_SHIELD, ORCISH_SHIELD],
            [RING_MAIL, ORCISH_RING_MAIL], [CHAIN_MAIL, ORCISH_CHAIN_MAIL],
            [CRAM_RATION, TRIPE_RATION], [LEMBAS_WAFER, TRIPE_RATION],
        ])],
    [2, new Map([
            [SPEAR, DWARVISH_SPEAR],
            [SHORT_SWORD, DWARVISH_SHORT_SWORD],
            [HELMET, DWARVISH_IRON_HELM],
            [LEMBAS_WAFER, CRAM_RATION],
        ])],
    [3, new Map([
            [BOW, CROSSBOW], [ARROW, CROSSBOW_BOLT],
        ])],
]);
const ARCHEOLOGIST_INVENTORY = [
    { typ: BULLWHIP, spe: 2, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: LEATHER_JACKET, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FEDORA, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 3, max: 3, bless: 0 },
    { typ: PICK_AXE, spe: UNDEF_SPE, cls: TOOL_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: TINNING_KIT, spe: UNDEF_SPE, cls: TOOL_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: TOUCHSTONE, spe: 0, cls: GEM_CLASS, min: 1, max: 1, bless: 0 },
    { typ: SACK, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const BARBARIAN_SWORD_INVENTORY = [
    { typ: TWO_HANDED_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: AXE, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: RING_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const BARBARIAN_AXE_INVENTORY = [
    { typ: BATTLE_AXE, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: RING_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const RANGER_INVENTORY = [
    { typ: DAGGER, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: BOW, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: ARROW, spe: 2, cls: WEAPON_CLASS, min: 50, max: 59, bless: UNDEF_BLESS },
    { typ: ARROW, spe: 0, cls: WEAPON_CLASS, min: 30, max: 39, bless: UNDEF_BLESS },
    { typ: CLOAK_OF_DISPLACEMENT, spe: 2, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: CRAM_RATION, spe: 0, cls: FOOD_CLASS, min: 4, max: 4, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const TOURIST_INVENTORY = [
    { typ: DART, spe: 2, cls: WEAPON_CLASS, min: 21, max: 40, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: FOOD_CLASS, min: 10, max: 10, bless: 0 },
    { typ: POT_EXTRA_HEALING, spe: 0, cls: POTION_CLASS, min: 2, max: 2, bless: UNDEF_BLESS },
    { typ: SCR_MAGIC_MAPPING, spe: 0, cls: SCROLL_CLASS, min: 4, max: 4, bless: UNDEF_BLESS },
    { typ: HAWAIIAN_SHIRT, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: EXPENSIVE_CAMERA, spe: UNDEF_SPE, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: CREDIT_CARD, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const CAVEMAN_INVENTORY = [
    { typ: CLUB, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SLING, spe: 2, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FLINT, spe: 0, cls: GEM_CLASS, min: 10, max: 20, bless: UNDEF_BLESS },
    { typ: ROCK, spe: 0, cls: GEM_CLASS, min: 3, max: 3, bless: 0 },
    { typ: LEATHER_ARMOR, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const ROGUE_INVENTORY = [
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: DAGGER, spe: 0, cls: WEAPON_CLASS, min: 6, max: 15, bless: 0 },
    { typ: LEATHER_ARMOR, spe: 1, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: POT_SICKNESS, spe: 0, cls: POTION_CLASS, min: 1, max: 1, bless: 0 },
    { typ: LOCK_PICK, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: SACK, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const SAMURAI_INVENTORY = [
    { typ: KATANA, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: YUMI, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: YA, spe: 0, cls: WEAPON_CLASS, min: 26, max: 45, bless: UNDEF_BLESS },
    { typ: SPLINT_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const VALKYRIE_INVENTORY = [
    { typ: SPEAR, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: DAGGER, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SMALL_SHIELD, spe: 3, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const PRIEST_INVENTORY = [
    { typ: MACE, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: 1 },
    { typ: ROBE, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SMALL_SHIELD, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: POT_WATER, spe: 0, cls: POTION_CLASS, min: 4, max: 4, bless: 1 },
    { typ: CLOVE_OF_GARLIC, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: SPRIG_OF_WOLFSBANE, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: SPBOOK_CLASS, min: 2, max: 2, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const HEALER_INVENTORY = [
    { typ: SCALPEL, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: LEATHER_GLOVES, spe: 1, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: STETHOSCOPE, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: POT_HEALING, spe: 0, cls: POTION_CLASS, min: 4, max: 4, bless: UNDEF_BLESS },
    { typ: POT_EXTRA_HEALING, spe: 0, cls: POTION_CLASS, min: 4, max: 4, bless: UNDEF_BLESS },
    { typ: WAN_SLEEP, spe: UNDEF_SPE, cls: WAND_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SPE_HEALING, spe: 0, cls: SPBOOK_CLASS, min: 1, max: 1, bless: 1 },
    { typ: SPE_EXTRA_HEALING, spe: 0, cls: SPBOOK_CLASS, min: 1, max: 1, bless: 1 },
    { typ: SPE_STONE_TO_FLESH, spe: 0, cls: SPBOOK_CLASS, min: 1, max: 1, bless: 1 },
    { typ: APPLE, spe: 0, cls: FOOD_CLASS, min: 5, max: 5, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const KNIGHT_INVENTORY = [
    { typ: LONG_SWORD, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: LANCE, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: RING_MAIL, spe: 1, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: HELMET, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SMALL_SHIELD, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: LEATHER_GLOVES, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: APPLE, spe: 0, cls: FOOD_CLASS, min: 10, max: 10, bless: 0 },
    { typ: CARROT, spe: 0, cls: FOOD_CLASS, min: 10, max: 10, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const MONK_INVENTORY = [
    { typ: LEATHER_GLOVES, spe: 2, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: ROBE, spe: 1, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: SCROLL_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: POT_HEALING, spe: 0, cls: POTION_CLASS, min: 3, max: 3, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 3, max: 3, bless: 0 },
    { typ: APPLE, spe: 0, cls: FOOD_CLASS, min: 5, max: 5, bless: UNDEF_BLESS },
    { typ: ORANGE, spe: 0, cls: FOOD_CLASS, min: 5, max: 5, bless: UNDEF_BLESS },
    { typ: FORTUNE_COOKIE, spe: 0, cls: FOOD_CLASS, min: 3, max: 3, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const WIZARD_INVENTORY = [
    { typ: QUARTERSTAFF, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: 1 },
    { typ: CLOAK_OF_MAGIC_RESISTANCE, spe: 0, cls: ARMOR_CLASS,
        min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: WAND_CLASS,
        min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: RING_CLASS,
        min: 2, max: 2, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: POTION_CLASS,
        min: 3, max: 3, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: SCROLL_CLASS,
        min: 3, max: 3, bless: UNDEF_BLESS },
    { typ: SPE_FORCE_BOLT, spe: 0, cls: SPBOOK_CLASS,
        min: 1, max: 1, bless: 1 },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: SPBOOK_CLASS,
        min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: MAGIC_MARKER, spe: 19, cls: TOOL_CLASS,
        min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
function oneItem(typ, spe = 0) {
    return [
        { typ, spe, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
        { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
    ];
}
function initialRoll(adv) {
    if (!adv)
        return 0;
    return (adv.infix || 0) + (adv.inrnd > 0 ? rnd(adv.inrnd) : 0);
}
// C u_init_misc(): establish the role body before any polymorph can occur.
export function initializeHeroSpecies(state = game) {
    const hero = state.u;
    if (!state.urole)
        throw new Error('Hero role must be selected before species initialization');
    // The compact role table numbers roles from zero; their monster records
    // follow LONG_WORM_TAIL in the generated NetHack monster table.
    hero.umonster = SPECIAL_PM + 1 + state.urole.mnum;
    hero.ulycn = -1;
    hero.mh = hero.mhmax = hero.mtimedone = 0;
    setHeroSpecies(hero.umonster, state);
}
// C u_init.c/u_init_misc() and hack.c:move_update().
export function initializeHeroRoomMembership(state) {
    const hero = state.u;
    hero.urooms = [];
    hero.urooms0 = [];
    hero.uentered = [];
    hero.ushops = [];
    hero.ushops0 = [];
    hero.ushops_entered = [];
    hero.ushops_left = [];
    state._emptyShops = [];
}
// The caller supplies the handedness roll from pre-level initialization.
export function uInitMisc(handednessRoll) {
    const g = game;
    const roleplay = g.u.uroleplay;
    // C clears all of u, including old timeouts, before restoring conduct
    // options. A partially restored hero must not affect the new character.
    g.u = createHeroState();
    const u = g.u;
    g.flags.beginner = true;
    u._propertySources = {};
    u.uhave = {};
    u.uconduct = {};
    initializeHeroRoomMembership(g);
    initializeHeroSpecies(g);
    const hp = initialRoll(g.urole?.hpadv) + initialRoll(g.urace?.hpadv);
    const pw = initialRoll(g.urole?.enadv) + (g._initialPwBonus || 0)
        + initialRoll(g.urace?.enadv);
    u.uz = { dnum: 0, dlevel: 1 };
    u.uz0 = { dnum: 0, dlevel: 0 };
    u.utolev = { ...u.uz };
    u.umortality = 0;
    u.ugrave_arise = -1;
    u.ulevel = u.ulevelmax = 1;
    u.ulevelpeak = 0;
    u.uhp = u.uhpmax = u.uhppeak = hp;
    u.uen = u.uenmax = u.uenpeak = pw;
    // C u_init_misc() calls newhp()/newpw() while ulevel is zero.  Those
    // helpers retain the initial rolls at slot zero so newman() can remove
    // the old body's complete level-based contribution before rebuilding it.
    u.uhpinc = Array.from({ length: 30 }, () => 0);
    u.ueninc = Array.from({ length: 30 }, () => 0);
    u.uhpinc[0] = hp;
    u.ueninc[0] = pw;
    u.uexp = 0;
    u.urexp = 0;
    u.uhunger = 900;
    u.uhs = NOT_HUNGRY;
    // C u_init_misc(): prayer starts on its own 300-turn cooldown.  Wishes,
    // prayer outcomes, and once-per-turn decay all compose with this value;
    // it is not a disclosure-only default.
    u.ublesscnt = 300;
    u.uac = 0; // ini_inv_skills_discoveries() computes starting AC.
    u.ualign = {
        type: g.initAlignment?.value ?? 0,
        record: g.urole?.initrecord || 0,
    };
    // C keeps converted/current and original alignment bases separately from
    // the live alignment record.  Quest readiness consumes all three.
    u.ualignbase = [u.ualign.type, u.ualign.type];
    const configuredNudist = Object.prototype.hasOwnProperty.call(g.flags || {}, 'nudist');
    u.uroleplay = roleplay ?? {
        pauper: !!g.flags?.pauper,
        nudist: configuredNudist
            ? !!g.flags.nudist : !!g.flags?.pauper,
        reroll: !!g.flags?.reroll,
        numrerolls: 0,
        numbones: 0,
        blind: !!g.flags?.blind,
        deaf: !!g.flags?.deaf,
    };
    ensureQuestStatus(g);
    u.rightHanded = !!handednessRoll;
    u.umovement = 0; // moveloop_preamble() grants the first movement ration.
    const roleAbilities = g.urole ? ROLE_LEVEL_ABILITIES[g.urole.key] : [];
    // adjabil() grants racial bits only to elves and orcs. Dwarves and
    // gnomes retain set_uasmon()'s current-body infravision instead.
    const raceAbilities = g.urace && (g.urace.name === 'elf' || g.urace.name === 'orc')
        ? RACE_LEVEL_ABILITIES[g.urace.name] ?? [] : [];
    for (const [origin, abilities] of [['role', roleAbilities], ['race', raceAbilities]]) {
        for (const [level, property] of abilities) {
            if (level !== 1)
                continue;
            grantIntrinsicProperty(property, origin, g);
            // Level-one abilities survive level loss and already count as
            // FROMOUTSIDE when a corpse or divine gift tries to grant them.
            grantIntrinsicProperty(property, 'outside', g);
        }
    }
    u.nv_range = 1;
    u.xray_range = -1;
    u.unblind_telepat_range = -1;
    // OPTIONS:blind installs a permanent intrinsic source.  Keep that source
    // distinct from the conduct bit so the Eyes of the Overworld can void
    // the conduct without curing the underlying blindness.
    u.permaBlind = !!u.uroleplay.blind;
    u.blindTurns = 0;
    u.deafTurns = 0;
    syncBlindness(g);
    syncDeafness(g);
    setHeroGoldAmount(g, 0);
    g.inventory = [];
    g._lastInvNr = 51;
    g.spells = [];
}
const DEFAULT_DOG_NAMES = {
    caveman: 'Slasher',
    ranger: 'Sirius',
    samurai: 'Hachi',
    barbarian: 'Idefix',
};
// C ref: dog.c makedog() and pet_type().
export async function makedog() {
    const g = game;
    if (g.preferred_pet === 'n') {
        g.context.startingpet_typ = -1;
        return null;
    }
    const role = g.urole?.key;
    if (role !== 'archeologist' && role !== 'barbarian'
        && role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk' && role !== 'wizard')
        return null;
    if (!g.level)
        throw new Error('Starting pet needs an initialized level');
    let pettype = g.urole?.petnum;
    if (pettype == null || pettype < 0) {
        if (g.preferred_pet === 'c')
            pettype = 32; // PM_KITTEN
        else if (g.preferred_pet === 'd')
            pettype = 16; // PM_LITTLE_DOG
        else
            pettype = rn2(2) ? 32 : 16;
    }
    g.context.startingpet_typ = pettype;
    // C makemon() places a monster made on the hero with enexto_core(),
    // first avoiding scary squares and only then accepting them.
    const spot = enexto_gpflags(pettype, g.u.ux, g.u.uy, GP_AVOID_MONPOS);
    if (!spot)
        return null;
    const monsterId = nextIdent();
    // C makemon() rolls the pet through newmonhp(): adj_lev() lowers dogs and
    // kittens to level one and the Knight's pony to level two, and an
    // all-ones roll gains a point.
    const { level, hp } = newMonsterHitPoints(pettype);
    const female = !!rn2(2);
    // Dogs, cats, and ponies are neutral. C's peace_minded() reaches its two
    // random branches only for a neutral hero, and the first denominator is
    // derived from the live alignment record rather than the role name.
    if ((g.initAlignment?.value ?? 0) === 0) {
        const record = g.u?.ualign?.record ?? 0;
        if (rn2(16 + Math.max(-15, record)))
            rn2(2); // 2 + abs(monster alignment), which is 0 here
    }
    const pet = {
        mnum: pettype, m_id: monsterId,
        mx: spot.x,
        my: spot.y,
        mhp: hp,
        mhpmax: hp,
        m_lev: level,
        female,
        mtame: 0,
        mpeaceful: 1,
        malign: 0,
        mcanmove: 1,
        mcansee: 1,
        mblinded: 0,
        movement: 0,
        mmove: MONSTER_MOVE[pettype] ?? 0,
        mspeed: 0,
        symbol: pettype === 100 ? 'u' : pettype === 32 ? 'f' : 'd',
        pet: true,
        mtrack: [],
        // C dog.c initedog(): initialize the pet's training and hunger state.
        edog: {
            droptime: 0,
            dropdist: 10000,
            // The pet is created before u_init_inventory_attrs(). At this
            // point C's ACURR(A_CHA) clamps the zeroed attribute to 3; the
            // finalized hero Charisma must not be read retroactively.
            apport: g.u?.acurr?.a?.[A_CHA] ?? 3,
            whistletime: 0,
            hungrytime: (g.moves ?? 0) + 1000,
            ogoal: { x: -1, y: -1 },
            abuse: 0,
            revivals: 0,
            mhpmax_penalty: 0,
            killed_by_u: 0,
        },
    };
    if (!g.level.monsters)
        g.level.monsters = [];
    g.level.monsters.push(pet);
    if (!g.context.startingpet_mid) {
        g.context.startingpet_mid = pet.m_id;
        if (pettype === MONSTER_NAME.indexOf('pony') && !g.u.uroleplay?.pauper)
            await putSaddleOnMonster(null, pet);
        g.bhitpos = { x: pet.mx, y: pet.my };
        g.notonhead = false;
        await seeMonsterCloseup(pet, { photo: g.inventory.some(object => object.otyp === EXPENSIVE_CAMERA) });
    }
    else {
        await impossible('makedog() when startingpet_mid is already non-zero?');
    }
    const name = pettype === MONSTER_NAME.indexOf('little dog')
        ? g.flags.dogname || DEFAULT_DOG_NAMES[role]
        : pettype === MONSTER_NAME.indexOf('kitten') ? g.flags.catname
            : pettype === MONSTER_NAME.indexOf('pony') ? g.flags.horsename : null;
    const petnameUsed = g.petname_used ?? 0;
    g.petname_used = petnameUsed + 1;
    if (!petnameUsed && name)
        setMonsterGivenName(pet, name);
    // C initedog() tames the pet after mpickobj() can forget an unseen saddle.
    pet.mtame = 10;
    setMonsterMalign(pet, g);
    if (!g.u.uconduct)
        g.u.uconduct = {};
    g.u.uconduct.pets = (g.u.uconduct.pets || 0) + 1;
    return pet;
}
function trquan(trobj) {
    if (!trobj.min)
        return 1;
    return trobj.min + rn2(trobj.max - trobj.min + 1);
}
// C ref: u_init.c knows_class().  Role preknowledge is installed before
// ini_inv_use_obj() records starting-inventory encounters, so discovery order
// within each class remains the object-table order followed by any exceptions
// such as the Knight's ordinary small shield.
function knowsClass(oclass, role) {
    const low = OBJECT_BASES[oclass];
    if (low === undefined)
        throw new RangeError(`Unknown object class ${oclass}`);
    const high = OBJECT_BASES[oclass + 1] || OBJECT_NAMES.length;
    const excludedArmor = new Set([
        OBJECT_NAMES.indexOf('cornuthaum'),
        OBJECT_NAMES.indexOf('dunce cap'),
        SMALL_SHIELD,
    ]);
    for (let otyp = low; otyp < high; otyp++) {
        if (objectMagic(otyp))
            continue;
        if (oclass === ARMOR_CLASS && excludedArmor.has(otyp))
            continue;
        if (oclass === WEAPON_CLASS) {
            const skill = objectSkill(otyp);
            if (['barbarian', 'valkyrie'].includes(role) && skill === 16)
                continue;
            if (role === 'ranger'
                && !([-20, -22, 17, 20, 21, 22].includes(skill)))
                continue;
            if (role === 'rogue' && skill !== 1)
                continue;
        }
        recordObjectKnowledge(otyp);
    }
}
// Also C u_init.c:u_init_role(): the role-specific discovery knowledge.
function initializeRolePreknowledge(role) {
    const pauper = !!game.u?.uroleplay?.pauper;
    if (role === 'archeologist') {
        // u_init_role() installs these before the later starting-inventory
        // encounter pass, so they are known rather than Ranger-style class
        // preknowledge inherited through a presentation fallback.
        if (!pauper) {
            recordObjectKnowledge(SACK);
            recordObjectKnowledge(TOUCHSTONE);
        }
    }
    if (!pauper && role === 'rogue')
        recordObjectKnowledge(SACK);
    if (!pauper
        && ['barbarian', 'knight', 'samurai', 'valkyrie'].includes(role))
        knowsClass(WEAPON_CLASS, role);
    else if (!pauper && (role === 'ranger' || role === 'rogue'))
        knowsClass(WEAPON_CLASS, role);
    if (!pauper
        && ['barbarian', 'knight', 'monk', 'samurai', 'valkyrie'].includes(role))
        knowsClass(ARMOR_CLASS, role);
    if (!pauper && role === 'samurai') {
        for (let type = ARROW; type < OBJECT_NAMES.length; type++) {
            if (!objectMagic(type) && japaneseItemName(type))
                recordObjectKnowledge(type);
        }
    }
    if (!pauper && role === 'healer')
        recordObjectKnowledge(POT_FULL_HEALING);
    if (!pauper && role === 'monk')
        recordObjectKnowledge(OBJECT_NAMES.indexOf('shuriken'));
    // Priest water is the one u_init_role() preknowledge call which
    // explicitly overrides pauper suppression.
    if (role === 'priest')
        recordObjectKnowledge(POT_WATER);
}
// C ref: u_init_skills_discoveries()->ini_inv_use_obj().  This runs after
// the first map/status display and turns fully known starting objects with an
// appearance into encountered discoveries without changing their earlier
// role-preknowledge position.
export async function finishStartingDiscoveries() {
    if (game._startingEffectsApplied)
        return false;
    for (const item of game.inventory || []) {
        if (OBJECT_DESCRIPTIONS[item.otyp] && item.known) {
            recordObjectKnowledge(item.otyp);
            recordObjectEncounter(item.otyp);
        }
        if (item.otyp === OIL_LAMP) {
            recordObjectKnowledge(POT_OIL);
            recordObjectEncounter(POT_OIL);
        }
        await useStartingItem(item, game);
    }
    ensureHeroSkills(game);
    applyPauperPreknowledge(game.urole?.key);
    if (game.spells.length && (game.u.uenmax || 0) < 5) {
        if (!game.u.ueninc || game.u.ulevel === undefined)
            throw new Error('Starting spells require initialized hero energy');
        game.u.uen = game.u.uenmax = game.u.uenpeak = 5;
        game.u.ueninc[game.u.ulevel] = 5;
    }
    findArmorClass(game);
    game._startingEffectsApplied = true;
    return true;
}
function startingInventoryRestrictions() {
    return {
        polymorphRing: null, polymorphSpellbook: null,
        polymorphPotion: null, previousRingOrBook: null,
    };
}
// C ini_inv(): exclusions persist across a role's inventory tables and reset
// before race inventory. The level-one-book threshold belongs to each table.
// Also C u_init.c:ini_inv_obj_substitution(): inlined here after object creation.
async function iniInv(table, restrictions = startingInventoryRestrictions()) {
    if (game.u.uroleplay?.pauper)
        return;
    let gotLevelOneSpellbook = false;
    let index = 0;
    let quan = trquan(initialInventoryEntry(table, index));
    while (initialInventoryEntry(table, index).cls) {
        const entry = initialInventoryEntry(table, index);
        const raw = entry.typ === UNDEF_TYP
            ? await randomStartingItem(entry.cls, gotLevelOneSpellbook, restrictions)
            : await mksobj(entry.typ, true, false);
        if (entry.typ === UNDEF_TYP)
            restrictStartingCombinations(raw, restrictions);
        const substituted = game.urace ? INITIAL_RACE_SUBSTITUTIONS
            .get(game.urace.raceIndex)?.get(raw.otyp) : undefined;
        if (substituted !== undefined)
            raw.otyp = substituted;
        // Nudist advances the template without drawing a new quantity.
        if (game.u.uroleplay?.nudist && raw.oclass === ARMOR_CLASS) {
            deallocateObject(raw);
            index++;
            continue;
        }
        if (adjustStartingItem(entry, raw))
            quan = 1;
        raw._startingInventory = true;
        // Coins keep their constructor knowledge and precede lettered gear.
        const item = raw.oclass === COIN_CLASS
            ? addHeroGoldObject(game, raw).object
            : await addCreatedInventoryItem(raw, null, false);
        if (!item)
            throw new Error('Starting inventory failed to link its object');
        if (item.oclass === SPBOOK_CLASS && OBJECT_SPELL_LEVEL[item.otyp] === 1)
            gotLevelOneSpellbook = true;
        if (--quan)
            continue;
        index++;
        quan = trquan(initialInventoryEntry(table, index));
    }
}
const FORBIDDEN_RANDOM_STARTING_ITEMS = new Set([
    WAN_WISHING, RIN_LEVITATION, POT_HALLUCINATION, POT_ACID,
    SCR_AMNESIA, SCR_FIRE, SCR_BLANK_PAPER, SPE_BLANK_PAPER,
    RIN_AGGRAVATE_MONSTER, RIN_HUNGER, WAN_NOTHING, SPE_NOVEL,
]);
// C u_init.c:ini_inv_mkobj_filter().
async function randomStartingItem(oclass, gotLevelOneSpellbook, restrictions) {
    for (let attempts = 0;; attempts++) {
        const item = await mkobj(oclass, false);
        if (randomStartingItemAllowed(item, gotLevelOneSpellbook, restrictions))
            return item;
        deallocateObject(item);
        // Native ini_inv_mkobj_filter() bounds even an impossible class.
        if (attempts === 1000)
            return await mksobj(PANCAKE, true, false);
    }
}
function randomStartingItemAllowed(item, gotLevelOneSpellbook, restrictions) {
    const type = item.otyp;
    if (FORBIDDEN_RANDOM_STARTING_ITEMS.has(type)
        || type === restrictions.polymorphRing
        || type === restrictions.polymorphSpellbook
        || type === restrictions.polymorphPotion
        || type === restrictions.previousRingOrBook)
        return false;
    if (type === RIN_POISON_RESISTANCE && game.urace?.name === 'orc')
        return false;
    if (type === SCR_ENCHANT_WEAPON && game.urole?.key === 'monk')
        return false;
    if (type === SPE_FORCE_BOLT && game.urole?.key === 'wizard')
        return false;
    return item.oclass !== SPBOOK_CLASS
        || ((OBJECT_SPELL_LEVEL[type] ?? 0) <= (gotLevelOneSpellbook ? 3 : 1)
            && roleAllowsSpellbook(type, game));
}
function restrictStartingCombinations(item, restrictions) {
    if ([WAN_POLYMORPH, RIN_POLYMORPH, POT_POLYMORPH].includes(item.otyp)) {
        restrictions.polymorphRing = RIN_POLYMORPH_CONTROL;
    }
    else if (item.otyp === RIN_POLYMORPH_CONTROL) {
        restrictions.polymorphRing = RIN_POLYMORPH;
        restrictions.polymorphSpellbook = SPE_POLYMORPH;
        restrictions.polymorphPotion = POT_POLYMORPH;
    }
    if (item.oclass === RING_CLASS || item.oclass === SPBOOK_CLASS)
        restrictions.previousRingOrBook = item.otyp;
}
function adjustStartingItem(entry, item) {
    if (entry.cls === COIN_CLASS) {
        item.quan = game._initialGoldCount ?? 0;
        item.owt = objectWeight(item);
        return false;
    }
    if (objectUsesKnown(item.otyp))
        item.known = true;
    item.dknown = item.bknown = item.rknown = true;
    if ((item.otyp >= LARGE_BOX && item.otyp <= BAG_OF_TRICKS)
        || item.otyp === STATUE) {
        item.cknown = item.lknown = true;
        item.otrapped = 0;
    }
    item.cursed = false;
    if (game.u.ualign?.type !== A_CHAOTIC)
        item.opoisoned = false;
    const stop = item.oclass === WEAPON_CLASS || item.oclass === TOOL_CLASS;
    if (stop)
        item.quan = trquan(entry);
    else if (item.oclass === GEM_CLASS && isGrayStone(item) && item.otyp !== FLINT)
        item.quan = 1;
    if (entry.spe !== UNDEF_SPE) {
        item.spe = entry.spe;
        if (entry.typ === MAGIC_MARKER && item.spe < 96)
            item.spe += rn2(4);
    }
    else if (item.oclass === RING_CLASS && objectCharged(item.otyp)
        && (item.spe ?? 0) <= 0) {
        item.spe = rne(3);
    }
    if (entry.bless !== UNDEF_BLESS)
        item.blessed = !!entry.bless;
    item.owt = objectWeight(item);
    return stop;
}
function initialInventoryEntry(table, index) {
    const entry = table[index];
    if (!entry)
        throw new Error(`Initial inventory has no terminator at entry ${index}`);
    return entry;
}
// C attrib.c:rnd_attr()
function rndAttr(weights) {
    let x = rn2(100);
    for (const i of ATTRIBUTE_INDICES) {
        x -= weights[i];
        if (x < 0)
            return i;
    }
    return 6;
}
// C attrib.c:init_attr()
// Also C attrib.c:init_attr_role_redist(): positive-point distribution is inlined here
// C refs: init_attr(75), vary_init_attr().
function initAttributes() {
    const role = game.urole;
    const race = game.urace;
    if (!role || !race)
        throw new Error('Hero role and race must be selected before attributes');
    const values = [...role.attrbase];
    let points = 75 - values.reduce((sum, value) => sum + value, 0);
    let tries = 0;
    while (points > 0 && tries < 100) {
        const i = rndAttr(role.attrdist);
        if (i === 6 || values[i] >= race.attrmax[i]) {
            tries++;
            continue;
        }
        tries = 0;
        values[i]++;
        points--;
    }
    for (const i of ATTRIBUTE_INDICES) {
        if (!rn2(20)) {
            const delta = rn2(7) - 2;
            values[i] = Math.max(race.attrmin[i], Math.min(race.attrmax[i], values[i] + delta));
        }
    }
    game.u.acurr = { a: [...values] };
    game.u.amax = { a: [...values] };
    game.u.atemp = { a: [0, 0, 0, 0, 0, 0] };
}
// C ref: u_init_carry_attr_boost(). Starting inventory must not leave the
// hero over normal capacity. Strength is exhausted first, then Constitution.
export function uInitCarryAttrBoost(state = game) {
    const current = state.u?.acurr?.a;
    const maximum = state.u?.amax?.a;
    if (!Array.isArray(current) || !Array.isArray(maximum)) {
        return { strength: 0, constitution: 0, excess: invWeight(state) };
    }
    const strengthMax = state.urace?.attrmax?.[A_STR] ?? current[A_STR];
    const constitutionMax = state.urace?.attrmax?.[A_CON] ?? current[A_CON];
    let strength = 0;
    let constitution = 0;
    while (invWeight(state) > 0) {
        if (current[A_STR] < strengthMax) {
            current[A_STR]++;
            maximum[A_STR] = Math.max(maximum[A_STR], current[A_STR]);
            strength++;
            continue;
        }
        if (current[A_CON] < constitutionMax) {
            current[A_CON]++;
            maximum[A_CON] = Math.max(maximum[A_CON], current[A_CON]);
            constitution++;
            continue;
        }
        break;
    }
    return { strength, constitution, excess: invWeight(state) };
}
const ELF_INSTRUMENTS = [
    WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP, BELL, BUGLE, LEATHER_DRUM,
];
const ELF_PREKNOWN_OBJECTS = [
    ELVEN_SHORT_SWORD, ELVEN_ARROW, ELVEN_BOW, ELVEN_SPEAR, ELVEN_DAGGER,
    ELVEN_BROADSWORD, ELVEN_MITHRIL_COAT, ELVEN_LEATHER_HELM, ELVEN_SHIELD,
    ELVEN_BOOTS, ELVEN_CLOAK,
];
const DWARF_PREKNOWN_OBJECTS = [
    DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_MATTOCK,
    DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT, DWARVISH_CLOAK,
    DWARVISH_ROUNDSHIELD,
];
const ORC_PREKNOWN_OBJECTS = [
    ORCISH_SHORT_SWORD, ORCISH_ARROW, ORCISH_BOW, ORCISH_SPEAR,
    ORCISH_DAGGER, ORCISH_CHAIN_MAIL, ORCISH_RING_MAIL, ORCISH_HELM,
    ORCISH_SHIELD, URUK_HAI_SHIELD, ORCISH_CLOAK,
];
const XTRA_FOOD_INVENTORY = [
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: FOOD_CLASS,
        min: 2, max: 2, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const MONEY_INVENTORY = [
    { typ: GOLD_PIECE, spe: 0, cls: COIN_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
const WISHING_INVENTORY = [
    { typ: WAN_WISHING, spe: 3, cls: WAND_CLASS,
        min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
];
// C u_init.c:u_init_race().
async function uInitRaceInventoryAndKnowledge(role) {
    const race = game.urace?.raceIndex;
    let preknown = [];
    if (race === 1) {
        // u_init.c:u_init_race().  Non-warrior elves receive exactly one
        // non-magical instrument; ROLL_FROM owns the selection draw before
        // the chosen one-entry inventory template is constructed.
        if (role === 'priest' || role === 'wizard') {
            const instrument = ELF_INSTRUMENTS[rn2(ELF_INSTRUMENTS.length)];
            if (instrument === undefined)
                throw new Error('No initial elven instrument was selected');
            await iniInv(oneItem(instrument));
        }
        preknown = ELF_PREKNOWN_OBJECTS;
    }
    else if (race === 2) {
        preknown = DWARF_PREKNOWN_OBJECTS;
    }
    else if (race === 4) {
        // C gives every non-Wizard Orc an extra food ration after role gear.
        if (role !== 'wizard')
            await iniInv(XTRA_FOOD_INVENTORY);
        preknown = ORC_PREKNOWN_OBJECTS;
    }
    if (!game.u?.uroleplay?.pauper) {
        for (const otyp of preknown)
            recordObjectKnowledge(otyp);
    }
}
const PAUPER_PREKNOWLEDGE = new Map([
    ['healer', SPE_HEALING],
    ['priest', SPE_PROTECTION],
    ['knight', SPE_PROTECTION],
    ['monk', SPE_PROTECTION],
    ['wizard', SPE_FORCE_BOLT],
    ['archeologist', TOUCHSTONE],
    ['caveman', FLINT],
    ['rogue', SACK],
    ['tourist', SACK],
    ['samurai', FOOD_RATION],
]);
// Also C u_init.c:pauper_reinit(): the role's one retained object discovery.
function applyPauperPreknowledge(role) {
    if (!role || !game.u?.uroleplay?.pauper)
        return;
    const otyp = PAUPER_PREKNOWLEDGE.get(role);
    if (otyp)
        recordObjectKnowledge(otyp);
}
// C u_init.c:u_init_inventory_attrs().
// Also C u_init.c:u_init_role(): inlined here for role inventory and starting turn.
export async function uInitInventoryAttrs() {
    const heroRole = game.urole;
    if (!heroRole)
        return false;
    const role = heroRole.key;
    if (role !== 'archeologist' && role !== 'barbarian'
        && role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk' && role !== 'wizard')
        return false;
    for (const item of [...game.inventory])
        await useUpInventoryStack(item);
    setHeroGoldAmount(game, 0);
    game._lastInvNr = 51;
    await setPrimaryWeapon(null, game);
    await setSecondaryWeapon(null, game);
    await setQuiverObject(null, game);
    game.uarm = game.uarms = game.uarmc = game.uarmu = game.uarmg =
        game.uarmh = game.uarmf = null;
    game.u.weaponSkills = null;
    game.u.skillRecord = [];
    // u_init_misc() starts with no slots; pauper_reinit() grants its two later.
    game.u.weapon_slots = 0;
    game.spells = [];
    delete game._startingEffectsApplied;
    game.moves = 1;
    // C resets u.umoney0 before the role switch so repeated character
    // initialization cannot inherit another role's purse.
    game._initialGoldCount = 0;
    let startingGold = 0;
    const restrictions = startingInventoryRestrictions();
    if (role === 'archeologist') {
        await iniInv(ARCHEOLOGIST_INVENTORY, restrictions);
        if (!rn2(10))
            await iniInv(oneItem(TIN_OPENER), restrictions);
        else if (!rn2(4))
            await iniInv(oneItem(OIL_LAMP, 1), restrictions);
        else if (!rn2(5))
            await iniInv(oneItem(MAGIC_MARKER, 19), restrictions);
    }
    else if (role === 'barbarian') {
        await iniInv(rn2(100) >= 50
            ? BARBARIAN_SWORD_INVENTORY : BARBARIAN_AXE_INVENTORY, restrictions);
        if (!rn2(6))
            await iniInv(oneItem(OIL_LAMP, 1), restrictions);
    }
    else if (role === 'caveman') {
        await iniInv(CAVEMAN_INVENTORY, restrictions);
    }
    else if (role === 'rogue') {
        await iniInv(ROGUE_INVENTORY, restrictions);
        if (!rn2(5))
            await iniInv(oneItem(BLINDFOLD), restrictions);
    }
    else if (role === 'tourist') {
        startingGold = rnd(1000);
        await iniInv(TOURIST_INVENTORY, restrictions);
        if (!rn2(25))
            await iniInv(oneItem(TIN_OPENER), restrictions);
        else if (!rn2(25))
            await iniInv(oneItem(LEASH), restrictions);
        else if (!rn2(25))
            await iniInv(oneItem(TOWEL), restrictions);
        else if (!rn2(20))
            await iniInv(oneItem(MAGIC_MARKER, 19), restrictions);
    }
    else if (role === 'samurai') {
        await iniInv(SAMURAI_INVENTORY, restrictions);
        if (!rn2(5))
            await iniInv(oneItem(BLINDFOLD), restrictions);
    }
    else if (role === 'valkyrie') {
        await iniInv(VALKYRIE_INVENTORY, restrictions);
        if (!rn2(6))
            await iniInv(oneItem(OIL_LAMP, 1), restrictions);
    }
    else if (role === 'priest') {
        await iniInv(PRIEST_INVENTORY, restrictions);
        if (!rn2(5))
            await iniInv(oneItem(MAGIC_MARKER, 19), restrictions);
        else if (!rn2(10))
            await iniInv(oneItem(OIL_LAMP, 1), restrictions);
    }
    else if (role === 'healer') {
        startingGold = 1001 + rn2(1000);
        await iniInv(HEALER_INVENTORY, restrictions);
        if (!rn2(25))
            await iniInv(oneItem(OIL_LAMP, 1), restrictions);
    }
    else if (role === 'knight') {
        await iniInv(KNIGHT_INVENTORY, restrictions);
        grantIntrinsicProperty('jumping', 'outside');
    }
    else if (role === 'monk') {
        await iniInv(MONK_INVENTORY, restrictions);
        const spell = [SPE_HEALING, SPE_PROTECTION, SPE_CONFUSE_MONSTER][Math.trunc(rn2(90) / 30)];
        if (spell === undefined)
            throw new Error('No initial Monk spell was selected');
        await iniInv([
            { typ: spell, spe: UNDEF_SPE, cls: SPBOOK_CLASS,
                min: 1, max: 1, bless: 1 },
            { typ: 0, spe: 0, cls: RANDOM_CLASS, min: 0, max: 0, bless: 0 },
        ], restrictions);
        if (!rn2(4))
            await iniInv(oneItem(MAGIC_MARKER, 19), restrictions);
        else if (!rn2(10))
            await iniInv(oneItem(OIL_LAMP, 1), restrictions);
    }
    else if (role === 'wizard') {
        await iniInv(WIZARD_INVENTORY, restrictions);
        if (!rn2(5))
            await iniInv(oneItem(BLINDFOLD), restrictions);
    }
    else {
        await iniInv(RANGER_INVENTORY, restrictions);
    }
    // C u_init_role() installs explicit role/class knowledge before
    // u_init_race() adds race inventory and knowledge.
    initializeRolePreknowledge(role);
    await uInitRaceInventoryAndKnowledge(role);
    // C adds discover-mode wishes after race gear, then creates role money.
    if (game.flags?.explore)
        await iniInv(WISHING_INVENTORY);
    game._initialGoldCount = startingGold;
    if (startingGold)
        await iniInv(MONEY_INVENTORY);
    game._initialGoldCount += hiddenGold(game, true);
    initAttributes();
    uInitCarryAttrBoost(game);
    heroRole.rank = heroRole.title[0] || heroRole.name;
    return true;
}
//# sourceMappingURL=u_init.js.map