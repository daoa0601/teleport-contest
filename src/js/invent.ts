import {
    RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
    TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS,
    CHAIN_CLASS, VENOM_CLASS,
} from './objclass.js';
import { objectClassForType, objectSkill, objectMerge, objectUsesKnown, objectUnique, ALCHEMY_SMOCK, ARROW as FIRST_OBJECT, BAG_OF_TRICKS, EGG, CHEST, FORTUNE_COOKIE, GOLD_PIECE, HAWAIIAN_SHIRT, LARGE_BOX, MAGIC_MARKER, HEAVY_IRON_BALL, LOCK_PICK, CREDIT_CARD, SKELETON_KEY, OBJECT_NAMES, SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, STATUE, TIN, TIN_OPENER, TOWEL, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, BEARTRAP, BELL, BELL_OF_OPENING, BLINDFOLD, BRASS_LANTERN, BULLWHIP, CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CORPSE, CREAM_PIE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, DWARVISH_MATTOCK, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA, FIGURINE, GRAPPLING_HOOK, HORN_OF_PLENTY, LAND_MINE, LEASH, LENSES, MAGIC_LAMP, MAGIC_WHISTLE, MEAT_RING, MIRROR, OBJECT_DESCRIPTIONS, OIL_LAMP, PICK_AXE, POT_OIL, SADDLE, STETHOSCOPE, TALLOW_CANDLE, TINNING_KIT, TIN_WHISTLE, UNICORN_HORN, WAX_CANDLE, WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN, FROST_HORN, FIRE_HORN, WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM, ROCK, SLIME_MOLD, ARROW, LOADSTONE, LUCKSTONE, AXE, SPEAR, BOW, DART, KATANA, MACE, SCALPEL, CLUB, QUARTERSTAFF, SLING, SHORT_SWORD, LONG_SWORD, TWO_HANDED_SWORD, LANCE, YUMI, YA, BATTLE_AXE, SPLINT_MAIL, HELMET, RING_MAIL, LEATHER_ARMOR, LEATHER_JACKET, FEDORA, ROBE, SMALL_SHIELD, LEATHER_GLOVES, POT_HEALING, POT_SICKNESS, SACK, FLINT, CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE, APPLE, ORANGE, PEAR, MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, CANDY_BAR, PANCAKE, LEMBAS_WAFER, CRAM_RATION, FOOD_RATION, POT_EXTRA_HEALING, POT_WATER, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SPE_HEALING, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER, SPE_PROTECTION, SPE_DETECT_MONSTERS, SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, TOUCHSTONE, WAN_WISHING, WAN_SLEEP, OBJECT_SPELL_LEVEL, OBJECT_SPELL_CATEGORY, AKLYS, DAGGER, ELVEN_DAGGER, ORCISH_DAGGER, ELVEN_SHORT_SWORD, ORCISH_SHORT_SWORD, DWARVISH_SHORT_SWORD } from './object_data.js';
import { bypassObjectList, clearBypasses, nextUnbypassedObject } from './worn.js';
import { game, requireGameDisplay, requireGameLevel, requireLiveGame } from './gstate.js';
import { hideUnhideMessageTypes } from './message_types.js';
import { encyclopediaEntries } from './encyclopedia.js';
import { objectBlessingDescription, objectDescription, primaryHandDescriptionDetail, makePlural, withIndefiniteArticle, corpseName, ownedObjectName, distantObjectName, wishedObjectPresentation, armorUsesPairGrammar, definiteName, objectCombatName, objectLooksUnique, objectName, objectNameIsPlural, observeObjectForNaming, simpleObjectName, singularObjectName } from './objnam.js';
import {
    rejoinObjectStack, splitObjectStack, objectQuantity, curseObjectState, unlinkObject, absorbGlob,
    objectWeight, isContainer, announceGlobMerge,
} from './mkobj.js';
import { ATTRIBUTE_DISPLAY_ORDER } from './attrib.js';
import { consumeHallucinatedMenuObjectGlyph, flush_screen, newsym, OBJECT_CLASS_SYMBOLS } from './display.js';
import { formatStrength } from './botl.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline, putMessageHistory, showMessageMenu, renderKeyPrompt } from './tty_topline.js';
import { pline, plineWithContinuation } from './pline.js';
import { showChoiceWindow, showDisclosureOverlay, showInventoryWindow, showMultiSelectWindow, showTextMenuOverlay, snapshotMenuUnderlay, restoreMenuUnderlay } from './windows.js';
import type { InventoryMenuItem, InventorySection, InventorySelection, MenuLabel, MultiSelectSection, PageLocalMultiSelectSection } from './windows.js';
import { windowOrigin } from './tty_menu.js';
import { nhgetch } from './input.js';
import { readchar, commandResultCancelled, commandResultFailed, cmdq_add_int, cmdq_add_key, cmdq_clear, cmdq_pop, getCount, GC_SAVEHIST, GC_ECHOFIRST, GC_CONDHIST, ynSingleKey, yn_function } from './cmd.js';
import { ingSuffix, possessiveName } from './hacklib.js';
import { NATIVE_COMMAND_CONSTANTS } from './command_data.js';
import {
    CMDQ_INT, CMDQ_KEY, CMDQ_USER_INPUT, CQ_CANNED, CQ_REPEAT, ALTAR, GETOBJ_EXCLUDE, GETOBJ_SUGGEST,
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, ICE,
    Is_airlevel, Is_waterlevel, MENU_TRADITIONAL, MENU_FULL, MENU_PARTIAL, MSGTYP_MASK_REP_SHOW, PICK_NONE,
    PICK_ONE, W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_TOOL, W_SADDLE, OBJECT_TIMER_KIND, ACH_AMUL, ACH_BELL,
    ACH_BOOK, ACH_CNDL, ACH_MINE_PRIZE, ACH_SOKO_PRIZE, AM_SANCTUM, Amask2align, A_NONE, DBWALL, DOOR,
    DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_ISOPEN, D_NODOOR, FOUNTAIN, GRAVE, IRONBARS, SINK, THRONE,
    TREE, PLNMSG_ONE_ITEM_HERE, LOST_NONE, LOST_THROWN, is_pit, SORTLOOT_PACK, SORTLOOT_INVLET, SORTLOOT_LOOT,
    SORTLOOT_INUSE, SORTLOOT_PETRIFY, P_BOW, P_CROSSBOW, P_SPEAR, P_DAGGER, P_KNIFE, W_WEAPONS, W_ARM, W_ARMC,
    W_ARMH, W_ARMS, W_ARMG, W_ARMF, W_ARMU, W_WEP, W_SWAPWEP, W_QUIVER, W_RINGL, W_RINGR,
} from './const.js';
import type { GameFlags } from './flags.js';
import { MONSTER_NAME } from './monster_data.js';
import type { SpellCategory } from './data_types.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { levelPrizeKind } from './level_prize.js';
import { recordLiteracy } from './literacy.js';
import { learnObjectType, recordObjectEncounter, recordObjectKnowledge, observeObject, objectMaterial } from './o_init.js';
import { recorderSort } from './recorder_sort.js';
import { getLine, promptYesNoAllQuit } from './query.js';
import { isBimanualObject, isGrayStone, isWeaponTool, objectUsesCharges, launcherMatchesAmmo, isBlade, isPolearm, isThrowingWeapon, isLauncherAmmunition } from './object_properties.js';
import { isTwoWeaponObject, mergeHeroWeaponSlots, isWeldedPrimary, setQuiverObject, heroCanUseTwoWeapons } from './wield.js';
import { heroHasNoHands, heroIsVerySmall, heroSpecies } from './polyself.js';
import { heroFingerName, heroHandName } from './body_parts.js';
import { discoverArtifact, artifactById, deactivateArtifactProperty, setCarriedArtifactProperties } from './artifacts.js';
import { isQuestArtifact, touchQuestArtifact } from './quest.js';
import { recordAchievement } from './insight.js';
import { isEdibleFood } from './food_selection.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { heroCanReachFloor, readEngravingAt } from './engrave.js';
import { surfaceName } from './terrain_name.js';
import { stairwayDescription } from './mklev.js';
import { deityName } from './alignment.js';
import { isIceAt, isLavaAt, isPoolAt, findDrawbridgeAt, drawbridgeUnderlyingType } from './dbridge.js';
import { forceDescribeDecor } from './pickup.js';
import { visibleRegionAt } from './regions.js';
import { trapName, objectIsVulnerableToErosion, erosionMatters } from './trap.js';
import { touchPetrifies, feelPetrifyingCorpse, willFeelPetrifyingCorpse, formCanBecomeStoneGolem } from './stoning.js';
import { iceDescriptionAt } from './pager.js';
import { lookInsideSwallower } from './swallowed_inventory.js';
import { impossible, panic } from './diagnostics.js';
import { armorSimpleName, armorSlotFor } from './do_wear.js';
import {
    objectTypeKnown, currentShopResident, shopkeeperInOwnShop, costlySpot, chargeUnpaidUsage, deleteObject,
    billForObject, visitBilledShopkeepers, unpaidObjectCost, reportShopFinances, pickedContainer,
} from './shk.js';
import { endObjectBurn, learnEggType, stopObjectTimer, stopObjectTimers } from './timeout.js';
import { objectShedsLight } from './light.js';
import { assertCreatedObject } from './do.js';
import { isReviver } from './corpse_species.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { takeQueuedInventoryChoice } from './inventory_queued_choice.js';
import { heroGoldObject } from './hero_gold.js';
import { hiddenGold } from './vault.js';
import { nomul, heroGoldAmount } from './hack.js';
import { displayLiquidName } from './do_name.js';
import { usedUpBill, showBill } from './inventory_reports.js';
import { NO_COLOR } from './terminal.js';
import type { GameObject } from './object_types.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { HeroPossessions } from './hero_types.js';
import type { GameDisplay } from './game_display.js';
import { maybeUnhideAt } from './mon.js';
import { rn2 } from './rng.js';
import { objectResistsDestruction, showProbedObjectInventory } from './zap.js';
import { monsterIsHumanoid } from './mondata.js';

// invent.js — the invent.c owner: inventory admission (addinv/freeinv/
// assigninvlet/reorder), getobj selection, the 'I' reports and unpaid
// views, look_here()/dolook(), doorganize/#adjust, and stack merging.
// C ref: invent.c — addinv(), getobj(), ddoinv(), display_inventory(),
// look_here(), doorganize(), dolook().

export interface InventoryObjectMenuOptions {
    // display_pickinv's lets: '-' is a filter letter even without an object.
    // Omitting the filter or passing an empty string requests full inventory.
    letters?: string;
    includeGold?: boolean;
    title?: string | null;
    extraChoice?: string | null;
    pickMode?: typeof PICK_NONE | typeof PICK_ONE;
    headingAttr?: number;
    menuOptions?: readonly { key: string; text: string }[];
}

export interface InventoryDescriptionOptions {
    primaryHandDetail?: string | null;
    projectPrimaryHand?: boolean;
    withPrice?: boolean;
}

export type InventoryActionKey = '-' | 'a' | 'c' | 'C' | 'd' | 'e' | 'E' | 'f' | 'i' | 'I' | 'O' | 'p' | 'P' | 'q' | 'Q' | 'r' | 'R' | 't' | 'T' | 'V' | 'w' | 'W' | 'x' | 'X' | 'z' | '/'
    | '\x1b' | ' ' | '\n' | '\r';
export interface InventoryAction { key: InventoryActionKey; item: GameObject }
type IdentificationBeatitude = 'B' | 'U' | 'C' | 'X';
interface IdentificationCategories {
    classes: number[];
    beatitudes: Set<IdentificationBeatitude>;
    unpaid: boolean;
    picked: boolean;
    all: boolean;
    menu: boolean;
}
interface IdentificationResult { identified: GameObject[]; remaining: number }

const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
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

interface ItemPresentation {
    class: string;
    name: string;
    plural: string;
    enchanted?: boolean;
    omitUncursed?: boolean;
    showBuc?: boolean | undefined;
    empty?: boolean;
    spellName?: string | null | undefined;
    spellLevel?: number | undefined;
    spellCategory?: SpellCategory | null | undefined;
    appearance?: string;
}

const PM_LICHEN = 158;

