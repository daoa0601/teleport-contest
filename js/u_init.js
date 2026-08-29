// u_init.js — Initial hero, pet, inventory, and attribute setup.
// C refs: u_init.c, attrib.c, dog.c, teleport.c, makemon.c.

import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { rn2, rnd, d, rne } from './rng.js';
import { mkobj, mksobj, monsterGoodPosition } from './mklev.js';
import { MONSTER_MOVE } from './monster_data.js';
import { armorSlotFor, findArmorClass } from './armor.js';
import { ensureQuestStatus } from './quest.js';
import { COLNO, ROWNO } from './const.js';
import {
    ARROW, CROSSBOW_BOLT, YA, DART, DAGGER, SCALPEL, SPEAR, AXE, BATTLE_AXE,
    SHORT_SWORD,
    LONG_SWORD, TWO_HANDED_SWORD, KATANA, LANCE, MACE, CLUB, QUARTERSTAFF,
    BULLWHIP, BOW, CROSSBOW, YUMI, SLING,
    HELMET, FEDORA, SPLINT_MAIL, RING_MAIL, LEATHER_ARMOR, LEATHER_JACKET,
    LEATHER_GLOVES, ROBE, SMALL_SHIELD, HAWAIIAN_SHIRT,
    CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE,
    LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING, STATUE,
    LOCK_PICK, CREDIT_CARD, EXPENSIVE_CAMERA, TOWEL, SADDLE, LEASH,
    STETHOSCOPE, TIN_OPENER,
    MAGIC_MARKER, BLINDFOLD, OIL_LAMP, PICK_AXE, TINNING_KIT,
    WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP, BELL, BUGLE, LEATHER_DRUM,
    CRAM_RATION, FOOD_RATION, TRIPE_RATION, TIN, EUCALYPTUS_LEAF, APPLE,
    ORANGE, PEAR,
    MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, SLIME_MOLD,
    CREAM_PIE, CANDY_BAR, FORTUNE_COOKIE, PANCAKE, LEMBAS_WAFER,
    POT_HEALING, POT_EXTRA_HEALING, POT_SICKNESS, POT_WATER,
    SCR_MAGIC_MAPPING, SCR_PUNISHMENT,
    SPE_DETECT_MONSTERS, SPE_HEALING, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER,
    SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, SPE_PROTECTION,
    WAN_SLEEP, WAN_WISHING, GOLD_PIECE, AMULET_OF_YENDOR,
    TOUCHSTONE, FLINT, ROCK,
    OBJECT_NAMES, OBJECT_DESCRIPTIONS, OBJECT_BASES, OBJECT_CHARGED, OBJECT_WEIGHT,
    OBJECT_SPELL_LEVEL, OBJECT_SPELL_CATEGORY, OBJECT_SUBTYPE, MAGIC_OBJECTS,
    ELVEN_SHORT_SWORD, ELVEN_ARROW, ELVEN_BOW, ELVEN_SPEAR, ELVEN_DAGGER,
    ELVEN_BROADSWORD, ELVEN_MITHRIL_COAT, ELVEN_LEATHER_HELM, ELVEN_SHIELD,
    ELVEN_BOOTS, ELVEN_CLOAK, ORCISH_ARROW, ORCISH_SPEAR, ORCISH_DAGGER,
    ORCISH_SHORT_SWORD, ORCISH_BOW, ORCISH_HELM, ORCISH_CHAIN_MAIL,
    ORCISH_RING_MAIL, ORCISH_CLOAK, URUK_HAI_SHIELD, ORCISH_SHIELD,
    DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_MATTOCK,
    DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT, DWARVISH_CLOAK,
    DWARVISH_ROUNDSHIELD, CHAIN_MAIL,
} from './object_data.js';
import {
    recordObjectEncounter, recordObjectKnowledge,
} from './object_knowledge.js';
import { ensureHeroSkills } from './skills.js';

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
const SPEAR_TYPES = new Set([
    SPEAR, ELVEN_SPEAR, ORCISH_SPEAR, DWARVISH_SPEAR,
]);
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
        rustproof: true,
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
        charged: true, showBuc: false,
    }],
    [CREDIT_CARD, { class: 'Tools', name: 'credit card', plural: 'credit cards' }],
    [TIN_OPENER, { class: 'Tools', name: 'tin opener', plural: 'tin openers' }],
    [PICK_AXE, { class: 'Tools', name: 'pick-axe', plural: 'pick-axes', enchanted: true }],
    [TINNING_KIT, {
        class: 'Tools', name: 'tinning kit', plural: 'tinning kits', charged: true,
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
        charged: true, showBuc: false,
    }],
    [BLINDFOLD, { class: 'Tools', name: 'blindfold', plural: 'blindfolds' }],
    [OIL_LAMP, { class: 'Tools', name: 'oil lamp', plural: 'oil lamps' }],
    [WAN_WISHING, {
        class: 'Wands', name: 'wand of wishing', plural: 'wands of wishing',
        charged: true, showBuc: false,
    }],
    [WAN_SLEEP, {
        class: 'Wands', name: 'wand of sleep', plural: 'wands of sleep',
        charged: true, showBuc: false,
    }],
]);

function initialRoll(adv) {
    return (adv?.infix || 0) + ((adv?.inrnd || 0) > 0 ? rnd(adv.inrnd) : 0);
}

