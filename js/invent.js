// invent.js — the invent.c owner: inventory admission (addinv/freeinv/
// assigninvlet/reorder), getobj selection, the 'I' reports and unpaid
// views, look_here()/dolook(), doorganize/#adjust, and stack merging,
// delallobj() and g_at().
// C ref: invent.c — addinv(), getobj(), ddoinv(), display_inventory(),
// look_here(), doorganize(), dolook(), delallobj(), g_at().
import { RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS, } from './objclass.js';
import { objectClassForType, objectSkill, objectMerge, objectUsesKnown, objectUnique, CRYSKNIFE, ALCHEMY_SMOCK, ARROW as FIRST_OBJECT, BAG_OF_TRICKS, EGG, FORTUNE_COOKIE, GOLD_PIECE, HAWAIIAN_SHIRT, MAGIC_MARKER, HEAVY_IRON_BALL, LOCK_PICK, CREDIT_CARD, SKELETON_KEY, OBJ_NAME, oc_level, SCR_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, STATUE, TIN, TIN_OPENER, TOWEL, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, BEARTRAP, BELL, BELL_OF_OPENING, BLINDFOLD, BRASS_LANTERN, BULLWHIP, CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CORPSE, CREAM_PIE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, DWARVISH_MATTOCK, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA, FIGURINE, GRAPPLING_HOOK, HORN_OF_PLENTY, LAND_MINE, LEASH, LENSES, MAGIC_LAMP, MAGIC_WHISTLE, MEAT_RING, MIRROR, OBJECT_NAMES, OIL_LAMP, PICK_AXE, POT_OIL, SADDLE, STETHOSCOPE, TALLOW_CANDLE, TINNING_KIT, TIN_WHISTLE, UNICORN_HORN, WAX_CANDLE, WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN, FROST_HORN, FIRE_HORN, WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM, ROCK, SLIME_MOLD, ARROW, LOADSTONE, LUCKSTONE, AXE, SPEAR, BOW, DART, KATANA, MACE, SCALPEL, CLUB, QUARTERSTAFF, SLING, SHORT_SWORD, LONG_SWORD, TWO_HANDED_SWORD, LANCE, YUMI, YA, BATTLE_AXE, SPLINT_MAIL, HELMET, RING_MAIL, LEATHER_ARMOR, LEATHER_JACKET, FEDORA, ROBE, SMALL_SHIELD, LEATHER_GLOVES, POT_HEALING, POT_SICKNESS, SACK, FLINT, CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE, APPLE, ORANGE, PEAR, MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, CANDY_BAR, PANCAKE, LEMBAS_WAFER, CRAM_RATION, FOOD_RATION, POT_EXTRA_HEALING, POT_WATER, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SPE_HEALING, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER, SPE_PROTECTION, SPE_DETECT_MONSTERS, SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, TOUCHSTONE, WAN_WISHING, WAN_SLEEP, OBJECT_SPELL_CATEGORY, AKLYS, DAGGER, ELVEN_DAGGER, ORCISH_DAGGER, ELVEN_SHORT_SWORD, ORCISH_SHORT_SWORD, DWARVISH_SHORT_SWORD, } from './object_data.js';
import { pair_of, isMissileObject, isBimanualObject, isGrayStone, isWeaponTool, launcherMatchesAmmo, isBlade, isPolearm, isLauncherAmmunition, } from './object_properties.js';
import { isThrowingWeapon } from './dothrow.js';
import { bypassObjectList, clearBypasses, nextUnbypassedObject, setnotworn, setworn, removeHeroEquipment } from './worn.js';
import { game, requireGameDisplay, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { unpunishHero } from './read.js';
import { hideUnhideMessageTypes } from './message_types.js';
import { inventoryActionForObject, itemReadingText } from './iactions.js';
import { encyclopediaEntries } from './encyclopedia.js';
import { killerObjectName, objectBlessingDescription, objectDescription, primaryHandDescriptionDetail, makePlural, withIndefiniteArticle, corpseName, ownedObjectName, distantObjectName, wishedObjectPresentation, definiteName, objectCombatName, objectLooksUnique, objectName, objectNameIsPlural, objectNeedsFullIdentification, observeObjectForNaming, simpleObjectName, singularObjectName, erosionMatters, objectUsesCharges, } from './objnam.js';
import { rejoinObjectStack, splitObjectStack, objectQuantity, curseObjectState, unlinkObject, absorbGlob, placeObject, objectWeight, isContainer, announceGlobMerge, } from './mkobj.js';
import { ATTRIBUTE_DISPLAY_ORDER, setMoreLuck } from './attrib.js';
import { consumeHallucinatedMenuObjectGlyph, transientMonsterGlyph, flush_screen, newsym, OBJECT_CLASS_SYMBOLS } from './display.js';
import { formatStrength } from './botl.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline, putMessageHistory, renderKeyPrompt } from './topl.js';
import { showMessageMenu, snapshotMenuUnderlay, restoreMenuUnderlay, windowOrigin } from './wintty.js';
import { pline, plineWithContinuation, impossible } from './pline.js';
import { getLine, showChoiceWindow, showDisclosureOverlay, showInventoryWindow, showMultiSelectWindow, showTextMenuOverlay } from './windows.js';
import { nhgetch } from './input.js';
import { readchar, commandResultCancelled, commandResultFailed, cmdq_add_int, cmdq_add_key, cmdq_clear, cmdq_pop, getCount, GC_SAVEHIST, GC_ECHOFIRST, GC_CONDHIST, ynSingleKey, yn_function } from './cmd.js';
import { recorderSort, ingSuffix, possessiveName } from './hacklib.js';
import { NATIVE_COMMAND_CONSTANTS } from './command_data.js';
import { CMDQ_INT, CMDQ_KEY, CMDQ_USER_INPUT, CQ_CANNED, CQ_REPEAT, ALTAR, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, ICE, Is_airlevel, Is_waterlevel, MENU_TRADITIONAL, MENU_FULL, MENU_PARTIAL, MSGTYP_MASK_REP_SHOW, PICK_NONE, PICK_ONE, W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_TOOL, W_SADDLE, OBJECT_TIMER_KIND, ACH_AMUL, ACH_BELL, ACH_BOOK, ACH_CNDL, ACH_MINE_PRIZE, ACH_SOKO_PRIZE, AM_SANCTUM, Amask2align, A_NONE, DBWALL, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_ISOPEN, D_NODOOR, FOUNTAIN, GRAVE, IRONBARS, SINK, THRONE, TREE, PLNMSG_ONE_ITEM_HERE, LOST_NONE, LOST_THROWN, is_pit, SORTLOOT_PACK, SORTLOOT_INVLET, SORTLOOT_LOOT, SORTLOOT_INUSE, SORTLOOT_PETRIFY, P_BOW, P_CROSSBOW, P_SPEAR, P_DAGGER, P_KNIFE, W_WEAPONS, W_ARM, W_ARMC, W_ARMH, W_ARMS, W_ARMG, W_ARMF, W_ARMU, W_WEP, W_SWAPWEP, W_QUIVER, W_RINGL, W_RINGR, CONTAINED_SYM, MGIVENNAME, HAND, FINGER, STOMACH } from './const.js';
import { MONSTER_NAME } from './monster_data.js';
import { levelPrizeKind } from './level_prize.js';
import { recordLiteracy } from './literacy.js';
import { learnObjectType, recordObjectEncounter, observeObject, objectMaterial, objectTypeKnown, OBJ_DESCR } from './o_init.js';
import { recordObjectKnowledge } from './u_init.js';
import { promptYesNoAllQuit } from './query.js';
import { isTwoWeaponObject, isWeldedPrimary, setQuiverObject, heroCanUseTwoWeapons } from './wield.js';
import { heroHasNoHands, heroIsVerySmall, heroSpecies, heroFormHidesUnderObjects, heroIsPolymorphed, body_part, mbodypart } from './polyself.js';
import { discoverArtifact, touchArtifactByHero, artifactById, deactivateArtifactProperty, setCarriedArtifactProperties } from './artifact.js';
import { touchQuestArtifact } from './quest.js';
import { isQuestArtifact } from './questpgr.js';
import { recordAchievement } from './insight.js';
import { isEdibleFood } from './eat.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { heroCanReachFloor, readEngravingAt } from './engrave.js';
import { surfaceName } from './dungeon.js';
import { stairwayDescription } from './stairs.js';
import { deityName } from './pray.js';
import { isIceAt, isLavaAt, isPoolAt, findDrawbridgeAt, drawbridgeUnderlyingType } from './dbridge.js';
import { forceDescribeDecor, pickupBurden, encumber_msg } from './pickup.js';
import { visibleRegionAt } from './region.js';
import { resolveImmediatePetrification, trapName, objectIsVulnerableToErosion } from './trap.js';
import { heroResistsStoning, monsterIsHumanoid, monsterDigests, touchPetrifies, formCanBecomeStoneGolem, } from './mondata.js';
import { iceDescriptionAt, swallowedHeroDescription } from './pager.js';
import { panic } from './end.js';
import { armorSimpleName, armorSlotFor } from './do_wear.js';
import { currentShopResident, shopkeeperInOwnShop, costlySpot, chargeUnpaidUsage, deleteObject, addShopObjectToBill, stolenValue, billForObject, visitBilledShopkeepers, unpaidObjectCost, reportShopFinances, pickedContainer, doinvbill, } from './shk.js';
import { attachFigurineTimer, endObjectBurn, learnEggType, stopObjectTimer, stopObjectTimers } from './timeout.js';
import { objectShedsLight } from './light.js';
import { hitFloorWithObject } from './dothrow.js';
import { assertCreatedObject, dropInventoryObjectAtHero, dropObjectAtHero } from './do.js';
import { heroGoldObject } from './sit.js';
import { hiddenGold } from './vault.js';
import { nomul, heroGoldAmount, roomsAt, nearCapacity } from './hack.js';
import { displayLiquidName, monsterName } from './do_name.js';
import { NO_COLOR } from './terminal.js';
import { maybeUnhideAt, hideHeroUnder, isReviver, } from './mon.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { objectResistsDestruction, showProbedObjectInventory } from './zap.js';
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
const PM_LICHEN = 158;
const DAGGER_TYPES = new Set([DAGGER, ELVEN_DAGGER, ORCISH_DAGGER]);
const SHORT_SWORD_TYPES = new Set([
    SHORT_SWORD, ELVEN_SHORT_SWORD, ORCISH_SHORT_SWORD,
    DWARVISH_SHORT_SWORD,
]);
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
const CLASS_PRESENTATION = {
    [WEAPON_CLASS]: 'Weapons', [ARMOR_CLASS]: 'Armor',
    [RING_CLASS]: 'Rings', [AMULET_CLASS]: 'Amulets',
    [TOOL_CLASS]: 'Tools', [FOOD_CLASS]: 'Comestibles',
    [POTION_CLASS]: 'Potions', [SCROLL_CLASS]: 'Scrolls',
    [SPBOOK_CLASS]: 'Spellbooks', [WAND_CLASS]: 'Wands',
    [COIN_CLASS]: 'Coins', [GEM_CLASS]: 'Gems/Stones',
    [ROCK_CLASS]: 'Boulders',
};
// C invent.c:freeinv_core()/addinv_core1()/addinv_core2()/learn_unseen_invent()
// and attrib.c:set_moreluck().
const CARRIED_FLAGS = new Map([
    [AMULET_OF_YENDOR, 'amulet'], [BELL_OF_OPENING, 'bell'],
    [CANDELABRUM_OF_INVOCATION, 'menorah'], [SPE_BOOK_OF_THE_DEAD, 'book'],
]);
const DUPLICATE_POSSESSION_MESSAGES = {
    amulet: 'already have amulet?',
    bell: 'already have silver bell?',
    book: 'already have the book?',
    menorah: 'already have candelabrum?',
    questart: 'already have quest artifact?',
};
// Currency names from invent.c; hallucinated choices use the core RNG.
const CURRENCIES = [
    'Altarian Dollar', 'Ankh-Morpork Dollar', 'auric', 'buckazoid', 'cirbozoid',
    'credit chit', 'cubit', 'Flanian Pobble Bead', 'fretzer', 'imperial credit',
    'Hong Kong Luna Dollar', 'kongbuck', 'nanite', 'quatloo', 'simoleon',
    'solari', 'spacebuck', 'sporebuck', 'Triganic Pu', 'woolong', 'zorkmid',
];
const CANCELLED = { cancelled: true, object: null, none: false, count: null };
const HANDS = { cancelled: false, object: null, none: true, count: null };
const HANDS_SYM = 45, QUESTION = 63, ASTERISK = 42, ESCAPE = 27;
// strchr(quitchars, '\0') also succeeds, for a literal NUL from the fuzzer.
const QUITCHARS = [0, 32, 13, 10, ESCAPE];
const BUC_CHOICES = ['B', 'C', 'U', 'X'];
// C invent.c:carry_obj_effects()
// Carrying affects the object: a cursed figurine of a live species arms the
// fig_transform timer.  The species/dead_species gate and the scheduling
// are attach_fig_transform_timeout() (timeout.ts:attachFigurineTimer()).
export function carryObjEffects(object, state = game) {
    if (object?.otyp !== FIGURINE || !object.cursed)
        return null;
    return attachFigurineTimer(object, state);
}
// C invent.c:count_buc()
// The B/U/C/X classification of one object: coins follow the goldX
// option, unknown status stays X.  C's counting loops became the menu
// builders' category sets (wornBucCategories(), query_categories());
// every classifier site shares this one.  The priest knowledge pass runs
// before the filter at each caller, as in count_buc().
export function bucCategory(object, state = game) {
    if (object.oclass === COIN_CLASS)
        return state.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
const DEFAULT_PACK_ORDER = [
    COIN_CLASS, AMULET_CLASS, WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, POTION_CLASS, RING_CLASS, WAND_CLASS,
    TOOL_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS,
];
const DEFAULT_LOOT_ORDER = [
    COIN_CLASS, AMULET_CLASS, RING_CLASS, WAND_CLASS, POTION_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, GEM_CLASS, FOOD_CLASS, TOOL_CLASS,
    WEAPON_CLASS, ARMOR_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS,
];
const INSTRUMENTS = new Set([WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN,
    FROST_HORN, FIRE_HORN, WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM,
    DRUM_OF_EARTHQUAKE, HORN_OF_PLENTY]);
export const OBJECT_CLASS_LABELS = {
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
    [ROCK_CLASS]: 'Boulders/Statues',
    [BALL_CLASS]: 'Iron balls',
    [CHAIN_CLASS]: 'Chains',
    [VENOM_CLASS]: 'Venoms',
};
// C invent.c:inuse_classify(). Rank the worn slot for an in-use inventory view.
function inUseRating(object, state) {
    const mask = (object.owornmask ?? 0) & (W_ACCESSORY | W_WEAPONS | W_ARMOR);
    if (!mask && object.otyp === LEASH && object.leashmon)
        return 1;
    if (!mask && object.oclass === TOOL_CLASS && object.lamplit)
        return 2;
    const mainHandRing = state.u.rightHanded === false ? W_RINGL : W_RINGR;
    const ratings = [W_ARMU, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMC, W_ARM,
        W_QUIVER, W_SWAPWEP, W_WEP, W_TOOL,
        mainHandRing === W_RINGR ? W_RINGL : W_RINGR, mainHandRing, W_AMUL];
    const index = ratings.findIndex(slot => mask & slot);
    return index >= 0 ? index + 3 : 0;
}
// C invent.c:loot_classify().
export function classifyLoot(object, state = game) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    const classOrder = state.flags.sortpack !== false ? inventoryClassOrder(state) : DEFAULT_LOOT_ORDER;
    const position = classOrder.indexOf(oclass);
    const seen = !!object.dknown;
    const discovered = objectTypeKnown(object, state);
    const description = OBJ_DESCR(object.otyp, state);
    return {
        order: position >= 0 ? position + 1 : classOrder.length + 1 + Number(oclass !== VENOM_CLASS),
        subclass: lootSubclass(object, oclass, seen, discovered),
        discovery: !seen ? 1 : discovered || !description ? 4
            : state._objectCallNames?.[object.otyp] ? 3 : 2,
    };
}
// C invent.c:loot_xname() ignores counts and individual user names. Its
// temporary adjustments group water, towels, and globs without altering them.
export function lootObjectName(object, state = game) {
    const view = { ...object, quan: 1, quantity: 1,
        blessed: object.otyp === POT_WATER ? false : object.blessed,
        cursed: object.otyp === POT_WATER ? false : object.cursed,
        spe: object.otyp === TOWEL ? 0 : object.spe,
        owt: object.globby ? 20 : object.owt,
    };
    if (object.oclass === POTION_CLASS)
        view.odiluted = false;
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
    if (object.otyp === TOWEL)
        name += object.spe >= 3 ? 'x' : object.spe > 0 ? 'y' : 'z';
    if (object.globby)
        name += object.owt <= 100 ? 'a' : object.owt <= 300 ? 'b'
            : object.owt <= 500 ? 'c' : 'd';
    return name;
}
// C invent.c:invletter_value().
function inventoryLetterValue(letter) {
    if (!letter)
        return 55;
    if (letter >= 'a' && letter <= 'z')
        return letter.charCodeAt(0) - 95;
    if (letter >= 'A' && letter <= 'Z')
        return letter.charCodeAt(0) - 37;
    return letter === '$' ? 1 : letter === '#' ? 54 : 55;
}
// C invent.c:sortloot_cmp(). The sort keys are computed by the renamed
// helpers below: inuse_classify() -> inUseRating, invletter_value() ->
// inventoryLetterValue, loot_xname() -> normalizedLootName.
function compareLoot(left, right, mode, state) {
    const a = left.object, b = right.object;
    if (mode & SORTLOOT_INUSE)
        return inUseRating(b, state) - inUseRating(a, state) || left.index - right.index;
    if ((mode & (SORTLOOT_PACK | SORTLOOT_INVLET)) !== SORTLOOT_INVLET) {
        const aClass = classifyEntry(left, state), bClass = classifyEntry(right, state);
        const difference = aClass.order - bClass.order;
        if (difference)
            return difference;
        if (!(mode & SORTLOOT_INVLET)) {
            const detail = aClass.subclass - bClass.subclass || aClass.discovery - bClass.discovery;
            if (detail)
                return detail;
        }
    }
    if (mode & SORTLOOT_INVLET) {
        const difference = inventoryLetterValue(a.invlet) - inventoryLetterValue(b.invlet);
        if (difference)
            return difference;
    }
    if (!(mode & SORTLOOT_LOOT))
        return left.index - right.index;
    if (left.name === undefined) {
        observeObjectForNaming(a, { state });
        left.name = normalizedLootName(a, state);
    }
    if (right.name === undefined) {
        observeObjectForNaming(b, { state });
        right.name = normalizedLootName(b, state);
    }
    if (left.name !== right.name)
        return left.name < right.name ? -1 : 1;
    const condition = beatitudeRating(b) - beatitudeRating(a)
        || Number(!!b.greased) - Number(!!a.greased)
        || lootErosion(a) - lootErosion(b)
        || Number(!!(b.rknown && b.oerodeproof)) - Number(!!(a.rknown && a.oerodeproof));
    if (condition)
        return condition;
    if (objectUsesKnown(a.otyp) && a.oclass !== FOOD_CLASS) {
        const difference = (b.known ? b.spe ?? 0 : -1000) - (a.known ? a.spe ?? 0 : -1000);
        if (difference)
            return difference;
    }
    return left.index - right.index;
}
// C invent.c:assigninvlet(). Assign a free inventory letter using the rotating cursor.
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
// C invent.c:reorder_invent(). Keep fixed inventory letters in native order.
function reorderInventory() {
    game.inventory.sort((left, right) => inventoryLetterRank(left) - inventoryLetterRank(right));
}
// C invent.c:merged(). Merge quantities, knowledge, timers, and weapon slots.
export async function mergeObjectStacks(survivor, incoming, state = game) {
    requireLiveGame(state);
    if (!survivor || !incoming || !mergable(survivor, incoming, state))
        return null;
    const discovered = await prepareStackMerge(survivor, incoming, state);
    if (incoming.globby) {
        await announceGlobMerge(survivor, incoming, state);
        return await absorbGlob(survivor, incoming, state);
    }
    if (discovered && survivor.where === 'inventory'
        && incoming.how_lost !== LOST_THROWN && survivor.how_lost !== LOST_THROWN) {
        await plineWithContinuation('You learn more about your items by comparing them.');
    }
    await deleteObject(incoming, state, { mergeInto: survivor });
    return survivor;
}
// C invent.c:addinv_core1(): these effects precede merging and inventory insertion.
export async function prepareInventoryAddition(object, state = game) {
    if (object.oclass === COIN_CLASS)
        state.context.botl = true;
    const flag = carriedPossessionFlag(object, state);
    if (flag && state.u.uhave?.[flag])
        await impossible(DUPLICATE_POSSESSION_MESSAGES[flag], { state });
    updateCarriedFlags(object, true, state);
    const achievement = object.otyp === AMULET_OF_YENDOR ? ACH_AMUL
        : object.otyp === BELL_OF_OPENING ? ACH_BELL
            : object.otyp === CANDELABRUM_OF_INVOCATION ? ACH_CNDL
                : object.otyp === SPE_BOOK_OF_THE_DEAD ? ACH_BOOK : null;
    if (achievement !== null)
        recordAchievement(state, achievement);
    if (isQuestArtifact(object, state))
        await touchQuestArtifact(object, state);
    await setCarriedArtifactProperties(object, true, state);
}
// C invent.c:addinv_core2(). The object is linked, including after a merge.
// Regaining sight reuses these effects without adding the object again.
export async function finishInventoryAddition(object, state = game) {
    if (confersLuck(object, state))
        setMoreLuck(state);
    if (state.urole?.key !== 'archeologist' || object.oclass !== SCROLL_CLASS
        || object.otyp === SCR_BLANK_PAPER || heroIsBlind(state)
        || objectTypeKnown(object, state))
        return;
    observeObjectForNaming(object, { state });
    await plineWithContinuation(`You decipher the label on ${ownedObjectName(object, state, { capitalized: false })}.`);
    learnObjectType(object.otyp, state);
    recordLiteracy('became literate by deciphering a scroll label', { state });
}
// C invent.c:addinv_core0(): merge with a carried stack, or take a letter
// and slot into the fixed-letter order; reinsertion keeps its predecessor.
async function addInventoryItemCore(raw, presentation, observe, next) {
    const wasThrown = raw.how_lost === LOST_THROWN;
    let item = prepareInventoryItem(raw, presentation, observe);
    await prepareInventoryAddition(item, game);
    const nextIndex = next ? game.inventory.indexOf(next) : -1;
    // C addinv_core0(): reinsertion needs a predecessor and skips both
    // merging and autoquivering, including with fixed inventory letters.
    if (nextIndex > 0) {
        item.where = 'inventory';
        game.inventory.splice(nextIndex, 0, item);
        return await finishAddedInventoryItem(item);
    }
    const existing = game.uquiver && mergable(game.uquiver, item, game) ? game.uquiver
        : game.inventory.find(other => mergable(other, item, game));
    const added = existing ? await mergeObjectStacks(existing, item, game)
        : linkInventoryItem(item);
    if (!added)
        throw new Error(`Inventory merge rejected object ${item.o_id} after admission`);
    item = added;
    return await finishAddedInventoryItem(item, wasThrown && !existing);
}
// C invent.c:addinv().
export async function addInventoryItem(raw, presentation = null, observe = true) {
    return await addInventoryItemCore(raw, presentation, observe, null);
}
// C invent.c:addinv_before().
export async function addInventoryItemBefore(raw, next) {
    return await addInventoryItemCore(raw, null, true, next);
}
// C invent.c:hold_another_object(). The argument must be free. Messages are already formatted by the caller,
// as native callers preserve doname() before addinv() can merge the object.
export async function holdAnotherObject(object, { state = game, dropMessage = null, holdMessage = null, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (object.where !== 'free')
        throw new Error('holding requires a free object');
    if (!heroIsBlind(state))
        observeObject(object, state);
    if (object.oartifact) {
        const crysknife = object.otyp === CRYSKNIFE;
        const proofing = object.oerodeproof;
        const wasPolymorphed = heroIsPolymorphed(state);
        await placeObject(object, state.u.ux, state.u.uy, state);
        const touch = await touchArtifactByHero(object, artifactById(object.oartifact, state), { state, publish });
        if (touch.died || state.program_state?.gameover)
            return { object, heroDied: true };
        if (!touch.allowed || wasPolymorphed && !heroIsPolymorphed(state)) {
            if (touch.allowed && dropMessage)
                await publish(dropMessage);
            unlinkObject(object, state);
            await dropObjectAtHero(object, { state, publish });
            return { object, heroDied: !!state.program_state?.gameover };
        }
        unlinkObject(object, state);
        if (crysknife) {
            object.otyp = CRYSKNIFE;
            if (proofing === undefined)
                delete object.oerodeproof;
            else
                object.oerodeproof = proofing;
        }
    }
    const unsafeWish = object.otyp === CORPSE && object.wishedfor
        && !(state.uarmg || state.u.uarmg)
        && touchPetrifies(object.corpsenm) && !heroResistsStoning(state);
    const forcedDrop = propertyIsActive('fumbling', state) || unsafeWish;
    if (propertyIsActive('fumbling', state))
        object.nomerge = true;
    else if (unsafeWish)
        object.wishedfor = false;
    const count = objectQuantity(object);
    const limit = Math.max(nearCapacity(state), pickupBurden(state));
    object = await addInventoryItem(object, null, false);
    if (state.program_state?.gameover)
        return { object, heroDied: true };
    const slots = state.inventory.filter(item => item.otyp !== GOLD_PIECE && item.oclass !== COIN_CLASS).length;
    const tooHeavy = !(object.otyp === LOADSTONE && object.cursed)
        && nearCapacity(state) > limit;
    if (forcedDrop || slots > 52 || tooHeavy) {
        if (!forcedDrop && objectQuantity(object) > count) {
            const parent = object;
            const split = splitObjectStack(parent, count, state);
            if (!split)
                throw new Error(`Cannot split ${count} items from object ${parent.o_id}`);
            object = split;
        }
        if (dropMessage)
            await publish(dropMessage);
        object.nomerge = false;
        if (heroCanReachFloor(state, { checkPit: true }) || state.u.uswallow)
            await dropInventoryObjectAtHero(object, { state, publish });
        else {
            await freeInventoryObject(object, state);
            if (!state.program_state?.gameover)
                await hitFloorWithObject(object, { verbose: false, state, publish });
        }
        return { object: null, heroDied: !!state.program_state?.gameover };
    }
    if (state.flags.autoquiver && !(state.uquiver || state.u.uquiver) && !object.owornmask
        && (isMissileObject(object) || launcherMatchesAmmo(object, state.uwep)
            || launcherMatchesAmmo(object, state.uswapwep)))
        await setQuiverObject(object, state);
    if (holdMessage !== null || dropMessage !== null) {
        if (state.flags.fixinv === false)
            reassignInventoryLetters();
        await publish(await heldInventoryMessage(object, count, holdMessage, state));
    }
    await encumber_msg(state);
    return { object, heroDied: !!state.program_state?.gameover };
}
// C invent.c:useupall(): setnotworn, freeinv, then obfree.
export async function useUpInventoryStack(object, state = game) {
    requireLiveGame(state);
    const gameWasOver = state.program_state.gameover;
    await removeHeroEquipment(object, state);
    if (!gameWasOver && state.program_state.gameover)
        return;
    await freeInventoryObject(object, state);
    if (!gameWasOver && state.program_state.gameover)
        return;
    await deleteObject(object, state);
}
// C invent.c:useup().
export async function consumeInventoryItem(item, state = game) {
    requireLiveGame(state);
    const quantity = item?.quantity ?? item?.quan ?? 1;
    if (quantity > 1) {
        item.in_use = false;
        item.quantity = quantity - 1;
        item.quan = quantity - 1;
        item.owt = objectWeight(item);
        return;
    }
    await useUpInventoryStack(item, state);
}
// C invent.c:consume_obj_charge(). Billing can suspend before charge removal.
export async function consumeObjectCharge(object, { maybeUnpaid = true, state = game, } = {}) {
    requireLiveGame(state);
    if (maybeUnpaid)
        await chargeUnpaidUsage(object, { state });
    object.spe--;
}
// C invent.c:freeinv_core(). Remove carried properties after extraction.
export async function finishInventoryRemoval(object, state = game) {
    const gameWasOver = state.program_state.gameover;
    object.pickup_prev = false;
    if (object.oclass === COIN_CLASS) {
        state.context.botl = true;
        return;
    }
    updateCarriedFlags(object, false, state);
    await setCarriedArtifactProperties(object, false, state);
    const artifact = artifactById(object.oartifact, state);
    if (artifact) {
        await deactivateArtifactProperty(object, artifact, {
            state, publish: plineWithContinuation,
        });
        if (!gameWasOver && state.program_state.gameover)
            return;
    }
    if (object.otyp === LOADSTONE) {
        curseObjectState(object);
    }
    else if (confersLuck(object, state)) {
        setMoreLuck(state);
    }
    else if (object.otyp === FIGURINE && object.timed) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    }
}
// C invent.c:freeinv(): extraction precedes carried effects; equipment stays installed.
export async function freeInventoryObject(object, state = game) {
    requireLiveGame(state);
    const index = state.inventory.indexOf(object);
    if (index < 0)
        await panic('extract_nobj: object lost', { state });
    state.inventory.splice(index, 1);
    object.where = 'free';
    await finishInventoryRemoval(object, state);
}
// C invent.c:delobj(): normal object deletion (if unpaid, it
// remains on the bill).
export async function delobj(object, state = game, random = rn2) {
    await delobjCore(object, false, state, random);
}
// C invent.c:delallobj()
// The closing drawbridge destroys the pile at a square — this
// whole-pile deletion.
export async function destroyObjectsAt(x, y, state) {
    for (const object of [...state.level?.objects[x]?.[y] ?? []]) {
        if (object.where === 'gone')
            continue;
        if (object === (state.uball || state.u.uball))
            await unpunishHero(state);
        if (object !== (state.uchain || state.u.uchain))
            await delobj(object, state);
    }
}
// C invent.c:delobj_core().  `force` is the Rider-revival path.
export async function delobjCore(object, force, state = game, random = rn2) {
    requireLiveGame(state);
    /* obj_resists(obj,0,0) protects the Amulet, the invocation tools,
     * and Rider corpses; the ordinary path still consumes its rn2(100)
     * roll at zero probability (objectResistsDestruction does not skip
     * the call), so deletion RNG parity is preserved. */
    if (!force && objectResistsDestruction(object, 0, 0, random)) {
        object.in_use = false; /* in case caller has set this */
        return;
    }
    const updateMap = object.where === 'floor';
    if (object.where === 'inventory')
        await freeInventoryObject(object, state);
    else
        unlinkObject(object, state);
    if (updateMap) {
        /* floor object's coordinates are always up to date */
        await maybeUnhideAt(object.ox, object.oy, state);
        await newsym(object.ox, object.oy);
    }
    await deleteObject(object, state);
}
// C invent.c:sobj_at(): the first object of a type in a floor pile.
export function objectAt(x, y, otyp, state) {
    return (state.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === otyp) || null;
}
// C invent.c:g_at()
// The gold stack on a square, if any.
export function goldAt(x, y, state) {
    return requireGameLevel(state).objects[x]?.[y]?.find(object => object.otyp === GOLD_PIECE);
}
// C invent.c:carrying_stoning_corpse(). Return the first carried corpse that petrifies on touch.
export function carryingStoningCorpse(state = game) {
    return state.inventory.find(object => object.otyp === CORPSE && touchPetrifies(object.corpsenm));
}
// C invent.c:currency().
export function currency(amount, { state = game, random = rn2, } = {}) {
    const name = heroIsHallucinating(state) ? CURRENCIES[random(CURRENCIES.length)] : 'zorkmid';
    if (!name)
        throw new RangeError('Currency selection is outside the native name table.');
    return amount === 1 ? name : makePlural(name);
}
// C invent.c:compactify().
export function compactInventoryLetters(letters) {
    if (letters.length <= 5)
        return letters;
    let compact = '';
    for (let start = 0; start < letters.length;) {
        let end = start;
        const overflow = letters[start] === '#';
        while (end + 1 < letters.length
            && (overflow ? letters[end + 1] === '#'
                : letters.charCodeAt(end + 1) === letters.charCodeAt(end) + 1)) {
            end++;
        }
        const length = end - start + 1;
        compact += length >= 3
            ? `${letters[start]}-${letters[end]}`
            : letters.slice(start, end + 1);
        start = end + 1;
    }
    return compact;
}
// C invent.c:taking_off(). Match the two removal command prompts.
export function takingOff(action) {
    return action === 'take off' || action === 'remove';
}
// C invent.c:mime_action(): '-' without a hands option is an action mime.
async function mimeInventoryAction(verb) {
    let action = verb, prefix = '', suffix = '';
    const onStone = action.indexOf(' on the ');
    if (onStone >= 0) {
        suffix = action.slice(onStone + 1);
        action = action.slice(0, onStone);
    }
    if (action.startsWith('rub the ') && action.includes(' on')
        || action.startsWith('dip ') && action.includes(' into')) {
        prefix = action.slice(4);
        action = action.slice(0, 3);
    }
    const alternatives = action.split(' or ');
    if (alternatives.length > 1) {
        const chosen = alternatives[rn2(2) ? 0 : 1];
        if (chosen === undefined)
            throw new Error('The action alternative is missing');
        action = chosen;
    }
    await pline(`You mime ${ingSuffix(action)}${prefix ? ' ' + prefix : ''} something${suffix ? ' ' + suffix : ''}.`);
}
// C invent.c:getobj().  The callback classifies HANDS_SYM and each carried
// object; suggestions shape the prompt and its '?' subset, downplayed
// choices force the prompt, and any carried letter may still be typed.
// The returned count has not been split off; callers which need native
// split_otmp behavior use chooseInventoryObject().
// C invent.c:getobj_hands_txt(): callers pass the hands entry's wording
// (fingers, fingertip, gloved/bare hands, empty quiver) as handsText.
// Also C invent.c:obj_to_let(): inlined as the fixinv-off letter
// reassignment before the inventory letters are read.
export async function getobj(word, classify, { forcePrompt = false, allowCount = false, hands = GETOBJ_EXCLUDE, handsText = 'your hands' } = {}) {
    // Read queued counts and choices before rotating inventory letters.
    {
        let count = null;
        let cntgiven = false;
        for (;;) {
            const entry = cmdq_pop();
            if (!entry)
                break;
            if (entry.typ === CMDQ_USER_INPUT)
                break;
            if (entry.typ === CMDQ_INT) {
                if (!cntgiven && allowCount) {
                    count = entry.intval;
                    cntgiven = true;
                    continue;
                }
                cmdq_clear(CQ_CANNED);
                return CANCELLED;
            }
            if (entry.typ === CMDQ_KEY) {
                if (entry.key === HANDS_SYM) {
                    if (admitsChoice(hands))
                        return HANDS;
                }
                else {
                    const letter = String.fromCharCode(entry.key);
                    const object = game.inventory.find(candidate => candidate.invlet === letter
                        && admitsChoice(classify(candidate)));
                    if (object)
                        return {
                            cancelled: false, object, none: false,
                            count: count !== null && count > 0 && count < object.quan ? count : null,
                        };
                }
            }
            // C invent.c:1817-1818: the popped entry selected nothing, so
            // discard any other queued commands too.
            cmdq_clear(CQ_CANNED);
            return CANCELLED;
        }
    }
    let allowNone = false, handsSuggested = false, handsDownplayed = false, inaccessible = 0;
    switch (hands) {
        case GETOBJ_SUGGEST:
            allowNone = handsSuggested = true;
            break;
        case GETOBJ_DOWNPLAY:
        case GETOBJ_EXCLUDE_INACCESS:
        case GETOBJ_EXCLUDE_SELECTABLE:
            allowNone = handsDownplayed = true;
            break;
        case GETOBJ_EXCLUDE_NONINVENT:
            forcePrompt = false;
            inaccessible++;
            break;
        case GETOBJ_EXCLUDE:
            break;
    }
    if (game.flags?.fixinv === false)
        reassignInventoryLetters();
    const sorted = [...game.inventory]
        .sort((left, right) => inventoryLetterOrder(left.invlet) - inventoryLetterOrder(right.invlet));
    const suggested = [], downplayed = [];
    for (const object of sorted) {
        const classification = classify(object);
        if (classification === GETOBJ_EXCLUDE_INACCESS)
            inaccessible++;
        else if (classification === GETOBJ_DOWNPLAY) {
            forcePrompt = true;
            downplayed.push(object);
        }
        else if (classification === GETOBJ_SUGGEST)
            suggested.push(object);
    }
    if (!suggested.length && !forcePrompt && !allowNone) {
        await pline(`You don't have anything ${inaccessible ? 'else ' : ''}to ${word}.`);
        return CANCELLED;
    }
    const letters = compactInventoryLetters(suggested.map(object => object.invlet).join(''));
    const buf = handsSuggested ? letters ? `- ${letters}` : '-' : letters;
    const prompt = `What do you want to ${word}? [${buf ? `${buf} or ?*` : '*'}]`;
    const forcedMenu = !!game.flags.force_invmenu;
    let oneloop = false;
    let key = 0;
    for (;;) {
        let count = null;
        // A forced-menu retry reuses its letter without answering a query.
        let answered = !forcedMenu || !oneloop;
        if (game._inDoAgain) {
            // getobj() reads fresh input silently once CQ_REPEAT is exhausted.
            // Paint any rejected choice before the next silent readchar().
            if (game._pending_message) {
                await flush_screen(0);
                renderKeyPrompt(game._pending_message);
            }
            key = await readchar();
        }
        else if (forcedMenu) {
            // The first forced menu lists likely candidates; a rejected
            // count retries the letter already chosen from it.
            if (!oneloop)
                key = suggested.length || downplayed.length || handsDownplayed ? QUESTION : ASTERISK;
            oneloop = true;
        }
        else
            key = await askInventoryPrompt(prompt);
        if (key >= 48 && key <= 57) {
            if (!allowCount) {
                await pline('No count allowed with this command.');
                continue;
            }
            const counted = await getCount(key, BigInt(NATIVE_COMMAND_CONSTANTS.LARGEST_INT), GC_SAVEHIST);
            key = counted.key;
            if (counted.count)
                count = Number(counted.count);
        }
        if (QUITCHARS.includes(key)) {
            // C getobj(): a silent cancellation leaves the question painted.
            if (game.flags?.verbose !== false) {
                game._pending_message = '';
                game._retained_message = '';
                await neverMind();
            }
            return CANCELLED;
        }
        if (key === HANDS_SYM) {
            game._pending_message = '';
            if (!allowNone)
                await mimeInventoryAction(word);
            return allowNone ? { cancelled: false, object: null, none: true, count } : CANCELLED;
        }
        while (key === QUESTION || key === ASTERISK) {
            // '?' lists the suggested letters, or the downplayed ones
            // (headed by '-') when nothing is suggested; '*' lists all.
            const useAlternates = key === QUESTION && !suggested.length
                && (downplayed.length > 0 || handsDownplayed);
            const items = useAlternates ? downplayed : suggested;
            const letters = key === QUESTION
                ? `${useAlternates && handsDownplayed ? '-' : ''}${items.map(object => object.invlet).join('')}`
                : undefined;
            const extraChoice = allowNone && (key === ASTERISK
                || useAlternates && handsDownplayed || handsSuggested) ? handsText : null;
            const letterCount = letters?.length ?? 0;
            const listed = letterCount > 0;
            // The query has been read before the menu opens. Its dismissal
            // can redraw vision and print a fresh monster notice, which
            // belongs to the following action rather than the old query.
            if (answered)
                game._pending_message = '';
            answered = false;
            const selection = await selectInventoryObject({
                ...(letters === undefined ? {} : { letters }),
                ...(extraChoice ? { extraChoice } : {}),
                ...(forcedMenu ? {
                    title: `What do you want to ${word}?`,
                    menuOptions: allowNone && !extraChoice || listed && letterCount < game.inventory.length
                        ? [{ key: '*', text: '(list everything)' }]
                        : !listed ? [{ key: '?', text: '(list likely candidates)' }] : [],
                } : {}),
            });
            key = selection.key;
            if (key === 0)
                break;
            if (key === HANDS_SYM) {
                return HANDS;
            }
            if (key === ESCAPE) {
                if (game.flags?.verbose !== false)
                    await neverMind();
                return CANCELLED;
            }
            // The native singleton returns count -1 (all), which does not
            // replace a count already entered before '?'.
            if (key !== QUESTION && key !== ASTERISK && allowCount && selection.count !== null)
                count = selection.count;
        }
        if (key === 0) {
            if (oneloop)
                return CANCELLED;
            continue;
        }
        // C tty_yn_function() marks an answered prompt as already read.
        // A one-line query stays painted through a silent action. Wrapped
        // queries have already been erased by tty_yn_function()'s cleanup.
        if (answered)
            game._pending_message = '';
        const letter = String.fromCharCode(key);
        const object = game.inventory.find(candidate => candidate.invlet === letter) ?? null;
        if (letter === '$' || object?.oclass === COIN_CLASS) {
            if (object && classify(object) === GETOBJ_EXCLUDE) {
                await pline(`You cannot ${word} gold.`);
                return CANCELLED;
            }
            if (count !== null && count <= 0)
                return CANCELLED;
        }
        if (count !== null && word === 'throw') {
            if (!object)
                return CANCELLED;
            const coins = object.oclass === COIN_CLASS;
            if (count > 1 && (!coins || count > object.quan)) {
                await pline(count > object.quan ? `You only have ${object.quan}${!coins && object.quan > 1 ? ' and can only throw one at a time' : ''}.`
                    : 'You can only throw one at a time.');
                continue;
            }
        }
        game.context.botl = true;
        // C invent.c:2051-2053 records the live choice and its count for
        // do-again; a queued letter never re-enters CQ_REPEAT.
        if (object && !game._inDoAgain) {
            if (count !== null && count > 0)
                cmdq_add_int(CQ_REPEAT, count);
            cmdq_add_key(CQ_REPEAT, key);
        }
        if (!object) {
            await pline("You don't have that object.");
            if (game._inDoAgain)
                return CANCELLED;
            continue;
        }
        if (count !== null && object.quan < count) {
            await pline(`You don't have that many!  You have only ${object.quan}.`);
            if (game._inDoAgain)
                return CANCELLED;
            continue;
        }
        if (classify(object) === GETOBJ_EXCLUDE) {
            await sillyThing(word, object);
            return CANCELLED;
        }
        // split_otmp: an explicit zero count selects nothing.
        if (count === 0)
            return { ...CANCELLED, count: 0 };
        return { cancelled: false, object, none: false, count };
    }
}
// C invent.c:silly_thing().
async function sillyThing(word, object) {
    await pline(word === 'call' && (object.otyp === AMULET_OF_YENDOR
        || object.otyp === FAKE_AMULET_OF_YENDOR && !object.known)
        ? "The Amulet doesn't like being called names."
        : `That is a silly thing to ${word}.`);
}
// C invent.c:is_inuse().
function isInUse(object) {
    return !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE | W_WEAPONS))
        || toolBeingUsed(object);
}
// C invent.c:ggetobj(). The traditional identify dialog asks for categories first.
async function identifyTraditionally(limit) {
    const identified = [];
    while (limit > 0) {
        const candidates = game.inventory.filter(objectNeedsFullIdentification);
        if (!candidates.length)
            return { identified, remaining: 0 };
        const choices = traditionalIdentifyChoices(candidates);
        await flushPendingTopline();
        clearMessageWindow();
        const answer = await getLine(`What kinds of thing do you want to identify? [${choices}]`, (_character, key) => key >= 32 && key < 127);
        // Native ggetobj returns zero here; identify_pack asks again while
        // identification allowance remains. The per-item q choice quits.
        if (answer === null)
            continue;
        if (answer.includes('i')) {
            await showInventoryWindow(await inventorySections(candidates, false), { pickMode: PICK_ONE });
            continue;
        }
        const categories = await parseIdentificationCategories(answer);
        if (categories.menu)
            return { identified, remaining: limit };
        const result = await askIdentificationChain(categories, limit, identified);
        limit = result.remaining;
        if (!limit)
            return { identified, remaining: 0 };
        await plineWithContinuation(result.questioned ? 'That was all.' : 'No applicable objects.');
    }
    return { identified, remaining: 0 };
}
// C invent.c:askchain(). Ask about eligible objects in the selected class order.
// The identify callback never splits a stack; safeq_xprname() supplies each question.
async function askIdentificationChain(categories, limit, identified) {
    let all = categories.all;
    let questioned = 0;
    const letterOrder = '$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#';
    const inventory = [...game.inventory].sort((a, b) => (a.invlet == null ? -1 : letterOrder.indexOf(a.invlet))
        - (b.invlet == null ? -1 : letterOrder.indexOf(b.invlet)));
    const classes = categories.classes.length ? categories.classes : [null];
    try {
        for (const objectClass of classes) {
            bypassObjectList(game.inventory, false);
            let object;
            let index = -1;
            while ((object = nextUnbypassedObject(game.inventory, game, inventory))) {
                index++;
                if ((objectClass !== null && object.oclass !== objectClass)
                    || !objectNeedsFullIdentification(object)
                    || !matchesIdentificationCategories(object, categories))
                    continue;
                let response = 'y';
                if (!all) {
                    observeObjectForNaming(object);
                    const letter = game.flags.fixinv === false
                        ? letterOrder.charAt(Math.min(index + (inventory[0]?.oclass === COIN_CLASS ? 0 : 1), 53))
                        : object.invlet;
                    const description = await inventoryItemDescription(object, {
                        primaryHandDetail: inventoryPrimaryHandDetail(object),
                    });
                    await flushPendingTopline();
                    response = await promptYesNoAllQuit(`${letter} - ${description}?`, 'n');
                }
                if (response === 'q')
                    return { remaining: 0, questioned };
                questioned++;
                if (response === 'n')
                    continue;
                if (response === 'a')
                    all = true;
                await identifyAndDescribe(object);
                identified.push(object);
                if (!--limit)
                    return { remaining: 0, questioned };
            }
        }
    }
    finally {
        clearBypasses();
    }
    return { remaining: limit, questioned };
}
// C invent.c:reroll_menu().  This menu is a startup transaction, not a
// command: accepting another roll changes no turn state and keeps consuming
// the live RNG stream from its current position.
export async function rerollMenu() {
    const acceptKey = game.flags?.lootabc ? 'a' : 'p';
    const rerollKey = game.flags?.lootabc ? 'b' : 'r';
    const descriptions = [];
    for (const item of game.inventory || []) {
        observeObjectForNaming(item, { distant: true });
        descriptions.push(await rerollItemDescription(item));
    }
    const entries = [
        { key: acceptKey, text: 'start the game with this character' },
        { key: rerollKey, text: 'reroll another character' },
        '',
        ...descriptions,
        '',
        rerollAttributeLine(),
    ];
    const key = await showChoiceWindow({
        title: 'Reroll this character?',
        entries,
    });
    const choice = String.fromCharCode(key);
    const reroll = choice === rerollKey ? true
        : choice === acceptKey ? false : await rerollFallbackPrompt();
    if (reroll) {
        const roleplay = game.u.uroleplay;
        if (!roleplay)
            throw new Error('Reroll requires initialized roleplay options');
        roleplay.numrerolls = (roleplay.numrerolls || 0) + 1;
    }
    return reroll;
}
// C invent.c:fully_identify_obj().
export function fullyIdentifyObject(object, state = game) {
    const realObjectType = object.otyp >= FIRST_OBJECT;
    if (realObjectType)
        learnObjectType(object.otyp, state);
    if (object.oartifact)
        discoverArtifact(object.oartifact, state);
    object.known = true;
    object.bknown = true;
    object.rknown = true;
    if (realObjectType && !heroIsHallucinating(state))
        object.dknown = true;
    object.buc = object.blessed ? 'blessed'
        : object.cursed ? 'cursed' : 'uncursed';
    const canonical = OBJ_NAME(object.otyp);
    if (canonical && object.oclass === SCROLL_CLASS) {
        object.name = `scroll of ${canonical}`;
        object.plural = `scrolls of ${canonical}`;
    }
    else if (canonical && object.oclass === SPBOOK_CLASS) {
        object.name = `spellbook of ${canonical}`;
        object.plural = `spellbooks of ${canonical}`;
    }
    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = true;
        object.lknown = true;
    }
    else if (object.otyp === TIN) {
        object.cknown = true;
    }
    if (object.otyp === EGG && object.corpsenm !== undefined && eggHasMonsterSpecies(object))
        learnEggType(object.corpsenm, state);
}
// C invent.c:identify(). Identify one object and announce it.
async function identifyAndDescribe(object) {
    fullyIdentifyObject(object);
    observeObjectForNaming(object);
    await plineWithContinuation(`${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}
// C invent.c:menu_identify(). Describe each selection before asking again.
async function menuIdentify(idLimit, identified) {
    let remaining = idLimit;
    let candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
    let first = true;
    let tries = 5;
    while (remaining > 0 && candidates.length) {
        const selected = await identificationMenu(candidates, first);
        if (selected === null)
            break;
        if (!selected.length) {
            if (!--tries) {
                await plineWithContinuation("That's enough tries!");
                break;
            }
            await plineWithContinuation('Choose an item; use ESC to decline.');
            continue;
        }
        const accepted = selected.slice(0, remaining);
        for (const object of accepted)
            await identifyAndDescribe(object);
        identified.push(...accepted);
        remaining -= accepted.length;
        candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
        if (remaining > 0 && !candidates.length)
            await plineWithContinuation('That was all.');
        first = false;
    }
    return identified;
}
// C invent.c:count_unidentified().
function countUnidentified(objects) {
    return objects.filter(objectNeedsFullIdentification).length;
}
// C invent.c:identify_pack(). Identify all possessions or ask for a limited selection.
export async function identifyPack(idLimit, learningIdentify = false) {
    const count = countUnidentified(game.inventory || []);
    if (!count) {
        await plineWithContinuation(`You have already identified ${learningIdentify ? 'the rest' : 'all'} of your possessions.`);
        return [];
    }
    if (!idLimit || idLimit >= count) {
        const identified = [];
        for (const object of (game.inventory || []).filter(objectNeedsFullIdentification)) {
            if (!objectNeedsFullIdentification(object))
                continue;
            await identifyAndDescribe(object);
            identified.push(object);
        }
        return identified;
    }
    const traditional = game.flags.menu_style === MENU_TRADITIONAL
        ? await identifyTraditionally(idLimit) : { identified: [], remaining: idLimit };
    return menuIdentify(traditional.remaining, traditional.identified);
}
// C invent.c:learn_unseen_invent(). Regaining sight marks unseen inventory.
export async function learnUnseenInventory(state = game) {
    if (heroIsBlind(state))
        return;
    const priest = state.urole?.key === 'priest';
    const archeologist = state.urole?.key === 'archeologist';
    for (const object of state.inventory) {
        if (object.dknown && (object.bknown || !priest)
            && (object.oclass !== SCROLL_CLASS || !archeologist))
            continue;
        observeObjectForNaming(object, { state });
        await finishInventoryAddition(object, state);
    }
    // The pinned TTY build's update_inventory() has no persistent window.
}
// C invent.c:doperminv(). The recorder's tty port is built without
// TTY_PERM_INVENT (config.h leaves it commented out and windconf.h is
// WIN32-only), so it does not advertise WC_PERM_INVENT and the command
// always reports the unsupported window port.
export async function doPermanentInventory() {
    game.context.move = 0;
    await pline("Persistent inventory display is not supported by 'tty'.");
}
// C invent.c:prinv(): name only the acquired quantity, while retaining
// the actual inventory identity for wielded, worn, and quivered descriptions.
async function heldInventoryMessage(object, count, prefix, state) {
    const letter = object.invlet;
    if (!letter)
        throw new Error(`Held object ${object.o_id} has no inventory letter`);
    const total = objectQuantity(object);
    const merged = count > 0 && count < total;
    const savedQuantity = object.quantity;
    // C prinv() formats with doname(), whose xname() records what the hero
    // sees (a cleric learns beatitude) before the knowledge fields are read.
    observeObjectForNaming(object, { state });
    let description;
    object.quan = count || total;
    object.quantity = object.quan;
    try {
        description = await inventoryItemDescription(object);
    }
    finally {
        object.quan = total;
        if (savedQuantity === undefined)
            delete object.quantity;
        else
            object.quantity = savedQuantity;
    }
    const suffix = merged ? state.flags.verbose ? ` (${total} in total).` : '' : '.';
    return `${prefix ? `${prefix} ` : ''}${letter} - ${description}${suffix}`;
}
// C invent.c:xprname(). Format the inventory letter, name, and price.
export async function pricedInventoryLine(object, letter, price, text = null, { quantity = 0, useInvlet = true, distant = true } = {}) {
    const suppress = game.iflags.suppress_price;
    game.iflags.suppress_price = true;
    const saved = object?.quan;
    try {
        if (object) {
            if (quantity)
                object.quan = quantity;
            if (distant)
                text ??= await distantObjectName(object, inventoryItemDescription);
            else {
                observeObjectForNaming(object);
                text ??= await inventoryItemDescription(object);
            }
            if (useInvlet && game.flags.fixinv !== false && letter !== '>')
                letter = object.invlet ?? letter;
        }
        const tab = game.iflags.menu_tab_sep;
        if (!price && letter !== '*')
            return `${letter} - ${text}${useInvlet ? '.' : ''}`;
        return `${letter} - ${tab ? text : (text ?? '').padEnd(45)}${tab ? '\t' : ' '}${String(price).padStart(6)} ${currency(price)}`;
    }
    finally {
        if (object && saved !== undefined)
            object.quan = saved;
        if (suppress === undefined)
            delete game.iflags.suppress_price;
        else
            game.iflags.suppress_price = suppress;
    }
}
// C invent.c:dispinv_with_action().
async function reportSubset(items, inuse = true, accessoryLabel = 'Accessories') {
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    const candidates = items ?? game.inventory.filter(isInUse);
    const queued = takeQueuedInventoryChoice(items ? items.map(object => object.invlet).join('') : null);
    if (queued !== undefined) {
        if (queued === 0 || queued === 27)
            return null;
        const selected = game.inventory.find(object => object.invlet === String.fromCharCode(queued));
        return selected ? inventoryActionForObject(selected) : null;
    }
    let key;
    if (items?.length === 1 && !game.iflags.menu_requested) {
        const first = items[0];
        if (first)
            await describeCarriedObject(first);
        return null;
    }
    if (!inuse) {
        const forceMenu = game.flags.force_invmenu;
        game.flags.force_invmenu = false;
        try {
            key = (await selectInventoryObject({ letters: candidates.map(object => object.invlet).join('') })).key;
        }
        finally {
            if (forceMenu === undefined)
                delete game.flags.force_invmenu;
            else
                game.flags.force_invmenu = forceMenu;
        }
    }
    else {
        const ordered = sortObjects(candidates, { mode: SORTLOOT_INUSE });
        // invent.c:display_pickinv() classifies entries only when sortloot()
        // actually runs its comparison, so a lone in-use entry keeps
        // orderclass 0 and is listed without any class heading.  The bare
        // hands entry makes the sorted list big enough to classify.
        const headed = ordered.length >= 2 || (!items && !game.uwep);
        const sections = [{ heading: null, items: [{ text: 'Inventory in use', attr: 1 }] }];
        const rows = ordered.map(object => ({
            object, heading: headed ? inUseHeading(object, accessoryLabel) : null,
        }));
        if (!items && !game.uwep) {
            const position = rows.findIndex(row => row.heading === 'Wielded/Readied Weapons'
                || row.heading === 'Worn Armor' || row.heading === 'Miscellaneous');
            rows.splice(position < 0 ? rows.length : position, 0, { object: null, heading: 'Wielded/Readied Weapons' });
        }
        for (const row of rows) {
            const object = row.object;
            if (object) {
                observeObjectForNaming(object);
                consumeHallucinatedMenuObjectGlyph(object);
            }
            const text = object ? await inventoryItemDescription(object, {
                primaryHandDetail: inventoryPrimaryHandDetail(object),
            }) : `${game.uarmg ? 'gloved' : 'bare'} ${makePlural(body_part(HAND, game))} (no weapon)`;
            const item = { key: object?.invlet ?? '-', text };
            const last = sections.at(-1);
            if (last?.heading === row.heading)
                sections[sections.length - 1] = { ...last, items: [...last.items, item] };
            else
                sections.push({ heading: row.heading, items: [item] });
        }
        key = (await showInventoryWindow(sections, { pickMode: PICK_ONE })).key;
    }
    const selected = candidates.find(object => object.invlet === String.fromCharCode(key));
    return selected ? inventoryActionForObject(selected) : null;
}
// C invent.c:ddoinv().
export async function ddoinv() {
    const inventory = game.inventory || [];
    const { key } = await selectInventoryObject();
    const selected = inventory.find(item => item.invlet === String.fromCharCode(key));
    let action = null;
    if (selected) {
        action = await inventoryActionForObject(selected);
    }
    await flush_screen(1);
    game.context.move = 0;
    return action;
}
// C invent.c:find_unpaid() and count_unpaid(): the recursive unpaid walk
// over carried objects and container contents.
function unpaidObjects(objects) {
    return objects.flatMap(object => [...(object.unpaid ? [object] : []), ...unpaidObjects(object.contents ?? [])]);
}
// C invent.c:display_pickinv(): the getobj inventory menu, including the
// "Not carrying anything" shortcut and the hands entry when allowed.
export async function selectInventoryObject({ letters, includeGold = true, title = null, extraChoice = null, pickMode = PICK_ONE, headingAttr, menuOptions = [], } = {}) {
    const filtered = !!letters;
    const candidates = letters ? game.inventory.filter(item => item.invlet && letters.includes(item.invlet))
        : game.inventory;
    const visible = includeGold ? candidates : candidates.filter(item => item.oclass !== COIN_CLASS);
    if (!visible.length && !extraChoice) {
        await pline('Not carrying anything.');
        return { key: 0, count: null };
    }
    // C invent.c:reassign() refreshes rotating letters; the wizard-mode
    // override_ID display runs identify_pack()/count_unidentified() first.
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    const wizardIdentification = game.flags.debug && game.iflags.override_ID;
    // Native counts '-' as a filter letter as well as an extra hands entry,
    // so a hands-only filter stays in a menu window.
    const singleton = !menuOptions.length && !game.flags.force_invmenu
        && !game.iflags.menu_requested && !wizardIdentification
        && (letters?.length === 1 && !extraChoice
            || !filtered && visible.length === 0 && !!extraChoice);
    if (singleton) {
        const item = visible[0];
        if (item)
            observeObjectForNaming(item);
        const letter = item ? item.invlet : '-';
        if (!letter)
            throw new Error('A carried inventory choice has no letter');
        const description = item ? await inventoryItemDescription(item, {
            primaryHandDetail: inventoryPrimaryHandDetail(item),
        }) : extraChoice;
        const key = await showMessageMenu(letter, item ? pickMode : PICK_ONE, `${letter} - ${description}.`);
        return { key, count: null };
    }
    // invent.c:display_pickinv() runs sortloot() over the whole inventory
    // (observing every object via loot_classify()) and only afterwards
    // drops entries whose letters are absent from the requested set,
    // treating an empty set as no filter at all.
    const sections = await inventorySections(game.inventory, includeGold, letters || null);
    if (extraChoice && !wizardIdentification)
        sections.unshift({
            heading: game.flags.sortpack === false ? null : 'Miscellaneous',
            items: [{ text: extraChoice, key: '-' }],
        });
    if (menuOptions.length)
        sections.push({
            heading: 'Special', items: menuOptions.map(option => ({
                text: option.text, key: option.key,
            })),
        });
    return showInventoryWindow(sections, {
        pickMode, title, ...(headingAttr === undefined ? {} : { headingAttr }),
    });
}
// C invent.c:display_inventory(). The queued branch of native display_inventory checks class symbols in
// the filter, even when its caller supplied inventory letters instead.
// Undefined means no queued answer; zero means the queue rejected a choice.
export function takeQueuedInventoryChoice(classes = null) {
    // One cmdq_pop() (invent.c:3430-3447)
    // must yield a CMDQ_KEY naming a visible object of a filtered class;
    // any other entry — or an unmatched letter — clears CQ_CANNED and
    // returns 0.
    const entry = cmdq_pop();
    if (!entry)
        return undefined;
    if (entry.typ === CMDQ_KEY) {
        const object = game.inventory.find(item => item.invlet === String.fromCharCode(entry.key));
        const symbol = object ? OBJECT_CLASS_SYMBOLS[object.oclass] : undefined;
        if (object && (!classes || symbol !== undefined && classes.includes(symbol)))
            return entry.key;
    }
    cmdq_clear(CQ_CANNED);
    return 0;
}
// C invent.c:display_used_invlets(). A split's original letter is omitted;
// all remaining carried slots, including gold, stay visible.
export async function selectUsedInventoryLetter(avoidLetter) {
    const items = game.inventory.filter(item => item.invlet !== avoidLetter);
    // This menu walks the carried chain once per pack class; sortloot does
    // not reorder items within a class, even when it sorts other menus.
    const ordered = game.flags.sortpack === false ? items
        : inventoryClassOrder().flatMap(oclass => items.filter(item => item.oclass === oclass));
    const result = await showInventoryWindow(await inventorySectionsInOrder(ordered), {
        title: 'Inventory letters used:', pickMode: PICK_ONE,
    });
    return result.key;
}
// C invent.c:count_contents(). A new drop counts unpaid contents before ownership marks change.
// shk.c:stolen_value() sizes a broken container's shop-owned contents.
export function countContents(container, { quantity = false, everything = false, newdrop = false } = {}, state = game) {
    let shoppy = false;
    if (!everything && !newdrop) {
        let top = container;
        while (top.container)
            top = top.container;
        if (top.where === 'floor')
            shoppy = !!costlySpot(top.ox, top.oy, state);
    }
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countContents(content, { quantity, everything, newdrop }, state);
        if (everything || content.unpaid || (shoppy && !content.no_charge))
            count += quantity ? (content.quan ?? content.quantity ?? 1) : 1;
    }
    return count;
}
// C invent.c:dounpaid(): list unpaid inventory (and floor/buried) items
// with prices, from 'I u' or the unpaid inventory menu.
async function showUnpaid(carried, floor, buried) {
    const extra = floor + buried;
    const first = carried[0];
    if (first && carried.length === 1 && !extra && !unknownContainer(first)) {
        await pline(await pricedInventoryLine(first, first.where === 'inventory' ? first.invlet ?? '#' : '>', await unpaidObjectCost(first)));
        return;
    }
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    const lines = [];
    let total = 0;
    const top = game.inventory.filter(object => object.unpaid);
    for (const oclass of game.flags.sortpack === false ? [null] : inventoryClassOrder()) {
        const objects = top.filter(object => oclass === null || object.oclass === oclass);
        if (objects.length && oclass !== null)
            lines.push(`Unpaid ${objectClassHeading(oclass)}`);
        for (const object of objects) {
            const price = await unpaidObjectCost(object);
            total += price;
            lines.push(await pricedInventoryLine(object, object.invlet ?? '#', price));
        }
    }
    if (carried.length > top.length) {
        if (game.flags.sortpack !== false)
            lines.push('Unpaid Bagged/Boxed items');
        for (const container of game.inventory) {
            const contents = unpaidObjects(container.contents ?? []);
            if (!container.contents?.length)
                continue;
            let price = 0;
            for (const object of contents) {
                const cost = await unpaidObjectCost(object);
                price += cost;
                total += cost;
                if (container.cknown)
                    lines.push(await pricedInventoryLine(object, '>', cost));
            }
            if (!container.cknown)
                lines.push(await pricedInventoryLine(null, '>', price, `${possessiveName(objectName(container))} contents`));
        }
    }
    if (carried.length)
        lines.push('', await pricedInventoryLine(null, '*', total, 'Total:'));
    if (extra) {
        const verb = extra > 1 ? 'are' : 'is';
        const where = !buried ? 'on the floor' : !floor ? 'under the floor' : 'on or under the floor';
        if (!carried.length)
            await pline(`You aren't carrying any unpaid items but there ${verb} ${extra} ${where}.`);
        else
            lines.push('', `(There ${verb} ${extra} more unpaid object${extra === 1 ? '' : 's'} ${where}.)`);
    }
    // C invent.c:3703 fills the unpaid-items window with putstr().
    if (carried.length)
        await showTextMenuOverlay(lines, { viaPutstr: true });
}
// C invent.c:dotypeinv(): the 'I' type filter. ckvalidcat() and ckunpaid()
// are the category filters, tally_BUCX() the beatitude statuses,
// wearing_armor() the armor-class admission, and this_type_only() the
// single-class selection — all inlined below.
// C pickup.c:count_justpicked()/find_justpicked(): the marked stacks
// of the previous pickup feed the 'P' selection.
async function typeInventory() {
    const bill = doinvbill(0);
    if (!game.inventory.length && !bill.length) {
        await pline("You aren't carrying anything.");
        return null;
    }
    if (game.urole?.key === 'priest')
        for (const object of game.inventory)
            object.bknown = object.oclass !== COIN_CLASS;
    const level = requireGameLevel();
    const carried = unpaidObjects(game.inventory);
    const floor = unpaidObjects(level.objects.flatMap(column => (column ?? []).flatMap(pile => pile ?? [])));
    const buried = unpaidObjects(level.buriedObjects ?? []);
    const statuses = new Set(game.inventory.map(object => bucCategory(object)));
    const picked = game.inventory.filter(object => object.pickup_prev);
    const classes = [...new Set(game.inventory.map(object => object.oclass))];
    const extra = `${carried.length + floor.length + buried.length ? 'u' : ''}${bill.length ? 'x' : ''}${[...'BUCX'].filter(status => statuses.has(bucChoice(status))).join('')}${picked.length ? 'P' : ''}`;
    const prompt = 'What type of object do you want an inventory of?';
    let choice;
    const style = game.flags.menu_style ?? MENU_FULL;
    if (style === MENU_FULL || style === MENU_PARTIAL) {
        const menuClasses = [...inventoryClassOrder(), VENOM_CLASS].filter(oclass => classes.includes(oclass));
        choice = await inventoryCategoryMenu(menuClasses, carried.length > 0, bill.length > 0, statuses, picked, prompt);
    }
    else {
        const types = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('') + (extra ? ` ${extra}` : '');
        choice = types;
        if (types.length > 1) {
            // invent.c:dotypeinv() accepts absent classes and categories too,
            // but hides them after ESC in the response list.
            const hiddenTypes = [...'uxBUCXP', ...OBJECT_CLASS_SYMBOLS]
                .filter(symbol => !types.includes(symbol)).join('');
            choice = (await yn_function(prompt, `${types}\x1b${hiddenTypes}`, '', true)).answer;
            if (!choice || choice === '\0') {
                clearMessageWindow();
                return null;
            }
        }
    }
    if (choice === null)
        return null;
    if (choice === 'x' || choice === 'X' && bill.length && !statuses.has('X')) {
        if (bill.length)
            await doinvbill(1);
        else
            await pline(`No used-up objects${carried.length + floor.length + buried.length ? ' on your shopping bill' : ''}.`);
        return null;
    }
    if (choice === 'u' || choice === 'U' && carried.length + floor.length + buried.length > 0 && !statuses.has('U')) {
        if (carried.length + floor.length + buried.length)
            await showUnpaid(carried, floor.length, buried.length);
        else
            await pline('You are not carrying any unpaid objects.');
        return null;
    }
    const status = typeof choice === 'string' && 'BUCXP'.includes(choice) ? choice : null;
    const oclass = typeof choice === 'number' ? choice : OBJECT_CLASS_SYMBOLS.indexOf(choice);
    const candidates = game.inventory.filter(object => status === 'P' ? object.pickup_prev
        : status ? bucCategory(object) === status : object.oclass === oclass);
    const before = status === 'B' ? 'known to be blessed ' : status === 'U' ? 'known to be uncursed '
        : status === 'C' ? 'known to be cursed ' : status ? '' : 'such ';
    const after = status === 'X' ? ' whose blessed/uncursed/cursed status is unknown'
        : status === 'P' ? ' that were just picked up' : '';
    if (!candidates.length) {
        await pline(`You have no ${before}objects${after}.`);
        return null;
    }
    const sorted = sortObjects(candidates, { mode: lootSortMode({ inventoryLetters: game.flags.fixinv !== false }) });
    const order = [...inventoryClassOrder(), VENOM_CLASS];
    const sections = [];
    for (const oclass of order) {
        const objects = sorted.filter(object => object.oclass === oclass);
        if (!objects.length)
            continue;
        const items = [];
        for (const object of objects) {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({ ...(game.flags.fixinv !== false ? { key: object.invlet ?? '#' }
                    : object === sorted[0] && object.oclass === COIN_CLASS ? { key: '$' } : {}),
                groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '', value: object,
                text: await inventoryItemDescription(object, { primaryHandDetail: inventoryPrimaryHandDetail(object) }) });
        }
        sections.push({ heading: objectClassHeading(oclass), items });
    }
    const selected = await showMultiSelectWindow({ title: '',
        introLines: status ? [`Items ${(before || after).trim()}:`] : [],
        sections, pageLocalKeys: true, pickOne: true });
    const object = selected[0];
    return object ? inventoryActionForObject(object) : null;
}
// C invent.c:dfeature_at(): name the dungeon feature on a square, if any.
export function dungeonFeatureAt(x, y, { state = game, probing = false } = {}) {
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ;
    if (type === DOOR) {
        if (findDrawbridgeAt(x, y, state))
            return 'open drawbridge portcullis';
        return location.doormask === D_NODOOR ? 'doorway'
            : location.doormask === D_ISOPEN ? 'open door'
                : location.doormask === D_BROKEN ? 'broken door' : 'closed door';
    }
    if (type === FOUNTAIN)
        return 'fountain';
    if (type === THRONE)
        return 'opulent throne';
    if (isLavaAt(x, y, state))
        return 'molten lava';
    const surface = type === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : type;
    if (surface === ICE)
        return iceDescriptionAt(x, y, { state, probing });
    if (isPoolAt(x, y, state))
        return 'pool of water';
    if (type === SINK)
        return 'sink';
    if (type === ALTAR) {
        const alignment = Amask2align(location.flags);
        const name = alignment === A_NONE ? 'unaligned'
            : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
        const deity = deityName(alignment, state).replace(/^_/, '');
        return `${location.flags & AM_SANCTUM ? 'high ' : ''}altar to ${deity} (${name})`;
    }
    for (let stairway = state.stairs; stairway; stairway = stairway.next)
        if (stairway.sx === x && stairway.sy === y)
            return stairwayDescription(stairway, state);
    if (type === DRAWBRIDGE_DOWN)
        return 'lowered drawbridge';
    if (type === DBWALL)
        return 'raised drawbridge';
    if (type === GRAVE)
        return 'grave';
    if (type === TREE)
        return 'tree';
    if (type === IRONBARS)
        return 'set of iron bars';
    return null;
}
// C invent.c:look_here(). A positive objectCount is
// autopickup's count, which summarizes a pile at pile_limit; skipFeature
// means describe_decor() already showed the terrain.
export async function lookHere(objectCount = 0, { pickedSome = false, skipFeature = false } = {}) {
    const blind = heroIsBlind();
    if (game.u.uswallow && game.u.ustuck) {
        const monster = game.u.ustuck;
        const location = `${possessiveName(monsterName(monster))} ${mbodypart(monster.mnum, STOMACH)}`;
        await plineWithContinuation(`You ${blind ? 'try' : 'look around'} to ${blind ? 'feel' : 'see'} what is lying in ${location}.`);
        const objects = monster.minvent ?? monster.inventory ?? [];
        if (!objects.length) {
            await plineWithContinuation(`You ${blind ? 'feel' : 'see'} no objects here.`);
            return { died: false, tookTime: blind };
        }
        for (const object of objects) {
            const contact = await feelPetrifyingCorpse(object);
            if (contact.died)
                return { died: true, tookTime: blind };
        }
        await displayMonsterInventory(monster, objects, location, blind);
        return { died: false, tookTime: blind };
    }
    const { ux: x, uy: y } = game.u;
    const level = requireGameLevel();
    const limit = configuredPileLimit();
    const skipObjects = limit > 0 && objectCount >= limit;
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!skipObjects) {
        const region = visibleRegionAt(game, x, y);
        const features = [];
        if (region)
            features.push(`a ${region.damage ? 'poison gas' : 'vapor'} cloud`);
        if (trap?.tseen)
            features.push(withIndefiniteArticle(trapName(trap.ttyp)));
        if (features.length)
            await plineWithContinuation(`There is ${features.join(' and ')} here.`);
    }
    const underwater = !!(game.underwater || game.u.uinwater);
    let featureName = dungeonFeatureAt(x, y);
    if (featureName === 'pool of water' && underwater)
        featureName = null;
    let hideFeature = skipFeature;
    if (blind) {
        const drift = Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz);
        const surface = surfaceName(x, y);
        if (featureName?.startsWith('altar ')) {
            await plineWithContinuation('You try to feel what is here.');
        }
        else if (isIceAt(x, y)) {
            if (!game.flags.mention_decor || game._prevDecorType === ICE)
                await forceDescribeDecor();
            await plineWithContinuation('You try to feel what is on it.');
            hideFeature = true;
        }
        else {
            const where = drift ? 'floating here' : heroCanReachFloor(game, { checkPit: true })
                ? `lying here on the ${surface}` : 'lying beneath you';
            await plineWithContinuation(`You try to feel what is ${where}.`);
            if (!drift && featureName === surface)
                hideFeature = true;
        }
        if (!heroCanReachFloor(game, { checkPit: !!trap && is_pit(trap.ttyp) })) {
            await plineWithContinuation("But you can't reach it!");
            return { died: false, tookTime: false };
        }
    }
    const feature = hideFeature ? '' : dungeonFeatureSentence(featureName);
    const objects = isLavaAt(x, y) || (isPoolAt(x, y) && !underwater) ? [] : level.objects[x]?.[y] ?? [];
    if (!objects.length) {
        if (feature)
            await plineWithContinuation(feature);
        await readFloorEngraving(x, y);
        if (!skipObjects && (blind || !featureName))
            await plineWithContinuation(`You ${blind ? 'feel' : 'see'} no objects here.`);
        return { died: false, tookTime: blind };
    }
    const { died } = await showFloorPile(objects, pickedSome, feature, { objectCount });
    return { died, tookTime: blind };
}
// C invent.c:dolook().
export async function dolook() {
    hideUnhideMessageTypes(true, MSGTYP_MASK_REP_SHOW, game.iflags.messageTypes);
    try {
        const { tookTime } = await lookHere(0);
        game.context.move = tookTime ? 1 : 0;
    }
    finally {
        hideUnhideMessageTypes(false, MSGTYP_MASK_REP_SHOW, game.iflags.messageTypes);
    }
}
// C invent.c:will_feel_cockatrice(). Unlike picking up a
// corpse, a floor inspection only touches it when blind or explicitly forced.
export function willFeelPetrifyingCorpse(object, { forceTouch = false, state = game } = {}) {
    return (heroIsBlind(state) || forceTouch)
        && !(state.uarmg || state.u?.uarmg) && !heroResistsStoning(state)
        && object.otyp === CORPSE && touchPetrifies(object.corpsenm);
}
// C invent.c:feel_cockatrice().
export async function feelPetrifyingCorpse(object, { forceTouch = false, state = game, publish = plineWithContinuation, } = {}) {
    if (!willFeelPetrifyingCorpse(object, { forceTouch, state }))
        return { touched: false, died: false };
    const corpse = corpseName(object, { definite: true });
    if (formCanBecomeStoneGolem(state.u.umonnum, state))
        await publish(`You touched ${corpse} with your bare ${makePlural(body_part(HAND, state))}.`);
    else
        await publish(`Touching ${corpse} is a fatal mistake...`);
    const result = await resolveImmediatePetrification({
        state, publish,
        killer: `touching ${killerObjectName(object, state)} bare-handed`,
    });
    return { touched: true, died: result.died };
}
// C invent.c:stackobj(). Stack an object with the first compatible floor object.
export async function stack_object(object, state = game) {
    if (!object)
        return object;
    const pile = state.level?.objects?.[object.ox]?.[object.oy];
    if (!pile)
        return object;
    const existing = pile.find(candidate => candidate !== object && mergable(object, candidate, state));
    if (!existing)
        return object;
    return await mergeObjectStacks(object, existing, state) || object;
}
// C invent.c:mergable().
export function mergable(otmp, obj, state = game) {
    if (!otmp || !obj || otmp === obj || otmp.otyp !== obj.otyp
        || otmp.nomerge || obj.nomerge || !objectMerge(obj.otyp)) {
        return false;
    }
    if (obj.oclass === COIN_CLASS)
        return true;
    if (!!otmp.cursed !== !!obj.cursed
        || !!otmp.blessed !== !!obj.blessed)
        return false;
    const otmpLost = otmp.how_lost ?? 0;
    const objLost = obj.how_lost ?? 0;
    if (otmpLost === 4 || objLost === 4
        || (otmpLost !== 0 && otmpLost !== objLost))
        return false;
    if (obj.globby || otmp.globby)
        return !!obj.globby && !!otmp.globby;
    // C obj.h stores opoisoned in otrapped, odiluted in oeroded and norevive
    // in oeroded2, so native mergable()'s tests of those fields also keep
    // poisoned weapons, diluted potions and frozen corpses in their own stacks.
    for (const field of [
        'unpaid', 'no_charge', 'obroken', 'otrapped', 'opoisoned', 'lamplit',
        'odiluted', 'norevive',
    ]) {
        if (!!otmp[field] !== !!obj[field])
            return false;
    }
    if ((otmp.spe ?? 0) !== (obj.spe ?? 0))
        return false;
    if (obj.oclass === FOOD_CLASS
        && ((otmp.oeaten ?? 0) !== (obj.oeaten ?? 0)
            || !!otmp.orotten !== !!obj.orotten))
        return false;
    const impairedSight = heroIsBlind(state) || heroIsHallucinating(state);
    const cleric = state?.urole?.key === 'priest';
    if (!!otmp.dknown !== !!obj.dknown
        || ((!!otmp.bknown !== !!obj.bknown)
            && !cleric && impairedSight)
        || (otmp.oeroded ?? 0) !== (obj.oeroded ?? 0)
        || (otmp.oeroded2 ?? 0) !== (obj.oeroded2 ?? 0)
        || !!otmp.greased !== !!obj.greased) {
        return false;
    }
    if (erosionMatters(obj) && (!!otmp.oerodeproof !== !!obj.oerodeproof
        || !!otmp.rknown !== !!obj.rknown && impairedSight))
        return false;
    if ([CORPSE, EGG, TIN].includes(obj.otyp)
        && (otmp.corpsenm ?? -1) !== (obj.corpsenm ?? -1))
        return false;
    if (obj.otyp === EGG && (otmp.timed || obj.timed))
        return false;
    if (obj.otyp === CORPSE && isReviver(otmp.corpsenm))
        return false;
    if ((obj.otyp === TALLOW_CANDLE || obj.otyp === WAX_CANDLE)
        && Math.trunc((otmp.age ?? 0) / 25)
            !== Math.trunc((obj.age ?? 0) / 25))
        return false;
    if (obj.otyp === POT_OIL && obj.lamplit)
        return false;
    // C: don't merge surcharged/differently priced unpaid stacks.
    if (obj.unpaid && !sameBillPrice(obj, otmp, state))
        return false;
    if (hasAttachment(otmp) || hasAttachment(obj))
        return false;
    const otmpName = objectMergeName(otmp);
    const OBJ_NAME = objectMergeName(obj);
    if ((otmpName && OBJ_NAME && otmpName !== OBJ_NAME)
        || (obj.otyp === CORPSE && !!otmpName !== !!OBJ_NAME))
        return false;
    // C keeps the two stamped-mail flavors (bones/wished vs hand-written)
    // apart unless the stack ids share a parity.
    if (obj.otyp === SCR_MAIL && (obj.spe ?? 0) > 0
        && (obj.o_id % 2) !== (otmp.o_id % 2))
        return false;
    if ((otmp.oartifact ?? 0) !== (obj.oartifact ?? 0))
        return false;
    if (!!otmp.known !== !!obj.known && impairedSight)
        return false;
    return true;
}
// C invent.c:doprgold(). Report visible and known hidden gold, then shop debt.
async function doprgold() {
    const purse = heroGoldAmount(game), stashed = hiddenGold(game, false);
    if (game.flags.verbose !== false) {
        let message = purse ? `Your wallet contains ${purse} ${currency(purse)}` : 'Your wallet is empty';
        if (stashed)
            message += `, ${purse ? 'and' : 'but'} you have ${stashed} ${purse ? 'more' : currency(stashed)} stashed away in your pack`;
        await pline(`${message}.`);
    }
    else {
        const total = purse + stashed;
        await pline(total ? `You are carrying a total of ${total} ${currency(total)}.` : 'You have no money.');
    }
    await reportShopFinances();
    const gold = heroGoldObject(game);
    return gold && game.iflags.menu_requested ? reportSubset([gold], false) : null;
}
// C invent.c:doprwep().
async function doprwep() {
    if (!game.uwep) {
        await pline(`You are ${game.uarmg ? 'empty handed' : monsterIsHumanoid(heroSpecies(game))
            ? 'bare handed' : 'not wielding anything'}.`);
    }
    else if (!game.iflags.menu_requested) {
        await describeCarriedObject(game.uwep);
        if (game.u.twoweap && game.uswapwep)
            await describeCarriedObject(game.uswapwep);
    }
    else {
        return reportSubset([game.uwep, game.uswapwep, game.uquiver]
            .filter((object) => !!object));
    }
    return null;
}
// C invent.c:noarmor(). Mention skin armor only when the caller requests it.
async function noarmor(reportSkin) {
    await pline(reportSkin && game.uskin ? `You are not wearing armor but have ${simpleObjectName(game.uskin)
        .replace(/^set of /i, '').replace(/ dragon /i, ' ')} embedded in your skin.`
        : 'You are not wearing any armor.');
}
// C invent.c:doprarm().
async function doprarm() {
    const armor = [game.uarm, game.uarmc, game.uarms, game.uarmh, game.uarmg, game.uarmf, game.uarmu]
        .filter((object) => !!object);
    if (armor.length)
        return reportSubset(armor);
    await noarmor(true);
    return null;
}
// C invent.c:doprring().
async function doprring() {
    const rings = [game.uright, game.uleft].filter((object) => !!object);
    if (rings.length)
        return reportSubset(rings, rings.length > 1 || !!game.iflags.menu_requested
            || rings.some(object => object.oclass !== RING_CLASS), rings.length === 1 ? 'Ring' : 'Rings');
    await pline('You are not wearing any rings.');
    return null;
}
// C invent.c:dopramulet().
async function dopramulet() {
    if (game.uamul)
        return reportSubset([game.uamul], true, 'Amulet');
    await pline('You are not wearing an amulet.');
    return null;
}
// C invent.c:tool_being_used().
function toolBeingUsed(object) {
    return !!((object.owornmask ?? 0) & (W_TOOL | W_SADDLE))
        || object.oclass === TOOL_CLASS && (object === game.uwep || !!object.lamplit
            || object.otyp === LEASH && !!object.leashmon);
}
// C invent.c:doprtool().
async function doprtool() {
    const items = game.inventory.filter(toolBeingUsed);
    if (items.length)
        return reportSubset(items.slice(0, 52));
    await pline('You are not using any tools.');
    return null;
}
// C invent.c:doprinuse().
async function doprinuse() {
    const items = game.inventory.filter(isInUse);
    if (items.length)
        return reportSubset(null);
    await pline('You are not wearing or wielding anything.');
    return null;
}
// C invent.c:useupf(). Consume floor stock, retaining any used-up shop bill.
export async function useUpFloorObject(object, count, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { ox: x, oy: y } = object;
    const consumed = object.quan > count ? splitObjectStack(object, count, state) : object;
    if (!consumed)
        throw new Error('Floor consumption requires a valid stack quantity');
    if (!state.context.mon_moving && costlySpot(x, y, state)) {
        const room = roomsAt(state.level, x, y)[0];
        if (room !== undefined && state.u.urooms.includes(room))
            await addShopObjectToBill(consumed, state, { ininv: false, silent: false, publish });
        else
            await stolenValue(consumed, x, y, false, { silent: false, state, publish });
    }
    await delobj(consumed, state);
    if (state.u.ux === x && state.u.uy === y
        && state.u.uundetected && heroFormHidesUnderObjects(state))
        await hideHeroUnder(state);
}
// C invent.c:let_to_name() names[]. Conversion from a class to a string
// for printing; this must match the object class order.
export function objectClassHeading(oclass) {
    return [null, 'Illegal objects', 'Weapons', 'Armor', 'Rings', 'Amulets',
        'Tools', 'Comestibles', 'Potions', 'Scrolls', 'Spellbooks', 'Wands',
        'Coins', 'Gems/Stones', 'Boulders/Statues', 'Iron balls', 'Chains', 'Venoms'][oclass] || 'Other';
}
// C invent.c:reassign(): give consecutive letters to every carried item
// for !fixinv mode; gold is always forced to '$' at the head of the list.
export function reassignInventoryLetters() {
    const goldIndex = game.inventory.findIndex(object => object.oclass === COIN_CLASS);
    if (goldIndex >= 0) {
        const gold = game.inventory[goldIndex];
        if (!gold)
            throw new Error('The gold inventory entry is missing');
        game.inventory.splice(goldIndex, 1);
        gold.invlet = '$';
        game.inventory.unshift(gold);
    }
    let index = 0;
    for (const object of game.inventory) {
        if (object.oclass === COIN_CLASS)
            continue;
        object.invlet = index < 26 ? String.fromCharCode(97 + index)
            : index < 52 ? String.fromCharCode(65 + index - 26) : '#';
        index++;
    }
    game._lastInvNr = Math.min(index, 51);
}
// C invent.c:check_invent_gold(): only malformed purses may be reorganized.
export async function checkInventoryGold(why, state = game) {
    const gold = state.inventory.filter(object => object.oclass === COIN_CLASS);
    const wrongSlots = gold.filter(object => object.invlet !== '$').length;
    if (gold.length <= 1 && wrongSlots === 0)
        return false;
    const wrongSlotMessage = wrongSlots > 1 ? 'gold in wrong slots'
        : wrongSlots === 1 ? 'gold in wrong slot' : '';
    await impossible(`${why}: ${wrongSlotMessage}${wrongSlots && gold.length > 1 ? ' and ' : ''}${gold.length > 1 ? 'multiple gold stacks' : ''}`, { state });
    return true;
}
// C invent.c:adjust_ok(). Gold is excluded from ordinary adjustment.
function adjustOk(object) {
    return object.oclass === COIN_CLASS ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST;
}
// C invent.c:adjust_gold_ok(). The sanity repair allows gold too.
function adjustGoldOk(_object) {
    return GETOBJ_SUGGEST;
}
// C invent.c:doorganize(). Select the source object before adjusting its letter.
export async function doadjust(selected = null, splitting = null) {
    const inventory = (game.inventory || [])
        .filter((object) => typeof object.invlet === 'string' && object.invlet.length > 0)
        .sort((a, b) => inventoryLetterRank(a) - inventoryLetterRank(b));
    if (!inventory.length) {
        await pline("You aren't carrying anything to adjust.");
        game.context.move = 0;
        return;
    }
    if (inventory.length === 1 && inventory[0]?.oclass === COIN_CLASS && inventory[0].invlet === '$') {
        await pline("You aren't carrying anything adjustable.");
        game.context.move = 0;
        return;
    }
    if (!selected && game.flags.fixinv === false)
        reassignInventoryLetters();
    const repairGold = !selected && await checkInventoryGold('adjust');
    const object = selected || await chooseInventoryObject('adjust', repairGold ? adjustGoldOk : adjustOk, { forcePrompt: true, allowCount: true });
    await doorganizeCore(object, splitting, inventory);
}
// C invent.c:adjust_split(). The split remains linked beside its
// original until the destination is chosen; cancelling merges it back.
export async function adjustSplit() {
    game.context.move = 0;
    const object = await chooseInventoryObject('split', adjustOk);
    if (!object || object.quan < 2 || object.oclass === COIN_CLASS) {
        commandResultFailed(); // invent.c:adjust_split() ECMD_FAIL.
        return;
    }
    let amount;
    if (object.quan === 2) {
        amount = 1;
    }
    else {
        // C adjust_split(): "get first digit; doesn't wait for <return>".
        await flushPendingTopline();
        const dig = await ynSingleKey('Split off how many? ');
        if (dig < 48 || dig > 57) {
            amount = null;
        }
        else {
            const { key, count } = await getCount(dig, 0n, GC_ECHOFIRST | GC_CONDHIST);
            clearMessageWindow();
            // C adjust_split(): quitchars[] accepts only space, \n and \r;
            // Escape (checked separately in C) and every other key cancel
            // with the count discarded.
            amount = key === 32 || key === 10 || key === 13 ? Number(count) : null;
        }
    }
    if (amount === null) {
        await pline('Never mind.');
        commandResultCancelled(); // adjust_split() quit answer ECMD_CANCEL.
        return;
    }
    if (amount < 1 || amount >= object.quan) {
        await pline(`Amount to split from current stack must be ${amount < 1
            ? 'at least 1' : `less than ${object.quan}`}.`);
        commandResultCancelled(); // adjust_split() bad amount ECMD_CANCEL.
        return;
    }
    const split = splitObjectStack(object, amount, game);
    if (!split)
        throw new Error('An admitted inventory stack could not be split');
    await doadjust(split, object);
}
// C invent.c:doorganize_core(). Move, split, merge, or exchange the selected stack.
async function doorganizeCore(object, splitting, inventory) {
    if (!object) {
        // invent.c:doorganize_core() returns ECMD_CANCEL when getobj() is
        // dismissed; the rhack seam clears both command queues.
        game.context.move = 0;
        commandResultCancelled();
        return;
    }
    if (!splitting) {
        const previous = game.inventory[game.inventory.indexOf(object) - 1];
        if (previous && previous.invlet === object.invlet)
            splitting = previous;
    }
    const source = object.invlet;
    if (!source)
        throw new Error('Adjusting inventory requires a lettered object.');
    // C doorganize_core() chooses '$' itself when repairing gold. A purse
    // already in '$' collects other stacks; one elsewhere merges into '$'.
    if (object.oclass === COIN_CLASS) {
        const collect = object.invlet === '$';
        let purse = object;
        let action = collect ? 'Collecting' : 'Moving';
        for (const candidate of inventory) {
            if (candidate === purse || candidate === object)
                continue;
            if (!collect && candidate.invlet !== '$')
                continue;
            const candidateName = candidate.oextra?.oname ?? candidate.oname;
            const purseName = purse.oextra?.oname ?? purse.oname;
            const merged = (!candidateName || candidateName === purseName)
                ? await mergeObjectStacks(candidate, purse) : null;
            if (merged) {
                purse = merged;
                if (collect)
                    continue;
                action = 'Merging';
            }
            else if (!collect) {
                candidate.invlet = source;
                action = 'Swapping';
            }
            if (!collect)
                break;
        }
        purse.invlet = '$';
        reorderInventory();
        if (game.flags.fixinv === false)
            reassignInventoryLetters();
        observeObjectForNaming(purse);
        await pline(`${action}: $ - ${await inventoryItemDescription(purse)}.`);
        game.context.move = 0;
        return;
    }
    const adjusting = object;
    const occupied = new Set(inventory.filter(candidate => candidate !== adjusting && !mergable(candidate, adjusting))
        .map(candidate => candidate.invlet));
    const slots = game.flags.fixinv === false
        ? game.inventory.filter(item => item.oclass !== COIN_CLASS).length + (splitting ? 0 : 1) : 52;
    const recommended = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, slots)
        .split('')
        .filter(letter => letter === adjusting.invlet || !occupied.has(letter))
        .join('') + (occupied.has('#') ? '#' : '');
    const destinationPrompt = `${splitting ? `Split ${object.quan}` : 'Adjust letter'} to what [${compactInventoryLetters(recommended)}] (? see used letters)?`;
    // The source item's queued letter bypasses getobj's prompt, but the
    // destination uses tty_yn_function(), which acknowledges unread prose.
    await flushPendingTopline();
    let destination = '';
    for (let attempt = 1;; attempt++) {
        let key = (await yn_function(destinationPrompt, null, '', true)).answer.charCodeAt(0);
        if (key === 63 || key === 42) {
            key = await selectUsedInventoryLetter(splitting ? source : null);
            if (!key)
                continue;
        }
        destination = String.fromCharCode(key);
        // C strchr(quitchars, let) also matches a literal fuzzer NUL.
        if ([0, 27, 32, 10, 13].includes(key) || splitting && destination === source) {
            if (splitting)
                await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        if (destination === '$') {
            if (splitting)
                await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline("Only gold coins may be moved into the '$' slot.");
            game.context.move = 0;
            return;
        }
        if (/^[a-zA-Z]$/.test(destination) || destination === '#' && occupied.has('#'))
            break;
        if (attempt === 5) {
            if (splitting)
                await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        await plineWithContinuation('Select an inventory slot letter.');
        await flushPendingTopline();
    }
    let action = splitting ? 'Splitting:' : destination === source ? 'Collecting:' : 'Moving:';
    let bumped = null;
    // C extracts the selected stack before collecting. A merge can free
    // that object, so it must never reappear among the remaining candidates.
    unlinkObject(object, game);
    for (const candidate of game.inventory.slice()) {
        const name = object.oextra?.oname ?? object.oname;
        const candidateName = candidate.oextra?.oname ?? candidate.oname;
        const permitsName = !candidateName || !!name && name === candidateName;
        if (destination === source) {
            if (permitsName) {
                const merged = await mergeObjectStacks(candidate, object);
                if (merged) {
                    object = merged;
                    unlinkObject(object, game);
                }
            }
            continue;
        }
        if (candidate.invlet !== destination)
            continue;
        const merged = permitsName ? await mergeObjectStacks(candidate, object) : null;
        if (merged) {
            object = merged;
            unlinkObject(object, game);
            action = 'Merging:';
        }
        else if (!splitting) {
            candidate.invlet = source;
            action = 'Swapping:';
        }
        else {
            // A split takes the destination's name when otherwise compatible.
            if (name && !object.oartifact) {
                if (object.oextra)
                    delete object.oextra.oname;
                delete object.oname;
            }
            const splitMerge = await mergeObjectStacks(candidate, object);
            if (splitMerge) {
                object = splitMerge;
                unlinkObject(object, game);
                action = 'Splitting and merging:';
            }
            else {
                if (name) {
                    if (object.oextra)
                        object.oextra.oname = name;
                    object.oname = name;
                }
                if (game.inventory.filter(item => item !== object && item.oclass !== COIN_CLASS).length >= 52) {
                    object.where = 'inventory';
                    game.inventory.unshift(object);
                    await rejoinObjectStack(splitting, object, game);
                    clearMessageWindow();
                    await pline('Your pack is too full.');
                    game.context.move = 0;
                    return;
                }
                unlinkObject(candidate, game);
                bumped = candidate;
            }
        }
        break;
    }
    object.invlet = destination;
    object.where = 'inventory';
    game.inventory.unshift(object);
    if (bumped) {
        assignInventoryLetter(bumped);
        bumped.where = 'inventory';
        game.inventory.unshift(bumped);
    }
    reorderInventory();
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    game._pending_message = '';
    observeObjectForNaming(object);
    await pline(`${action} ${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
    if (bumped)
        await plineWithContinuation(`Moving: ${bumped.invlet} - ${await inventoryItemDescription(bumped)}.`);
    game.context.move = 0;
}
// Part of C pickup.c:query_objlist(): its INCLUDE_HERO branch — an
// engulfer's loot menu closes after the last class group with an
// "Engulfed Creatures" heading ("Swallowed" when the engulfer digests)
// and a fake hero entry selectable through CONTAINED_SYM and described
// by an(self_lookat()).
export function engulfedHeroMenuSection(monster) {
    // query_objlist() attaches a monster glyph even though tty only shows text.
    transientMonsterGlyph({ mnum: heroSpecies(game),
        female: !!(heroIsPolymorphed(game) ? game.u.mfemale : game.flags.female) });
    return { heading: `${monsterDigests(monster) ? 'Swallowed' : 'Engulfed'} Creatures`,
        items: [{ key: CONTAINED_SYM, text: withIndefiniteArticle(swallowedHeroDescription()) }] };
}
// C invent.c:display_minventory(). The swallowed inventory view includes the hero.
async function displayMonsterInventory(monster, objects, location, blind) {
    // display_minventory() builds its default title even when look_here()
    // supplies another title, so the perceived owner still changes.
    monsterName(monster, { article: 'your', suppressIt: true, capitalized: true,
        suppressSaddle: !!MGIVENNAME(monster) });
    const ordered = sortObjects(objects, { mode: lootSortMode() });
    const sections = [];
    let first = true;
    for (const oclass of [...inventoryClassOrder(), VENOM_CLASS, RANDOM_CLASS]) {
        const objects = ordered.filter(object => object.oclass === oclass);
        if (!objects.length)
            continue;
        const items = [];
        for (const object of objects) {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            const firstGold = first && object.otyp === GOLD_PIECE;
            first = false;
            items.push({ ...(firstGold ? { key: '$' } : {}),
                text: await inventoryItemDescription(object), value: object });
        }
        sections.push({ heading: objectClassHeading(oclass), items });
    }
    sections.push(engulfedHeroMenuSection(monster));
    await showInventoryWindow(sections, { title: blind ? 'You feel:'
            : `Contents of ${location}:` });
}
// C invent.c:cinv_doname(): the probing contents menu names the box with
// "trapped" inserted before its lock state even though doname() already
// shows a just-learned trap, so a trapped box is named twice.
export async function probedContentsTitle(object, state) {
    let name = await objectDescription(object, { state });
    if (!object.otrapped)
        return name;
    const locked = name.indexOf(' locked ');
    const unlocked = name.indexOf(' unlocked ');
    if (locked >= 0 && (unlocked < 0 || locked < unlocked))
        name = name.replace(' locked ', ' trapped locked ');
    else if (unlocked >= 0)
        name = name.replace(' unlocked ', ' trapped unlocked ');
    return name.replace('an trapped ', 'a trapped ');
}
// C invent.c:display_binventory(): objects beneath the probed surface.
// Also C invent.c:only_here(): inlined as the buried-objects filter by
// (x, y) below.
export async function displayBuriedInventory(x, y, state) {
    const pile = state.level.objects[x]?.[y] || [];
    let underwhat = 'here', count = 0;
    if ((isPoolAt(x, y, state) || isLavaAt(x, y, state)) && !(state.underwater || state.u.uinwater) && pile.length) {
        const liquid = displayLiquidName(isPoolAt(x, y, state) ? 'water' : 'lava', state);
        count = pile.length;
        if (pile.length === 1) {
            const object = pile[0];
            if (!object)
                throw new Error('A visible one-object pile must contain its object.');
            const plural = objectNameIsPlural(object, state);
            await plineWithContinuation(`There ${plural ? 'are' : 'is'} ${await inventoryItemDescription(object)} under the ${liquid} here.`);
            underwhat = plural || pair_of(object) ? 'under them' : 'beneath it';
        }
        else {
            await showProbedObjectInventory(pile, `Things that are under the ${liquid} here:`, { state, groupByClass: false });
            underwhat = 'beneath them';
        }
    }
    const buried = (state.level.buriedObjects || []).filter(object => object.ox === x && object.oy === y);
    for (const object of buried)
        observeObject(object, state);
    if (buried.length)
        await showProbedObjectInventory(buried, `Things that are buried ${underwhat}:`, { state });
    return count + buried.length;
}
// Part of C objnam.c:obj_typename(): the class-qualified type name ("potion
// of ..."); the shared port is in objnam.ts.
function qualifiedObjectName(raw) {
    if (raw.otyp === CORPSE && raw.corpsenm !== undefined && MONSTER_NAME[raw.corpsenm])
        return `${MONSTER_NAME[raw.corpsenm]} corpse`;
    const name = OBJ_NAME(raw.otyp) || `object ${raw.otyp}`;
    switch (raw.oclass) {
        case RING_CLASS: return `ring of ${name}`;
        case POTION_CLASS: return `potion of ${name}`;
        case SCROLL_CLASS: return `scroll of ${name}`;
        case SPBOOK_CLASS: return `spellbook of ${name}`;
        case WAND_CLASS: return `wand of ${name}`;
        default: return name;
    }
}
// Port only: the presentation cache for a fully known object (objnam.c
// naming materialized once per type).
function sourceKnownPresentation(raw) {
    const name = qualifiedObjectName(raw);
    const plural = raw.oclass === RING_CLASS ? `rings of ${OBJ_NAME(raw.otyp)}`
        : raw.oclass === POTION_CLASS ? `potions of ${OBJ_NAME(raw.otyp)}`
            : raw.oclass === SCROLL_CLASS ? `scrolls of ${OBJ_NAME(raw.otyp)}`
                : raw.oclass === SPBOOK_CLASS ? `spellbooks of ${OBJ_NAME(raw.otyp)}`
                    : raw.oclass === WAND_CLASS ? `wands of ${OBJ_NAME(raw.otyp)}`
                        : makePlural(name);
    return {
        class: CLASS_PRESENTATION[raw.oclass] || 'Other',
        name, plural,
        enchanted: raw.oclass === WEAPON_CLASS || raw.oclass === ARMOR_CLASS
            || (raw.oclass === RING_CLASS && raw.spe !== 0),
        showBuc: raw.oclass === WAND_CLASS ? false : undefined,
        spellName: raw.oclass === SPBOOK_CLASS ? OBJ_NAME(raw.otyp) : undefined,
        spellLevel: raw.oclass === SPBOOK_CLASS
            ? oc_level(raw.otyp) : undefined,
        spellCategory: raw.oclass === SPBOOK_CLASS
            ? OBJECT_SPELL_CATEGORY[raw.otyp] : undefined,
    };
}
// Port only: display-only projection without changing the carried object.
export function inventoryItem(raw, presentation = null) {
    return { ...raw, ...inventoryPresentation(raw, presentation) };
}
// Port only: acquisition and polymorph retain the same object already held
// by timers and ownership links. Only presentation fields are updated here.
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
// Port only: the presentation view (role-specific sword and dagger names
// follow objnam.c's xname() adjustments).
function inventoryPresentation(raw, presentation) {
    let view = presentation || ITEM_PRESENTATION.get(raw.otyp)
        || (raw._startingInventory || objectTypeKnown(raw)
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
// Part of C invent.c:addinv_core2(): normalize the new object before
// linking — how_lost, no_charge, the picked container, and ox/oy.
function prepareInventoryItem(raw, presentation, observe) {
    raw.how_lost = LOST_NONE;
    raw.no_charge = false;
    if (raw.contents?.length)
        pickedContainer(raw);
    raw.ox = raw.oy = 0;
    const item = updateInventoryPresentation(raw, presentation);
    if (observe)
        item.dknown = true;
    recordHeroPrizeAcquisition(item, game);
    return item;
}
// Part of C invent.c:addinv_core2(): assigninvlet, mark carried, link into
// invent, and reorder under fixinv.
function linkInventoryItem(item) {
    assignInventoryLetter(item);
    item.where = 'inventory';
    game.inventory.push(item);
    // C invent.c:addinv_core0()/reorder_invent(): fixed letters order the
    // carried chain, including gold before letters and lowercase before uppercase.
    if (game.flags.fixinv !== false) {
        reorderInventory();
    }
    return item;
}
// Part of C invent.c:reorder_invent(): the key toggles ASCII case to put
// a-z before A-Z.
export function inventoryLetterRank(item) {
    return (item.invlet?.charCodeAt(0) ?? 0) ^ 0x20;
}
// Part of C invent.c:addinv_core2(): the tail — the pickup_thrown quiver,
// pickup_prev, carry_obj_effects(), and the cursed-figurine timer.
async function finishAddedInventoryItem(item, recoveredThrownStack = false) {
    if (recoveredThrownStack && game.flags.pickup_thrown !== false && !game.uquiver
        && item.otyp !== AKLYS && artifactById(item.oartifact)?.name !== 'Mjollnir'
        && (isThrowingWeapon(item) || isLauncherAmmunition(item)))
        await setQuiverObject(item, game);
    item.pickup_prev = true;
    await finishInventoryAddition(item, game);
    carryObjEffects(item, game);
    return item;
}
// Part of C invent.c:addinv(): the created-object entry — the same
// admission, merge and tail as addInventoryItem().
export async function addCreatedInventoryItem(raw, presentation = null, observe = true) {
    assertCreatedObject(raw, game);
    const wasThrown = raw.how_lost === LOST_THROWN;
    let item = prepareInventoryItem(raw, presentation, observe);
    await prepareInventoryAddition(item, game);
    const existing = game.uquiver && mergable(game.uquiver, item, game) ? game.uquiver
        : game.inventory.find(other => mergable(other, item, game));
    const added = existing ? await mergeCreatedObjectStacks(existing, item, game)
        : linkInventoryItem(item);
    if (!added)
        throw new Error(`Initial inventory merge rejected object ${item.o_id} after admission`);
    item = added;
    return await finishAddedInventoryItem(item, wasThrown && !existing);
}
// Part of C invent.c:addinv_core1(): clear prize protection before addinv
// tests stack merging.
export function recordHeroPrizeAcquisition(object, state = game) {
    const prizes = state.context.achieveo;
    const kind = levelPrizeKind(object, state);
    if (!prizes || !kind)
        return;
    const achievement = kind === 'mines' ? ACH_MINE_PRIZE : ACH_SOKO_PRIZE;
    // the prize chronicle line is logged by recordAchievement()
    recordAchievement(state, achievement);
    if (kind === 'mines')
        prizes.mines_prize_oid = 0;
    else
        prizes.soko_prize_oid = 0;
    object.nomerge = false;
}
// Part of C invent.c:addinv_core1(): the uhave possession flags.
function updateCarriedFlags(object, carried, state) {
    const flag = carriedPossessionFlag(object, state);
    if (flag) {
        if (!state.u.uhave)
            throw new Error('Carried quest objects require initialized hero possessions');
        state.u.uhave[flag] = carried;
    }
}
// Part of C invent.c:addinv_core1(): the object to uhave-flag mapping.
function carriedPossessionFlag(object, state) {
    return CARRIED_FLAGS.get(object.otyp) ?? (isQuestArtifact(object, state) ? 'questart' : undefined);
}
// Part of C attrib.c:stone_luck(): whether this object contributes to the
// luckstone balance.
export function confersLuck(object, state = game) {
    return object.otyp === LUCKSTONE
        || !!artifactById(object.oartifact, state)?.flags.includes('SPFX_LUCK');
}
// Part of C invent.c:getobj(): the classifications that offer a choice.
function admitsChoice(classification) {
    return classification === GETOBJ_SUGGEST || classification === GETOBJ_DOWNPLAY;
}
// C invent.c:splittable()
// Some objects shouldn't be split when a count is given to getobj() or
// askchain(): a cursed loadstone and the welded weapon.
export function splittable(object) {
    return !(object.otyp === LOADSTONE && object.cursed) && !isWeldedPrimary(object);
}
// Part of C invent.c:getobj(): followed by its split_otmp tail (the two
// arms of !splittable(), each with its own side effect), for callers
// which take the object getobj() returns; hands are not a choice for
// these callbacks.
export async function chooseInventoryObject(word, classify, options = {}) {
    const selection = await getobj(word, classify, options);
    const object = selection.object;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed)
            object.corpsenm = selection.count;
        // C splittable() calls welded(), revealing the curse before refusing
        // the split. A cursed loadstone returns before that weapon check.
        else if (isWeldedPrimary(object))
            object.bknown = true;
        else
            return splitObjectStack(object, selection.count, game);
    }
    return object;
}
// Part of C invent.c:getobj(): the "Never mind." answer.
async function neverMind() {
    await pline('Never mind.');
}
// Part of C invent.c:reorder_invent(): '$' first, then a-z, then A-Z,
// then other.
export function inventoryLetterOrder(letter) {
    if (letter == null)
        return 53;
    if (letter === '$')
        return 0;
    if (letter >= 'a' && letter <= 'z')
        return letter.charCodeAt(0) - 96;
    if (letter >= 'A' && letter <= 'Z')
        return letter.charCodeAt(0) - 38;
    return 53;
}
// Part of C invent.c:getobj(): the prompt after its queued selection or
// user-input marker was consumed; later canned answers stay for the caller.
async function askInventoryPrompt(prompt) {
    await flushPendingTopline();
    const { answer } = await yn_function(prompt, null, '', false);
    return answer.charCodeAt(0);
}
// Part of C invent.c:dounpaid()/count_buc(): the unpaid recursion into
// containers.
function hasUnpaidContents(object) {
    return !!object.unpaid || (object.contents || []).some(hasUnpaidContents);
}
// Part of C invent.c:dotypeinv(): the traditional class+BUCX+uP+aim
// answer set, with count_buc()'s priest recognition.
function traditionalIdentifyChoices(candidates) {
    const classes = [...new Set(candidates.map(object => OBJECT_CLASS_SYMBOLS[object.oclass]))];
    const inventory = game.inventory;
    // Native count_buc() lets a priest recognize even objects which are
    // omitted by this identification's eligibility filter.
    if (game.urole?.key === 'priest') {
        for (const object of inventory)
            object.bknown = object.oclass !== COIN_CLASS;
    }
    const eligible = inventory.filter(objectNeedsFullIdentification);
    let choices = classes.join('') + ' ';
    if (inventory.some(hasUnpaidContents))
        choices += 'u';
    for (const category of 'BUCX') {
        if (eligible.some(object => bucCategory(object) === category))
            choices += category;
    }
    if (inventory.some(object => object.pickup_prev))
        choices += 'P';
    return choices + 'aim';
}
// Part of C invent.c:dotypeinv(): parse the category answer into classes,
// beatitudes, unpaid, picked, all and menu.
async function parseIdentificationCategories(answer) {
    const classes = [];
    const beatitudes = new Set();
    let unpaid = false, picked = false, all = false, menu = false;
    for (const symbol of answer) {
        if (symbol === ' ' || symbol === 'A')
            continue;
        if (symbol === 'a')
            all = true;
        else if (symbol === 'm')
            menu = true;
        else if (symbol === 'u')
            unpaid = true;
        else if (symbol === 'P')
            picked = true;
        else if (symbol === 'B' || symbol === 'U' || symbol === 'C' || symbol === 'X')
            beatitudes.add(symbol);
        else {
            const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
            if (objectClass <= RANDOM_CLASS)
                await plineWithContinuation(`You don't have any ${symbol}'s.`);
            else if (!classes.includes(objectClass))
                classes.push(objectClass);
        }
    }
    return { classes, beatitudes, unpaid, picked, all, menu };
}
// Part of C invent.c:dotypeinv(): whether one object matches the chosen
// categories.
function matchesIdentificationCategories(object, categories) {
    if (categories.unpaid && !hasUnpaidContents(object))
        return false;
    if (categories.beatitudes.size && !categories.beatitudes.has(bucCategory(object)))
        return false;
    return !categories.picked || !!object.pickup_prev;
}
// Part of C invent.c:menu_identify(): the "What would you like to identify
// first/next?" menu over inventory letters.
async function identificationMenu(candidates, first) {
    await flushPendingTopline();
    clearMessageWindow();
    const sections = (await inventorySections(candidates, false)).map(section => ({
        ...section,
        items: section.items.map(item => {
            if (item.key === undefined)
                throw new Error('Identification item has no inventory letter');
            const object = candidates.find(candidate => candidate.invlet === item.key);
            if (!object)
                throw new Error(`No inventory object for identification letter ${item.key}`);
            return { ...item, key: item.key, value: object };
        }),
    }));
    return await showMultiSelectWindow({
        title: `What would you like to identify ${first ? 'first' : 'next'}?`,
        sections, signalEscape: true,
    });
}
// Part of C invent.c:xprname(): the BUC adjective.
export function bucAdjectiveForName(item) {
    return objectBlessingDescription(item);
}
// Part of C invent.c:xprname(): the primary-hand detail materialized only
// at a menu/prinv boundary; hallucinated colors use display RNG.
export function inventoryPrimaryHandDetail(item) {
    return primaryHandDescriptionDetail(item);
}
// Part of C objnam.c:doname(): the display wrapper.
export async function inventoryItemDescription(item, options = {}) {
    return await objectDescription(item, options);
}
// Part of C invent.c:reroll_menu(): distant_name(doname) under
// override_ID.  Identify a temporary view rather than mutating the live
// object or discovery tables for a character which might be rejected.
async function rerollItemDescription(item) {
    return await inventoryItemDescription({
        ...item,
        known: true,
        bknown: true,
        dknown: true,
        rknown: true,
        overrideIdentified: true,
    });
}
// Part of C invent.c:reroll_menu(): the St/Dx/Co/In/Wi/Ch line.
function rerollAttributeLine() {
    const values = game.u?.acurr?.a || [];
    const displayed = ATTRIBUTE_DISPLAY_ORDER.map(attribute => values[attribute]);
    return `St:${formatStrength(displayed[0])} Dx:${displayed[1] ?? '?'} `
        + `Co:${displayed[2] ?? '?'} In:${displayed[3] ?? '?'} Wi:${displayed[4] ?? '?'} `
        + `Ch:${displayed[5] ?? '?'}`;
}
// Part of C invent.c:reroll_menu(): the plain [yn] fallback prompt.
async function rerollFallbackPrompt() {
    const message = 'Reroll this character? [yn] (n) ';
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    for (;;) {
        const key = await nhgetch();
        const answer = String.fromCharCode(key).toLowerCase();
        if (answer === 'y' || answer === 'n')
            return answer === 'y';
        if ([27, 32, 10, 13].includes(key))
            return false;
    }
}
// Part of C invent.c:display_pickinv(): sortloot() grouping into class
// sections under sortpack.
async function inventorySections(items = game.inventory || [], includeGold = true, letters = null) {
    return await inventorySectionsInOrder(sortObjects(items, { mode: inventorySortMode() }), includeGold, letters);
}
// Part of C invent.c:display_pickinv(): the grouped render in chain order,
// with letter filtering after naming.
async function inventorySectionsInOrder(items, includeGold = true, letters = null) {
    const grouped = new Map();
    for (const item of items) {
        if (!includeGold && item.oclass === COIN_CLASS)
            continue;
        // C display_pickinv() filters by letters when rendering, after
        // sortloot() has classified -- and observed -- every object in the
        // passed list, so items hidden by the filter are still named.
        if (letters !== null && !letters.includes(item.invlet ?? ''))
            continue;
        observeObjectForNaming(item);
        consumeHallucinatedMenuObjectGlyph(item);
        const heading = game.flags.sortpack === false ? null : objectClassHeading(item.oclass);
        let section = grouped.get(heading);
        if (!section) {
            section = [];
            grouped.set(heading, section);
        }
        section.push({
            ...(item.invlet == null ? {} : { key: item.invlet }),
            text: await inventoryItemDescription(item, {
                primaryHandDetail: inventoryPrimaryHandDetail(item),
            }),
        });
    }
    return [...grouped].map(([heading, items]) => ({ heading, items }));
}
// Part of C do_name.c:docall(): which object types accept a type call.
export function objectTypeCallable(object, state = game) {
    return !!state._objectCallNames?.[object.otyp]
        || ![AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(object.otyp)
            && [ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, GEM_CLASS, VENOM_CLASS].includes(object.oclass)
            && !!OBJ_DESCR(object.otyp, state);
}
// Part of C invent.c:fully_identify_obj(), end.c:really_done(): identify
// one carried object for final disclosure.
export function identifyObjectForDisclosure(item, identifyTinContents = false) {
    recordObjectEncounter(item.otyp);
    recordObjectKnowledge(item.otyp);
    item.known = true;
    item.bknown = true;
    item.dknown = true;
    item.rknown = true;
    if (isContainer(item) || item.otyp === STATUE)
        item.cknown = item.lknown = true;
    else if (identifyTinContents && item.otyp === TIN)
        item.cknown = true;
    const redundantNeutral = item.oclass === WEAPON_CLASS || item.oclass === WAND_CLASS
        || (item.oclass === TOOL_CLASS && objectUsesCharges(item));
    item.buc = item.blessed ? 'blessed' : item.cursed ? 'cursed'
        : !redundantNeutral
            && [ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, GEM_CLASS].includes(item.oclass)
            ? 'uncursed' : '';
    const canonicalName = OBJ_NAME(item.otyp);
    if (item.oclass === GEM_CLASS && canonicalName)
        item.name = canonicalName;
}
// Part of C invent.c:dotypeinv()/ddoinv(): dispatch the report keys to the
// pr* commands.
export async function inventoryReport(report) {
    game.context.move = 0;
    switch (report) {
        case 'type': return typeInventory();
        case 'gold': return doprgold();
        case 'weapon': return doprwep();
        case 'armor': return doprarm();
        case 'rings': return doprring();
        case 'amulet': return dopramulet();
        case 'tools': return doprtool();
        case 'inuse': return doprinuse();
    }
}
// Part of C invent.c:prinv(): the "invlet - doname()." line.
async function describeCarriedObject(object) {
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    observeObjectForNaming(object);
    await pline(`${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}
// Part of C invent.c:doprinuse(): the section headings (accessories,
// weapons, armor, miscellaneous).
function inUseHeading(object, accessoryLabel) {
    const mask = object.owornmask ?? 0;
    if (mask & W_ACCESSORY)
        return accessoryLabel;
    if (mask & W_WEAPONS)
        return 'Wielded/Readied Weapons';
    if (mask & W_ARMOR)
        return 'Worn Armor';
    return 'Miscellaneous';
}
// Part of C invent.c:dotypeinv(): the BUCX answer keys.
function bucChoice(choice) {
    switch (choice) {
        case 'B':
        case 'U':
        case 'C':
        case 'X': return choice;
        default: throw new Error(`Unknown inventory status ${choice}`);
    }
}
// Part of C invent.c:dotypeinv(): the category menu — classes, unpaid,
// BUCX and just-picked entries.
async function inventoryCategoryMenu(classes, unpaid, billed, statuses, picked, prompt) {
    if (!game.inventory.length)
        return null;
    if (classes.length === 1 && !unpaid && !billed && statuses.size <= 1)
        return classes[0] ?? null;
    const entries = classes.map((oclass, index) => ({ key: String.fromCharCode(97 + index),
        groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '', value: oclass, text: objectClassHeading(oclass) }));
    // pickup.c:query_category() names the single just-picked stack via
    // doname(); xname() observes the object while the hero can see.
    let justPickedText = 'Items you just picked up';
    if (picked.length === 1 && picked[0]) {
        observeObjectForNaming(picked[0]);
        justPickedText = `Just picked up: ${await inventoryItemDescription(picked[0])}`;
    }
    const extras = [
        ...(unpaid ? [{ key: 'u', text: 'Unpaid items' }] : []),
        ...(billed ? [{ key: 'x', text: 'Unpaid items already used up' }] : []),
        ...BUC_CHOICES.filter(status => statuses.has(status)).map(key => ({ key,
            text: key === 'X' ? 'Items of unknown Bless/Curse status' : `Items known to be ${key === 'B' ? 'Blessed' : key === 'C' ? 'Cursed' : 'Uncursed'}` })),
        ...(picked.length ? [{ key: 'P', text: justPickedText }] : []),
    ];
    const separator = { selectable: false, text: '' };
    const selected = await showMultiSelectWindow({ title: prompt, pickOne: true,
        omitHeadings: true, sections: [{ items: [...entries,
                    ...(extras.length ? [separator] : []),
                    ...extras.map(entry => ({ ...entry, value: entry.key })),
                ] }],
    });
    return selected[0] ?? null;
}
// Part of C invent.c:dotypeinv(): an unvalidated containing chain
// excludes the item.
function unknownContainer(object) {
    let container = object.container;
    while (container) {
        if (!container.cknown)
            return true;
        container = container.container;
    }
    return false;
}
// Part of C invent.c:dfeature_at(): the sentence for the hero's square.
export function dungeonFeatureSentenceAt(x, y) {
    return dungeonFeatureSentence(dungeonFeatureAt(x, y));
}
// Part of C invent.c:dfeature_at(): the "There is %s here." sentence.
export function dungeonFeatureSentence(feature) {
    if (!feature || feature === 'pool of water' && (game.underwater || game.u.uinwater))
        return '';
    const noArticle = feature === 'molten lava' || feature === 'ice'
        || feature.startsWith('frozen ') || feature.slice(feature.indexOf(' ')) === ' ice';
    return `There is ${noArticle ? feature : withIndefiniteArticle(feature)} here.`;
}
// Part of C invent.c:look_here(): read_engr_at() plus nomul(0) for a real
// run.
export async function readFloorEngraving(x, y) {
    const read = await readEngravingAt(x, y, plineWithContinuation);
    // engrave.c:read_engr_at() only calls nomul(0) for a real run
    // (context.run > 0); a counted walk keeps moving past the engraving.
    if (read && (game.context.run ?? 0) > 0)
        nomul(0);
}
// Port only: the pile_limit option read with its default.
function configuredPileLimit() {
    const configured = Number(game.flags?.pile_limit ?? 5);
    return Number.isFinite(configured) && configured >= 0 ? Math.trunc(configured) : 5;
}
// Part of C invent.c:look_here(): the object part — objectCount at or
// above pile_limit summarizes the pile.
export async function showFloorPile(objects, pickedSome = false, featureDescription = '', { objectCount = 0 } = {}) {
    const first = objects[0];
    if (!first)
        return { died: false };
    const pileLimit = configuredPileLimit();
    if (pileLimit > 0 && objectCount >= pileLimit) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        if (objectCount === 1 && objectQuantity(first) === 1) {
            await plineWithContinuation(`There is ${pickedSome ? 'another' : 'an'} object here.`);
        }
        else {
            const quantity = objectCount === 2 ? 'two'
                : objectCount < 5 ? 'a few'
                    : objectCount < 10 ? 'several' : 'many';
            await plineWithContinuation(`There are ${quantity}${pickedSome ? ' more' : ''} objects here.`);
        }
        const corpse = objects.find(object => willFeelPetrifyingCorpse(object));
        if (corpse) {
            const plural = objectQuantity(corpse) > 1;
            const prefix = objectCount > 1 ? 'Including' : plural ? "They're" : "It's";
            const warning = formCanBecomeStoneGolem(game.u.umonnum) ? '' : ', unfortunately';
            await plineWithContinuation(`${prefix} ${corpseName(corpse, { includeArticle: true })}${warning}.`);
            return await feelPetrifyingCorpse(corpse);
        }
        return { died: false };
    }
    if (objects.length === 1) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        observeObjectForNaming(first);
        await plineWithContinuation(`You ${heroIsBlind() ? 'feel' : 'see'} here ${await pricedFloorObjectDescription(first)}.`);
        game._lastPlineKind = PLNMSG_ONE_ITEM_HERE;
        return await feelPetrifyingCorpse(first);
    }
    // C invent.c:look_here(): "display_nhwindow(WIN_MESSAGE, FALSE);"
    // acknowledges prose here. Arrival's pickup.c:check_here() owns
    // "flush_screen(1);" before "(void) look_here(ct, lhflags);".
    // wintty.c:tty_display_nhwindow() erases the row only for a pending
    // (TOPLINE_NEED_MORE) line; a seen line just becomes TOPLINE_EMPTY and
    // stays visible, and tty_clear_nhwindow(WIN_MESSAGE) — the corner
    // window below and the next command's parse() both call it — then
    // no-ops, so the seen autodescribe text survives until a later pline.
    // Explicit inspection leaves pending map glyphs buffered.
    await displayMessageWindow();
    const display = requireGameDisplay();
    const pileLocation = heroIsBlind() ? 'you feel here' : 'are here';
    const descriptions = [];
    let touchedCorpse = null;
    for (const object of objects) {
        observeObjectForNaming(object);
        if (willFeelPetrifyingCorpse(object)) {
            descriptions.push(`${await floorObjectDescription(object)}...`);
            touchedCorpse = object;
            break;
        }
        descriptions.push(await pricedFloorObjectDescription(object));
    }
    if (game._pending_message) {
        await displayMessageWindow();
        // tty_display_nhwindow() clears WIN_MESSAGE before a corner window,
        // even when WIN_STOP prevented acknowledging its remaining text.
        clearMessageWindow();
    }
    const underlay = snapshotMenuUnderlay();
    const content = [
        ...(featureDescription ? [featureDescription, ''] : []),
        `${pickedSome ? 'Other things' : 'Things'} that ${pileLocation}:`,
        ...descriptions,
    ];
    // tty_display_nhwindow() clears the whole screen instead of using a
    // corner when menu_overlay is off or the window is too tall.
    const widest = Math.max(...content.map(line => line.length));
    if (windowOrigin(display.cols, display.rows, widest + 1, content.length, game.flags.menu_overlay !== false) === 0) {
        await showDisclosureOverlay(content);
    }
    else {
        const cornerLeft = await showFloorPileCorner(display, [...content, '--More--']);
        restoreMenuUnderlay(underlay);
        // docorner() erased the corner without repainting the message row,
        // so the top line stays clipped past the window's left edge until
        // a topline writer repaints it. Cells an earlier, wider window
        // erased stay erased.
        const clipColumn = Math.max(0, cornerLeft - 2);
        for (let col = clipColumn; col < display.cols; col++)
            display.setCell(col, 0, ' ', NO_COLOR, 0);
        display.toplineClipColumn = Math.min(display.toplineClipColumn ?? clipColumn, clipColumn);
    }
    const result = touchedCorpse ? await feelPetrifyingCorpse(touchedCorpse) : { died: false };
    if (!result.died)
        await readFloorEngraving(game.u.ux, game.u.uy);
    return result;
}
// Part of C invent.c:look_here(): the tty corner window (docorner
// placement) for a short pile window.
async function showFloorPileCorner(display, lines) {
    // Tty menus leave one blank column after the widest line and align the
    // window to the right.
    const left = Math.max(0, Math.min(41, display.cols - Math.max(...lines.map(line => line.length)) - 1));
    for (const [row, line] of lines.entries()) {
        for (let col = Math.max(0, left - 1); col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < line.length; col++)
            display.setCell(left + col, row, line.charAt(col), NO_COLOR, 0);
    }
    display.setCursor(left + 8, lines.length - 1);
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return left;
}
// Part of C objnam.c:doname(): the priced floor description.
export async function pricedFloorObjectDescription(object) {
    return await objectDescription(object, { withPrice: true });
}
// Part of C objnam.c:doname(): the plain floor description.
export async function floorObjectDescription(object) {
    return await objectDescription(object);
}
// Port only: the validated inventory letter.
export function inventoryCommandLetter(item) {
    if (item.invlet === null || item.invlet === undefined)
        throw new TypeError(`Carried object ${item.o_id} has no inventory letter`);
    return item.invlet;
}
// Part of C invent.c:sortloot_cmp(): the flags.inv_order class order.
export function inventoryClassOrder(state = game) {
    return [...(state.flags.inv_order || DEFAULT_PACK_ORDER)];
}
// Part of C invent.c:sortloot_cmp(): the inv_order symbols string.
export function inventoryOrderSymbols(state = game) {
    return inventoryClassOrder(state).map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
}
// Part of C invent.c:sortloot(): the sortloot and sortpack option bits.
export function inventorySortMode(state = game) {
    return ((state.flags.sortloot ?? 'l') === 'f' ? SORTLOOT_LOOT : SORTLOOT_INVLET)
        | (state.flags.sortpack !== false ? SORTLOOT_PACK : 0);
}
// Part of C invent.c:sortloot(): the sort bits for a loot-context caller.
export function lootSortMode({ inventoryLetters = false, state = game } = {}) {
    const sortloot = state.flags.sortloot ?? 'l';
    return (sortloot === 'f' || sortloot === 'l' && !inventoryLetters
        ? SORTLOOT_LOOT : inventoryLetters ? SORTLOOT_INVLET : 0)
        | (state.flags.sortpack !== false ? SORTLOOT_PACK : 0);
}
// C invent.c:sortloot()
// Returns a new order without rewriting the inventory or container chain.
// Observation is the native sort boundary; name normalization uses a view.
export function sortObjects(objects, { mode = 0, state = game, filter = null, } = {}) {
    const keepPetrifying = !!(mode & SORTLOOT_PETRIFY);
    mode &= ~SORTLOOT_PETRIFY;
    const entries = objects.filter(object => !filter || filter(object)
        || keepPetrifying && object.otyp === CORPSE && touchPetrifies(object.corpsenm))
        .map((object, index) => ({ object, index }));
    if (!mode || entries.length < 2)
        return entries.map(entry => entry.object);
    return recorderSort(entries, (left, right) => compareLoot(left, right, mode, state))
        .map(entry => entry.object);
}
// Part of C invent.c:loot_classify(): the per-class subclass ranking.
function lootSubclass(object, oclass, seen, discovered) {
    const skill = objectSkill(object.otyp);
    if (oclass === ARMOR_CLASS)
        return [7, 4, 1, 2, 3, 5, 6][skill] ?? 8;
    if (oclass === WEAPON_CLASS)
        return skill < 0
            ? skill >= -P_CROSSBOW && skill <= -P_BOW ? 1 : 3
            : skill >= P_BOW && skill <= P_CROSSBOW ? 2
                : [P_SPEAR, P_DAGGER, P_KNIFE].includes(skill) ? 4
                    : isPolearm(object) ? 6 : 5;
    if (oclass === TOOL_CLASS) {
        if (seen && discovered && [BAG_OF_TRICKS, HORN_OF_PLENTY].includes(object.otyp))
            return 2;
        if (isContainer(object) || object.otyp === BAG_OF_TRICKS)
            return 1;
        return INSTRUMENTS.has(object.otyp) ? 3 : 4;
    }
    if (oclass === FOOD_CLASS) {
        if (object.otyp === SLIME_MOLD)
            return 1;
        if (object.otyp === TIN)
            return 3;
        if (object.otyp === EGG)
            return 4;
        if (object.otyp === CORPSE)
            return 5;
        return object.globby ? 6 : 2;
    }
    if (oclass === GEM_CLASS) {
        const material = objectMaterial(object.otyp);
        if (material === 20 || material === 19)
            return !seen ? 1 : !discovered ? 2 : material === 20 ? 3 : 4;
        return !seen ? 5 : object.otyp === ROCK ? 8 : !discovered ? 6 : 7;
    }
    return 1;
}
// Part of C invent.c:sortloot(): the observation and classification
// boundary per entry.
function classifyEntry(entry, state) {
    if (!entry.classification) {
        if (!heroIsBlind(state))
            observeObject(entry.object, state);
        entry.classification = classifyLoot(entry.object, state);
    }
    return entry.classification;
}
// Part of C invent.c:sortloot_cmp(): the case-normalized loot name.
function normalizedLootName(object, state) {
    const name = lootObjectName(object, state);
    if (typeof name !== 'string')
        throw new Error(`Loot object ${object.o_id} has no sortable name`);
    return name.replace(/[A-Z]/g, letter => letter.toLowerCase());
}
// Part of C invent.c:sortloot_cmp(): the BUC rank.
function beatitudeRating(object) {
    return object.bknown ? object.blessed ? 3 : object.cursed ? 1 : 2 : 0;
}
// Part of C invent.c:sortloot_cmp(): greatest_erosion(), with the obj.h
// aliases from the existing prose below.
function lootErosion(object) {
    return Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0, Number(!!object.orotten), Number(!!object.odiluted), Number(!!object.norevive));
}
// ---------------------------------------------------------------------------
// Ordinary stack compatibility and merging. C refs: invent.c:mergable(),
// merged(), same_price().
// ---------------------------------------------------------------------------
// Part of C invent.c:mergable(): the object's given-name compare.
function objectMergeName(object) {
    return object?.oextra?.oname ?? object?.oname ?? '';
}
// Part of C invent.c:mergable(): the omid/omonst attachment test.
function hasAttachment(object) {
    return !!(object?.oextra?.omid || object?.oextra?.omonst);
}
// Part of C invent.c:same_price(): the next_shkp(TRUE) bill search, with
// its riling side effects, preferring the first keeper's bill for the
// second object.
function billedStackOwner(object, state) {
    for (const keeper of visitBilledShopkeepers(state)) {
        const billed = billForObject(object, state, keeper);
        if (billed)
            return billed;
    }
    return null;
}
// C invent.c:same_price().
function sameBillPrice(first, second, state) {
    const firstBill = billedStackOwner(first, state);
    const secondBill = (firstBill
        && billForObject(second, state, firstBill.resident))
        || billedStackOwner(second, state);
    return !!firstBill && !!secondBill
        && firstBill.resident === secondBill.resident
        && firstBill.entry.price === secondBill.entry.price;
}
// Part of C invent.c:merged(): whether the comparison discovers
// known/bknown/rknown.
function comparisonDiscovers(survivor, incoming, state) {
    return !!survivor.known !== !!incoming.known
        || (!!survivor.rknown !== !!incoming.rknown && !!survivor.oerodeproof)
        || ((survivor.oclass === COIN_CLASS ? false : !!survivor.bknown)
            !== !!incoming.bknown && state.urole?.key !== 'priest');
}
// Part of C invent.c:merged(): the discovery-message conditions
// (carried, and neither half thrown).
function comparisonNeedsMessage(survivor, incoming, state) {
    return survivor.where === 'inventory'
        && incoming.how_lost !== LOST_THROWN && survivor.how_lost !== LOST_THROWN
        && comparisonDiscovers(survivor, incoming, state);
}
// Part of C invent.c:merged(): the prelude, completed before either kind
// of display can yield.
async function prepareStackMerge(survivor, incoming, state) {
    const discovered = comparisonDiscovers(survivor, incoming, state);
    if (!survivor.globby) {
        const firstQuantity = survivor.quan ?? survivor.quantity ?? 1;
        const secondQuantity = incoming.quan ?? incoming.quantity ?? 1;
        const quantity = firstQuantity + secondQuantity;
        if (!incoming.lamplit) {
            survivor.age = Math.trunc((survivor.age * firstQuantity + incoming.age * secondQuantity)
                / quantity);
        }
        survivor.quan = survivor.quantity = quantity;
        survivor.owt = objectWeight(survivor);
        if (survivor.oclass === COIN_CLASS)
            survivor.bknown = false;
    }
    const incomingName = objectMergeName(incoming);
    if (!objectMergeName(survivor) && incomingName) {
        if (incoming.oextra?.oname) {
            survivor.oextra = { ...(survivor.oextra || {}), oname: incoming.oextra.oname };
        }
        else
            survivor.oname = incomingName;
    }
    unlinkObject(incoming, state);
    if (incoming.pickup_prev && survivor.where === 'inventory')
        survivor.pickup_prev = true;
    if (incoming.lamplit) {
        endObjectBurn(incoming, state, state.moves);
        if (objectShedsLight(survivor))
            state.vision_full_recalc = 1;
    }
    if (incoming.timed)
        stopObjectTimers(incoming, state);
    if (!!survivor.known !== !!incoming.known)
        survivor.known = true;
    if (!!survivor.rknown !== !!incoming.rknown)
        survivor.rknown = true;
    if (!!survivor.bknown !== !!incoming.bknown)
        survivor.bknown = true;
    if (incoming.owornmask && survivor.where === 'inventory') {
        const combined = (survivor.owornmask ?? 0) | incoming.owornmask;
        const wmask = combined & W_WEP ? W_WEP
            : combined & W_SWAPWEP ? W_SWAPWEP
                : combined & W_QUIVER ? W_QUIVER : 0;
        if (!wmask)
            throw new Error('merging objects in non-weapon slots');
        if (((survivor.owornmask ?? 0) & ~wmask) !== 0)
            await setnotworn(survivor, state);
        await setworn(survivor, wmask, state);
        await setnotworn(incoming, state);
    }
    if (incoming.bypass)
        survivor.bypass = true;
    return discovered;
}
// Part of C invent.c:merged(): the creation-time merge with no display
// continuation.
export async function mergeCreatedObjectStacks(survivor, incoming, state = game) {
    assertCreatedObject(incoming, state);
    if (survivor.unpaid || billForObject(survivor, state) || incoming.owornmask)
        throw new Error('creation merge requires unbilled objects and an unworn incoming object');
    if (!mergable(survivor, incoming, state))
        return null;
    if (incoming.globby || comparisonNeedsMessage(survivor, incoming, state))
        throw new Error('stack merge with display effects must be awaited');
    await prepareStackMerge(survivor, incoming, state);
    await deleteObject(incoming, state, { mergeInto: survivor });
    return survivor;
}
//# sourceMappingURL=invent.js.map