const DAGGER_TYPES = new Set([DAGGER, ELVEN_DAGGER, ORCISH_DAGGER]);
const SHORT_SWORD_TYPES = new Set([
    SHORT_SWORD, ELVEN_SHORT_SWORD, ORCISH_SHORT_SWORD,
    DWARVISH_SHORT_SWORD,
]);
const ITEM_PRESENTATION = new Map<number, ItemPresentation>([
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
const CLASS_PRESENTATION: Readonly<Partial<Record<number, string>>> = {
    [WEAPON_CLASS]: 'Weapons', [ARMOR_CLASS]: 'Armor',
    [RING_CLASS]: 'Rings', [AMULET_CLASS]: 'Amulets',
    [TOOL_CLASS]: 'Tools', [FOOD_CLASS]: 'Comestibles',
    [POTION_CLASS]: 'Potions', [SCROLL_CLASS]: 'Scrolls',
    [SPBOOK_CLASS]: 'Spellbooks', [WAND_CLASS]: 'Wands',
    [COIN_CLASS]: 'Coins', [GEM_CLASS]: 'Gems/Stones',
    [ROCK_CLASS]: 'Boulders',
};

function qualifiedObjectName(raw: Pick<GameObject, 'otyp' | 'oclass' | 'corpsenm'>): string {
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

function sourceKnownPresentation(raw: GameObject): ItemPresentation {
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

type InventoryPresentation = ItemPresentation & {
    quantity: number;
    enchantment: number | undefined;
    buc: GameObject['buc'];
};

// Display-only callers receive a projection without changing the carried object.
export function inventoryItem(raw: GameObject, presentation: ItemPresentation | null = null): GameObject {
    return { ...raw, ...inventoryPresentation(raw, presentation) };
}

// Acquisition and polymorph retain the same object already held by timers and
// ownership links. Only presentation fields are updated here.
export function updateInventoryPresentation(raw: GameObject, presentation: ItemPresentation | null = null): GameObject {
    const view = inventoryPresentation(raw, presentation);
    raw.class = view.class;
    raw.name = view.name;
    raw.plural = view.plural;
    if ('enchanted' in view) raw.enchanted = view.enchanted;
    if ('omitUncursed' in view) raw.omitUncursed = view.omitUncursed;
    if ('showBuc' in view) raw.showBuc = view.showBuc;
    if ('empty' in view) raw.empty = view.empty;
    if ('spellName' in view) raw.spellName = view.spellName;
    if ('spellLevel' in view) raw.spellLevel = view.spellLevel;
    if ('spellCategory' in view) raw.spellCategory = view.spellCategory;
    if ('appearance' in view) raw.appearance = view.appearance;
    raw.quantity = view.quantity;
    raw.enchantment = view.enchantment;
    raw.buc = view.buc;
    return raw;
}

function inventoryPresentation(raw: GameObject, presentation: ItemPresentation | null): InventoryPresentation {
    let view: ItemPresentation = presentation || ITEM_PRESENTATION.get(raw.otyp)
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

export function assignInventoryLetter(item: GameObject): GameObject {
    if (item.oclass === COIN_CLASS) {
        item.invlet = '$';
        return item;
    }
    // invent.c:assigninvlet() uses a persistent rotating cursor rather than
    // inventory length.  Consuming p and r must not make a later wished item
    // reuse q; after the last assignment was r, the next free slot is s.
    if (!Number.isInteger(game._lastInvNr)) {
        const previous = Array.from(game.inventory).reverse().find(object =>
            /^[a-zA-Z]$/.test(object.invlet || ''));
        if (!previous?.invlet) game._lastInvNr = 51;
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
    if (index === undefined) throw new Error('Inventory letter cursor is not initialized');
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
    if (!item.invlet) item.invlet = '#';
    return item;
}

function prepareInventoryItem(raw: GameObject, presentation: ItemPresentation | null, observe: boolean): GameObject {
    raw.how_lost = LOST_NONE;
    raw.no_charge = false;
    if (raw.contents?.length) pickedContainer(raw);
    raw.ox = raw.oy = 0;
    const item = updateInventoryPresentation(raw, presentation);
    if (observe) item.dknown = true;
    recordHeroPrizeAcquisition(item, game);
    return item;
}

function linkInventoryItem(item: GameObject): GameObject {
    assignInventoryLetter(item);
    item.where = 'inventory';
    game.inventory.push(item);
    // C invent.c:addinv_core0()/reorder_invent(): fixed letters order the
    // carried chain, including gold before letters and lowercase before uppercase.
    if (game.flags.fixinv !== false) {
        game.inventory.sort((left, right) =>
            inventoryLetterRank(left) - inventoryLetterRank(right));
    }
    return item;
}

// C invent.c:reorder_invent() toggles the ASCII case bit to put a-z before A-Z.
export function inventoryLetterRank(item: GameObject): number {
    return (item.invlet?.charCodeAt(0) ?? 0) ^ 0x20;
}

async function finishAddedInventoryItem(item: GameObject, recoveredThrownStack = false): Promise<GameObject> {
    if (recoveredThrownStack && game.flags.pickup_thrown !== false && !game.uquiver
        && item.otyp !== AKLYS && artifactById(item.oartifact)?.name !== 'Mjollnir'
        && (isThrowingWeapon(item) || isLauncherAmmunition(item)))
        await setQuiverObject(item, game);
    item.pickup_prev = true;
    await finishInventoryAddition(item, game);
    attachCursedFigurineTimer(item, game);
    return item;
}

export async function addInventoryItem(raw: GameObject, presentation: ItemPresentation | null = null, observe = true): Promise<GameObject> {
    return await addInventoryItemCore(raw, presentation, observe, null);
}

export async function addInventoryItemBefore(raw: GameObject, next: GameObject | null): Promise<GameObject> {
    return await addInventoryItemCore(raw, null, true, next);
}

// C invent.c:addinv_core0(): merge with a carried stack, or take a letter
// and slot into the fixed-letter order; reinsertion keeps its predecessor.
async function addInventoryItemCore(
    raw: GameObject, presentation: ItemPresentation | null, observe: boolean,
    next: GameObject | null,
): Promise<GameObject> {
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
    if (!added) throw new Error(`Inventory merge rejected object ${item.o_id} after admission`);
    item = added;
    return await finishAddedInventoryItem(item, wasThrown && !existing);
}

export async function addCreatedInventoryItem(raw: GameObject, presentation: ItemPresentation | null = null, observe = true): Promise<GameObject> {
    assertCreatedObject(raw, game);
    const wasThrown = raw.how_lost === LOST_THROWN;
    let item = prepareInventoryItem(raw, presentation, observe);
    await prepareInventoryAddition(item, game);
    const existing = game.uquiver && mergable(game.uquiver, item, game) ? game.uquiver
        : game.inventory.find(other => mergable(other, item, game));
    const added = existing ? await mergeCreatedObjectStacks(existing, item, game)
        : linkInventoryItem(item);
    if (!added) throw new Error(`Initial inventory merge rejected object ${item.o_id} after admission`);
    item = added;
    return await finishAddedInventoryItem(item, wasThrown && !existing);
}

// C invent.c:freeinv_core()/addinv_core1()/addinv_core2()/learn_unseen_invent()
// and attrib.c:set_moreluck().
const CARRIED_FLAGS = new Map<number, keyof HeroPossessions>([
    [AMULET_OF_YENDOR, 'amulet'], [BELL_OF_OPENING, 'bell'],
    [CANDELABRUM_OF_INVOCATION, 'menorah'], [SPE_BOOK_OF_THE_DEAD, 'book'],
]);

const DUPLICATE_POSSESSION_MESSAGES: Record<keyof HeroPossessions, string> = {
    amulet: 'already have amulet?',
    bell: 'already have silver bell?',
    book: 'already have the book?',
    menorah: 'already have candelabrum?',
    questart: 'already have quest artifact?',
};

// C freeinv(): extraction precedes carried effects; equipment stays installed.
export async function freeInventoryObject(object: GameObject, state: GameState = game) {
    requireLiveGame(state);
    const index = state.inventory.indexOf(object);
    if (index < 0) await panic('extract_nobj: object lost', { state });
    state.inventory.splice(index, 1);
    object.where = 'free';
    await finishInventoryRemoval(object, state);
}

// C invent.c useupall(): setnotworn, freeinv, then obfree.
export async function useUpInventoryStack(object: GameObject, state: GameState = game) {
    requireLiveGame(state);
    const gameWasOver = state.program_state.gameover;
    await removeHeroEquipment(object, state);
    if (!gameWasOver && state.program_state.gameover) return;
    await freeInventoryObject(object, state);
    if (!gameWasOver && state.program_state.gameover) return;
    await deleteObject(object, state);
}

// C addinv_core1(): clear prize protection before addinv tests stack merging.
export function recordHeroPrizeAcquisition(object: GameObject, state: GameState = game): void {
    const prizes = state.context.achieveo;
    const kind = levelPrizeKind(object, state);
    if (!prizes || !kind) return;
    const achievement = kind === 'mines' ? ACH_MINE_PRIZE : ACH_SOKO_PRIZE;
    // the prize chronicle line is logged by recordAchievement()
    recordAchievement(state, achievement);
    if (kind === 'mines') prizes.mines_prize_oid = 0;
    else prizes.soko_prize_oid = 0;
    object.nomerge = false;
}

// C addinv_core1(): these effects precede merging and inventory insertion.
export async function prepareInventoryAddition(object: GameObject, state: GameState = game) {
    if (object.oclass === COIN_CLASS) state.context.botl = true;
    const flag = carriedPossessionFlag(object, state);
    if (flag && state.u.uhave?.[flag])
        await impossible(DUPLICATE_POSSESSION_MESSAGES[flag], { state });
    updateCarriedFlags(object, true, state);
    const achievement = object.otyp === AMULET_OF_YENDOR ? ACH_AMUL
        : object.otyp === BELL_OF_OPENING ? ACH_BELL
            : object.otyp === CANDELABRUM_OF_INVOCATION ? ACH_CNDL
                : object.otyp === SPE_BOOK_OF_THE_DEAD ? ACH_BOOK : null;
    if (achievement !== null) recordAchievement(state, achievement);
    if (isQuestArtifact(object, state)) await touchQuestArtifact(object, state);
    await setCarriedArtifactProperties(object, true, state);
}

// C addinv_core2(): the surviving object is now in the inventory chain.
export async function finishInventoryAddition(object: GameObject, state: GameState = game) {
    await reactToSeenInventoryObject(object, state);
}

// C addinv_core2(): the object is already linked, including after a merge.
// Sight recovery reuses these effects without adding the object again.
export async function reactToSeenInventoryObject(object: GameObject, state: GameState = game) {
    updateCarriedLuck(object, state);
    if (state.urole?.key !== 'archeologist' || object.oclass !== SCROLL_CLASS
        || object.otyp === SCR_BLANK_PAPER || heroIsBlind(state)
        || objectTypeKnown(object, state)) return;

    observeObjectForNaming(object, { state });
    await plineWithContinuation(`You decipher the label on ${
        ownedObjectName(object, state, { capitalized: false })}.`);
    learnObjectType(object.otyp, state);
    recordLiteracy('became literate by deciphering a scroll label', { state });
}

// C invent.c:learn_unseen_invent(). Regaining sight marks unseen inventory.
export async function learnUnseenInventory(state: GameState = game) {
    if (heroIsBlind(state)) return;
    const priest = state.urole?.key === 'priest';
    const archeologist = state.urole?.key === 'archeologist';
    for (const object of state.inventory) {
        if (object.dknown && (object.bknown || !priest)
            && (object.oclass !== SCROLL_CLASS || !archeologist)) continue;
        observeObjectForNaming(object, { state });
        await reactToSeenInventoryObject(object, state);
    }
    // The pinned TTY build's update_inventory() has no persistent window.
}

export async function finishInventoryRemoval(object: GameObject, state: GameState = game) {
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
        if (!gameWasOver && state.program_state.gameover) return;
    }
    if (object.otyp === LOADSTONE) {
        curseObjectState(object);
    } else if (confersLuck(object, state)) {
        updateCarriedLuck(object, state);
    } else if (object.otyp === FIGURINE && object.timed) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    }
}

function updateCarriedFlags(object: GameObject, carried: boolean, state: GameState): void {
    const flag = carriedPossessionFlag(object, state);
    if (flag) {
        if (!state.u.uhave) throw new Error('Carried quest objects require initialized hero possessions');
        state.u.uhave[flag] = carried;
    }
}

function carriedPossessionFlag(object: GameObject, state: GameState): keyof HeroPossessions | undefined {
    return CARRIED_FLAGS.get(object.otyp) ?? (isQuestArtifact(object, state) ? 'questart' : undefined);
}

// C attrib.c:set_moreluck()
// Also C attrib.c:stone_luck(): inventory quantity sum is inlined here
export function updateCarriedLuck(object: GameObject, state: GameState = game): void {
    if (confersLuck(object, state)) {
        const lucky = state.inventory.filter(item => confersLuck(item, state));
        const luck = lucky.reduce((sum, item) =>
            sum + (item.cursed ? -1 : 1) * item.quan, 0);
        state.u.moreluck = !luck && !lucky.some(item => item.otyp === LUCKSTONE)
            ? 0 : luck < 0 ? -3 : 3;
    }
}

export function confersLuck(object: GameObject, state: GameState = game) {
    return object.otyp === LUCKSTONE
        || !!artifactById(object.oartifact, state)?.flags.includes('SPFX_LUCK');
}

// C invent.c:sobj_at(): the first object of a type in a floor pile.
export function objectAt(x: number, y: number, otyp: number, state: GameState): GameObject | null {
    return (state.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === otyp) || null;
}

// C invent.c:currency(). Hallucinated currency names use the core RNG.
const CURRENCIES: readonly string[] = [
    'Altarian Dollar', 'Ankh-Morpork Dollar', 'auric', 'buckazoid', 'cirbozoid',
    'credit chit', 'cubit', 'Flanian Pobble Bead', 'fretzer', 'imperial credit',
    'Hong Kong Luna Dollar', 'kongbuck', 'nanite', 'quatloo', 'simoleon',
    'solari', 'spacebuck', 'sporebuck', 'Triganic Pu', 'woolong', 'zorkmid',
];

export function currency(amount: number, {
    state = game, random = rn2,
}: { state?: GameState; random?: typeof rn2 } = {}): string {
    const name = heroIsHallucinating(state) ? CURRENCIES[random(CURRENCIES.length)] : 'zorkmid';
    if (!name) throw new RangeError('Currency selection is outside the native name table.');
    return amount === 1 ? name : makePlural(name);
}

// Inventory selection shared by commands which use NetHack's getobj flow.
// C ref: invent.c getobj().

export type InventoryClassification = typeof GETOBJ_EXCLUDE | typeof GETOBJ_EXCLUDE_NONINVENT
    | typeof GETOBJ_EXCLUDE_INACCESS | typeof GETOBJ_EXCLUDE_SELECTABLE | typeof GETOBJ_DOWNPLAY | typeof GETOBJ_SUGGEST;

export interface GetobjOptions {
    // GETOBJ_PROMPT: ask even when nothing is a likely candidate.
    forcePrompt?: boolean;
    // GETOBJ_ALLOWCNT: accept a typed or menu count.
    allowCount?: boolean;
    // The callback's answer for HANDS_SYM, obj_ok((struct obj *) 0).
    hands?: InventoryClassification;
    // getobj_hands_txt(): the '-' menu entry, when hands are allowed.
    handsText?: string;
}

export type InventoryObjectSelection = {
    cancelled: true;
    object: null;
    none: false;
    count: 0 | null;
} | {
    cancelled: false;
    object: GameObject;
    none: false;
    count: number | null;
} | {
    cancelled: false;
    object: null;
    none: true;
    count: number | null;
};

const CANCELLED: InventoryObjectSelection = { cancelled: true, object: null, none: false, count: null };
const HANDS: InventoryObjectSelection = { cancelled: false, object: null, none: true, count: null };
const HANDS_SYM = 45, QUESTION = 63, ASTERISK = 42, ESCAPE = 27;
// strchr(quitchars, '\0') also succeeds, for a literal NUL from the fuzzer.
const QUITCHARS = [0, 32, 13, 10, ESCAPE];

function admitsChoice(classification: InventoryClassification): boolean {
    return classification === GETOBJ_SUGGEST || classification === GETOBJ_DOWNPLAY;
}

// C invent.c:getobj().  The callback classifies HANDS_SYM and each carried
// object; suggestions shape the prompt and its '?' subset, downplayed
// choices force the prompt, and any carried letter may still be typed.
// The returned count has not been split off; callers which need native
// split_otmp behavior use chooseInventoryObject().
// C invent.c:getobj_hands_txt(): callers pass the hands entry's wording
// (fingers, fingertip, gloved/bare hands, empty quiver) as handsText.
export async function getobj(
    word: string,
    classify: (object: GameObject) => InventoryClassification,
    { forcePrompt = false, allowCount = false, hands = GETOBJ_EXCLUDE, handsText = 'your hands' }: GetobjOptions = {},
): Promise<InventoryObjectSelection> {
    const queued = takeQueuedInventorySelection(classify, allowCount, hands);
    if (queued) return queued;

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
    if (game.flags?.fixinv === false) reassignInventoryLetters();
    const sorted = [...game.inventory]
        .sort((left, right) => inventoryLetterOrder(left.invlet) - inventoryLetterOrder(right.invlet));
    const suggested: GameObject[] = [], downplayed: GameObject[] = [];
    for (const object of sorted) {
        const classification = classify(object);
        if (classification === GETOBJ_EXCLUDE_INACCESS) inaccessible++;
        else if (classification === GETOBJ_DOWNPLAY) {
            forcePrompt = true;
            downplayed.push(object);
        } else if (classification === GETOBJ_SUGGEST) suggested.push(object);
    }
    if (!suggested.length && !forcePrompt && !allowNone) {
        await pline(`You don't have anything ${inaccessible ? 'else ' : ''}to ${word}.`);
        return CANCELLED;
    }
    const letters = compactInventoryLetters(suggested.map(object => object.invlet).join(''));
    const buf = handsSuggested ? letters ? `- ${letters}` : '-' : letters;
    const prompt = `What do you want to ${word}? [${buf ? `${buf} or ?*` : '*'}]`;
    const selection = await chooseGetobjLetter(word, prompt, classify, {
        allowCount, allowNone, handsSuggested, handsDownplayed, handsText, suggested, downplayed,
    });
    if (selection.object && classify(selection.object) === GETOBJ_EXCLUDE) {
        await sillyThing(word, selection.object);
        return CANCELLED;
    }
    // split_otmp: an explicit zero count selects nothing.
    if (selection.object && selection.count === 0) return { ...CANCELLED, count: 0 };
    return selection;
}

// getobj() followed by its split_otmp tail, for callers which take the
// object getobj() returns; hands are not a choice for these callbacks.
export async function chooseInventoryObject(
    word: string,
    classify: (object: GameObject) => InventoryClassification,
    options: Omit<GetobjOptions, 'handsText'> = {},
): Promise<GameObject | null> {
    return selectedInventoryObject(await getobj(word, classify, options));
}

function selectedInventoryObject(selection: InventoryObjectSelection): GameObject | null {
    const object = selection.object;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed) object.corpsenm = selection.count;
        // C splittable() calls welded(), revealing the curse before refusing
        // the split. A cursed loadstone returns before that weapon check.
        else if (isWeldedPrimary(object)) object.bknown = true;
        else return splitObjectStack(object, selection.count, game);
    }
    return object;
}

// C invent.c:getobj(): the need_more_cq loop pops queue entries before
// reassign() (invent.c:1778-1830) — CQ_REPEAT during a do-again replay,
// CQ_CANNED otherwise. A queued letter must not become a different
// possession merely because fixinv is disabled. Every entry which selects
// nothing — a non-key entry, an unmatched letter, refused hands — clears
// CQ_CANNED and returns NULL without any prompt; a CMDQ_INT supplies the
// count and pops again. CMDQ_USER_INPUT or an exhausted queue falls through
// to the interactive loop, which starts with a fresh count.
function takeQueuedInventorySelection(
    classify: (object: GameObject) => InventoryClassification,
    allowCount: boolean,
    hands: InventoryClassification,
): InventoryObjectSelection | undefined {
    let count: number | null = null;
    let cntgiven = false;
    for (;;) {
        const entry = cmdq_pop();
        if (!entry) return undefined;
        if (entry.typ === CMDQ_USER_INPUT) return undefined;
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
                if (admitsChoice(hands)) return HANDS;
            } else {
                const letter = String.fromCharCode(entry.key);
                const object = game.inventory.find(candidate => candidate.invlet === letter
                    && admitsChoice(classify(candidate)));
                if (object) return {
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

interface GetobjChoices {
    allowCount: boolean;
    allowNone: boolean;
    handsSuggested: boolean;
    handsDownplayed: boolean;
    handsText: string;
    suggested: readonly GameObject[];
    downplayed: readonly GameObject[];
}

// The interactive loop of C getobj(), up to its final silly_thing() check.
async function chooseGetobjLetter(
    word: string,
    prompt: string,
    classify: (object: GameObject) => InventoryClassification,
    { allowCount, allowNone, handsSuggested, handsDownplayed, handsText, suggested, downplayed }: GetobjChoices,
): Promise<InventoryObjectSelection> {
    const forcedMenu = !!game.flags.force_invmenu;
    let oneloop = false;
    let key = 0;
    for (;;) {
        let count: number | null = null;
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
        } else if (forcedMenu) {
            // The first forced menu lists likely candidates; a rejected
            // count retries the letter already chosen from it.
            if (!oneloop) key = suggested.length || downplayed.length || handsDownplayed ? QUESTION : ASTERISK;
            oneloop = true;
        } else key = await askInventoryPrompt(prompt);
        if (key >= 48 && key <= 57) {
            if (!allowCount) {
                await pline('No count allowed with this command.');
                continue;
            }
            const counted = await getCount(key, BigInt(NATIVE_COMMAND_CONSTANTS.LARGEST_INT), GC_SAVEHIST);
            key = counted.key;
            if (counted.count) count = Number(counted.count);
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
            if (!allowNone) await mimeInventoryAction(word);
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
            if (answered) game._pending_message = '';
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
            if (key === 0) break;
            if (key === HANDS_SYM) {
                return HANDS;
            }
            if (key === ESCAPE) {
                if (game.flags?.verbose !== false) await neverMind();
                return CANCELLED;
            }
            // The native singleton returns count -1 (all), which does not
            // replace a count already entered before '?'.
            if (key !== QUESTION && key !== ASTERISK && allowCount && selection.count !== null)
                count = selection.count;
        }
        if (key === 0) {
            if (oneloop) return CANCELLED;
            continue;
        }
        // C tty_yn_function() marks an answered prompt as already read.
        // A one-line query stays painted through a silent action. Wrapped
        // queries have already been erased by tty_yn_function()'s cleanup.
        if (answered) game._pending_message = '';
        const letter = String.fromCharCode(key);
        const object = game.inventory.find(candidate => candidate.invlet === letter) ?? null;
        if (letter === '$' || object?.oclass === COIN_CLASS) {
            if (object && classify(object) === GETOBJ_EXCLUDE) {
                await pline(`You cannot ${word} gold.`);
                return CANCELLED;
            }
            if (count !== null && count <= 0) return CANCELLED;
        }
        if (count !== null && word === 'throw') {
            if (!object) return CANCELLED;
            const coins = object.oclass === COIN_CLASS;
            if (count > 1 && (!coins || count > object.quan)) {
                await pline(count > object.quan ? `You only have ${object.quan}${
                    !coins && object.quan > 1 ? ' and can only throw one at a time' : ''}.`
                    : 'You can only throw one at a time.');
                continue;
            }
        }
        game.context.botl = true;
        // C invent.c:2051-2053 records the live choice and its count for
        // do-again; a queued letter never re-enters CQ_REPEAT.
        if (object && !game._inDoAgain) {
            if (count !== null && count > 0) cmdq_add_int(CQ_REPEAT, count);
            cmdq_add_key(CQ_REPEAT, key);
        }
        if (!object) {
            await pline("You don't have that object.");
            if (game._inDoAgain) return CANCELLED;
            continue;
        }
        if (count !== null && object.quan < count) {
            await pline(`You don't have that many!  You have only ${object.quan}.`);
            if (game._inDoAgain) return CANCELLED;
            continue;
        }
        return { cancelled: false, object, none: false, count };
    }
}

async function neverMind(): Promise<void> {
    await pline('Never mind.');
}

// C invent.c:silly_thing().
async function sillyThing(word: string, object: GameObject): Promise<void> {
    await pline(word === 'call' && (object.otyp === AMULET_OF_YENDOR
        || object.otyp === FAKE_AMULET_OF_YENDOR && !object.known)
        ? "The Amulet doesn't like being called names."
        : `That is a silly thing to ${word}.`);
}

// C invent.c:mime_action(): '-' without a hands option is an action mime.
async function mimeInventoryAction(verb: string): Promise<void> {
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
        if (chosen === undefined) throw new Error('The action alternative is missing');
        action = chosen;
    }
    await pline(`You mime ${ingSuffix(action)}${prefix ? ' ' + prefix : ''} something${suffix ? ' ' + suffix : ''}.`);
}

// C invent.c:reassign(): give consecutive letters to every carried item
// for !fixinv mode; gold is always forced to '$' at the head of the list.
export function reassignInventoryLetters() {
    const goldIndex = game.inventory.findIndex(object => object.oclass === COIN_CLASS);
    if (goldIndex >= 0) {
        const gold = game.inventory[goldIndex];
        if (!gold) throw new Error('The gold inventory entry is missing');
        game.inventory.splice(goldIndex, 1);
        gold.invlet = '$';
        game.inventory.unshift(gold);
    }
    let index = 0;
    for (const object of game.inventory) {
        if (object.oclass === COIN_CLASS) continue;
        object.invlet = index < 26 ? String.fromCharCode(97 + index)
            : index < 52 ? String.fromCharCode(65 + index - 26) : '#';
        index++;
    }
    game._lastInvNr = Math.min(index, 51);
}

// C invent.c invletter_value(): '$' first, then a-z, then A-Z, then other.
export function inventoryLetterOrder(letter: string | null | undefined): number {
    if (letter == null) return 53;
    if (letter === '$') return 0;
    if (letter >= 'a' && letter <= 'z') return letter.charCodeAt(0) - 96;
    if (letter >= 'A' && letter <= 'Z') return letter.charCodeAt(0) - 38;
    return 53;
}

// C invent.c:compactify().
export function compactInventoryLetters(letters: string): string {
    if (letters.length <= 5) return letters;
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

// C getobj() has already consumed its queued selection or user-input marker.
// Its interactive query must leave later canned answers for the caller.
async function askInventoryPrompt(prompt: string): Promise<number> {
    await flushPendingTopline();
    const { answer } = await yn_function(prompt, null, '', false);
    return answer.charCodeAt(0);
}

// C check_invent_gold(): only malformed purses may be reorganized.
export async function checkInventoryGold(why: string, state: GameState = game): Promise<boolean> {
    const gold = state.inventory.filter(object => object.oclass === COIN_CLASS);
    const wrongSlots = gold.filter(object => object.invlet !== '$').length;
    if (gold.length <= 1 && wrongSlots === 0) return false;
    const wrongSlotMessage = wrongSlots > 1 ? 'gold in wrong slots'
        : wrongSlots === 1 ? 'gold in wrong slot' : '';
    await impossible(`${why}: ${wrongSlotMessage}${wrongSlots && gold.length > 1 ? ' and ' : ''}${
        gold.length > 1 ? 'multiple gold stacks' : ''}`, { state });
    return true;
}
export function objectNeedsFullIdentification(object: GameObject | null | undefined) {
    if (!object || object.oclass === COIN_CLASS) return false;
    const typeKnown = objectTypeKnown(object);
    if (!object.known || (!object.bknown && object.otyp !== SCR_MAIL)
        || !object.dknown || !typeKnown) return true;
    if ((!object.cknown && (isContainer(object) || object.otyp === STATUE))
        || (!object.lknown && [CHEST, LARGE_BOX].includes(object.otyp))) return true;
    if (object.oartifact && !game._artifactDiscoveries?.includes(object.oartifact)) return true;
    if (object.rknown || !([WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS].includes(object.oclass) || isWeaponTool(object))) return false;
    return (['rust', 'burn', 'rot', 'corrosion', 'crack'] as const).some(kind =>
        objectIsVulnerableToErosion(object, kind));
}

export function fullyIdentifyObject(object: GameObject, state: GameState = game) {
    const realObjectType = object.otyp >= FIRST_OBJECT;
    if (realObjectType) learnObjectType(object.otyp, state);
    if (object.oartifact) discoverArtifact(object.oartifact, state);

    object.known = true;
    object.bknown = true;
    object.rknown = true;
    if (realObjectType && !heroIsHallucinating(state)) object.dknown = true;
    object.buc = object.blessed ? 'blessed'
        : object.cursed ? 'cursed' : 'uncursed';

    const canonical = OBJECT_NAMES[object.otyp];
    if (canonical && object.oclass === SCROLL_CLASS) {
        object.name = `scroll of ${canonical}`;
        object.plural = `scrolls of ${canonical}`;
    } else if (canonical && object.oclass === SPBOOK_CLASS) {
        object.name = `spellbook of ${canonical}`;
        object.plural = `spellbooks of ${canonical}`;
    }

    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = true;
        object.lknown = true;
    } else if (object.otyp === TIN) {
        object.cknown = true;
    }
    if (object.otyp === EGG && object.corpsenm !== undefined && eggHasMonsterSpecies(object))
        learnEggType(object.corpsenm, state);
}

function identificationBuc(object: GameObject) {
    if (object.oclass === COIN_CLASS) return game.flags.goldX ? 'X' : 'U';
    if (!object.bknown) return 'X';
    return object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}

function hasUnpaidContents(object: GameObject): boolean {
    return !!object.unpaid || (object.contents || []).some(hasUnpaidContents);
}

function traditionalIdentifyChoices(candidates: readonly GameObject[]) {
    const classes = [...new Set(candidates.map(object => OBJECT_CLASS_SYMBOLS[object.oclass]))];
    const inventory = game.inventory;
    // Native count_buc() lets a priest recognize even objects which are
    // omitted by this identification's eligibility filter.
    if (game.urole?.key === 'priest') {
        for (const object of inventory) object.bknown = object.oclass !== COIN_CLASS;
    }
    const eligible = inventory.filter(objectNeedsFullIdentification);
    let choices = classes.join('') + ' ';
    if (inventory.some(hasUnpaidContents)) choices += 'u';
    for (const category of 'BUCX') {
        if (eligible.some(object => identificationBuc(object) === category)) choices += category;
    }
    if (inventory.some(object => object.pickup_prev)) choices += 'P';
    return choices + 'aim';
}

async function parseIdentificationCategories(answer: string): Promise<IdentificationCategories> {
    const classes: number[] = [];
    const beatitudes = new Set<IdentificationBeatitude>();
    let unpaid = false, picked = false, all = false, menu = false;
    for (const symbol of answer) {
        if (symbol === ' ' || symbol === 'A') continue;
        if (symbol === 'a') all = true;
        else if (symbol === 'm') menu = true;
        else if (symbol === 'u') unpaid = true;
        else if (symbol === 'P') picked = true;
        else if (symbol === 'B' || symbol === 'U' || symbol === 'C' || symbol === 'X')
            beatitudes.add(symbol);
        else {
            const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
            if (objectClass <= RANDOM_CLASS) await plineWithContinuation(`You don't have any ${symbol}'s.`);
            else if (!classes.includes(objectClass)) classes.push(objectClass);
        }
    }
    return { classes, beatitudes, unpaid, picked, all, menu };
}

function matchesIdentificationCategories(object: GameObject, categories: IdentificationCategories): boolean {
    if (categories.unpaid && !hasUnpaidContents(object)) return false;
    if (categories.beatitudes.size && !categories.beatitudes.has(identificationBuc(object))) return false;
    return !categories.picked || !!object.pickup_prev;
}

// C ggetobj()/askchain(), restricted to identify. Category order controls
// which class is questioned first; identifying never splits a stack.
async function identifyTraditionally(limit: number): Promise<IdentificationResult> {
    const identified: GameObject[] = [];
    while (limit > 0) {
        const candidates = game.inventory.filter(objectNeedsFullIdentification);
        if (!candidates.length) return { identified, remaining: 0 };
        const choices = traditionalIdentifyChoices(candidates);
        await flushPendingTopline();
        clearMessageWindow();
        const answer = await getLine(
            `What kinds of thing do you want to identify? [${choices}]`,
            (_character, key) => key >= 32 && key < 127,
        );
        // Native ggetobj returns zero here; identify_pack asks again while
        // identification allowance remains. The per-item q choice quits.
        if (answer === null) continue;
        if (answer.includes('i')) {
            await showInventoryWindow(await inventorySections(candidates, false), { pickMode: PICK_ONE });
            continue;
        }
        const categories = await parseIdentificationCategories(answer);
        if (categories.menu) return { identified, remaining: limit };
        let all = categories.all;
        let questioned = 0;
        const letterOrder = '$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#';
        const inventory = [...game.inventory].sort((a, b) =>
            (a.invlet == null ? -1 : letterOrder.indexOf(a.invlet))
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
                        || !matchesIdentificationCategories(object, categories)) continue;
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
                    if (response === 'q') return { identified, remaining: 0 };
                    questioned++;
                    if (response === 'n') continue;
                    if (response === 'a') all = true;
                    await identifyAndDescribe(object);
                    identified.push(object);
                    if (!--limit) return { identified, remaining: 0 };
                }
            }
        } finally {
            clearBypasses();
        }
        await plineWithContinuation(questioned ? 'That was all.' : 'No applicable objects.');
    }
    return { identified, remaining: 0 };
}