// C ref: u_init_misc().  The handedness RNG call is made by the shared
// pre-mklev initialization and passed in so that it is consumed only once.
export function uInitMisc(handednessRoll) {
    const g = game;
    const u = g.u || (g.u = {});
    const hp = initialRoll(g.urole?.hpadv) + initialRoll(g.urace?.hpadv);
    const pw = initialRoll(g.urole?.enadv) + (g._initialPwBonus || 0)
        + initialRoll(g.urace?.enadv);

    u.uz = { dnum: 0, dlevel: 1 };
    u.ulevel = u.ulevelmax = 1;
    u.uhp = u.uhpmax = u.uhppeak = hp;
    u.uen = u.uenmax = u.uenpeak = pw;
    // C u_init_misc() calls newhp()/newpw() while ulevel is zero.  Those
    // helpers retain the initial rolls at slot zero so newman() can remove
    // the old body's complete level-based contribution before rebuilding it.
    u.uhpinc = Array(30).fill(0);
    u.ueninc = Array(30).fill(0);
    u.uhpinc[0] = hp;
    u.ueninc[0] = pw;
    u.uexp = 0;
    u.urexp = 0;
    // C u_init_misc(): prayer starts on its own 300-turn cooldown.  Wishes,
    // prayer outcomes, and once-per-turn decay all compose with this value;
    // it is not a disclosure-only default.
    u.ublesscnt = 300;
    u._propertySources = {};
    u.uac = 0; // set_wear() computes this in moveloop_preamble()
    u.ualign = {
        type: g.initAlignment?.value ?? 0,
        record: g.urole?.initrecord || 0,
    };
    // C keeps converted/current and original alignment bases separately from
    // the live alignment record.  Quest readiness consumes all three.
    u.ualignbase = [u.ualign.type, u.ualign.type];
    const configuredNudist = Object.prototype.hasOwnProperty.call(
        g.flags || {}, 'nudist',
    );
    u.uroleplay = {
        ...(u.uroleplay || {}),
        pauper: !!g.flags?.pauper,
        nudist: configuredNudist
            ? !!g.flags.nudist : !!g.flags?.pauper,
    };
    ensureQuestStatus(g);
    u.rightHanded = !!handednessRoll;
    // C initializes the hero with one ordinary action available.  Samurai
    // also gain intrinsic Fast at level 1 (attrib.c sam_abil[]).
    u.umovement = 12;
    u.fast = !!g.urole?.intrinsicFast;
    // C attrib.c race ability tables: dwarves, elves, gnomes, and orcs gain
    // intrinsic infravision at level 1.  It affects monster projection in
    // dark but geometrically visible cells; it does not light the terrain.
    u.infravision = ['dwarf', 'elf', 'gnome', 'orc'].includes(g.urace?.name);
    // C attrib.c level-one role/race ability tables.  Keep these properties
    // on the hero rather than reconstructing them from identity during end
    // disclosure; combat and enlightenment must share the same owner.
    u.poisonResistance = ['barbarian', 'healer'].includes(g.urole?.key)
        || g.urace?.name === 'orc';
    u.stealth = g.urole?.key === 'rogue';
    u.searching = ['archeologist', 'ranger'].includes(g.urole?.key);
    if (g.urole?.key === 'monk') {
        u.sleepResistance = true;
        u.seeInvisible = true;
    }
    u.nv_range = 1;
    u.xray_range = -1;
    g._goldCount = 0;
    g.inventory = [];
    g._lastInvNr = 51;
    g.discoveries = [];
    g.spells = [];
}

// C ref: collect_coords().  Each of the first three rings is completely
// collected and shuffled before enexto_core() tests candidate positions.
export function collectNearbyCoords(
    cx, cy, maxradius = 3, random = rn2, calls = null,
) {
    const coords = [];
    for (let radius = 1; radius <= maxradius; radius++) {
        const start = coords.length;
        const lox = cx - radius, hix = cx + radius;
        const loy = cy - radius, hiy = cy + radius;
        for (let y = Math.max(loy, 0); y <= Math.min(hiy, ROWNO - 1); y++) {
            for (let x = Math.max(lox, 1); x <= Math.min(hix, COLNO - 1); x++) {
                if (x !== lox && x !== hix && y !== loy && y !== hiy) continue;
                coords.push({ x, y });
            }
        }
        let pass = start;
        let n = coords.length - start;
        while (n > 1) {
            const k = random(n);
            if (calls) calls.push(`rn2(${n})`);
            if (k) [coords[pass], coords[pass + k]] = [coords[pass + k], coords[pass]];
            pass++;
            n--;
        }
    }
    return coords;
}

