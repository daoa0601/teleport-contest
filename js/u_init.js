// u_init.js — Initial hero, pet, inventory, and attribute setup.
// C refs: u_init.c, attrib.c, dog.c, teleport.c, makemon.c.
import { game } from './gstate.js';
import { useStartingItem } from './starting_equipment.js';
import { isGrayStone } from './object_properties.js';
import { deallocateObject } from './object_delete.js';
import { initializeHeroRoomMembership } from './room.js';
import { finishInventoryAddition, recordHeroPrizeAcquisition, useUpInventoryStack } from './hero_inventory.js';
import { japaneseItemName, wishedObjectPresentation } from './objnam.js';
import { setHeroSpecies } from './hero_species.js';
import { seeMonsterCloseup } from './monster_observation.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { setMonsterMalign } from './monster_alignment.js';
import { nextIdent } from './ident.js';
import { rn2, rnd, d, rne } from './rng.js';
import { mkobj, mksobj } from './mklev.js';
import { goodPosition } from './teleport_rules.js';
import { MONSTER_MOVE, MONSTER_NAME, SPECIAL_PM } from './monster_data.js';
import { findArmorClass } from './armor.js';
import { ensureQuestStatus } from './quest.js';
import { GP_AVOID_MONPOS, A_CHA, A_CHAOTIC, A_CON, A_STR, COLNO, ROWNO, LOST_NONE, NOT_HUNGRY } from './const.js';
import { ARROW, CROSSBOW_BOLT, YA, DART, DAGGER, SCALPEL, SPEAR, AXE, BATTLE_AXE, SHORT_SWORD, LONG_SWORD, TWO_HANDED_SWORD, KATANA, LANCE, MACE, CLUB, QUARTERSTAFF, BULLWHIP, BOW, CROSSBOW, YUMI, SLING, HELMET, FEDORA, SPLINT_MAIL, RING_MAIL, LEATHER_ARMOR, LEATHER_JACKET, LEATHER_GLOVES, ROBE, SMALL_SHIELD, HAWAIIAN_SHIRT, CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE, LARGE_BOX, BAG_OF_TRICKS, SACK, CORPSE, STATUE, LOCK_PICK, CREDIT_CARD, EXPENSIVE_CAMERA, TOWEL, SADDLE, LEASH, STETHOSCOPE, TIN_OPENER, MAGIC_MARKER, BLINDFOLD, OIL_LAMP, PICK_AXE, TINNING_KIT, WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP, BELL, BUGLE, LEATHER_DRUM, CRAM_RATION, FOOD_RATION, TRIPE_RATION, TIN, EUCALYPTUS_LEAF, APPLE, ORANGE, PEAR, MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, SLIME_MOLD, CREAM_PIE, CANDY_BAR, FORTUNE_COOKIE, PANCAKE, LEMBAS_WAFER, POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_SICKNESS, POT_OIL, POT_WATER, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SPE_DETECT_MONSTERS, SPE_HEALING, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER, SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, SPE_PROTECTION, WAN_SLEEP, WAN_WISHING, GOLD_PIECE, AMULET_OF_YENDOR, TOUCHSTONE, FLINT, ROCK, OBJECT_NAMES, OBJECT_DESCRIPTIONS, OBJECT_BASES, OBJECT_CHARGED, OBJECT_USES_KNOWN, OBJECT_SPELL_LEVEL, OBJECT_SPELL_CATEGORY, OBJECT_SUBTYPE, OBJECT_MAGIC, ELVEN_SHORT_SWORD, ELVEN_ARROW, ELVEN_BOW, ELVEN_SPEAR, ELVEN_DAGGER, ELVEN_BROADSWORD, ELVEN_MITHRIL_COAT, ELVEN_LEATHER_HELM, ELVEN_SHIELD, ELVEN_BOOTS, ELVEN_CLOAK, ORCISH_ARROW, ORCISH_SPEAR, ORCISH_DAGGER, ORCISH_SHORT_SWORD, ORCISH_BOW, ORCISH_HELM, ORCISH_CHAIN_MAIL, ORCISH_RING_MAIL, ORCISH_CLOAK, URUK_HAI_SHIELD, ORCISH_SHIELD, DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_MATTOCK, DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT, DWARVISH_CLOAK, DWARVISH_ROUNDSHIELD, CHAIN_MAIL, RIN_LEVITATION, RIN_HUNGER, RIN_AGGRAVATE_MONSTER, RIN_POISON_RESISTANCE, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL, POT_POLYMORPH, WAN_POLYMORPH, SPE_POLYMORPH, SPE_BLANK_PAPER, SPE_NOVEL, WAN_NOTHING, POT_HALLUCINATION, POT_ACID, SCR_AMNESIA, SCR_FIRE, SCR_BLANK_PAPER, SCR_ENCHANT_WEAPON, } from './object_data.js';
import { recordObjectEncounter, recordObjectKnowledge, } from './object_knowledge.js';
import { ensureHeroSkills, roleAllowsSpellbook } from './skills.js';
import { hiddenGold } from './gold.js';
import { addHeroGoldObject, setHeroGoldAmount, } from './hero_gold.js';
import { invWeight, objectWeight } from './weight.js';
import { syncBlindness, syncDeafness } from './senses.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { mergable, mergeCreatedObjectStacks, mergeObjectStacks } from './object_merge.js';
import { assertCreatedObject } from './object_release.js';
import { putSaddleOnMonster } from './steed.js';
import { grantIntrinsicProperty } from './properties.js';
import { makePlural } from './object_grammar.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, } from './weapon_slots.js';
const ATTRIBUTE_INDICES = [0, 1, 2, 3, 4, 5];
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
const UNDEF_BLESS = 2;
const UNDEF_TYP = -1;
const UNDEF_SPE = null;
const PM_LICHEN = 158;
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
const DAGGER_TYPES = new Set([DAGGER, ELVEN_DAGGER, ORCISH_DAGGER]);
const SHORT_SWORD_TYPES = new Set([
    SHORT_SWORD, ELVEN_SHORT_SWORD, ORCISH_SHORT_SWORD,
    DWARVISH_SHORT_SWORD,
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
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const BARBARIAN_SWORD_INVENTORY = [
    { typ: TWO_HANDED_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: AXE, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: RING_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const BARBARIAN_AXE_INVENTORY = [
    { typ: BATTLE_AXE, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: RING_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const RANGER_INVENTORY = [
    { typ: DAGGER, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: BOW, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: ARROW, spe: 2, cls: WEAPON_CLASS, min: 50, max: 59, bless: UNDEF_BLESS },
    { typ: ARROW, spe: 0, cls: WEAPON_CLASS, min: 30, max: 39, bless: UNDEF_BLESS },
    { typ: CLOAK_OF_DISPLACEMENT, spe: 2, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: CRAM_RATION, spe: 0, cls: FOOD_CLASS, min: 4, max: 4, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const TOURIST_INVENTORY = [
    { typ: DART, spe: 2, cls: WEAPON_CLASS, min: 21, max: 40, bless: UNDEF_BLESS },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: FOOD_CLASS, min: 10, max: 10, bless: 0 },
    { typ: POT_EXTRA_HEALING, spe: 0, cls: POTION_CLASS, min: 2, max: 2, bless: UNDEF_BLESS },
    { typ: SCR_MAGIC_MAPPING, spe: 0, cls: SCROLL_CLASS, min: 4, max: 4, bless: UNDEF_BLESS },
    { typ: HAWAIIAN_SHIRT, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: EXPENSIVE_CAMERA, spe: UNDEF_SPE, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: CREDIT_CARD, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const CAVEMAN_INVENTORY = [
    { typ: CLUB, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SLING, spe: 2, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FLINT, spe: 0, cls: GEM_CLASS, min: 10, max: 20, bless: UNDEF_BLESS },
    { typ: ROCK, spe: 0, cls: GEM_CLASS, min: 3, max: 3, bless: 0 },
    { typ: LEATHER_ARMOR, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const ROGUE_INVENTORY = [
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: DAGGER, spe: 0, cls: WEAPON_CLASS, min: 6, max: 15, bless: 0 },
    { typ: LEATHER_ARMOR, spe: 1, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: POT_SICKNESS, spe: 0, cls: POTION_CLASS, min: 1, max: 1, bless: 0 },
    { typ: LOCK_PICK, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: SACK, spe: 0, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const SAMURAI_INVENTORY = [
    { typ: KATANA, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: YUMI, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: YA, spe: 0, cls: WEAPON_CLASS, min: 26, max: 45, bless: UNDEF_BLESS },
    { typ: SPLINT_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const VALKYRIE_INVENTORY = [
    { typ: SPEAR, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: DAGGER, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SMALL_SHIELD, spe: 3, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: FOOD_RATION, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const PRIEST_INVENTORY = [
    { typ: MACE, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: 1 },
    { typ: ROBE, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SMALL_SHIELD, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: POT_WATER, spe: 0, cls: POTION_CLASS, min: 4, max: 4, bless: 1 },
    { typ: CLOVE_OF_GARLIC, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: SPRIG_OF_WOLFSBANE, spe: 0, cls: FOOD_CLASS, min: 1, max: 1, bless: 0 },
    { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: SPBOOK_CLASS, min: 2, max: 2, bless: UNDEF_BLESS },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
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
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
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
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
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
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
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
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
function oneItem(typ, spe = 0) {
    return [
        { typ, spe, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
        { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
    ];
}
const ITEM_PRESENTATION = new Map([
    [DAGGER, { class: 'Weapons', name: 'dagger', plural: 'daggers', enchanted: true }],
    [AXE, { class: 'Weapons', name: 'axe', plural: 'axes', enchanted: true }],
    [BATTLE_AXE, {
            class: 'Weapons', name: 'battle-axe', plural: 'battle-axes', enchanted: true,
        }],
    [SPEAR, {
            class: 'Weapons', name: 'spear', plural: 'spears', enchanted: true,
            omitUncursed: true,
        }],
    [BOW, { class: 'Weapons', name: 'bow', plural: 'bows', enchanted: true }],
    [ARROW, { class: 'Weapons', name: 'arrow', plural: 'arrows', enchanted: true }],
    [DART, {
            class: 'Weapons', name: 'dart', plural: 'darts', enchanted: true, omitUncursed: true,
        }],
    [KATANA, {
            class: 'Weapons', name: 'katana', plural: 'katanas', enchanted: true,
            omitUncursed: true,
        }],
    [MACE, { class: 'Weapons', name: 'mace', plural: 'maces', enchanted: true }],
    [SCALPEL, {
            class: 'Weapons', name: 'scalpel', plural: 'scalpels', enchanted: true,
            omitUncursed: true,
        }],
    [CLUB, { class: 'Weapons', name: 'club', plural: 'clubs', enchanted: true, omitUncursed: true }],
    [QUARTERSTAFF, {
            class: 'Weapons', name: 'quarterstaff', plural: 'quarterstaffs', enchanted: true,
        }],
    [SLING, { class: 'Weapons', name: 'sling', plural: 'slings', enchanted: true, omitUncursed: true }],
    [SHORT_SWORD, {
            class: 'Weapons', name: 'wakizashi', plural: 'wakizashi', enchanted: true,
            omitUncursed: true,
        }],
    [AMULET_OF_YENDOR, {
            class: 'Amulets', name: 'Amulet of Yendor',
            plural: 'Amulets of Yendor',
        }],
    [LONG_SWORD, {
            class: 'Weapons', name: 'long sword', plural: 'long swords', enchanted: true,
        }],
    [TWO_HANDED_SWORD, {
            class: 'Weapons', name: 'two-handed sword', plural: 'two-handed swords',
            enchanted: true,
        }],
    [BULLWHIP, { class: 'Weapons', name: 'bullwhip', plural: 'bullwhips', enchanted: true }],
    [LANCE, { class: 'Weapons', name: 'lance', plural: 'lances', enchanted: true }],
    [YUMI, {
            class: 'Weapons', name: 'yumi', plural: 'yumi', enchanted: true,
            omitUncursed: true,
        }],
    [YA, {
            class: 'Weapons', name: 'ya', plural: 'ya', enchanted: true, omitUncursed: true,
        }],
    [SPLINT_MAIL, {
            class: 'Armor', name: 'splint mail', plural: 'splint mails', enchanted: true,
        }],
    [HELMET, { class: 'Armor', name: 'helmet', plural: 'helmets', enchanted: true }],
    [RING_MAIL, { class: 'Armor', name: 'ring mail', plural: 'ring mails', enchanted: true }],
    [LEATHER_ARMOR, {
            class: 'Armor', name: 'leather armor', plural: 'leather armors', enchanted: true,
        }],
    [LEATHER_JACKET, {
            class: 'Armor', name: 'leather jacket', plural: 'leather jackets', enchanted: true,
        }],
    [FEDORA, { class: 'Armor', name: 'fedora', plural: 'fedoras', enchanted: true }],
    [ROBE, { class: 'Armor', name: 'robe', plural: 'robes', enchanted: true }],
    [SMALL_SHIELD, {
            class: 'Armor', name: 'small shield', plural: 'small shields', enchanted: true,
        }],
    [LEATHER_GLOVES, {
            class: 'Armor', name: 'pair of leather gloves',
            plural: 'pairs of leather gloves', enchanted: true,
        }],
    [POT_HEALING, { class: 'Potions', name: 'potion of healing', plural: 'potions of healing' }],
    [POT_SICKNESS, { class: 'Potions', name: 'potion of sickness', plural: 'potions of sickness' }],
    [LOCK_PICK, { class: 'Tools', name: 'lock pick', plural: 'lock picks' }],
    [SACK, { class: 'Tools', name: 'sack', plural: 'sacks', empty: true }],
    [FLINT, { class: 'Gems/Stones', name: 'flint stone', plural: 'flint stones' }],
    [ROCK, { class: 'Gems/Stones', name: 'rock', plural: 'rocks' }],
    [HAWAIIAN_SHIRT, {
            class: 'Armor', name: 'Hawaiian shirt', plural: 'Hawaiian shirts', enchanted: true,
        }],
    [CLOAK_OF_DISPLACEMENT, {
            class: 'Armor', name: 'cloak of displacement', plural: 'cloaks of displacement',
            enchanted: true,
        }],
    [CLOAK_OF_MAGIC_RESISTANCE, {
            class: 'Armor', name: 'cloak of magic resistance',
            plural: 'cloaks of magic resistance', enchanted: true,
        }],
    [264, { class: 'Comestibles', name: 'tripe ration', plural: 'tripe rations' }],
    [266, { class: 'Comestibles', name: 'egg', plural: 'eggs' }],
    [EUCALYPTUS_LEAF, { class: 'Comestibles', name: 'eucalyptus leaf', plural: 'eucalyptus leaves' }],
    [APPLE, { class: 'Comestibles', name: 'apple', plural: 'apples' }],
    [ORANGE, { class: 'Comestibles', name: 'orange', plural: 'oranges' }],
    [PEAR, { class: 'Comestibles', name: 'pear', plural: 'pears' }],
    [MELON, { class: 'Comestibles', name: 'melon', plural: 'melons' }],
    [BANANA, { class: 'Comestibles', name: 'banana', plural: 'bananas' }],
    [CARROT, { class: 'Comestibles', name: 'carrot', plural: 'carrots' }],
    [SPRIG_OF_WOLFSBANE, {
            class: 'Comestibles', name: 'sprig of wolfsbane', plural: 'sprigs of wolfsbane',
        }],
    [CLOVE_OF_GARLIC, {
            class: 'Comestibles', name: 'clove of garlic', plural: 'cloves of garlic',
        }],
    [SLIME_MOLD, { class: 'Comestibles', name: 'slime mold', plural: 'slime molds' }],
    [CREAM_PIE, { class: 'Comestibles', name: 'cream pie', plural: 'cream pies' }],
    [CANDY_BAR, { class: 'Comestibles', name: 'candy bar', plural: 'candy bars' }],
    [FORTUNE_COOKIE, {
            class: 'Comestibles', name: 'fortune cookie', plural: 'fortune cookies',
        }],
    [PANCAKE, { class: 'Comestibles', name: 'pancake', plural: 'pancakes' }],
    [LEMBAS_WAFER, { class: 'Comestibles', name: 'lembas wafer', plural: 'lembas wafers' }],
    [CRAM_RATION, { class: 'Comestibles', name: 'cram ration', plural: 'cram rations' }],
    [FOOD_RATION, { class: 'Comestibles', name: 'food ration', plural: 'food rations' }],
    [POT_EXTRA_HEALING, {
            class: 'Potions', name: 'potion of extra healing', plural: 'potions of extra healing',
        }],
    [POT_WATER, { class: 'Potions', name: 'potion of water', plural: 'potions of water' }],
    [SCR_MAGIC_MAPPING, {
            class: 'Scrolls', name: 'scroll of magic mapping', plural: 'scrolls of magic mapping',
        }],
    [SCR_PUNISHMENT, {
            class: 'Scrolls', name: 'scroll of punishment', plural: 'scrolls of punishment',
        }],
    [SPE_HEALING, {
            class: 'Spellbooks', name: 'spellbook of healing', plural: 'spellbooks of healing',
            spellName: 'healing', spellLevel: 1, spellCategory: 'healing', appearance: 'purple',
        }],
    [SPE_FORCE_BOLT, {
            class: 'Spellbooks', name: 'spellbook of force bolt',
            plural: 'spellbooks of force bolt', spellName: 'force bolt',
            spellLevel: 1, spellCategory: 'attack', appearance: 'red',
        }],
    [SPE_CONFUSE_MONSTER, {
            class: 'Spellbooks', name: 'spellbook of confuse monster',
            plural: 'spellbooks of confuse monster', spellName: 'confuse monster',
            spellLevel: 2, spellCategory: 'enchantment', appearance: 'orange',
        }],
    [SPE_PROTECTION, {
            class: 'Spellbooks', name: 'spellbook of protection',
            plural: 'spellbooks of protection', spellName: 'protection',
            spellLevel: 1, spellCategory: 'clerical', appearance: 'dull',
        }],
    [SPE_DETECT_MONSTERS, {
            class: 'Spellbooks', name: 'spellbook of detect monsters',
            plural: 'spellbooks of detect monsters', spellName: 'detect monsters',
            spellLevel: 1, spellCategory: 'divination', appearance: 'silver',
        }],
    [SPE_EXTRA_HEALING, {
            class: 'Spellbooks', name: 'spellbook of extra healing',
            plural: 'spellbooks of extra healing', spellName: 'extra healing',
            spellLevel: 3, spellCategory: 'healing', appearance: 'dog eared',
        }],
    [SPE_STONE_TO_FLESH, {
            class: 'Spellbooks', name: 'spellbook of stone to flesh',
            plural: 'spellbooks of stone to flesh', spellName: 'stone to flesh',
            spellLevel: 3, spellCategory: 'healing', appearance: 'stained',
        }],
    [EXPENSIVE_CAMERA, {
            class: 'Tools', name: 'expensive camera', plural: 'expensive cameras',
            showBuc: false,
        }],
    [CREDIT_CARD, { class: 'Tools', name: 'credit card', plural: 'credit cards' }],
    [TIN_OPENER, { class: 'Tools', name: 'tin opener', plural: 'tin openers' }],
    [PICK_AXE, { class: 'Tools', name: 'pick-axe', plural: 'pick-axes', enchanted: true }],
    [TINNING_KIT, {
            class: 'Tools', name: 'tinning kit', plural: 'tinning kits',
            showBuc: false,
        }],
    [TOUCHSTONE, {
            class: 'Gems/Stones', name: 'touchstone', plural: 'touchstones', showBuc: false,
        }],
    [LEASH, { class: 'Tools', name: 'leash', plural: 'leashes' }],
    [STETHOSCOPE, { class: 'Tools', name: 'stethoscope', plural: 'stethoscopes' }],
    [TOWEL, { class: 'Tools', name: 'towel', plural: 'towels' }],
    [MAGIC_MARKER, {
            class: 'Tools', name: 'magic marker', plural: 'magic markers',
            showBuc: false,
        }],
    [BLINDFOLD, { class: 'Tools', name: 'blindfold', plural: 'blindfolds' }],
    [OIL_LAMP, { class: 'Tools', name: 'oil lamp', plural: 'oil lamps' }],
    [WAN_WISHING, {
            class: 'Wands', name: 'wand of wishing', plural: 'wands of wishing',
            showBuc: false,
        }],
    [WAN_SLEEP, {
            class: 'Wands', name: 'wand of sleep', plural: 'wands of sleep',
            showBuc: false,
        }],
]);
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
// The caller supplies the handedness roll from pre-level initialization.
export function uInitMisc(handednessRoll) {
    const g = game;
    const u = g.u;
    u._propertySources = {};
    u.uhave = {};
    u.uconduct = {};
    initializeHeroRoomMembership(g);
    initializeHeroSpecies(g);
    const hp = initialRoll(g.urole?.hpadv) + initialRoll(g.urace?.hpadv);
    const pw = initialRoll(g.urole?.enadv) + (g._initialPwBonus || 0)
        + initialRoll(g.urace?.enadv);
    u.uz = { dnum: 0, dlevel: 1 };
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
    u.uroleplay = {
        ...(u.uroleplay || {}),
        pauper: !!g.flags?.pauper,
        nudist: configuredNudist
            ? !!g.flags.nudist : !!g.flags?.pauper,
        reroll: !!g.flags?.reroll,
        numrerolls: 0,
        blind: !!g.flags?.blind,
        deaf: !!g.flags?.deaf,
    };
    ensureQuestStatus(g);
    u.rightHanded = !!handednessRoll;
    // C initializes the hero with one ordinary action available.  Samurai
    // also gain intrinsic Fast at level 1 (attrib.c sam_abil[]).
    u.umovement = 0; // moveloop_preamble() grants the first movement ration.
    if (g.urole?.intrinsicFast)
        grantIntrinsicProperty('fast', 'role', g);
    // attrib.c race abilities retain infravision even in a body without it.
    if (g.urace && ['dwarf', 'elf', 'gnome', 'orc'].includes(g.urace.name))
        grantIntrinsicProperty('infravision', 'race', g);
    // C attrib.c level-one role/race ability tables.  Keep these properties
    // on the hero rather than reconstructing them from identity during end
    // disclosure; combat and enlightenment must share the same owner.
    if (g.urole && ['barbarian', 'healer'].includes(g.urole.key))
        grantIntrinsicProperty('poisonResistance', 'role', g);
    if (g.urace?.name === 'orc')
        grantIntrinsicProperty('poisonResistance', 'race', g);
    if (g.urole?.key === 'rogue')
        grantIntrinsicProperty('stealth', 'role', g);
    if (g.urole && ['archeologist', 'ranger'].includes(g.urole.key))
        grantIntrinsicProperty('searching', 'role', g);
    if (g.urole?.key === 'monk') {
        grantIntrinsicProperty('sleepResistance', 'role', g);
        grantIntrinsicProperty('seeInvisible', 'role', g);
    }
    u.nv_range = 1;
    u.xray_range = -1;
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
// C ref: collect_coords().  Each of the first three rings is completely
// collected and shuffled before enexto_core() tests candidate positions.
export function collectNearbyCoords(cx, cy, maxradius = 3, random = rn2, calls = null) {
    const coords = [];
    const mapRadius = Math.max(cx, COLNO - 1 - cx, cy, ROWNO - 1 - cy);
    maxradius = maxradius ? Math.min(maxradius, mapRadius) : mapRadius;
    for (let radius = 1; radius <= maxradius; radius++) {
        const start = coords.length;
        const lox = cx - radius, hix = cx + radius;
        const loy = cy - radius, hiy = cy + radius;
        for (let y = Math.max(loy, 0); y <= Math.min(hiy, ROWNO - 1); y++) {
            for (let x = Math.max(lox, 1); x <= Math.min(hix, COLNO - 1); x++) {
                if (x !== lox && x !== hix && y !== loy && y !== hiy)
                    continue;
                coords.push({ x, y });
            }
        }
        let pass = start;
        let n = coords.length - start;
        while (n > 1) {
            const k = random(n);
            if (calls)
                calls.push(`rn2(${n})`);
            if (k) {
                const current = coords[pass];
                const chosen = coords[pass + k];
                if (!current || !chosen || k < 0 || k >= n)
                    throw new RangeError(`Invalid coordinate shuffle index ${k} for ${n} entries`);
                coords[pass] = chosen;
                coords[pass + k] = current;
            }
            pass++;
            n--;
        }
    }
    return coords;
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
    const candidates = collectNearbyCoords(g.u.ux, g.u.uy, 3);
    const spot = candidates.find(({ x, y }) => goodPosition(x, y, { kind: 'species', mnum: pettype }, { gpflags: GP_AVOID_MONPOS }));
    if (!spot)
        return null;
    const monsterId = nextIdent();
    // adj_lev() reduces dogs and kittens to level one; a starting pony is
    // level two here and therefore rolls two hit dice.
    let hp = d(role === 'knight' ? 2 : 1, 8);
    if (role !== 'knight' && hp === 1)
        hp++;
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
        // makemon()->adj_lev() lowers the Knight's starting pony from its
        // species level three to level two before rolling its two hit dice.
        m_lev: role === 'knight' ? 2 : 1,
        female,
        mtame: 10,
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
    if (role === 'knight' && !g.u?.uroleplay?.pauper) {
        await putSaddleOnMonster(await mksobj(SADDLE, true, false), pet);
    }
    if (!g.level.monsters)
        g.level.monsters = [];
    g.level.monsters.push(pet);
    g.startingPet = pet;
    g.context.startingpet_mid = pet.m_id;
    await seeMonsterCloseup(pet, { photo: g.inventory.some(object => object.otyp === EXPENSIVE_CAMERA) });
    if (pettype === MONSTER_NAME.indexOf('little dog')) {
        const name = DEFAULT_DOG_NAMES[role];
        if (name)
            setMonsterGivenName(pet, name);
    }
    // dog.c:initedog() assigns kill credit after making the pet peaceful.
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
const CLASS_PRESENTATION = {
    [WEAPON_CLASS]: 'Weapons', [ARMOR_CLASS]: 'Armor',
    [RING_CLASS]: 'Rings', [AMULET_CLASS]: 'Amulets',
    [TOOL_CLASS]: 'Tools', [FOOD_CLASS]: 'Comestibles',
    [POTION_CLASS]: 'Potions', [SCROLL_CLASS]: 'Scrolls',
    [SPBOOK_CLASS]: 'Spellbooks', [WAND_CLASS]: 'Wands',
    [COIN_CLASS]: 'Coins', [GEM_CLASS]: 'Gems/Stones',
    [ROCK_CLASS]: 'Boulders',
};
function qualifiedObjectName(raw) {
    if (raw.otyp === CORPSE && raw.corpsenm !== undefined && MONSTER_NAME[raw.corpsenm])
        return `${MONSTER_NAME[raw.corpsenm]} corpse`;
    const name = OBJECT_NAMES[raw.otyp] || `object ${raw.otyp}`;
    switch (raw.oclass) {
        case RING_CLASS: return `ring of ${name}`;
        case POTION_CLASS: return `potion of ${name}`;
        case SCROLL_CLASS: return `scroll of ${name}`;
        case SPBOOK_CLASS: return `spellbook of ${name}`;
        case WAND_CLASS: return `wand of ${name}`;
        default: return name;
    }
}
function sourceKnownPresentation(raw) {
    const name = qualifiedObjectName(raw);
    const plural = raw.oclass === RING_CLASS ? `rings of ${OBJECT_NAMES[raw.otyp]}`
        : raw.oclass === POTION_CLASS ? `potions of ${OBJECT_NAMES[raw.otyp]}`
            : raw.oclass === SCROLL_CLASS ? `scrolls of ${OBJECT_NAMES[raw.otyp]}`
                : raw.oclass === SPBOOK_CLASS ? `spellbooks of ${OBJECT_NAMES[raw.otyp]}`
                    : raw.oclass === WAND_CLASS ? `wands of ${OBJECT_NAMES[raw.otyp]}`
                        : makePlural(name);
    return {
        class: CLASS_PRESENTATION[raw.oclass] || 'Other',
        name, plural,
        enchanted: raw.oclass === WEAPON_CLASS || raw.oclass === ARMOR_CLASS
            || (raw.oclass === RING_CLASS && raw.spe !== 0),
        showBuc: raw.oclass === WAND_CLASS ? false : undefined,
        spellName: raw.oclass === SPBOOK_CLASS ? OBJECT_NAMES[raw.otyp] : undefined,
        spellLevel: raw.oclass === SPBOOK_CLASS
            ? OBJECT_SPELL_LEVEL[raw.otyp] : undefined,
        spellCategory: raw.oclass === SPBOOK_CLASS
            ? OBJECT_SPELL_CATEGORY[raw.otyp] : undefined,
    };
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
        if (OBJECT_MAGIC[otyp])
            continue;
        if (oclass === ARMOR_CLASS && excludedArmor.has(otyp))
            continue;
        if (oclass === WEAPON_CLASS) {
            const skill = OBJECT_SUBTYPE[otyp] || 0;
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
            if (!OBJECT_MAGIC[type] && japaneseItemName(type))
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
// Display-only callers receive a projection without changing the carried object.
export function inventoryItem(raw, presentation = null) {
    return { ...raw, ...inventoryPresentation(raw, presentation) };
}
// Acquisition and polymorph retain the same object already held by timers and
// ownership links. Only presentation fields are updated here.
export function updateInventoryPresentation(raw, presentation = null) {
    const view = inventoryPresentation(raw, presentation);
    raw.class = view.class;
    raw.name = view.name;
    raw.plural = view.plural;
    if ('enchanted' in view)
        raw.enchanted = view.enchanted;
    if ('omitUncursed' in view)
        raw.omitUncursed = view.omitUncursed;
    if ('showBuc' in view)
        raw.showBuc = view.showBuc;
    if ('empty' in view)
        raw.empty = view.empty;
    if ('spellName' in view)
        raw.spellName = view.spellName;
    if ('spellLevel' in view)
        raw.spellLevel = view.spellLevel;
    if ('spellCategory' in view)
        raw.spellCategory = view.spellCategory;
    if ('appearance' in view)
        raw.appearance = view.appearance;
    raw.quantity = view.quantity;
    raw.enchantment = view.enchantment;
    raw.buc = view.buc;
    return raw;
}
function inventoryPresentation(raw, presentation) {
    let view = presentation || ITEM_PRESENTATION.get(raw.otyp)
        || (raw._startingInventory || raw.typeKnown
            ? sourceKnownPresentation(raw) : null) || wishedObjectPresentation(raw);
    if (game.urole?.key === 'knight'
        && (raw.otyp === LONG_SWORD || raw.otyp === LANCE)) {
        view = { ...view, omitUncursed: true };
    }
    if (raw.otyp === SHORT_SWORD && game.urole?.key !== 'samurai') {
        view = {
            ...view, name: 'short sword', plural: 'short swords',
            omitUncursed: true,
        };
    }
    if (SHORT_SWORD_TYPES.has(raw.otyp) && game.urole?.key === 'rogue') {
        const orcish = game.urace?.raceIndex === 4;
        view = raw.otyp === SHORT_SWORD ? {
            ...view,
            name: orcish ? 'orcish short sword' : 'short sword',
            plural: orcish ? 'orcish short swords' : 'short swords',
            omitUncursed: true,
        } : { ...view, omitUncursed: true };
    }
    if (DAGGER_TYPES.has(raw.otyp) && game.urole?.key === 'rogue') {
        view = raw.otyp === DAGGER && game.urace?.raceIndex === 4
            ? {
                ...view, name: 'orcish dagger', plural: 'orcish daggers',
                omitUncursed: true,
            }
            : { ...view, omitUncursed: true };
    }
    if (raw.otyp === DAGGER && game.urole?.key === 'valkyrie') {
        view = { ...view, omitUncursed: true };
    }
    if (raw.otyp === TIN) {
        // objnam.c:xname() appends tin_details() only after the individual
        // tin's contents have become known.  Generation may already retain
        // corpsenm without making that state legal presentation data.
        view = !raw.known
            ? { class: 'Comestibles', name: 'tin', plural: 'tins' }
            : raw.corpsenm === PM_LICHEN
                ? { class: 'Comestibles', name: 'tin of lichen', plural: 'tins of lichen' }
                : raw.corpsenm === 322
                    ? { class: 'Comestibles', name: 'tin of newt meat', plural: 'tins of newt meat' }
                    : raw.corpsenm == null
                        ? { class: 'Comestibles', name: 'tin of spinach', plural: 'tins of spinach' }
                        : { class: 'Comestibles', name: 'tin', plural: 'tins' };
    }
    const buc = raw.bknown
        ? raw.blessed ? 'blessed' : raw.cursed ? 'cursed' : 'uncursed'
        : undefined;
    return {
        ...view,
        quantity: raw.quan,
        enchantment: view.enchanted ? raw.spe : undefined,
        buc: view.showBuc === false || (view.omitUncursed && buc === 'uncursed')
            ? undefined : buc,
    };
}
export function assignInventoryLetter(item) {
    if (item.oclass === COIN_CLASS) {
        item.invlet = '$';
        return item;
    }
    // invent.c:assigninvlet() uses a persistent rotating cursor rather than
    // inventory length.  Consuming p and r must not make a later wished item
    // reuse q; after the last assignment was r, the next free slot is s.
    if (!Number.isInteger(game._lastInvNr)) {
        const previous = Array.from(game.inventory).reverse().find(object => /^[a-zA-Z]$/.test(object.invlet || ''));
        if (!previous?.invlet)
            game._lastInvNr = 51;
        else {
            const code = previous.invlet.charCodeAt(0);
            game._lastInvNr = code >= 97 ? code - 97 : code - 65 + 26;
        }
    }
    const inUse = new Set(game.inventory.map(object => object.invlet));
    // C invent.c:assigninvlet() first preserves a valid incoming letter when
    // no carried object currently owns it.  Stolen/dropped/recovered objects
    // retain identity across freeinv(), so reassignment must not advance the
    // rotating cursor merely because the object left hero inventory.
    if (/^[a-zA-Z]$/.test(item.invlet || '')
        && !inUse.has(item.invlet))
        return item;
    item.invlet = null;
    let index = game._lastInvNr;
    if (index === undefined)
        throw new Error('Inventory letter cursor is not initialized');
    for (let count = 0; count < 52; count++) {
        index = (index + 1) % 52;
        const letter = index < 26
            ? String.fromCharCode(97 + index)
            : String.fromCharCode(65 + index - 26);
        if (inUse.has(letter))
            continue;
        item.invlet = letter;
        game._lastInvNr = index;
        break;
    }
    if (!item.invlet)
        item.invlet = '#';
    return item;
}
function prepareInventoryItem(raw, presentation, observe) {
    raw.how_lost = LOST_NONE;
    raw.no_charge = false;
    raw.ox = raw.oy = 0;
    const item = updateInventoryPresentation(raw, presentation);
    if (observe)
        item.dknown = true;
    recordHeroPrizeAcquisition(item, game);
    return item;
}
function linkInventoryItem(item) {
    assignInventoryLetter(item);
    item.where = 'inventory';
    game.inventory.push(item);
    // C invent.c:addinv_core0()/reorder_invent(): fixed letters order the
    // carried chain, including gold before letters and lowercase before uppercase.
    if (game.flags.fixinv !== false) {
        game.inventory.sort((left, right) => inventoryLetterRank(left) - inventoryLetterRank(right));
    }
    return item;
}
function inventoryLetterRank(item) {
    return (item.invlet?.charCodeAt(0) ?? 0) ^ 0x20;
}
async function finishAddedInventoryItem(item) {
    await finishInventoryAddition(item, game);
    attachCursedFigurineTimer(item, game);
    return item;
}
export async function addInventoryItem(raw, presentation = null, observe = true) {
    let item = prepareInventoryItem(raw, presentation, observe);
    const existing = game.inventory.find(other => mergable(other, item, game));
    const added = existing ? await mergeObjectStacks(existing, item, game)
        : linkInventoryItem(item);
    if (!added)
        throw new Error(`Inventory merge rejected object ${item.o_id} after admission`);
    item = added;
    return await finishAddedInventoryItem(item);
}
export async function addCreatedInventoryItem(raw, presentation = null, observe = true) {
    assertCreatedObject(raw, game);
    let item = prepareInventoryItem(raw, presentation, observe);
    const existing = game.inventory.find(other => mergable(other, item, game));
    const added = existing ? await mergeCreatedObjectStacks(existing, item, game)
        : linkInventoryItem(item);
    if (!added)
        throw new Error(`Initial inventory merge rejected object ${item.o_id} after admission`);
    item = added;
    return await finishAddedInventoryItem(item);
}
function startingInventoryRestrictions() {
    return {
        polymorphRing: null, polymorphSpellbook: null,
        polymorphPotion: null, previousRingOrBook: null,
    };
}
// C ini_inv(): exclusions persist across a role's inventory tables and reset
// before race inventory. The level-one-book threshold belongs to each table.
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
    if (OBJECT_USES_KNOWN[item.otyp])
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
    else if (item.oclass === RING_CLASS && OBJECT_CHARGED[item.otyp]
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
function rndAttr(weights) {
    let x = rn2(100);
    for (const i of ATTRIBUTE_INDICES) {
        x -= weights[i];
        if (x < 0)
            return i;
    }
    return 6;
}
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
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const MONEY_INVENTORY = [
    { typ: GOLD_PIECE, spe: 0, cls: COIN_CLASS, min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
const WISHING_INVENTORY = [
    { typ: WAN_WISHING, spe: 3, cls: WAND_CLASS,
        min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];
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
function applyPauperPreknowledge(role) {
    if (!role || !game.u?.uroleplay?.pauper)
        return;
    const otyp = PAUPER_PREKNOWLEDGE.get(role);
    if (otyp)
        recordObjectKnowledge(otyp);
}
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
    game.u.weapon_slots = 2;
    game.spells = [];
    delete game._startingEffectsApplied;
    game.moves = 1;
    game.u.uhunger = 900;
    game.u.uhs = NOT_HUNGRY;
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
            { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
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