async function identificationMenu(candidates: readonly GameObject[], first: boolean): Promise<GameObject[] | null> {
    await flushPendingTopline();
    clearMessageWindow();
    const sections: MultiSelectSection<GameObject>[] = (await inventorySections(candidates, false)).map(section => ({
        ...section,
        items: section.items.map(item => {
            if (item.key === undefined) throw new Error('Identification item has no inventory letter');
            const object = candidates.find(candidate => candidate.invlet === item.key);
            if (!object) throw new Error(`No inventory object for identification letter ${item.key}`);
            return { ...item, key: item.key, value: object };
        }),
    }));
    return await showMultiSelectWindow({
        title: `What would you like to identify ${first ? 'first' : 'next'}?`,
        sections, signalEscape: true,
    });
}

async function identifyAndDescribe(object: GameObject) {
    fullyIdentifyObject(object);
    observeObjectForNaming(object);
    await plineWithContinuation(`${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}

// C invent.c:identify_pack()/menu_identify(). Each selection is identified
// and described before another menu opens, so resumed input sees the result.
// C invent.c:count_unidentified() is the candidate count and the
// already-identified shortcut.
export async function identifyPack(idLimit: number, learningIdentify = false): Promise<GameObject[]> {
    let candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
    if (!candidates.length) {
        await plineWithContinuation(`You have already identified ${
            learningIdentify ? 'the rest' : 'all'
        } of your possessions.`);
        return [];
    }
    if (!idLimit || idLimit >= candidates.length) {
        const identified: GameObject[] = [];
        for (const object of candidates) {
            if (!objectNeedsFullIdentification(object)) continue;
            await identifyAndDescribe(object);
            identified.push(object);
        }
        return identified;
    }

    const traditional = game.flags.menu_style === MENU_TRADITIONAL
        ? await identifyTraditionally(idLimit) : { identified: [], remaining: idLimit };
    const identified = traditional.identified;
    let remaining = traditional.remaining;
    candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
    let first = true;
    let tries = 5;
    while (remaining > 0 && candidates.length) {
        const selected = await identificationMenu(candidates, first);
        if (selected === null) break;
        if (!selected.length) {
            if (!--tries) {
                await plineWithContinuation("That's enough tries!");
                break;
            }
            await plineWithContinuation('Choose an item; use ESC to decline.');
            continue;
        }
        const accepted = selected.slice(0, remaining);
        for (const object of accepted) await identifyAndDescribe(object);
        identified.push(...accepted);
        remaining -= accepted.length;
        candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
        if (remaining > 0 && !candidates.length)
            await plineWithContinuation('That was all.');
        first = false;
    }
    return identified;
}

export function bucAdjectiveForName(item: GameObject) {
    return objectBlessingDescription(item);
}

// Materialize only at a menu/prinv boundary. Hallucinated colors use display RNG.
export function inventoryPrimaryHandDetail(item: GameObject) {
    return primaryHandDescriptionDetail(item);
}

export async function inventoryItemDescription(item: GameObject, options: InventoryDescriptionOptions = {}): Promise<string> {
    return await objectDescription(item, options);
}

export async function consumeInventoryItem(item: GameObject, state: GameState = game) {
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

async function rerollItemDescription(item: GameObject) {
    // invent.c:reroll_menu() brackets distant_name(doname) with
    // override_ID.  Identify a temporary view rather than mutating the live
    // object or discovery tables for a character which might be rejected.
    return await inventoryItemDescription({
        ...item,
        known: true,
        bknown: true,
        dknown: true,
        rknown: true,
        overrideIdentified: true,
    });
}

function rerollAttributeLine() {
    const values = game.u?.acurr?.a || [];
    const displayed = ATTRIBUTE_DISPLAY_ORDER.map(attribute => values[attribute]);
    return `St:${formatStrength(displayed[0])} Dx:${displayed[1] ?? '?'} `
        + `Co:${displayed[2] ?? '?'} In:${displayed[3] ?? '?'} Wi:${displayed[4] ?? '?'} `
        + `Ch:${displayed[5] ?? '?'}`;
}

async function rerollFallbackPrompt() {
    const message = 'Reroll this character? [yn] (n) ';
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    for (;;) {
        const key = await nhgetch();
        const answer = String.fromCharCode(key).toLowerCase();
        if (answer === 'y' || answer === 'n') return answer === 'y';
        if ([27, 32, 10, 13].includes(key)) return false;
    }
}

// C ref: invent.c:reroll_menu().  This menu is a startup transaction, not a
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
        if (!roleplay) throw new Error('Reroll requires initialized roleplay options');
        roleplay.numrerolls = (roleplay.numrerolls || 0) + 1;
    }
    return reroll;
}

async function inventorySections(
    items: readonly GameObject[] = game.inventory || [], includeGold = true,
    letters: string | null = null,
): Promise<InventorySection[]> {
    return await inventorySectionsInOrder(
        sortObjects(items, { mode: inventorySortMode() }), includeGold, letters);
}

async function inventorySectionsInOrder(
    items: readonly GameObject[], includeGold = true,
    letters: string | null = null,
): Promise<InventorySection[]> {
    const grouped = new Map<string | null, InventoryMenuItem[]>();
    for (const item of items) {
        if (!includeGold && item.oclass === COIN_CLASS) continue;
        // C display_pickinv() filters by letters when rendering, after
        // sortloot() has classified -- and observed -- every object in the
        // passed list, so items hidden by the filter are still named.
        if (letters !== null && !letters.includes(item.invlet ?? '')) continue;
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

async function showItemActionMenu(item: GameObject) {
    const repairGold = item.oclass === COIN_CLASS && await checkInventoryGold('item-action');
    return showChoiceWindow({
        title: `Do what with ${definiteName(objectCombatName(item))}?`,
        entries: itemActionEntries(item, game, repairGold),
    });
}

export async function inventoryActionForObject(item: GameObject): Promise<InventoryAction | null> {
    const key = await showItemActionMenu(item);
    return key === 0 ? null : { key: inventoryActionKey(key), item };
}

// Also C iactions.c:item_naming_classification(): inlined here
// Also C iactions.c:ia_addmenu(): keyed action rows are built inline here
function itemActionEntries(item: GameObject, state: GameState, repairGold: boolean) {
    const itemName = simpleObjectName(item, state);
    const entries: { key: InventoryActionKey; text: string }[] = [];
    const alreadyWorn = !!((item.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY));
    const stack = item.quan > 1;
    const plural = objectNameIsPlural(item, state);
    const shoot = launcherMatchesAmmo(item, state.uwep);
    if (item === state.uwep || item === state.uswapwep || item === state.uquiver) {
        const quivered = item === state.uquiver;
        const verb = quivered ? 'Quiver' : 'Wield';
        const action = quivered ? 'un-ready' : 'un-wield';
        const noun = item.oclass === WEAPON_CLASS || isWeaponTool(item) ? 'weapon' : 'item';
        entries.push({ key: '-', text: `${verb} '-' to ${action} ${plural ? `these ${noun}s` : `this ${noun}`}` });
    }
    const apply = itemApplyText(item, state);
    if (apply) entries.push({ key: 'a', text: apply });
    if (item.oclass !== COIN_CLASS && item.dknown && !item.oartifact && item.otyp !== SPE_NOVEL) {
        const named = !!(item.oextra?.oname || item.oname);
        entries.push({ key: 'c', text: `${named ? 'Rename or un-name' : 'Name'} ${
            objectLooksUnique(item, state) ? 'the' : plural ? 'this stack of' : 'this specific'} ${itemName}` });
    }
    const callName = state._objectCallNames?.[item.otyp];
    if (item.dknown && objectTypeCallable(item, state) && (!objectTypeKnown(item, state) || callName)) {
        const noun = objectLooksUnique(item, state) ? definiteName(itemName, state)
            : plural ? itemName : makePlural(itemName);
        entries.push({ key: 'C', text: `${callName ? 'Re-call or un-call' : 'Call'} the type for ${noun}` });
    }
    if (!alreadyWorn) entries.push({ key: 'd', text: `Drop this ${stack ? 'stack' : 'item'}` });
    if (item.otyp === TIN) {
        const opener = state.uwep?.otyp === TIN_OPENER ? ' with your tin opener' : '';
        entries.push({ key: 'e', text: `Open ${stack ? 'one of these tins' : 'this tin'}${opener} and eat the contents` });
    } else if (isEdibleFood(item, state)) {
        entries.push({ key: 'e', text: `Eat ${stack ? 'one of these' : 'this'}` });
    }
    if (item.otyp === TOWEL) {
        entries.push({ key: 'E', text: 'Wipe the floor with this towel' });
    } else if (item.otyp === MAGIC_MARKER) {
        entries.push({ key: 'E', text: 'Scribble graffiti on the floor' });
    } else if ([WEAPON_CLASS, RING_CLASS, WAND_CLASS, GEM_CLASS].includes(item.oclass)) {
        const engraves = isBlade(item) || item.oclass === WAND_CLASS
            || (item.oclass === RING_CLASS || item.oclass === GEM_CLASS) && !!state.objectToughness?.[item.otyp];
        const verb = engraves ? 'Engrave' : 'Write';
        const surface = surfaceName(state.u.ux, state.u.uy, state);
        entries.push({ key: 'E', text: `${verb} on the ${surface} with ${stack ? 'one of these items' : 'this item'}` });
    }
    if (item === state.uquiver) {
        const launcher = shoot && state.uwep
            ? ` with your wielded ${simpleObjectName(state.uwep, state)}` : '';
        entries.push({ key: 'f', text: `${shoot ? 'Shoot' : 'Throw'} ${stack ? 'one of these' : 'this'}${launcher}` });
    }
    if (item.oclass !== COIN_CLASS || repairGold)
        entries.push({ key: 'i', text: 'Adjust inventory by assigning new letter' });
    if (stack && item.oclass !== COIN_CLASS)
        entries.push({ key: 'I', text: 'Adjust inventory by splitting this stack' });
    if (state.level?.at(state.u.ux, state.u.uy)?.typ === ALTAR && !state.u.uswallow) {
        if (item.otyp === CORPSE) entries.push({ key: 'O', text: 'Offer this corpse as a sacrifice at this altar' });
        else if ([AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(item.otyp))
            entries.push({ key: 'O', text: 'Offer this amulet as a sacrifice at this altar' });
    }
    const keeper = item.unpaid ? currentShopResident(state) : null;
    if (keeper && shopkeeperInOwnShop(keeper, state))
        entries.push({ key: 'p', text: `Buy this unpaid ${stack ? 'stack' : 'item'}` });
    if (!alreadyWorn) {
        const wear = accessoryActionText(item, state);
        if (wear) entries.push({ key: 'P', text: wear });
    }
    if (item.oclass === POTION_CLASS)
        entries.push({ key: 'q', text: `Quaff (drink) ${stack ? 'one of these potions' : 'this potion'}` });
    if ([WEAPON_CLASS, GEM_CLASS].includes(item.oclass) && item !== state.uquiver)
        entries.push({ key: 'Q', text: `Quiver this ${stack ? 'stack' : 'item'} for easy ${shoot ? 'shooting' : 'throwing'} with 'f'ire` });
    const reading = itemReadingText(item, state);
    if (reading) entries.push({ key: 'r', text: reading });
    if ((item.owornmask ?? 0) & W_ACCESSORY) {
        const accessory = (item.owornmask ?? 0) & W_AMUL ? 'amulet'
            : (item.owornmask ?? 0) & W_RING ? 'ring'
                : (item.owornmask ?? 0) & W_TOOL ? 'eyewear' : 'accessory';
        entries.push({ key: 'R', text: `Remove this ${accessory}` });
    }
    if ([OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN].includes(item.otyp))
        entries.push({ key: 'R', text: `Rub this ${itemName}` });
    else if (item.oclass === GEM_CLASS && isGrayStone(item))
        entries.push({ key: 'R', text: 'Rub something on this stone' });
    if (!alreadyWorn) {
        const goldStack = stack && item.otyp === GOLD_PIECE;
        const quantity = stack ? goldStack ? 'them' : 'one of these' : 'this item';
        const fireAlias = item === state.uquiver && !goldStack ? " (same as 'f')" : '';
        entries.push({ key: 't', text: `${shoot ? 'Shoot' : 'Throw'} ${quantity}${fireAlias}` });
    }
    if ((item.owornmask ?? 0) & W_ARMOR)
        entries.push({ key: 'T', text: 'Take off this armor' });
    if ((isContainer(item) || item.otyp === BAG_OF_TRICKS) && (item.contents?.length || !item.cknown)
        || item.otyp === HORN_OF_PLENTY && (item.spe > 0 || !item.known))
        entries.push({ key: 'T', text: 'Tip all the contents out of this container' });
    if (item.otyp === FAKE_AMULET_OF_YENDOR && !item.known
        || item.oartifact || objectUnique(item.otyp) || item.otyp === CRYSTAL_BALL)
        entries.push({ key: 'V', text: 'Try to invoke a unique power of this object' });
    if (item !== state.uwep && !heroHasNoHands(state) && !heroIsVerySmall(state)) {
        const weapon = item.oclass === WEAPON_CLASS || isWeaponTool(item)
            || item.otyp === TOWEL && item.spe > 0 || item.otyp === HEAVY_IRON_BALL;
        if (weapon) {
            entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'} as your weapon` });
        } else if (item.otyp === TIN_OPENER) {
            entries.push({ key: 'w', text: 'Wield the tin opener to easily open tins' });
        } else if (!alreadyWorn) {
            entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'} in your ${makePlural(heroHandName(state))}` });
        }
    }
    if (!alreadyWorn && item.oclass === ARMOR_CLASS) {
        const slot = armorSlotFor(item.otyp);
        const worn = slot ? state[slot] : null;
        entries.push({ key: 'W', text: worn ? `[already wearing ${withIndefiniteArticle(armorSimpleName(worn, state))}]`
            : 'Wear this armor' });
    }
    if (item === state.uwep) entries.push({ key: 'x', text: state.uswapwep
        ? 'Swap this with your alternate weapon' : 'Ready this as an alternate weapon' });
    else if (item === state.uswapwep)
        entries.push({ key: 'x', text: 'Swap this with your main weapon' });
    if ((item === state.uwep || item === state.uswapwep)
        && (state.u.twoweap || heroCanUseTwoWeapons(state) && !state.uarms
            && isTwoWeaponObject(state.uwep) && state.uwep && !isBimanualObject(state.uwep)
            && isTwoWeaponObject(state.uswapwep) && state.uswapwep && !isBimanualObject(state.uswapwep)))
        entries.push({ key: 'X', text: `Toggle two-weapon combat ${state.u.twoweap ? 'off' : 'on'}` });
    if (item.oclass === WAND_CLASS) entries.push({ key: 'z', text: 'Zap this wand to release its magic' });
    if (encyclopediaEntries(singularObjectName(item, state), state).length)
        entries.push({ key: '/', text: `Look up information about ${stack ? 'these' : 'this'}` });
    return entries;
}