// C ref: dog.c makedog() and pet_type().
export function makedog() {
    const g = game;
    if (g.preferred_pet === 'n') return null;
    const role = g.urole?.key;
    if (role !== 'archeologist' && role !== 'barbarian'
        && role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk' && role !== 'wizard') return null;

    let pettype = g.urole?.petnum;
    if (pettype == null || pettype < 0) {
        if (g.preferred_pet === 'c') pettype = 32; // PM_KITTEN
        else if (g.preferred_pet === 'd') pettype = 16; // PM_LITTLE_DOG
        else pettype = rn2(2) ? 32 : 16;
    }

    const candidates = collectNearbyCoords(g.u.ux, g.u.uy, 3);
    const spot = candidates.find(({ x, y }) =>
        monsterGoodPosition(pettype, x, y, true));
    if (!spot) return null;

    const monsterId = nextIdent();
    // adj_lev() reduces dogs and kittens to level one; a starting pony is
    // level two here and therefore rolls two hit dice.
    let hp = d(role === 'knight' ? 2 : 1, 8);
    if (role !== 'knight' && hp === 1) hp++;
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
        mcanmove: 1,
        movement: 0,
        mmove: MONSTER_MOVE[pettype] ?? 0,
        mspeed: 0,
        symbol: pettype === 100 ? 'u' : pettype === 32 ? 'f' : 'd',
        name: role === 'caveman' ? 'Slasher' : role === 'ranger' ? 'Sirius'
            : role === 'samurai' ? 'Hachi' : '',
        pet: true,
        mtrack: [],
        // C dog.c initedog(): this state belongs to the pet, not to replay
        // logic in the scheduler. More dog inventory/nutrition fields can be
        // added here without changing the movement owner.
        edog: {
            droptime: 0,
            dropdist: 10000,
            // The pet is created before u_init_inventory_attrs(). At this
            // point C's ACURR(A_CHA) clamps the zeroed attribute to 3; the
            // finalized hero Charisma must not be read retroactively.
            apport: g.u?.acurr?.a?.[5] ?? 3,
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
        pet.saddled = true;
        pet.saddle = mksobj(SADDLE, true, false);
    }
    if (!g.level.monsters) g.level.monsters = [];
    g.level.monsters.push(pet);
    g.startingPet = pet;
    if (!g.u.uconduct) g.u.uconduct = {};
    g.u.uconduct.pets = (g.u.uconduct.pets || 0) + 1;
    return pet;
}

function trquan(trobj) {
    if (!trobj.min) return 1;
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
        : `${name}s`;
    return {
        class: CLASS_PRESENTATION[raw.oclass] || 'Other',
        name, plural,
        enchanted: raw.oclass === WEAPON_CLASS || raw.oclass === ARMOR_CLASS
            || (raw.oclass === RING_CLASS && raw.spe !== 0),
        charged: raw.oclass === WAND_CLASS && !!OBJECT_CHARGED[raw.otyp],
        showBuc: raw.oclass === WAND_CLASS ? false : undefined,
        spellName: raw.oclass === SPBOOK_CLASS ? OBJECT_NAMES[raw.otyp] : undefined,
        spellLevel: raw.oclass === SPBOOK_CLASS
            ? OBJECT_SPELL_LEVEL[raw.otyp] : undefined,
        spellCategory: raw.oclass === SPBOOK_CLASS
            ? OBJECT_SPELL_CATEGORY[raw.otyp] : undefined,
    };
}

const DISCOVERY_CLASS_ORDER = [
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems/Stones',
    'Boulders', 'Other',
];

function wizardInitialDiscoveries() {
    const byType = new Map();
    let discoveryOrder = 0;
    const add = (otyp, preknown = false) => {
        const raw = { otyp, oclass: objectClassForType(otyp) };
        const entry = {
            otyp,
            class: CLASS_PRESENTATION[raw.oclass] || 'Other',
            name: qualifiedObjectName(raw),
            appearance: game.objectDescriptions?.[otyp],
            preknown,
            order: discoveryOrder++,
        };
        // An actual starting object is an encountered discovery and should
        // not carry the '*' used for skill-only preknowledge.
        if (!byType.has(otyp) || !preknown) byType.set(otyp, entry);
    };

    for (const item of game.inventory || [])
        if (item._startingInventory) add(item.otyp, false);

    // weapon.c:skill_based_spellbook_id(): Wizards start basic in attack
    // and enchantment, identifying those schools through level 3; their
    // other unrestricted schools begin unskilled and identify level 1.
    for (let otyp = 366; otyp <= 406; otyp++) {
        const category = OBJECT_SPELL_CATEGORY[otyp];
        if (!category) continue;
        const knownLevel = category === 'attack' || category === 'enchantment'
            ? 3 : 1;
        if (OBJECT_SPELL_LEVEL[otyp] <= knownLevel) add(otyp, true);
    }

    return [...byType.values()].sort((a, b) => {
        const classOrder = DISCOVERY_CLASS_ORDER.indexOf(a.class)
            - DISCOVERY_CLASS_ORDER.indexOf(b.class);
        return classOrder || Number(a.preknown) - Number(b.preknown)
            || a.order - b.order;
    });
}

function objectClassForType(otyp) {
    for (let cls = 2; cls < OBJECT_BASES.length - 1; cls++)
        if (otyp >= OBJECT_BASES[cls] && otyp < OBJECT_BASES[cls + 1])
            return cls;
    return 1;
}

// C ref: u_init.c knows_class().  Role preknowledge is installed before
// ini_inv_use_obj() records starting-inventory encounters, so discovery order
// within each class remains the object-table order followed by any exceptions
// such as the Knight's ordinary small shield.
function knowsClass(oclass, role) {
    const low = OBJECT_BASES[oclass];
    const high = OBJECT_BASES[oclass + 1] || OBJECT_NAMES.length;
    const excludedArmor = new Set([
        OBJECT_NAMES.indexOf('cornuthaum'),
        OBJECT_NAMES.indexOf('dunce cap'),
        SMALL_SHIELD,
    ]);
    for (let otyp = low; otyp < high; otyp++) {
        if (MAGIC_OBJECTS.has(otyp)) continue;
        if (oclass === ARMOR_CLASS && excludedArmor.has(otyp)) continue;
        if (oclass === WEAPON_CLASS) {
            const skill = OBJECT_SUBTYPE[otyp] || 0;
            if (['barbarian', 'valkyrie'].includes(role) && skill === 16)
                continue;
            if (role === 'ranger'
                && !([-20, -22, 17, 20, 21, 22].includes(skill)))
                continue;
            if (role === 'rogue' && skill !== 1) continue;
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
    } else if (!pauper
        && ['barbarian', 'knight', 'samurai', 'valkyrie'].includes(role))
        knowsClass(WEAPON_CLASS, role);
    else if (!pauper && (role === 'ranger' || role === 'rogue'))
        knowsClass(WEAPON_CLASS, role);

    if (!pauper
        && ['barbarian', 'knight', 'monk', 'samurai', 'valkyrie'].includes(role))
        knowsClass(ARMOR_CLASS, role);
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
export function finishStartingDiscoveries() {
    for (const item of game.inventory || []) {
        if (!item._startingInventory || !OBJECT_DESCRIPTIONS[item.otyp])
            continue;
        recordObjectKnowledge(item.otyp);
        recordObjectEncounter(item.otyp);
    }
}

export function inventoryItem(raw, presentation = null) {
    let view = presentation || ITEM_PRESENTATION.get(raw.otyp)
        || (raw._startingInventory ? sourceKnownPresentation(raw) : null) || {
        class: 'Other', name: `object ${raw.otyp}`, plural: `objects ${raw.otyp}`,
    };
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
        const orcish = game.urace?.mnum === 4;
        view = raw.otyp === SHORT_SWORD ? {
            ...view,
            name: orcish ? 'orcish short sword' : 'short sword',
            plural: orcish ? 'orcish short swords' : 'short swords',
            omitUncursed: true,
        } : { ...view, omitUncursed: true };
    }
    if (DAGGER_TYPES.has(raw.otyp) && game.urole?.key === 'rogue') {
        view = raw.otyp === DAGGER && game.urace?.mnum === 4
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
        ...raw,
        ...view,
        quantity: raw.quan,
        enchantment: view.enchanted ? raw.spe : undefined,
        buc: view.showBuc === false || (view.omitUncursed && buc === 'uncursed')
            ? undefined : buc,
        charges: view.charged ? { recharged: 0, current: raw.spe } : undefined,
        rustproof: !!view.rustproof,
    };
}

export function assignInventoryLetter(item) {
    // invent.c:assigninvlet() uses a persistent rotating cursor rather than
    // inventory length.  Consuming p and r must not make a later wished item
    // reuse q; after the last assignment was r, the next free slot is s.
    if (!Number.isInteger(game._lastInvNr)) {
        const previous = Array.from(game.inventory).reverse().find(object =>
            /^[a-zA-Z]$/.test(object.invlet || ''));
        if (!previous) game._lastInvNr = 51;
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
        && !inUse.has(item.invlet)) return item;
    item.invlet = null;
    let index = game._lastInvNr;
    for (let count = 0; count < 52; count++) {
        index = (index + 1) % 52;
        const letter = index < 26
            ? String.fromCharCode(97 + index)
            : String.fromCharCode(65 + index - 26);
        if (inUse.has(letter)) continue;
        item.invlet = letter;
        game._lastInvNr = index;
        break;
    }
    return item;
}

export function addInventoryItem(raw, presentation = null, observe = true) {
    const item = inventoryItem(raw, presentation);
    if (observe) item.dknown = true;
    const merge = game.inventory.find(other => other.otyp === item.otyp
        && other.enchantment === item.enchantment && other.buc === item.buc
        && other.corpsenm === item.corpsenm && other.spe === item.spe);
    if (merge) {
        merge.quantity += item.quantity;
        merge.quan = merge.quantity;
        return merge;
    }
    assignInventoryLetter(item);
    game.inventory.push(item);
    return item;
}

function addStartingItem(raw) {
    // C ini_inv_adjust_obj() makes every aspect of starting inventory
    // observable, then ini_inv_use_obj() discovers its concrete type.
    raw._startingInventory = true;
    raw.known = true;
    raw.dknown = raw.bknown = raw.rknown = true;
    if ([LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK,
        BAG_OF_HOLDING, STATUE].includes(raw.otyp)) {
        raw.cknown = raw.lknown = true;
        raw.otrapped = 0;
    }
    const item = addInventoryItem(raw);
    item.typeKnown = true;
    return item;
}

function useStartingItem(item) {
    if (item.otyp === ARROW || item.otyp === CROSSBOW_BOLT
        || item.otyp === YA || item.otyp === DART || item.otyp === FLINT) {
        if (!game.uquiver) {
            game.uquiver = item;
            item.ready = true;
        }
    } else if (SPEAR_TYPES.has(item.otyp)
        || item.otyp === MACE || item.otyp === BULLWHIP
        || item.otyp === BATTLE_AXE || item.otyp === TWO_HANDED_SWORD
        || item.otyp === LONG_SWORD || item.otyp === QUARTERSTAFF) {
        game.uwep = item;
        item.wielded = true;
    } else if (DAGGER_TYPES.has(item.otyp) || item.otyp === SCALPEL
        || item.otyp === KATANA || item.otyp === CLUB) {
        if (game.urole?.key === 'rogue' && game.uwep && !game.uquiver) {
            game.uquiver = item;
            item.ready = true;
        } else if (game.urole?.key === 'valkyrie' && game.uwep && !game.uswapwep) {
            game.uswapwep = item;
            item.alternate = true;
        } else {
            game.uwep = item;
            item.wielded = true;
        }
    } else if (item.otyp === BOW || item.otyp === CROSSBOW
        || item.otyp === SLING || item.otyp === LANCE) {
        game.uswapwep = item;
        item.alternate = true;
    } else if (item.otyp === PICK_AXE || item.otyp === TIN_OPENER) {
        // u_init.c:ini_inv_use_obj() treats weapon-tools and the tin opener
        // like weapons for initial primary/alternate slot assignment.
        if (!game.uwep) {
            game.uwep = item;
            item.wielded = true;
        } else if (!game.uswapwep) {
            game.uswapwep = item;
            item.alternate = true;
        }
    } else if (item.otyp === AXE || SHORT_SWORD_TYPES.has(item.otyp)
        || item.otyp === YUMI) {
        if (!game.uwep) {
            game.uwep = item;
            item.wielded = true;
        } else if (!game.uswapwep) {
            game.uswapwep = item;
            item.alternate = true;
        }
    } else if (item.oclass === ARMOR_CLASS && armorSlotFor(item.otyp)) {
        game[armorSlotFor(item.otyp)] = item;
        item.worn = true;
    } else if (item.oclass === SPBOOK_CLASS && item.spellName) {
        game.spells.push({
            name: item.spellName,
            level: item.spellLevel,
            category: item.spellCategory,
            skill: (game.urole?.key === 'wizard'
                    && ['attack', 'enchantment'].includes(item.spellCategory))
                || ['healer', 'monk'].includes(game.urole?.key)
                || (game.urole?.key === 'priest'
                    && item.spellCategory === 'clerical')
                ? 'basic' : 'unskilled',
            know: 20000,
            retention: ['healer', 'monk'].includes(game.urole?.key) ? 91 : 100,
            fail: game.urole?.key === 'healer'
                ? spellFailForHealer(item.spellName) : 0,
            otyp: item.otyp,
        });
    }
}

function spellFailForHealer(name) {
    return name === 'extra healing' ? 68 : name === 'stone to flesh' ? 76 : 0;
}

function priestSpellbookAllowed(otyp) {
    const alreadyHasLevelOne = game.inventory.some(item =>
        item.oclass === SPBOOK_CLASS && item.spellLevel === 1);
    // C u_init.c:restricted_spell_discipline() consults Skill_P rather than
    // enumerating object identities.  Priests may start with any healing,
    // divination, or clerical book under the current level threshold.
    const allowedDisciplines = new Set([
        'healing', 'divination', 'clerical',
    ]);
    const level = OBJECT_SPELL_LEVEL[otyp] ?? 0;
    return level > 0
        && level <= (alreadyHasLevelOne ? 3 : 1)
        && allowedDisciplines.has(OBJECT_SPELL_CATEGORY[otyp])
        && !game.inventory.some(item => item.otyp === otyp);
}

function wizardSpellbookAllowed(otyp) {
    // Wizard begins with force bolt, so ini_inv_mkobj_filter() permits an
    // additional book through level three, from any of Wizard's disciplines.
    // Blank paper and a duplicate force bolt remain explicitly excluded.
    return new Set([
        367, 370, 372, SPE_DETECT_MONSTERS, SPE_HEALING, 375,
        378, 379, 380, 381, 382, 383, 384, 385, 386, 388, 389,
        SPE_EXTRA_HEALING, 395, 397, SPE_PROTECTION, 404,
        SPE_STONE_TO_FLESH, 406,
    ]).has(otyp);
}

function randomStartingItemAllowed(raw) {
    // C ini_inv_mkobj_filter(): random starting rings must not be overly
    // powerful or actively harmful, and repeated rings are rerolled.  The
    // numeric ids are stable positions in objects.h's contiguous ring table.
    const RIN_LEVITATION = 183;
    const RIN_HUNGER = 184;
    const RIN_AGGRAVATE_MONSTER = 185;
    const POT_HALLUCINATION = 304;
    const POT_ACID = 320;
    const SCR_AMNESIA = 338;
    const SCR_FIRE = 339;
    const SCR_BLANK_PAPER = 365;
    const SCR_ENCHANT_WEAPON = 328;
    if (raw.otyp === WAN_WISHING
        || raw.otyp === RIN_LEVITATION
        || raw.otyp === RIN_HUNGER
        || raw.otyp === RIN_AGGRAVATE_MONSTER
        || raw.otyp === POT_HALLUCINATION
        || raw.otyp === POT_ACID
        || raw.otyp === SCR_AMNESIA
        || raw.otyp === SCR_FIRE
        || raw.otyp === SCR_BLANK_PAPER
        // C u_init.c:ini_inv_mkobj_filter(): Monks have no weapon skill
        // use for this otherwise legal random starting scroll.
        || (game.urole?.key === 'monk' && raw.otyp === SCR_ENCHANT_WEAPON))
        return false;
    if (raw.oclass === RING_CLASS
        && game.inventory.some(item => item.otyp === raw.otyp)) return false;
    return true;
}

// Direct port of ini_inv() for fixed and class-generated inventory entries.
function iniInv(table) {
    // u_init.c:ini_inv() returns before trquan() or object construction.
    // Role/race optional-choice RNG remains with each caller.
    if (game.u?.uroleplay?.pauper) return;
    let index = 0;
    let quan = trquan(table[index]);
    while (table[index].cls) {
        const trobj = table[index];
        let raw;
        if (trobj.typ === UNDEF_TYP) {
            do raw = mkobj(trobj.cls, false);
            while (!randomStartingItemAllowed(raw)
                || (trobj.cls === SPBOOK_CLASS
                    && ((game.urole?.key === 'priest'
                            && !priestSpellbookAllowed(raw.otyp))
                        || (game.urole?.key === 'wizard'
                            && !wizardSpellbookAllowed(raw.otyp)))));
        } else {
            raw = mksobj(trobj.typ, true, false);
        }

        const substituted = INITIAL_RACE_SUBSTITUTIONS
            .get(game.urace?.mnum)?.get(raw.otyp);
        if (substituted !== undefined) {
            raw.otyp = substituted;
            raw.owt = OBJECT_WEIGHT[substituted] ?? raw.owt;
        }

        // C creates and substitutes the object before enforcing nudist. On
        // rejection it advances the template while retaining the current
        // quantity counter; do not introduce a replacement trquan() draw.
        if (game.u?.uroleplay?.nudist && raw.oclass === ARMOR_CLASS) {
            index++;
            continue;
        }

        raw.cursed = false;
        let stop = false;
        if (raw.oclass === WEAPON_CLASS || raw.oclass === TOOL_CLASS) {
            raw.quan = trquan(trobj);
            stop = true;
        }
        if (trobj.spe !== UNDEF_SPE) {
            raw.spe = trobj.spe;
            if (trobj.typ === MAGIC_MARKER && raw.spe < 96) raw.spe += rn2(4);
        } else if (raw.oclass === RING_CLASS
            && OBJECT_CHARGED[raw.otyp] && (raw.spe ?? 0) <= 0) {
            // u_init.c:ini_inv_adjust_obj(): a random charged starting ring
            // must never retain a zero or negative constructor enchantment.
            // This occurs after mksobj_init() and before the next template
            // entry, so both the rne calls and the positive spe are visible.
            raw.spe = rne(3);
        }
        if (trobj.bless !== UNDEF_BLESS) raw.blessed = !!trobj.bless;

        const item = addStartingItem(raw);
        useStartingItem(item);
        if (stop) quan = 1;
        if (--quan) continue;
        index++;
        quan = trquan(table[index]);
    }
}

function rndAttr(weights) {
    let x = rn2(100);
    for (let i = 0; i < weights.length; i++) {
        x -= weights[i];
        if (x < 0) return i;
    }
    return weights.length;
}

// C refs: init_attr(75), vary_init_attr().
function initAttributes() {
    const role = game.urole;
    const race = game.urace;
    const values = role.attrbase.slice();
    let points = 75 - values.reduce((sum, value) => sum + value, 0);
    let tries = 0;
    while (points > 0 && tries < 100) {
        const i = rndAttr(role.attrdist);
        if (i >= values.length || values[i] >= race.attrmax[i]) {
            tries++;
            continue;
        }
        tries = 0;
        values[i]++;
        points--;
    }
    for (let i = 0; i < values.length; i++) {
        if (!rn2(20)) {
            const delta = rn2(7) - 2;
            values[i] = Math.max(race.attrmin[i], Math.min(race.attrmax[i], values[i] + delta));
        }
    }

    // JS status code stores the traditional display order rather than the
    // internal C order: Str, Dex, Con, Int, Wis, Cha.
    const displayOrder = [values[0], values[3], values[4], values[1], values[2], values[5]];
    game.u.acurr = { a: displayOrder.slice() };
    game.u.amax = { a: displayOrder.slice() };
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

const WISHING_INVENTORY = [
    { typ: WAN_WISHING, spe: 3, cls: WAND_CLASS,
        min: 1, max: 1, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];

function uInitRaceInventoryAndKnowledge(role) {
    const race = game.urace?.mnum;
    let preknown = [];
    if (race === 1) {
        // u_init.c:u_init_race().  Non-warrior elves receive exactly one
        // non-magical instrument; ROLL_FROM owns the selection draw before
        // the chosen one-entry inventory template is constructed.
        if (role === 'priest' || role === 'wizard') {
            const instrument = ELF_INSTRUMENTS[rn2(ELF_INSTRUMENTS.length)];
            iniInv(oneItem(instrument));
        }
        preknown = ELF_PREKNOWN_OBJECTS;
    } else if (race === 2) {
        preknown = DWARF_PREKNOWN_OBJECTS;
    } else if (race === 4) {
        // C compensates every non-Wizard Orc after role inventory, not only
        // the public Rogue carrier which originally exposed this branch.
        if (role !== 'wizard') iniInv(XTRA_FOOD_INVENTORY);
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
    if (!game.u?.uroleplay?.pauper) return;
    const otyp = PAUPER_PREKNOWLEDGE.get(role);
    if (otyp) recordObjectKnowledge(otyp);
}

export function uInitInventoryAttrs() {
    const role = game.urole?.key;
    if (role !== 'archeologist' && role !== 'barbarian'
        && role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk' && role !== 'wizard') return false;
    game.inventory = [];
    game._lastInvNr = 51;
    game.uwep = game.uswapwep = game.uquiver = null;
    game.uarm = game.uarms = game.uarmc = game.uarmu = game.uarmg = game.uarmh = null;
    game.u.weaponSkills = null;
    game.u.skillRecord = [];
    game.moves = 1;
    game.u.uhunger = 900;
    // C resets u.umoney0 before the role switch so repeated character
    // initialization cannot inherit another role's purse.
    game._goldCount = 0;
    game._initialGoldCount = 0;
    if (role === 'archeologist') {
        iniInv(ARCHEOLOGIST_INVENTORY);
        if (!rn2(10)) iniInv(oneItem(TIN_OPENER));
        else if (!rn2(4)) iniInv(oneItem(OIL_LAMP, 1));
        else if (!rn2(5)) iniInv(oneItem(MAGIC_MARKER, 19));
    } else if (role === 'barbarian') {
        iniInv(rn2(100) >= 50
            ? BARBARIAN_SWORD_INVENTORY : BARBARIAN_AXE_INVENTORY);
        if (!rn2(6)) iniInv(oneItem(OIL_LAMP, 1));
    } else if (role === 'caveman') {
        iniInv(CAVEMAN_INVENTORY);
    } else if (role === 'rogue') {
        iniInv(ROGUE_INVENTORY);
        if (!rn2(5)) iniInv(oneItem(BLINDFOLD));
    } else if (role === 'tourist') {
        game._goldCount = rnd(1000);
        iniInv(TOURIST_INVENTORY);
        if (!rn2(25)) iniInv(oneItem(TIN_OPENER));
        else if (!rn2(25)) iniInv(oneItem(LEASH));
        else if (!rn2(25)) iniInv(oneItem(TOWEL));
        else if (!rn2(20)) iniInv(oneItem(MAGIC_MARKER, 19));
    } else if (role === 'samurai') {
        iniInv(SAMURAI_INVENTORY);
        if (!rn2(5)) iniInv(oneItem(BLINDFOLD));
    } else if (role === 'valkyrie') {
        iniInv(VALKYRIE_INVENTORY);
        if (!rn2(6)) iniInv(oneItem(OIL_LAMP, 1));
    } else if (role === 'priest') {
        iniInv(PRIEST_INVENTORY);
        if (!rn2(5)) iniInv(oneItem(MAGIC_MARKER, 19));
        else if (!rn2(10)) iniInv(oneItem(OIL_LAMP, 1));
    } else if (role === 'healer') {
        game._goldCount = 1001 + rn2(1000);
        iniInv(HEALER_INVENTORY);
        if (!rn2(25)) iniInv(oneItem(OIL_LAMP, 1));
    } else if (role === 'knight') {
        iniInv(KNIGHT_INVENTORY);
        game.u.jumping = true;
    } else if (role === 'monk') {
        iniInv(MONK_INVENTORY);
        const spell = [SPE_HEALING, SPE_PROTECTION, SPE_CONFUSE_MONSTER]
            [Math.trunc(rn2(90) / 30)];
        iniInv([
            { typ: spell, spe: UNDEF_SPE, cls: SPBOOK_CLASS,
                min: 1, max: 1, bless: 1 },
            { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
        ]);
        if (!rn2(4)) iniInv(oneItem(MAGIC_MARKER, 19));
        else if (!rn2(10)) iniInv(oneItem(OIL_LAMP, 1));
    } else if (role === 'wizard') {
        iniInv(WIZARD_INVENTORY);
        if (!rn2(5)) iniInv(oneItem(BLINDFOLD));
    } else {
        iniInv(RANGER_INVENTORY);
    }
    // C u_init_role() installs explicit role/class knowledge before
    // u_init_race() adds race inventory and knowledge.
    initializeRolePreknowledge(role);
    uInitRaceInventoryAndKnowledge(role);
    // C applies discover-mode wishing inventory to every role after racial
    // startup, then materializes role money.  Keeping these outside public
    // role branches makes the constructor order option- and race-general.
    if (game.flags?.explore) iniInv(WISHING_INVENTORY);
    if (game.u?.uroleplay?.pauper) game._goldCount = 0;
    if (game._goldCount) {
        game._initialGoldCount = game._goldCount;
        // ini_inv(Money): its object is kept outside lettered inventory.
        rn2(1);
        mksobj(GOLD_PIECE, true, false);
    }
    // C u_init_inventory_attrs(): any hero who starts with a learned spell
    // receives enough power to cast a level-one spell at least once.
    if (game.spells.length && (game.u.uenmax || 0) < 5)
        game._startingPwMinimum = 5;
    initAttributes();
    game.discoveries = game.u?.uroleplay?.pauper ? []
        : role === 'archeologist' || role === 'barbarian'
        ? [] : role === 'healer' ? [
        { class: 'Armor', name: 'pair of leather gloves', appearance: 'fencing gloves' },
        { class: 'Spellbooks', name: 'spellbook of healing', appearance: 'wrinkled' },
        { class: 'Spellbooks', name: 'spellbook of extra healing', appearance: 'dog eared' },
        { class: 'Spellbooks', name: 'spellbook of stone to flesh', appearance: 'stained' },
        { class: 'Potions', name: 'potion of full healing', appearance: 'white', preknown: true },
        { class: 'Potions', name: 'potion of healing', appearance: 'milky' },
        { class: 'Potions', name: 'potion of extra healing', appearance: 'effervescent' },
        { class: 'Wands', name: 'wand of sleep', appearance: 'platinum' },
    ] : role === 'priest' ? [] : role === 'caveman' ? [
        ...(game.flags?.explore ? [{
            class: 'Wands', name: 'wand of wishing', appearance: 'hexagonal',
        }] : []),
    ] : role === 'tourist' ? [
        { class: 'Scrolls', name: 'scroll of magic mapping', appearance: 'ANDOVA BEGARIN' },
        { class: 'Potions', name: 'potion of extra healing', appearance: 'murky' },
        ...(game.flags?.explore ? [{
            class: 'Wands', name: 'wand of wishing', appearance: 'ebony',
        }] : []),
    ] : role === 'samurai' ? [
        { class: 'Weapons', name: 'elven arrow', appearance: 'runed arrow', preknown: true },
        { class: 'Weapons', name: 'orcish arrow', appearance: 'crude arrow', preknown: true },
        { class: 'Weapons', name: 'ya', appearance: 'bamboo arrow' },
        { class: 'Weapons', name: 'shuriken', appearance: 'throwing star', preknown: true },
        { class: 'Weapons', name: 'elven spear', appearance: 'runed spear', preknown: true },
        { class: 'Weapons', name: 'orcish spear', appearance: 'crude spear', preknown: true },
        { class: 'Weapons', name: 'dwarvish spear', appearance: 'stout spear', preknown: true },
        { class: 'Weapons', name: 'javelin', appearance: 'throwing spear', preknown: true },
        { class: 'Weapons', name: 'elven dagger', appearance: 'runed dagger', preknown: true },
        { class: 'Weapons', name: 'orcish dagger', appearance: 'crude dagger', preknown: true },
        { class: 'Weapons', name: 'shito', bracket: 'knife', preknown: true },
        { class: 'Weapons', name: 'battle-axe', appearance: 'double-headed axe', preknown: true },
        { class: 'Weapons', name: 'wakizashi', bracket: 'short sword' },
        { class: 'Weapons', name: 'elven short sword', appearance: 'runed short sword', preknown: true },
        { class: 'Weapons', name: 'orcish short sword', appearance: 'crude short sword', preknown: true },
        { class: 'Weapons', name: 'dwarvish short sword', appearance: 'broad short sword', preknown: true },
        { class: 'Weapons', name: 'scimitar', appearance: 'curved sword', preknown: true },
        { class: 'Weapons', name: 'ninja-to', bracket: 'broadsword', preknown: true },
        { class: 'Weapons', name: 'elven broadsword', appearance: 'runed broadsword', preknown: true },
        { class: 'Weapons', name: 'katana', appearance: 'samurai sword' },
    ] : role === 'knight' ? [
        { class: 'Weapons', name: 'elven arrow', appearance: 'runed arrow', preknown: true },
        { class: 'Weapons', name: 'orcish arrow', appearance: 'crude arrow', preknown: true },
        { class: 'Weapons', name: 'ya', appearance: 'bamboo arrow', preknown: true },
        { class: 'Weapons', name: 'shuriken', appearance: 'throwing star', preknown: true },
        { class: 'Weapons', name: 'elven spear', appearance: 'runed spear', preknown: true },
        { class: 'Weapons', name: 'orcish spear', appearance: 'crude spear', preknown: true },
        { class: 'Weapons', name: 'dwarvish spear', appearance: 'stout spear', preknown: true },
        { class: 'Weapons', name: 'javelin', appearance: 'throwing spear', preknown: true },
        { class: 'Weapons', name: 'elven dagger', appearance: 'runed dagger', preknown: true },
        { class: 'Weapons', name: 'orcish dagger', appearance: 'crude dagger', preknown: true },
        { class: 'Weapons', name: 'battle-axe', appearance: 'double-headed axe', preknown: true },
        { class: 'Weapons', name: 'elven short sword', appearance: 'runed short sword', preknown: true },
        { class: 'Weapons', name: 'orcish short sword', appearance: 'crude short sword', preknown: true },
        { class: 'Weapons', name: 'dwarvish short sword', appearance: 'broad short sword', preknown: true },
        { class: 'Weapons', name: 'scimitar', appearance: 'curved sword', preknown: true },
        { class: 'Weapons', name: 'elven broadsword', appearance: 'runed broadsword', preknown: true },
        { class: 'Weapons', name: 'katana', appearance: 'samurai sword', preknown: true },
        { class: 'Weapons', name: 'tsurugi', appearance: 'long samurai sword', preknown: true },
        { class: 'Weapons', name: 'runesword', appearance: 'runed broadsword', preknown: true },
        { class: 'Weapons', name: 'partisan', appearance: 'vulgar polearm', preknown: true },
    ] : role === 'valkyrie' ? [
        { class: 'Weapons', name: 'elven arrow', appearance: 'runed arrow', preknown: true },
        { class: 'Weapons', name: 'orcish arrow', appearance: 'crude arrow', preknown: true },
        { class: 'Weapons', name: 'ya', appearance: 'bamboo arrow', preknown: true },
        { class: 'Weapons', name: 'shuriken', appearance: 'throwing star', preknown: true },
        { class: 'Weapons', name: 'elven spear', appearance: 'runed spear', preknown: true },
        { class: 'Weapons', name: 'orcish spear', appearance: 'crude spear', preknown: true },
        { class: 'Weapons', name: 'dwarvish spear', appearance: 'stout spear', preknown: true },
        { class: 'Weapons', name: 'javelin', appearance: 'throwing spear', preknown: true },
        { class: 'Weapons', name: 'elven dagger', appearance: 'runed dagger', preknown: true },
        { class: 'Weapons', name: 'orcish dagger', appearance: 'crude dagger', preknown: true },
        { class: 'Weapons', name: 'battle-axe', appearance: 'double-headed axe', preknown: true },
        { class: 'Weapons', name: 'elven short sword', appearance: 'runed short sword', preknown: true },
        { class: 'Weapons', name: 'orcish short sword', appearance: 'crude short sword', preknown: true },
        { class: 'Weapons', name: 'dwarvish short sword', appearance: 'broad short sword', preknown: true },
        { class: 'Weapons', name: 'scimitar', appearance: 'curved sword', preknown: true },
        { class: 'Weapons', name: 'elven broadsword', appearance: 'runed broadsword', preknown: true },
        { class: 'Weapons', name: 'katana', appearance: 'samurai sword', preknown: true },
        { class: 'Weapons', name: 'tsurugi', appearance: 'long samurai sword', preknown: true },
        { class: 'Weapons', name: 'runesword', appearance: 'runed broadsword', preknown: true },
        { class: 'Weapons', name: 'dwarvish mattock', appearance: 'broad pick', preknown: true },
    ] : role === 'monk' ? [
        { class: 'Weapons', name: 'shuriken', appearance: 'throwing star', preknown: true },
        { class: 'Armor', name: 'elven leather helm', appearance: 'leather hat', preknown: true },
        { class: 'Armor', name: 'orcish helm', appearance: 'iron skull cap', preknown: true },
        { class: 'Armor', name: 'dwarvish iron helm', appearance: 'hard hat', preknown: true },
        { class: 'Armor', name: 'helmet', appearance: 'etched helmet', preknown: true },
        { class: 'Armor', name: 'orcish chain mail', appearance: 'crude chain mail', preknown: true },
        { class: 'Armor', name: 'orcish ring mail', appearance: 'crude ring mail', preknown: true },
        { class: 'Armor', name: 'orcish cloak', appearance: 'coarse mantelet', preknown: true },
        { class: 'Armor', name: 'dwarvish cloak', appearance: 'hooded cloak', preknown: true },
        { class: 'Armor', name: 'oilskin cloak', appearance: 'slippery cloak', preknown: true },
        { class: 'Armor', name: 'elven shield', appearance: 'blue and green shield', preknown: true },
        { class: 'Armor', name: 'Uruk-hai shield', appearance: 'white-handed shield', preknown: true },
        { class: 'Armor', name: 'orcish shield', appearance: 'red-eyed shield', preknown: true },
        { class: 'Armor', name: 'dwarvish roundshield', appearance: 'large round shield', preknown: true },
        { class: 'Armor', name: 'pair of leather gloves', appearance: 'fencing gloves' },
        { class: 'Armor', name: 'pair of low boots', appearance: 'walking shoes', preknown: true },
        { class: 'Armor', name: 'pair of iron shoes', appearance: 'hard shoes', preknown: true },
        { class: 'Armor', name: 'pair of high boots', appearance: 'jackboots', preknown: true },
        { class: 'Scrolls', name: 'scroll of punishment', appearance: 'ELAM EBOW' },
    ] : role === 'rogue' && game.urace?.mnum === 4 ? [
        { class: 'Weapons', name: 'elven dagger', appearance: 'runed dagger', preknown: true },
        { class: 'Weapons', name: 'orcish dagger', appearance: 'crude dagger' },
        { class: 'Weapons', name: 'orcish short sword', appearance: 'crude short sword' },
        { class: 'Weapons', name: 'orcish arrow', appearance: 'crude arrow', preknown: true },
        { class: 'Weapons', name: 'orcish bow', appearance: 'crude bow', preknown: true },
        { class: 'Weapons', name: 'orcish spear', appearance: 'crude spear', preknown: true },
        { class: 'Armor', name: 'orcish chain mail', appearance: 'crude chain mail', preknown: true },
        { class: 'Armor', name: 'orcish ring mail', appearance: 'crude ring mail', preknown: true },
        { class: 'Armor', name: 'orcish helm', appearance: 'iron skull cap', preknown: true },
        { class: 'Armor', name: 'orcish shield', appearance: 'red-eyed shield', preknown: true },
        { class: 'Armor', name: 'Uruk-hai shield', appearance: 'white-handed shield', preknown: true },
        { class: 'Armor', name: 'orcish cloak', appearance: 'coarse mantelet', preknown: true },
        { class: 'Potions', name: 'potion of sickness', appearance: 'pink' },
        { class: 'Tools', name: 'sack', appearance: 'bag' },
    ] : role === 'rogue' ? [
        { class: 'Weapons', name: 'elven dagger', appearance: 'runed dagger', preknown: true },
        { class: 'Weapons', name: 'orcish dagger', appearance: 'crude dagger', preknown: true },
        { class: 'Potions', name: 'potion of sickness', appearance: 'pink' },
        { class: 'Tools', name: 'sack', appearance: 'bag' },
    ] : [
        { class: 'Weapons', name: 'elven arrow', appearance: 'runed arrow', preknown: true },
        { class: 'Weapons', name: 'orcish arrow', appearance: 'crude arrow', preknown: true },
        { class: 'Weapons', name: 'ya', appearance: 'bamboo arrow', preknown: true },
        { class: 'Weapons', name: 'elven spear', appearance: 'runed spear', preknown: true },
        { class: 'Weapons', name: 'orcish spear', appearance: 'crude spear', preknown: true },
        { class: 'Weapons', name: 'dwarvish spear', appearance: 'stout spear', preknown: true },
        { class: 'Weapons', name: 'javelin', appearance: 'throwing spear', preknown: true },
        { class: 'Weapons', name: 'elven bow', appearance: 'runed bow', preknown: true },
        { class: 'Weapons', name: 'orcish bow', appearance: 'crude bow', preknown: true },
        { class: 'Weapons', name: 'yumi', appearance: 'long bow', preknown: true },
        { class: 'Armor', name: 'cloak of displacement', appearance: 'opera cloak' },
    ];
    if (role === 'wizard' && !game.u?.uroleplay?.pauper) {
        game.discoveries = wizardInitialDiscoveries();
        // weapon.c:skill_based_spellbook_id() and ini_inv_use_obj() both
        // feed o_init.c's authoritative object-knowledge table.  The legacy
        // discoveries projection is only a menu view; naming code must see
        // the same knowledge before the first command is processed.
        for (const discovery of game.discoveries) {
            recordObjectKnowledge(discovery.otyp);
            if (!discovery.preknown) recordObjectEncounter(discovery.otyp);
        }
    }
    game.urole.rank = game.urole.title?.[0] || game.urole.name;
    // weapon.c:skill_init() snapshots the startup inventory here.  Later
    // wishes, pickups, drops, and weapon changes must not redefine which
    // classes began at Basic.
    ensureHeroSkills(game);
    applyPauperPreknowledge(role);
    return true;
}

export function setInitialArmorClass() {
    findArmorClass(game);
}