function itemApplyText(item: GameObject, state: GameState): string | null {
    const light = item.lamplit ? 'Extinguish' : 'Light';
    if (item.oclass === COIN_CLASS) return 'Flip a coin';
    if (item.otyp === CREAM_PIE) return 'Hit yourself with this cream pie';
    if (item.otyp === BULLWHIP) return 'Lash out with this whip';
    if (item.otyp === GRAPPLING_HOOK) return 'Grapple something with this hook';
    if (item.otyp === BAG_OF_TRICKS) return objectTypeKnown(item, state) ? 'Reach into this bag' : 'Open this container';
    if (isContainer(item)) return 'Open this container';
    switch (item.otyp) {
    case CAN_OF_GREASE: return 'Use the can to grease an item';
    case LOCK_PICK: case CREDIT_CARD: case SKELETON_KEY: return 'Use this tool to pick a lock';
    case TINNING_KIT: return 'Use this kit to tin a corpse';
    case LEASH: return 'Tie a pet to this leash';
    case SADDLE: return 'Place this saddle on a pet';
    case MAGIC_WHISTLE: case TIN_WHISTLE: return 'Blow this whistle';
    case EUCALYPTUS_LEAF: return 'Use this leaf as a whistle';
    case STETHOSCOPE: return 'Listen through the stethoscope';
    case MIRROR: return 'Show something its reflection';
    case BELL: case BELL_OF_OPENING: return 'Ring the bell';
    case CANDELABRUM_OF_INVOCATION: return `${light} the candelabrum`;
    case TALLOW_CANDLE: case WAX_CANDLE: {
        const candelabrum = state.inventory.find(object => object.otyp === CANDELABRUM_OF_INVOCATION);
        const multiple = item.quan !== 1;
        if (candelabrum && candelabrum.spe < 7)
            return `Attach ${multiple ? 'these' : 'this'} to your candelabrum, or ${
                item.lamplit ? 'extinguish' : 'light'} ${multiple ? 'them' : 'it'}`;
        return `${light} ${multiple ? 'these' : 'this'} ${simpleObjectName(item, state)}`;
    }
    case OIL_LAMP: case MAGIC_LAMP: case BRASS_LANTERN: return `${light} this light source`;
    case EXPENSIVE_CAMERA: return 'Take a photograph';
    case TOWEL: return 'Clean yourself off with this towel';
    case CRYSTAL_BALL: return 'Peer into this crystal ball';
    case MAGIC_MARKER: return 'Write on something with this marker';
    case FIGURINE: return 'Make this figurine transform';
    case UNICORN_HORN: return 'Use this unicorn horn';
    case LAND_MINE: case BEARTRAP: return 'Arm this trap';
    case PICK_AXE: case DWARVISH_MATTOCK: return 'Dig with this digging tool';
    default: break;
    }
    if (item.otyp === POT_OIL && objectTypeKnown(item, state)) return `${light} this oil`;
    if (item.oclass === POTION_CLASS) return `Dip something into ${item.quan > 1 ? 'one of these' : 'this'} potion${item.quan === 1 ? '' : 's'}`;
    if (item.otyp === HORN_OF_PLENTY && objectTypeKnown(item, state)) return 'Blow into the horn of plenty';
    if (item.otyp >= WOODEN_FLUTE && item.otyp <= DRUM_OF_EARTHQUAKE) return 'Play this musical instrument';
    return item.oclass === WAND_CLASS ? 'Break this wand' : null;
}

export function objectTypeCallable(object: GameObject, state: GameState = game): boolean {
    return !!state._objectCallNames?.[object.otyp]
        || ![AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(object.otyp)
            && [ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, GEM_CLASS, VENOM_CLASS].includes(object.oclass)
            && !!(state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]);
}

function accessoryActionText(item: GameObject, state: GameState): string | null {
    if (item.oclass === AMULET_CLASS) return state.uamul ? '[already wearing an amulet]' : 'Put this amulet on';
    if (item.oclass === RING_CLASS || item.otyp === MEAT_RING)
        return state.uleft && state.uright ? `[both ring ${makePlural(heroFingerName(state))} in use]` : 'Put this ring on';
    if ([BLINDFOLD, TOWEL, LENSES].includes(item.otyp)) {
        if (state.ublindf) return '[already wearing eyewear]';
        return item.otyp === LENSES ? 'Put these lenses on' : `Put this on${item.otyp === TOWEL ? ' to blindfold yourself' : ''}`;
    }
    return null;
}

// C iactions.c:item_reading_classification(). Reading advice depends on
// what the hero knows about the type, rather than the object's charges.
function itemReadingText(item: GameObject, state: GameState): string | null {
    const known = objectTypeKnown(item, state);
    if (item.otyp === FORTUNE_COOKIE) return 'Read the message inside this cookie';
    if (item.otyp === OBJECT_NAMES.indexOf('T-shirt')) return 'Read the slogan on the shirt';
    if (item.otyp === ALCHEMY_SMOCK) return 'Read the slogan on the apron';
    if (item.otyp === HAWAIIAN_SHIRT) return 'Look at the pattern on the shirt';
    if (item.oclass === SCROLL_CLASS) {
        const magic = item.dknown && item.otyp !== SCR_MAIL
            && (item.otyp !== SCR_BLANK_PAPER || !known)
            ? ' to activate its magic' : '';
        return `Read this scroll${magic}`;
    }
    if (item.oclass !== SPBOOK_CLASS) return null;
    const novel = item.otyp === SPE_NOVEL;
    const blank = item.otyp === SPE_BLANK_PAPER && known;
    const tome = item.otyp === SPE_BOOK_OF_THE_DEAD && known;
    const verb = novel || blank ? 'Read' : tome ? 'Examine' : 'Study';
    const noun = novel ? simpleObjectName(item, state) : tome ? 'tome' : 'spellbook';
    return `${verb} this ${noun}`;
}

function inventoryActionKey(code: number): InventoryActionKey {
    const key = String.fromCharCode(code);
    switch (key) {
    case '-': case 'a': case 'c': case 'C': case 'd': case 'e': case 'E': case 'f': case 'i': case 'I': case 'O': case 'p': case 'P': case 'q': case 'Q': case 'r': case 'R':
    case 't': case 'T': case 'V': case 'w': case 'W': case 'x': case 'X': case 'z': case '/': case '\x1b': case ' ': case '\n': case '\r':
        return key;
    default:
        throw new RangeError(`Unexpected inventory action key ${code}`);
    }
}

export async function ddoinv(): Promise<InventoryAction | null> {
    const inventory = game.inventory || [];
    const { key } = await selectInventoryObject();
    const selected = inventory.find(item =>
        item.invlet === String.fromCharCode(key));
    let action: InventoryAction | null = null;
    if (selected) {
        action = await inventoryActionForObject(selected);
    }
    await flush_screen(1);
    game.context.move = 0;
    return action;
}

// C invent.c:display_used_invlets(). A split's original letter is omitted;
// all remaining carried slots, including gold, stay visible.
export async function selectUsedInventoryLetter(avoidLetter: string | null): Promise<number> {
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

// C end.c:really_done() discovers every carried type and marks all of the
// object's knowledge bits before disclose() calls display_inventory().
// Keep that state transition separate from the ordinary `i` command, whose
// descriptions are still constrained by what the hero learned in play.
export async function showIdentifiedInventory() {
    for (const item of game.inventory) identifyObjectForDisclosure(item, true);
    // disclose() requests a reply so an inventory letter closes the menu;
    // it ignores the selected object and continues with the next question.
    return selectInventoryObject({ headingAttr: 0, pickMode: PICK_ONE });
}

export function identifyObjectForDisclosure(item: GameObject, identifyTinContents = false): void {
    recordObjectEncounter(item.otyp);
    recordObjectKnowledge(item.otyp);
    item.known = true;
    item.bknown = true;
    item.dknown = true;
    item.rknown = true;
    if (isContainer(item) || item.otyp === STATUE)
        item.cknown = item.lknown = true;
    else if (identifyTinContents && item.otyp === TIN) item.cknown = true;
    const redundantNeutral = item.oclass === WEAPON_CLASS || item.oclass === WAND_CLASS
        || (item.oclass === TOOL_CLASS && objectUsesCharges(item));
    item.buc = item.blessed ? 'blessed' : item.cursed ? 'cursed'
        : !redundantNeutral
            && [ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, GEM_CLASS].includes(item.oclass)
            ? 'uncursed' : '';
    const canonicalName = OBJECT_NAMES[item.otyp];
    if (item.oclass === GEM_CLASS && canonicalName) item.name = canonicalName;
}

// C invent.c:display_pickinv(): the getobj inventory menu, including the
// "Not carrying anything" shortcut and the hands entry when allowed.
export async function selectInventoryObject({
    letters, includeGold = true, title = null, extraChoice = null,
    pickMode = PICK_ONE, headingAttr, menuOptions = [],
}: InventoryObjectMenuOptions = {}): Promise<InventorySelection> {
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
    if (game.flags.fixinv === false) reassignInventoryLetters();
    const wizardIdentification = game.flags.debug && game.iflags.override_ID;
    // Native counts '-' as a filter letter as well as an extra hands entry,
    // so a hands-only filter stays in a menu window.
    const singleton = !menuOptions.length && !game.flags.force_invmenu
        && !game.iflags.menu_requested && !wizardIdentification
        && (letters?.length === 1 && !extraChoice
            || !filtered && visible.length === 0 && !!extraChoice);
    if (singleton) {
        const item = visible[0];
        if (item) observeObjectForNaming(item);
        const letter = item ? item.invlet : '-';
        if (!letter) throw new Error('A carried inventory choice has no letter');
        const description = item ? await inventoryItemDescription(item, {
            primaryHandDetail: inventoryPrimaryHandDetail(item),
        }) : extraChoice;
        const key = await showMessageMenu(letter, item ? pickMode : PICK_ONE,
            `${letter} - ${description}.`);
        return { key, count: null };
    }
    // invent.c:display_pickinv() runs sortloot() over the whole inventory
    // (observing every object via loot_classify()) and only afterwards
    // drops entries whose letters are absent from the requested set,
    // treating an empty set as no filter at all.
    const sections = await inventorySections(game.inventory, includeGold, letters || null);
    if (extraChoice && !wizardIdentification) sections.unshift({
        heading: game.flags.sortpack === false ? null : 'Miscellaneous',
        items: [{ text: extraChoice, key: '-' }],
    });
    if (menuOptions.length) sections.push({
        heading: 'Special', items: menuOptions.map(option => ({
            text: option.text, key: option.key,
        })),
    });
    return showInventoryWindow(sections, {
        pickMode, title, ...(headingAttr === undefined ? {} : { headingAttr }),
    });
}

export async function dolook() {
    hideUnhideMessageTypes(true, MSGTYP_MASK_REP_SHOW, game.iflags.messageTypes);
    try {
        await inspectHere();
    } finally {
        hideUnhideMessageTypes(false, MSGTYP_MASK_REP_SHOW, game.iflags.messageTypes);
    }
}

async function inspectHere(): Promise<void> {
    if (game.u.uswallow && game.u.ustuck) {
        await lookInsideSwallower(game.u.ustuck);
        game.context.move = heroIsBlind() ? 1 : 0;
        return;
    }
    const { tookTime } = await lookHere(0);
    game.context.move = tookTime ? 1 : 0;
}
// C invent.c:count_contents(container, nested, quantity, everything, FALSE):
// shk.c:stolen_value() sizes a broken container's shop-owned contents.
export function countContents(container: GameObject, { quantity = false, everything = false } = {},
    state: GameState = game): number {
    let shoppy = false;
    if (!everything) {
        let top = container;
        while (top.container) top = top.container;
        if (top.where === 'floor')
            shoppy = !!costlySpot(top.ox, top.oy, state);
    }
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countContents(content, { quantity, everything }, state);
        if (everything || content.unpaid || (shoppy && !content.no_charge))
            count += quantity ? (content.quan ?? content.quantity ?? 1) : 1;
    }
    return count;
}

// C invent.c:doperminv(). The recorder's tty port is built without
// TTY_PERM_INVENT (config.h leaves it commented out and windconf.h is
// WIN32-only), so it does not advertise WC_PERM_INVENT and the command
// always reports the unsupported window port.
export async function doPermanentInventory(): Promise<void> {
    game.context.move = 0;
    await pline("Persistent inventory display is not supported by 'tty'.");
}

type InventoryReport = 'gold' | 'weapon' | 'armor' | 'rings' | 'amulet' | 'tools' | 'inuse' | 'type';
type Buc = 'B' | 'U' | 'C' | 'X';
const BUC_CHOICES: readonly Buc[] = ['B', 'C', 'U', 'X'];

// C invent.c:doprwep().
// C invent.c:doprgold().
// C invent.c:doprarm().
// C invent.c:doprring().
// C invent.c:dopramulet().
// C invent.c:doprtool().
// C invent.c:doprinuse().
// C invent.c:noarmor().
export async function inventoryReport(report: InventoryReport): Promise<InventoryAction | null> {
    game.context.move = 0;
    if (report === 'type') return typeInventory();
    if (report === 'gold') {
        await reportWallet();
        const purse = heroGoldObject(game);
        return purse && game.iflags.menu_requested ? reportSubset([purse], false) : null;
    }
    if (report === 'weapon') {
        if (!game.uwep) {
            await pline(`You are ${game.uarmg ? 'empty handed' : monsterIsHumanoid(heroSpecies(game))
                ? 'bare handed' : 'not wielding anything'}.`);
        } else if (!game.iflags.menu_requested) {
            await describeCarriedObject(game.uwep);
            if (game.u.twoweap && game.uswapwep) await describeCarriedObject(game.uswapwep);
        } else {
            return reportSubset([game.uwep, game.uswapwep, game.uquiver]
                .filter((object): object is GameObject => !!object));
        }
        return null;
    }
    if (report === 'armor') {
        const armor = [game.uarm, game.uarmc, game.uarms, game.uarmh, game.uarmg, game.uarmf, game.uarmu]
            .filter((object): object is GameObject => !!object);
        if (armor.length) return reportSubset(armor);
        await pline(game.uskin ? `You are not wearing armor but have ${simpleObjectName(game.uskin)
            .replace(/^set of /i, '').replace(/ dragon /i, ' ')} embedded in your skin.`
            : 'You are not wearing any armor.');
        return null;
    }
    if (report === 'rings') {
        const rings = [game.uright, game.uleft].filter((object): object is GameObject => !!object);
        if (rings.length) return reportSubset(rings, rings.length > 1 || !!game.iflags.menu_requested
            || rings.some(object => object.oclass !== RING_CLASS), rings.length === 1 ? 'Ring' : 'Rings');
        await pline('You are not wearing any rings.');
        return null;
    }
    if (report === 'amulet') {
        if (game.uamul) return reportSubset([game.uamul], true, 'Amulet');
        await pline('You are not wearing an amulet.');
        return null;
    }
    const items = game.inventory.filter(report === 'tools' ? toolBeingUsed : isInUse);
    if (items.length) return reportSubset(report === 'tools' ? items.slice(0, 52) : null);
    await pline(report === 'tools' ? 'You are not using any tools.' : 'You are not wearing or wielding anything.');
    return null;
}

async function reportWallet(): Promise<void> {
    const purse = heroGoldAmount(game), stashed = hiddenGold(game, false);
    if (game.flags.verbose !== false) {
        let message = purse ? `Your wallet contains ${purse} ${currency(purse)}` : 'Your wallet is empty';
        if (stashed) message += `, ${purse ? 'and' : 'but'} you have ${stashed} ${
            purse ? 'more' : currency(stashed)} stashed away in your pack`;
        await pline(`${message}.`);
    } else {
        const total = purse + stashed;
        await pline(total ? `You are carrying a total of ${total} ${currency(total)}.` : 'You have no money.');
    }
    await reportShopFinances();
}

async function describeCarriedObject(object: GameObject): Promise<void> {
    if (game.flags.fixinv === false) reassignInventoryLetters();
    observeObjectForNaming(object);
    await pline(`${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}

function toolBeingUsed(object: GameObject): boolean {
    return !!((object.owornmask ?? 0) & (W_TOOL | W_SADDLE))
        || object.oclass === TOOL_CLASS && (object === game.uwep || !!object.lamplit
            || object.otyp === LEASH && !!object.leashmon);
}

function isInUse(object: GameObject): boolean {
    return !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE | W_WEAPONS))
        || toolBeingUsed(object);
}

// C invent.c:dispinv_with_action().
async function reportSubset(items: readonly GameObject[] | null, inuse = true, accessoryLabel = 'Accessories')
: Promise<InventoryAction | null> {
    if (game.flags.fixinv === false) reassignInventoryLetters();
    const candidates = items ?? game.inventory.filter(isInUse);
    const queued = takeQueuedInventoryChoice(items ? items.map(object => object.invlet).join('') : null);
    if (queued !== undefined) {
        if (queued === 0 || queued === 27) return null;
        const selected = game.inventory.find(object => object.invlet === String.fromCharCode(queued));
        return selected ? inventoryActionForObject(selected) : null;
    }
    let key: number;
    if (items?.length === 1 && !game.iflags.menu_requested) {
        const first = items[0];
        if (first) await describeCarriedObject(first);
        return null;
    }
    if (!inuse) {
        const forceMenu = game.flags.force_invmenu;
        game.flags.force_invmenu = false;
        try {
            key = (await selectInventoryObject({ letters: candidates.map(object => object.invlet).join('') })).key;
        } finally {
            if (forceMenu === undefined) delete game.flags.force_invmenu;
            else game.flags.force_invmenu = forceMenu;
        }
    } else {
        const ordered = sortObjects(candidates, { mode: SORTLOOT_INUSE });
        // invent.c:display_pickinv() classifies entries only when sortloot()
        // actually runs its comparison, so a lone in-use entry keeps
        // orderclass 0 and is listed without any class heading.  The bare
        // hands entry makes the sorted list big enough to classify.
        const headed = ordered.length >= 2 || (!items && !game.uwep);
        const sections: InventorySection[] = [{ heading: null, items: [{ text: 'Inventory in use', attr: 1 }] }];
        const rows: { object: GameObject | null; heading: string | null }[] = ordered.map(object => ({
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
            }) : `${game.uarmg ? 'gloved' : 'bare'} ${makePlural(heroHandName(game))} (no weapon)`;
            const item = { key: object?.invlet ?? '-', text };
            const last = sections.at(-1);
            if (last?.heading === row.heading) sections[sections.length - 1] = { ...last, items: [...last.items, item] };
            else sections.push({ heading: row.heading, items: [item] });
        }
        key = (await showInventoryWindow(sections, { pickMode: PICK_ONE })).key;
    }
    const selected = candidates.find(object => object.invlet === String.fromCharCode(key));
    return selected ? inventoryActionForObject(selected) : null;
}

function inUseHeading(object: GameObject, accessoryLabel: string): string {
    const mask = object.owornmask ?? 0;
    if (mask & W_ACCESSORY) return accessoryLabel;
    if (mask & W_WEAPONS) return 'Wielded/Readied Weapons';
    if (mask & W_ARMOR) return 'Worn Armor';
    return 'Miscellaneous';
}

function beatitude(object: GameObject): Buc {
    if (object.oclass === COIN_CLASS) return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}

// C invent.c:find_unpaid() and count_unpaid(): the recursive unpaid walk
// over carried objects and container contents.
function unpaidObjects(objects: readonly GameObject[]): GameObject[] {
    return objects.flatMap(object => [...(object.unpaid ? [object] : []), ...unpaidObjects(object.contents ?? [])]);
}

// C invent.c:dotypeinv(): the 'I' type filter. ckvalidcat() and ckunpaid()
// are the category filters, tally_BUCX() the beatitude statuses,
// wearing_armor() the armor-class admission, and this_type_only() the
// single-class selection — all inlined below.
// C pickup.c:count_justpicked()/find_justpicked(): the marked stacks
// of the previous pickup feed the 'P' selection.
async function typeInventory(): Promise<InventoryAction | null> {
    const bill = usedUpBill();
    if (!game.inventory.length && !bill.length) {
        await pline("You aren't carrying anything.");
        return null;
    }
    if (game.urole?.key === 'priest')
        for (const object of game.inventory) object.bknown = object.oclass !== COIN_CLASS;
    const level = requireGameLevel();
    const carried = unpaidObjects(game.inventory);
    const floor = unpaidObjects(level.objects.flatMap(column =>
        (column ?? []).flatMap(pile => pile ?? [])));
    const buried = unpaidObjects(level.buriedObjects ?? []);
    const statuses = new Set(game.inventory.map(beatitude));
    const picked = game.inventory.filter(object => object.pickup_prev);
    const classes = [...new Set(game.inventory.map(object => object.oclass))];
    const extra = `${carried.length + floor.length + buried.length ? 'u' : ''}${bill.length ? 'x' : ''}${
        [...'BUCX'].filter(status => statuses.has(bucChoice(status))).join('')}${picked.length ? 'P' : ''}`;
    const prompt = 'What type of object do you want an inventory of?';
    let choice: string | number | null;
    const style = game.flags.menu_style ?? MENU_FULL;
    if (style === MENU_FULL || style === MENU_PARTIAL) {
        const menuClasses = [...inventoryClassOrder(), VENOM_CLASS].filter(oclass => classes.includes(oclass));
        choice = await inventoryCategoryMenu(menuClasses, carried.length > 0, bill.length > 0, statuses, picked, prompt);
    } else {
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
    if (choice === null) return null;
    if (choice === 'x' || choice === 'X' && bill.length && !statuses.has('X')) {
        if (bill.length) await showBill(bill);
        else await pline(`No used-up objects${carried.length + floor.length + buried.length ? ' on your shopping bill' : ''}.`);
        return null;
    }
    if (choice === 'u' || choice === 'U' && carried.length + floor.length + buried.length > 0 && !statuses.has('U')) {
        if (carried.length + floor.length + buried.length) await showUnpaid(carried, floor.length, buried.length);
        else await pline('You are not carrying any unpaid objects.');
        return null;
    }
    const status = typeof choice === 'string' && 'BUCXP'.includes(choice) ? choice : null;
    const oclass = typeof choice === 'number' ? choice : OBJECT_CLASS_SYMBOLS.indexOf(choice);
    const candidates = game.inventory.filter(object => status === 'P' ? object.pickup_prev
        : status ? beatitude(object) === status : object.oclass === oclass);
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
    const sections: PageLocalMultiSelectSection<GameObject>[] = [];
    for (const oclass of order) {
        const objects = sorted.filter(object => object.oclass === oclass);
        if (!objects.length) continue;
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

function bucChoice(choice: string): Buc {
    switch (choice) { case 'B': case 'U': case 'C': case 'X': return choice;
    default: throw new Error(`Unknown inventory status ${choice}`); }
}

async function inventoryCategoryMenu(classes: readonly number[], unpaid: boolean, billed: boolean,
    statuses: ReadonlySet<Buc>, picked: readonly GameObject[], prompt: string): Promise<string | number | null> {
    if (!game.inventory.length) return null;
    if (classes.length === 1 && !unpaid && !billed && statuses.size <= 1) return classes[0] ?? null;
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
            text: key === 'X' ? 'Items of unknown Bless/Curse status' : `Items known to be ${
                key === 'B' ? 'Blessed' : key === 'C' ? 'Cursed' : 'Uncursed'}` })),
        ...(picked.length ? [{ key: 'P', text: justPickedText }] : []),
    ];
    const separator: MenuLabel = { selectable: false, text: '' };
    const selected = await showMultiSelectWindow<string | number>({ title: prompt, pickOne: true,
        omitHeadings: true, sections: [{ items: [...entries,
            ...(extras.length ? [separator] : []),
            ...extras.map(entry => ({ ...entry, value: entry.key })),
        ] }],
    });
    return selected[0] ?? null;
}

// C invent.c:dounpaid(): list unpaid inventory (and floor/buried) items
// with prices, from 'I u' or the unpaid inventory menu.
async function showUnpaid(carried: readonly GameObject[], floor: number, buried: number): Promise<void> {
    const extra = floor + buried;
    const first = carried[0];
    if (first && carried.length === 1 && !extra && !unknownContainer(first)) {
        await pline(await pricedInventoryLine(first, first.where === 'inventory' ? first.invlet ?? '#' : '>', await unpaidObjectCost(first)));
        return;
    }
    if (game.flags.fixinv === false) reassignInventoryLetters();
    const lines: string[] = [];
    let total = 0;
    const top = game.inventory.filter(object => object.unpaid);
    for (const oclass of game.flags.sortpack === false ? [null] : inventoryClassOrder()) {
        const objects = top.filter(object => oclass === null || object.oclass === oclass);
        if (objects.length && oclass !== null) lines.push(`Unpaid ${objectClassHeading(oclass)}`);
        for (const object of objects) {
            const price = await unpaidObjectCost(object);
            total += price;
            lines.push(await pricedInventoryLine(object, object.invlet ?? '#', price));
        }
    }
    if (carried.length > top.length) {
        if (game.flags.sortpack !== false) lines.push('Unpaid Bagged/Boxed items');
        for (const container of game.inventory) {
            const contents = unpaidObjects(container.contents ?? []);
            if (!container.contents?.length) continue;
            let price = 0;
            for (const object of contents) {
                const cost = await unpaidObjectCost(object);
                price += cost;
                total += cost;
                if (container.cknown) lines.push(await pricedInventoryLine(object, '>', cost));
            }
            if (!container.cknown)
                lines.push(await pricedInventoryLine(null, '>', price, `${possessiveName(objectName(container))} contents`));
        }
    }
    if (carried.length) lines.push('', await pricedInventoryLine(null, '*', total, 'Total:'));
    if (extra) {
        const verb = extra > 1 ? 'are' : 'is';
        const where = !buried ? 'on the floor' : !floor ? 'under the floor' : 'on or under the floor';
        if (!carried.length) await pline(`You aren't carrying any unpaid items but there ${verb} ${extra} ${where}.`);
        else lines.push('', `(There ${verb} ${extra} more unpaid object${extra === 1 ? '' : 's'} ${where}.)`);
    }
    // C invent.c:3703 fills the unpaid-items window with putstr().
    if (carried.length) await showTextMenuOverlay(lines, { viaPutstr: true });
}

function unknownContainer(object: GameObject): boolean {
    let container = object.container;
    while (container) {
        if (!container.cknown) return true;
        container = container.container;
    }
    return false;
}

export async function pricedInventoryLine(object: GameObject | null, letter: string, price: number,
    text: string | null = null, { quantity = 0, useInvlet = true, distant = true }:
    { quantity?: number; useInvlet?: boolean; distant?: boolean } = {}): Promise<string> {
    const suppress = game.iflags.suppress_price;
    game.iflags.suppress_price = true;
    const saved = object?.quan;
    try {
        if (object) {
            if (quantity) object.quan = quantity;
            if (distant) text ??= await distantObjectName(object, inventoryItemDescription);
            else {
                observeObjectForNaming(object);
                text ??= await inventoryItemDescription(object);
            }
            if (useInvlet && game.flags.fixinv !== false && letter !== '>') letter = object.invlet ?? letter;
        }
        const tab = game.iflags.menu_tab_sep;
        if (!price && letter !== '*') return `${letter} - ${text}${useInvlet ? '.' : ''}`;
        return `${letter} - ${tab ? text : (text ?? '').padEnd(45)}${tab ? '\t' : ' '}${String(price).padStart(6)} ${currency(price)}`;
    } finally {
        if (object && saved !== undefined) object.quan = saved;
        if (suppress === undefined) delete game.iflags.suppress_price;
        else game.iflags.suppress_price = suppress;
    }
}

// Looking at floor objects and displaying their prices and pile windows.
// C invent.c:look_here(), pickup.c:check_here(), and objnam.c.
export interface FeatureOptions { state?: GameState; probing?: boolean }

// C invent.c:dfeature_at(): name the dungeon feature on a square, if any.
export function dungeonFeatureAt(x: number, y: number, { state = game, probing = false }: FeatureOptions = {}): string | null {
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ;
    if (type === DOOR) {
        if (findDrawbridgeAt(x, y, state)) return 'open drawbridge portcullis';
        return location.doormask === D_NODOOR ? 'doorway'
            : location.doormask === D_ISOPEN ? 'open door'
                : location.doormask === D_BROKEN ? 'broken door' : 'closed door';
    }
    if (type === FOUNTAIN) return 'fountain';
    if (type === THRONE) return 'opulent throne';
    if (isLavaAt(x, y, state)) return 'molten lava';
    const surface = type === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : type;
    if (surface === ICE) return iceDescriptionAt(x, y, { state, probing });
    if (isPoolAt(x, y, state)) return 'pool of water';
    if (type === SINK) return 'sink';
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
    if (type === DRAWBRIDGE_DOWN) return 'lowered drawbridge';
    if (type === DBWALL) return 'raised drawbridge';
    if (type === GRAVE) return 'grave';
    if (type === TREE) return 'tree';
    if (type === IRONBARS) return 'set of iron bars';
    return null;
}

export function dungeonFeatureSentenceAt(x: number, y: number): string {
    return dungeonFeatureSentence(dungeonFeatureAt(x, y));
}

export function dungeonFeatureSentence(feature: string | null): string {
    if (!feature || feature === 'pool of water' && (game.underwater || game.u.uinwater))
        return '';
    const noArticle = feature === 'molten lava' || feature === 'ice'
        || feature.startsWith('frozen ') || feature.slice(feature.indexOf(' ')) === ' ice';
    return `There is ${noArticle ? feature : withIndefiniteArticle(feature)} here.`;
}

export async function readFloorEngraving(x: number, y: number): Promise<void> {
    const read = await readEngravingAt(x, y, plineWithContinuation);
    // engrave.c:read_engr_at() only calls nomul(0) for a real run
    // (context.run > 0); a counted walk keeps moving past the engraving.
    if (read && (game.context.run ?? 0) > 0) nomul(0);
}

// C invent.c:look_here() outside an engulfer. A positive objectCount is
// autopickup's count, which summarizes a pile at pile_limit; skipFeature
// means describe_decor() already showed the terrain.
export async function lookHere(
    objectCount = 0, { pickedSome = false, skipFeature = false } = {},
): Promise<{ died: boolean; tookTime: boolean }> {
    const { ux: x, uy: y } = game.u;
    const level = requireGameLevel();
    const blind = heroIsBlind();
    const limit = configuredPileLimit();
    const skipObjects = limit > 0 && objectCount >= limit;
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!skipObjects) {
        const region = visibleRegionAt(game, x, y);
        const features: string[] = [];
        if (region) features.push(`a ${region.damage ? 'poison gas' : 'vapor'} cloud`);
        if (trap?.tseen) features.push(withIndefiniteArticle(trapName(trap.ttyp)));
        if (features.length) await plineWithContinuation(`There is ${features.join(' and ')} here.`);
    }
    const underwater = !!(game.underwater || game.u.uinwater);
    let featureName = dungeonFeatureAt(x, y);
    if (featureName === 'pool of water' && underwater) featureName = null;
    let hideFeature = skipFeature;
    if (blind) {
        const drift = Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz);
        const surface = surfaceName(x, y);
        if (featureName?.startsWith('altar ')) {
            await plineWithContinuation('You try to feel what is here.');
        } else if (isIceAt(x, y)) {
            if (!game.flags.mention_decor || game._prevDecorType === ICE) await forceDescribeDecor();
            await plineWithContinuation('You try to feel what is on it.');
            hideFeature = true;
        } else {
            const where = drift ? 'floating here' : heroCanReachFloor(game, { checkPit: true })
                ? `lying here on the ${surface}` : 'lying beneath you';
            await plineWithContinuation(`You try to feel what is ${where}.`);
            if (!drift && featureName === surface) hideFeature = true;
        }
        if (!heroCanReachFloor(game, { checkPit: !!trap && is_pit(trap.ttyp) })) {
            await plineWithContinuation("But you can't reach it!");
            return { died: false, tookTime: false };
        }
    }
    const feature = hideFeature ? '' : dungeonFeatureSentence(featureName);
    const objects = isLavaAt(x, y) || (isPoolAt(x, y) && !underwater) ? [] : level.objects[x]?.[y] ?? [];
    if (!objects.length) {
        if (feature) await plineWithContinuation(feature);
        await readFloorEngraving(x, y);
        if (!skipObjects && (blind || !featureName))
            await plineWithContinuation(`You ${blind ? 'feel' : 'see'} no objects here.`);
        return { died: false, tookTime: blind };
    }
    const { died } = await showFloorPile(objects, pickedSome, feature, { objectCount });
    return { died, tookTime: blind };
}

function configuredPileLimit(): number {
    const configured = Number(game.flags?.pile_limit ?? 5);
    return Number.isFinite(configured) && configured >= 0 ? Math.trunc(configured) : 5;
}

// The object part of look_here(). objectCount at or above pile_limit only
// summarizes the pile.
export async function showFloorPile(
    objects: readonly GameObject[], pickedSome = false, featureDescription = '', { objectCount = 0 } = {},
) {
    const first = objects[0];
    if (!first) return { died: false };
    const pileLimit = configuredPileLimit();
    if (pileLimit > 0 && objectCount >= pileLimit) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        if (objectCount === 1 && objectQuantity(first) === 1) {
            await plineWithContinuation(
                `There is ${pickedSome ? 'another' : 'an'} object here.`,
            );
        } else {
            const quantity = objectCount === 2 ? 'two'
                : objectCount < 5 ? 'a few'
                    : objectCount < 10 ? 'several' : 'many';
            await plineWithContinuation(
                `There are ${quantity}${pickedSome ? ' more' : ''} objects here.`,
            );
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
        if (featureDescription) await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        observeObjectForNaming(first);
        await plineWithContinuation(
            `You ${heroIsBlind() ? 'feel' : 'see'} here ${
                await pricedFloorObjectDescription(first)}.`,
        );
        game._lastPlineKind = PLNMSG_ONE_ITEM_HERE;
        return await feelPetrifyingCorpse(first);
    }
    // C invent.c:look_here(): "display_nhwindow(WIN_MESSAGE, FALSE);"
    // acknowledges prose here. Arrival's pickup.c:check_here() owns
    // "flush_screen(1);" before "(void) look_here(ct, lhflags);".
    // Explicit inspection leaves pending map glyphs buffered.
    const unreadMessage = !!game._pending_message;
    await flushPendingTopline();
    if (unreadMessage) clearMessageWindow();
    const display = requireGameDisplay();
    const pileLocation = heroIsBlind() ? 'you feel here' : 'are here';
    const descriptions: string[] = [];
    let touchedCorpse: GameObject | null = null;
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
    if (windowOrigin(display.cols, display.rows, widest + 1, content.length,
        game.flags.menu_overlay !== false) === 0) {
        await showDisclosureOverlay(content);
    } else {
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
    if (!result.died) await readFloorEngraving(game.u.ux, game.u.uy);
    return result;
}

// tty corner placement for a short pile window. Only a menu-dismissal key
// destroys it and returns that input boundary to the command loop.
async function showFloorPileCorner(display: GameDisplay, lines: readonly string[]): Promise<number> {
    // Tty menus leave one blank column after the widest line and align the
    // window to the right.
    const left = Math.max(0, Math.min(41,
        display.cols - Math.max(...lines.map(line => line.length)) - 1));
    for (const [row, line] of lines.entries()) {
        for (let col = Math.max(0, left - 1); col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < line.length; col++)
            display.setCell(left + col, row, line.charAt(col), NO_COLOR, 0);
    }
    display.setCursor(left + 8, lines.length - 1);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return left;
}

export async function pricedFloorObjectDescription(object: GameObject): Promise<string> {
    return await objectDescription(object, { withPrice: true });
}

export async function floorObjectDescription(object: GameObject): Promise<string> {
    return await objectDescription(object);
}

export function inventoryCommandLetter(item: GameObject): string {
    if (item.invlet === null || item.invlet === undefined)
        throw new TypeError(`Carried object ${item.o_id} has no inventory letter`);
    return item.invlet;
}

// C ref: invent.c:adjust_split(). The split remains linked beside its
// original until the destination is chosen; cancelling merges it back.
export async function adjustSplit(): Promise<void> {
    game.context.move = 0;
    const object = await chooseInventoryObject('split', candidate =>
        candidate.oclass === COIN_CLASS ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST);
    if (!object || object.quan < 2 || object.oclass === COIN_CLASS) {
        commandResultFailed(); // invent.c:adjust_split() ECMD_FAIL.
        return;
    }
    let amount: number | null;
    if (object.quan === 2) {
        amount = 1;
    } else {
        // C adjust_split(): "get first digit; doesn't wait for <return>".
        await flushPendingTopline();
        const dig = await ynSingleKey('Split off how many? ');
        if (dig < 48 || dig > 57) {
            amount = null;
        } else {
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
    if (!split) throw new Error('An admitted inventory stack could not be split');
    await doadjust(split, object);
}

// C ref: invent.c:doorganize()/doorganize_core().
// C invent.c:adjust_ok()/adjust_gold_ok(): the getobj filters that make
// every lettered object selectable (gold only after confirmation).
export async function doadjust(selected: GameObject | null = null, splitting: GameObject | null = null) {
    const inventory = (game.inventory || [])
        .filter((object: GameObject): object is GameObject & { invlet: string } =>
                typeof object.invlet === 'string' && object.invlet.length > 0)
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
    if (!selected && game.flags.fixinv === false) reassignInventoryLetters();
    const repairGold = !selected && await checkInventoryGold('adjust');
    let object = selected || await chooseInventoryObject('adjust', candidate =>
        candidate.oclass === COIN_CLASS && !repairGold ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST,
        { forcePrompt: true, allowCount: true });
    if (!object) {
        // invent.c:doorganize_core() returns ECMD_CANCEL when getobj() is
        // dismissed; the rhack seam clears both command queues.
        game.context.move = 0;
        commandResultCancelled();
        return;
    }
    if (!splitting) {
        const previous = game.inventory[game.inventory.indexOf(object) - 1];
        if (previous && previous.invlet === object.invlet) splitting = previous;
    }
    const source = object.invlet;
    if (!source) throw new Error('Adjusting inventory requires a lettered object.');
    // C doorganize_core() chooses '$' itself when repairing gold. A purse
    // already in '$' collects other stacks; one elsewhere merges into '$'.
    if (object.oclass === COIN_CLASS) {
        const collect = object.invlet === '$';
        let purse = object;
        let action = collect ? 'Collecting' : 'Moving';
        for (const candidate of inventory) {
            if (candidate === purse || candidate === object) continue;
            if (!collect && candidate.invlet !== '$') continue;
            const candidateName = candidate.oextra?.oname ?? candidate.oname;
            const purseName = purse.oextra?.oname ?? purse.oname;
            const merged = (!candidateName || candidateName === purseName)
                ? await mergeObjectStacks(candidate, purse) : null;
            if (merged) {
                purse = merged;
                if (collect) continue;
                action = 'Merging';
            } else if (!collect) {
                candidate.invlet = source;
                action = 'Swapping';
            }
            if (!collect) break;
        }
        purse.invlet = '$';
        game.inventory.sort((a, b) => inventoryLetterRank(a) - inventoryLetterRank(b));
        if (game.flags.fixinv === false) reassignInventoryLetters();
        observeObjectForNaming(purse);
        await pline(`${action}: $ - ${await inventoryItemDescription(purse)}.`);
        game.context.move = 0;
        return;
    }
    const adjusting = object;
    const occupied = new Set(
        inventory.filter(candidate => candidate !== adjusting && !mergable(candidate, adjusting))
            .map(candidate => candidate.invlet),
    );
    const slots = game.flags.fixinv === false
        ? game.inventory.filter(item => item.oclass !== COIN_CLASS).length + (splitting ? 0 : 1) : 52;
    const recommended = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, slots)
        .split('')
        .filter(letter => letter === adjusting.invlet || !occupied.has(letter))
        .join('') + (occupied.has('#') ? '#' : '');
    const destinationPrompt = `${splitting ? `Split ${object.quan}` : 'Adjust letter'} to what [${
        compactInventoryLetters(recommended)}] (? see used letters)?`;
    // The source item's queued letter bypasses getobj's prompt, but the
    // destination uses tty_yn_function(), which acknowledges unread prose.
    await flushPendingTopline();
    let destination = '';
    for (let attempt = 1; ; attempt++) {
        let key = (await yn_function(destinationPrompt, null, '', true)).answer.charCodeAt(0);
        if (key === 63 || key === 42) {
            key = await selectUsedInventoryLetter(splitting ? source : null);
            if (!key) continue;
        }
        destination = String.fromCharCode(key);
        // C strchr(quitchars, let) also matches a literal fuzzer NUL.
        if ([0, 27, 32, 10, 13].includes(key) || splitting && destination === source) {
            if (splitting) await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        if (destination === '$') {
            if (splitting) await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline("Only gold coins may be moved into the '$' slot.");
            game.context.move = 0;
            return;
        }
        if (/^[a-zA-Z]$/.test(destination) || destination === '#' && occupied.has('#')) break;
        if (attempt === 5) {
            if (splitting) await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        await plineWithContinuation('Select an inventory slot letter.');
        await flushPendingTopline();
    }

    let action = splitting ? 'Splitting:' : destination === source ? 'Collecting:' : 'Moving:';
    let bumped: GameObject | null = null;
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
        if (candidate.invlet !== destination) continue;
        const merged = permitsName ? await mergeObjectStacks(candidate, object) : null;
        if (merged) {
            object = merged;
            unlinkObject(object, game);
            action = 'Merging:';
        } else if (!splitting) {
            candidate.invlet = source;
            action = 'Swapping:';
        } else {
            // A split takes the destination's name when otherwise compatible.
            if (name && !object.oartifact) {
                if (object.oextra) delete object.oextra.oname;
                delete object.oname;
            }
            const splitMerge = await mergeObjectStacks(candidate, object);
            if (splitMerge) {
                object = splitMerge;
                unlinkObject(object, game);
                action = 'Splitting and merging:';
            } else {
                if (name) {
                    if (object.oextra) object.oextra.oname = name;
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
    game.inventory.sort((a, b) =>
        inventoryLetterRank(a) - inventoryLetterRank(b));
    if (game.flags.fixinv === false) reassignInventoryLetters();
    game._pending_message = '';
    observeObjectForNaming(object);
    await pline(
        `${action} ${object.invlet} - ${
            await inventoryItemDescription(object, {
                primaryHandDetail: inventoryPrimaryHandDetail(object),
            })}.`,
    );
    if (bumped) await plineWithContinuation(`Moving: ${bumped.invlet} - ${await inventoryItemDescription(bumped)}.`);
    game.context.move = 0;
}

// C invent.c:consume_obj_charge(). Billing can suspend before charge removal.

export async function consumeObjectCharge(object: GameObject, {
    maybeUnpaid = true, state = game,
}: { maybeUnpaid?: boolean; state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    if (maybeUnpaid) await chargeUnpaidUsage(object, { state });
    object.spe--;
}
// C invent.c:1428-1433 delobj(): normal object deletion (if unpaid, it
// remains on the bill).
export async function delobj(object: GameObject, state: GameState = game, random = rn2): Promise<void> {
    await delobjCore(object, false, state, random);
}

// C invent.c:1435-1462 delobj_core().  `force` is the Rider-revival path.
export async function delobjCore(
    object: GameObject, force: boolean, state: GameState = game, random = rn2,
): Promise<void> {
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
    if (object.where === 'inventory') await freeInventoryObject(object, state);
    else unlinkObject(object, state);
    if (updateMap) {
        /* floor object's coordinates are always up to date */
        await maybeUnhideAt(object.ox, object.oy, state);
        await newsym(object.ox, object.oy);
    }
    await deleteObject(object, state);
}

// ---------------------------------------------------------------------------
// Inventory and loot ordering. C refs: invent.c:sortloot()/loot_classify().
// ---------------------------------------------------------------------------

export type InventoryOrderState = { flags: Pick<GameFlags, 'inv_order'> };

interface LootClassification {
    order: number;
    subclass: number;
    discovery: number;
}

type LootView = Pick<GameObject, 'otyp'> & Partial<Pick<GameObject, 'oclass' | 'dknown' | 'globby'>>;

interface LootEntry {
    object: GameObject;
    index: number;
    classification?: LootClassification;
    name?: string;
}

interface ObjectSortOptions {
    mode?: number;
    state?: GameState;
    filter?: ((object: GameObject) => boolean) | null;
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

export function inventoryClassOrder(state: InventoryOrderState = game): number[] {
    return [...(state.flags.inv_order || DEFAULT_PACK_ORDER)];
}

// C invent.c:let_to_name() names[]. Conversion from a class to a string
// for printing; this must match the object class order.
export function objectClassHeading(oclass: number): string {
    return [null, 'Illegal objects', 'Weapons', 'Armor', 'Rings', 'Amulets',
        'Tools', 'Comestibles', 'Potions', 'Scrolls', 'Spellbooks', 'Wands',
        'Coins', 'Gems/Stones', 'Boulders/Statues', 'Iron balls', 'Chains', 'Venoms'][oclass] || 'Other';
}

export const OBJECT_CLASS_LABELS: Readonly<Partial<Record<number, string>>> = {
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

export function inventoryOrderSymbols(state: InventoryOrderState = game): string {
    return inventoryClassOrder(state).map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
}

export function inventorySortMode(state: GameState = game): number {
    return ((state.flags.sortloot ?? 'l') === 'f' ? SORTLOOT_LOOT : SORTLOOT_INVLET)
        | (state.flags.sortpack !== false ? SORTLOOT_PACK : 0);
}

export function lootSortMode({ inventoryLetters = false, state = game }: {
    inventoryLetters?: boolean; state?: GameState;
} = {}): number {
    const sortloot = state.flags.sortloot ?? 'l';
    return (sortloot === 'f' || sortloot === 'l' && !inventoryLetters
        ? SORTLOOT_LOOT : inventoryLetters ? SORTLOOT_INVLET : 0)
        | (state.flags.sortpack !== false ? SORTLOOT_PACK : 0);
}

// Returns a new order without rewriting the inventory or container chain.
// Observation is the native sort boundary; name normalization uses a view.
export function sortObjects(objects: readonly GameObject[], {
    mode = 0, state = game, filter = null,
}: ObjectSortOptions = {}): GameObject[] {
    const keepPetrifying = !!(mode & SORTLOOT_PETRIFY);
    mode &= ~SORTLOOT_PETRIFY;
    const entries: LootEntry[] = objects.filter(object => !filter || filter(object)
        || keepPetrifying && object.otyp === CORPSE && touchPetrifies(object.corpsenm))
        .map((object, index) => ({ object, index }));
    if (!mode || entries.length < 2) return entries.map(entry => entry.object);
    return recorderSort(entries, (left, right) => compareLoot(left, right, mode, state))
        .map(entry => entry.object);
}

export function classifyLoot(object: LootView, state: GameState = game): LootClassification {
    const oclass = object.oclass || objectClassForType(object.otyp);
    const classOrder = state.flags.sortpack !== false ? inventoryClassOrder(state) : DEFAULT_LOOT_ORDER;
    const position = classOrder.indexOf(oclass);
    const seen = !!object.dknown;
    const discovered = objectTypeKnown(object, state);
    const description = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
    return {
        order: position >= 0 ? position + 1 : classOrder.length + 1 + Number(oclass !== VENOM_CLASS),
        subclass: lootSubclass(object, oclass, seen, discovered),
        discovery: !seen ? 1 : discovered || !description ? 4
            : state._objectCallNames?.[object.otyp] ? 3 : 2,
    };
}

function lootSubclass(object: LootView, oclass: number, seen: boolean, discovered: boolean): number {
    const skill = objectSkill(object.otyp);
    if (oclass === ARMOR_CLASS) return [7, 4, 1, 2, 3, 5, 6][skill] ?? 8;
    if (oclass === WEAPON_CLASS) return skill < 0
        ? skill >= -P_CROSSBOW && skill <= -P_BOW ? 1 : 3
        : skill >= P_BOW && skill <= P_CROSSBOW ? 2
            : [P_SPEAR, P_DAGGER, P_KNIFE].includes(skill) ? 4
                : isPolearm(object) ? 6 : 5;
    if (oclass === TOOL_CLASS) {
        if (seen && discovered && [BAG_OF_TRICKS, HORN_OF_PLENTY].includes(object.otyp)) return 2;
        if (isContainer(object) || object.otyp === BAG_OF_TRICKS) return 1;
        return INSTRUMENTS.has(object.otyp) ? 3 : 4;
    }
    if (oclass === FOOD_CLASS) {
        if (object.otyp === SLIME_MOLD) return 1;
        if (object.otyp === TIN) return 3;
        if (object.otyp === EGG) return 4;
        if (object.otyp === CORPSE) return 5;
        return object.globby ? 6 : 2;
    }
    if (oclass === GEM_CLASS) {
        const material = objectMaterial(object.otyp);
        if (material === 20 || material === 19) return !seen ? 1 : !discovered ? 2 : material === 20 ? 3 : 4;
        return !seen ? 5 : object.otyp === ROCK ? 8 : !discovered ? 6 : 7;
    }
    return 1;
}

// C invent.c:sortloot_cmp(). The sort keys are computed by the renamed
// helpers below: inuse_classify() -> inUseRating, invletter_value() ->
// inventoryLetterValue, loot_xname() -> normalizedLootName.
function compareLoot(left: LootEntry, right: LootEntry, mode: number, state: GameState): number {
    const a = left.object, b = right.object;
    if (mode & SORTLOOT_INUSE)
        return inUseRating(b, state) - inUseRating(a, state) || left.index - right.index;
    if ((mode & (SORTLOOT_PACK | SORTLOOT_INVLET)) !== SORTLOOT_INVLET) {
        const aClass = classifyEntry(left, state), bClass = classifyEntry(right, state);
        const difference = aClass.order - bClass.order;
        if (difference) return difference;
        if (!(mode & SORTLOOT_INVLET)) {
            const detail = aClass.subclass - bClass.subclass || aClass.discovery - bClass.discovery;
            if (detail) return detail;
        }
    }
    if (mode & SORTLOOT_INVLET) {
        const difference = inventoryLetterValue(a.invlet) - inventoryLetterValue(b.invlet);
        if (difference) return difference;
    }
    if (!(mode & SORTLOOT_LOOT)) return left.index - right.index;
    if (left.name === undefined) {
        observeObjectForNaming(a, { state });
        left.name = normalizedLootName(a, state);
    }
    if (right.name === undefined) {
        observeObjectForNaming(b, { state });
        right.name = normalizedLootName(b, state);
    }
    if (left.name !== right.name) return left.name < right.name ? -1 : 1;
    const condition = beatitudeRating(b) - beatitudeRating(a)
        || Number(!!b.greased) - Number(!!a.greased)
        || lootErosion(a) - lootErosion(b)
        || Number(!!(b.rknown && b.oerodeproof)) - Number(!!(a.rknown && a.oerodeproof));
    if (condition) return condition;
    if (objectUsesKnown(a.otyp) && a.oclass !== FOOD_CLASS) {
        const difference = (b.known ? b.spe ?? 0 : -1000) - (a.known ? a.spe ?? 0 : -1000);
        if (difference) return difference;
    }
    return left.index - right.index;
}

function classifyEntry(entry: LootEntry, state: GameState): LootClassification {
    if (!entry.classification) {
        if (!heroIsBlind(state)) observeObject(entry.object, state);
        entry.classification = classifyLoot(entry.object, state);
    }
    return entry.classification;
}

function normalizedLootName(object: GameObject, state: GameState): string {
    const name = lootObjectName(object, state);
    if (typeof name !== 'string')
        throw new Error(`Loot object ${object.o_id} has no sortable name`);
    return name.replace(/[A-Z]/g, letter => letter.toLowerCase());
}

function beatitudeRating(object: GameObject): number {
    return object.bknown ? object.blessed ? 3 : object.cursed ? 1 : 2 : 0;
}

// obj.h aliases these conditions to the fields read by greatest_erosion().
function lootErosion(object: GameObject): number {
    return Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0,
        Number(!!object.orotten), Number(!!object.odiluted), Number(!!object.norevive));
}

function inventoryLetterValue(letter: string | null | undefined): number {
    if (!letter) return 55;
    if (letter >= 'a' && letter <= 'z') return letter.charCodeAt(0) - 95;
    if (letter >= 'A' && letter <= 'Z') return letter.charCodeAt(0) - 37;
    return letter === '$' ? 1 : letter === '#' ? 54 : 55;
}

function inUseRating(object: GameObject, state: GameState): number {
    const mask = (object.owornmask ?? 0) & (W_ACCESSORY | W_WEAPONS | W_ARMOR);
    if (!mask && object.otyp === LEASH && object.leashmon) return 1;
    if (!mask && object.oclass === TOOL_CLASS && object.lamplit) return 2;
    const mainHandRing = state.u.rightHanded === false ? W_RINGL : W_RINGR;
    const ratings = [W_ARMU, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMC, W_ARM,
        W_QUIVER, W_SWAPWEP, W_WEP, W_TOOL,
        mainHandRing === W_RINGR ? W_RINGL : W_RINGR, mainHandRing, W_AMUL];
    const index = ratings.findIndex(slot => mask & slot);
    return index >= 0 ? index + 3 : 0;
}

// ---------------------------------------------------------------------------
// Ordinary stack compatibility and merging. C refs: invent.c:mergable(),
// merged(), same_price().
// ---------------------------------------------------------------------------

function objectMergeName(object: GameObject | null | undefined): string {
    return object?.oextra?.oname ?? object?.oname ?? '';
}

function hasAttachment(object: GameObject): boolean {
    return !!(
        object?.oextra?.omid || object?.oextra?.omonst
    );
}

// C same_price(): each search follows next_shkp(TRUE), with its riling
// side effects, and prefers the first keeper for the second object.
function billedStackOwner(
    object: GameObject, state: GameState,
): ReturnType<typeof billForObject> {
    for (const keeper of visitBilledShopkeepers(state)) {
        const billed = billForObject(object, state, keeper);
        if (billed) return billed;
    }
    return null;
}

function sameBillPrice(first: GameObject, second: GameObject, state: GameState): boolean {
    const firstBill = billedStackOwner(first, state);
    const secondBill = (firstBill
        && billForObject(second, state, firstBill.resident))
        || billedStackOwner(second, state);
    return !!firstBill && !!secondBill
        && firstBill.resident === secondBill.resident
        && firstBill.entry.price === secondBill.entry.price;
}

export function mergable(
    otmp: GameObject | null | undefined, obj: GameObject | null | undefined,
    state: GameState = game,
): boolean {
    if (!otmp || !obj || otmp === obj || otmp.otyp !== obj.otyp
        || otmp.nomerge || obj.nomerge || !objectMerge(obj.otyp)) {
        return false;
    }
    if (obj.oclass === COIN_CLASS) return true;
    if (!!otmp.cursed !== !!obj.cursed
        || !!otmp.blessed !== !!obj.blessed) return false;

    const otmpLost = otmp.how_lost ?? 0;
    const objLost = obj.how_lost ?? 0;
    if (otmpLost === 4 || objLost === 4
        || (otmpLost !== 0 && otmpLost !== objLost)) return false;
    if (obj.globby || otmp.globby) return !!obj.globby && !!otmp.globby;

    // C obj.h stores opoisoned in otrapped, odiluted in oeroded and norevive
    // in oeroded2, so native mergable()'s tests of those fields also keep
    // poisoned weapons, diluted potions and frozen corpses in their own stacks.
    for (const field of [
        'unpaid', 'no_charge', 'obroken', 'otrapped', 'opoisoned', 'lamplit',
        'odiluted', 'norevive',
    ] as const) {
        if (!!otmp[field] !== !!obj[field]) return false;
    }
    if ((otmp.spe ?? 0) !== (obj.spe ?? 0)) return false;
    if (obj.oclass === FOOD_CLASS
        && ((otmp.oeaten ?? 0) !== (obj.oeaten ?? 0)
            || !!otmp.orotten !== !!obj.orotten)) return false;

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
        || !!otmp.rknown !== !!obj.rknown && impairedSight)) return false;

    if ([CORPSE, EGG, TIN].includes(obj.otyp)
        && (otmp.corpsenm ?? -1) !== (obj.corpsenm ?? -1)) return false;
    if (obj.otyp === EGG && (otmp.timed || obj.timed)) return false;
    if (obj.otyp === CORPSE && isReviver(otmp.corpsenm)) return false;
    if ((obj.otyp === TALLOW_CANDLE || obj.otyp === WAX_CANDLE)
        && Math.trunc((otmp.age ?? 0) / 25)
            !== Math.trunc((obj.age ?? 0) / 25)) return false;
    if (obj.otyp === POT_OIL && obj.lamplit) return false;
    // C: don't merge surcharged/differently priced unpaid stacks.
    if (obj.unpaid && !sameBillPrice(obj, otmp, state)) return false;
    if (hasAttachment(otmp) || hasAttachment(obj)) return false;

    const otmpName = objectMergeName(otmp);
    const objName = objectMergeName(obj);
    if ((otmpName && objName && otmpName !== objName)
        || (obj.otyp === CORPSE && !!otmpName !== !!objName)) return false;
    // C keeps the two stamped-mail flavors (bones/wished vs hand-written)
    // apart unless the stack ids share a parity.
    if (obj.otyp === SCR_MAIL && (obj.spe ?? 0) > 0
        && (obj.o_id % 2) !== (otmp.o_id % 2)) return false;
    if ((otmp.oartifact ?? 0) !== (obj.oartifact ?? 0)) return false;
    if (!!otmp.known !== !!obj.known && impairedSight) return false;
    return true;
}

function comparisonDiscovers(
    survivor: GameObject, incoming: GameObject, state: GameState,
): boolean {
    return !!survivor.known !== !!incoming.known
        || (!!survivor.rknown !== !!incoming.rknown && !!survivor.oerodeproof)
        || ((survivor.oclass === COIN_CLASS ? false : !!survivor.bknown)
            !== !!incoming.bknown && state.urole?.key !== 'priest');
}

function comparisonNeedsMessage(
    survivor: GameObject, incoming: GameObject, state: GameState,
): boolean {
    return survivor.where === 'inventory'
        && incoming.how_lost !== LOST_THROWN && survivor.how_lost !== LOST_THROWN
        && comparisonDiscovers(survivor, incoming, state);
}

// C merged() prelude, completed before either kind of display can yield.
async function prepareStackMerge(
    survivor: GameObject, incoming: GameObject, state: GameState,
): Promise<boolean> {
    const discovered = comparisonDiscovers(survivor, incoming, state);
    if (!survivor.globby) {
        const firstQuantity = survivor.quan ?? survivor.quantity ?? 1;
        const secondQuantity = incoming.quan ?? incoming.quantity ?? 1;
        const quantity = firstQuantity + secondQuantity;
        if (!incoming.lamplit) {
            survivor.age = Math.trunc(
                (survivor.age * firstQuantity + incoming.age * secondQuantity)
                    / quantity,
            );
        }
        survivor.quan = survivor.quantity = quantity;
        survivor.owt = objectWeight(survivor);
        if (survivor.oclass === COIN_CLASS) survivor.bknown = false;
    }
    const incomingName = objectMergeName(incoming);
    if (!objectMergeName(survivor) && incomingName) {
        if (incoming.oextra?.oname) {
            survivor.oextra = { ...(survivor.oextra || {}), oname: incoming.oextra.oname };
        } else survivor.oname = incomingName;
    }
    unlinkObject(incoming, state);
    if (incoming.pickup_prev && survivor.where === 'inventory')
        survivor.pickup_prev = true;
    if (incoming.lamplit) {
        endObjectBurn(incoming, state, state.moves);
        if (objectShedsLight(survivor)) state.vision_full_recalc = 1;
    }
    if (incoming.timed) stopObjectTimers(incoming, state);
    if (!!survivor.known !== !!incoming.known) survivor.known = true;
    if (!!survivor.rknown !== !!incoming.rknown) survivor.rknown = true;
    if (!!survivor.bknown !== !!incoming.bknown) survivor.bknown = true;
    await mergeHeroWeaponSlots(survivor, incoming, state);
    if (incoming.bypass) survivor.bypass = true;
    return discovered;
}

// A creation merge has no display continuation. Reject such work before
// changing ages, quantities, timers or ownership; live callers must await it.
export async function mergeCreatedObjectStacks(
    survivor: GameObject, incoming: GameObject, state: GameState = game,
): Promise<GameObject | null> {
    assertCreatedObject(incoming, state);
    if (survivor.unpaid || billForObject(survivor, state) || incoming.owornmask)
        throw new Error('creation merge requires unbilled objects and an unworn incoming object');
    if (!mergable(survivor, incoming, state)) return null;
    if (incoming.globby || comparisonNeedsMessage(survivor, incoming, state))
        throw new Error('stack merge with display effects must be awaited');
    await prepareStackMerge(survivor, incoming, state);
    await deleteObject(incoming, state, { mergeInto: survivor });
    return survivor;
}

export async function mergeObjectStacks(
    survivor: GameObject | null | undefined, incoming: GameObject | null | undefined,
    state: GameState = game,
): Promise<GameObject | null> {
    requireLiveGame(state);
    if (!survivor || !incoming || !mergable(survivor, incoming, state)) return null;
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

// C invent.c:cinv_doname(): the probing contents menu names the box with
// "trapped" inserted before its lock state even though doname() already
// shows a just-learned trap, so a trapped box is named twice.
export async function probedContentsTitle(object: GameObject, state: GameState): Promise<string> {
    let name = await objectDescription(object, { state });
    if (!object.otrapped) return name;
    const locked = name.indexOf(' locked ');
    const unlocked = name.indexOf(' unlocked ');
    if (locked >= 0 && (unlocked < 0 || locked < unlocked))
        name = name.replace(' locked ', ' trapped locked ');
    else if (unlocked >= 0)
        name = name.replace(' unlocked ', ' trapped unlocked ');
    return name.replace('an trapped ', 'a trapped ');
}

// C invent.c:display_binventory(): objects beneath the probed surface.
export async function displayBuriedInventory(x: number, y: number, state: PlayingGameState) {
    const pile = state.level.objects[x]?.[y] || [];
    let underwhat = 'here', count = 0;
    if ((isPoolAt(x, y, state) || isLavaAt(x, y, state)) && !(state.underwater || state.u.uinwater) && pile.length) {
        const liquid = displayLiquidName(isPoolAt(x, y, state) ? 'water' : 'lava', state);
        count = pile.length;
        if (pile.length === 1) {
            const object = pile[0];
            if (!object) throw new Error('A visible one-object pile must contain its object.');
            const plural = objectNameIsPlural(object, state);
            await plineWithContinuation(`There ${plural ? 'are' : 'is'} ${await inventoryItemDescription(object)} under the ${liquid} here.`);
            underwhat = plural || armorUsesPairGrammar(OBJECT_NAMES[object.otyp] ?? '') ? 'under them' : 'beneath it';
        } else {
            await showProbedObjectInventory(pile, `Things that are under the ${liquid} here:`, { state, groupByClass: false });
            underwhat = 'beneath them';
        }
    }
    const buried = (state.level.buriedObjects || []).filter(object => object.ox === x && object.oy === y);
    for (const object of buried) observeObject(object, state);
    if (buried.length) await showProbedObjectInventory(buried, `Things that are buried ${underwhat}:`, { state });
    return count + buried.length;
}

