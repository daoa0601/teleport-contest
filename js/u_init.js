// u_init.js — Initial hero, pet, inventory, and attribute setup.
// C refs: u_init.c, attrib.c, dog.c, teleport.c, makemon.c.

import { game } from './gstate.js';
import { rn2, rnd, d } from './rng.js';
import { mkobj, mksobj } from './mklev.js';
import {
    COLNO, ROWNO, STONE, ROOM, CORR, DOOR, STAIRS,
    D_ISOPEN, D_NODOOR,
} from './const.js';
import {
    ARROW, YA, DART, DAGGER, SCALPEL, SPEAR, SHORT_SWORD, LONG_SWORD, KATANA, LANCE, MACE, CLUB, BOW, YUMI, SLING,
    HELMET, SPLINT_MAIL, RING_MAIL, LEATHER_ARMOR, LEATHER_GLOVES, ROBE, SMALL_SHIELD, HAWAIIAN_SHIRT, CLOAK_OF_DISPLACEMENT,
    SACK, LOCK_PICK, CREDIT_CARD, EXPENSIVE_CAMERA, TOWEL, SADDLE, LEASH, STETHOSCOPE, TIN_OPENER,
    MAGIC_MARKER, BLINDFOLD, OIL_LAMP,
    CRAM_RATION, FOOD_RATION, TIN, EUCALYPTUS_LEAF, APPLE, ORANGE, PEAR,
    MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, SLIME_MOLD,
    CREAM_PIE, CANDY_BAR, FORTUNE_COOKIE, PANCAKE, LEMBAS_WAFER,
    POT_HEALING, POT_EXTRA_HEALING, POT_SICKNESS, POT_WATER,
    SCR_MAGIC_MAPPING, SCR_PUNISHMENT,
    SPE_DETECT_MONSTERS, SPE_HEALING, SPE_CONFUSE_MONSTER,
    SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, SPE_PROTECTION,
    WAN_SLEEP, WAN_WISHING, GOLD_PIECE,
    FLINT, ROCK,
} from './object_data.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const GEM_CLASS = 13;
const UNDEF_BLESS = 2;
const UNDEF_TYP = -1;
const UNDEF_SPE = null;
const PM_LICHEN = 158;

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

function oneItem(typ, spe = 0) {
    return [
        { typ, spe, cls: TOOL_CLASS, min: 1, max: 1, bless: 0 },
        { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
    ];
}

const ITEM_PRESENTATION = new Map([
    [DAGGER, { class: 'Weapons', name: 'dagger', plural: 'daggers', enchanted: true }],
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
    [SLING, { class: 'Weapons', name: 'sling', plural: 'slings', enchanted: true, omitUncursed: true }],
    [SHORT_SWORD, {
        class: 'Weapons', name: 'wakizashi', plural: 'wakizashi', enchanted: true,
        omitUncursed: true,
    }],
    [LONG_SWORD, {
        class: 'Weapons', name: 'long sword', plural: 'long swords', enchanted: true,
    }],
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
    u.uexp = 0;
    u.uac = 0; // set_wear() computes this in moveloop_preamble()
    u.ualign = {
        type: g.initAlignment?.value ?? 0,
        record: g.urole?.initrecord || 0,
    };
    u.rightHanded = !!handednessRoll;
    // C initializes the hero with one ordinary action available.  Samurai
    // also gain intrinsic Fast at level 1 (attrib.c sam_abil[]).
    u.umovement = 12;
    u.fast = !!g.urole?.intrinsicFast;
    u.nv_range = 1;
    u.xray_range = -1;
    g._goldCount = 0;
    g.inventory = [];
    g.discoveries = [];
    g.spells = [];
}

// C ref: collect_coords().  Each of the first three rings is completely
// collected and shuffled before enexto_core() tests candidate positions.
function collectNearbyCoords(cx, cy, maxradius = 3) {
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
            const k = rn2(n);
            if (k) [coords[pass], coords[pass + k]] = [coords[pass + k], coords[pass]];
            pass++;
            n--;
        }
    }
    return coords;
}

function monsterGoodPos(x, y) {
    if (x === game.u?.ux && y === game.u?.uy) return false;
    if (game.level?.monsters?.some(mon => mon.mx === x && mon.my === y)) return false;
    const loc = game.level?.at(x, y);
    if (!loc || loc.typ === STONE) return false;
    if (loc.typ === ROOM || loc.typ === CORR || loc.typ === STAIRS) return true;
    return loc.typ === DOOR && !!(loc.doormask & (D_ISOPEN | D_NODOOR));
}

// C ref: dog.c makedog() and pet_type().
export function makedog() {
    const g = game;
    if (g.preferred_pet === 'n') return null;
    const role = g.urole?.key;
    if (role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk') return null;

    let pettype = role === 'knight' ? 102 : 16; // PM_PONY or PM_LITTLE_DOG
    if (role === 'tourist' || role === 'rogue' || role === 'valkyrie'
        || role === 'priest' || role === 'healer' || role === 'monk') {
        if (g.preferred_pet === 'c') pettype = 32; // PM_KITTEN
        else if (g.preferred_pet !== 'd') pettype = rn2(2) ? 32 : 16;
    }

    const candidates = collectNearbyCoords(g.u.ux, g.u.uy, 3);
    const spot = candidates.find(({ x, y }) => monsterGoodPos(x, y));
    if (!spot) return null;

    rnd(2); // next_ident()
    // adj_lev() reduces dogs and kittens to level one; a starting pony is
    // level two here and therefore rolls two hit dice.
    let hp = d(role === 'knight' ? 2 : 1, 8);
    if (role !== 'knight' && hp === 1) hp++;
    const female = !!rn2(2);
    if (role === 'tourist' || role === 'caveman' || role === 'valkyrie'
        || role === 'priest' || role === 'healer' || role === 'monk') {
        // peace_minded(); initedog() below ultimately makes the pet tame.
        rn2(role === 'healer' || role === 'monk' ? 26 : 16);
        rn2(2);
    }
    const pet = {
        mnum: pettype,
        mx: spot.x,
        my: spot.y,
        mhp: hp,
        mhpmax: hp,
        female,
        mtame: 10,
        mpeaceful: 1,
        symbol: pettype === 102 ? 'u' : pettype === 32 ? 'f' : 'd',
        name: role === 'caveman' ? 'Slasher' : role === 'ranger' ? 'Sirius'
            : role === 'samurai' ? 'Hachi' : '',
        pet: true,
    };
    if (role === 'knight') {
        pet.saddled = true;
        pet.saddle = mksobj(SADDLE, true, false);
    }
    if (!g.level.monsters) g.level.monsters = [];
    g.level.monsters.push(pet);
    g.startingPet = pet;
    return pet;
}

function trquan(trobj) {
    if (!trobj.min) return 1;
    return trobj.min + rn2(trobj.max - trobj.min + 1);
}

function inventoryItem(raw) {
    let view = ITEM_PRESENTATION.get(raw.otyp) || {
        class: 'Other', name: `object ${raw.otyp}`, plural: `objects ${raw.otyp}`,
    };
    if (game.urole?.key === 'knight'
        && (raw.otyp === LONG_SWORD || raw.otyp === LANCE)) {
        view = { ...view, omitUncursed: true };
    }
    if (raw.otyp === SHORT_SWORD && game.urole?.key === 'rogue') {
        const orcish = game.urace?.mnum === 4;
        view = {
            class: 'Weapons',
            name: orcish ? 'orcish short sword' : 'short sword',
            plural: orcish ? 'orcish short swords' : 'short swords',
            enchanted: true, omitUncursed: true,
        };
    }
    if (raw.otyp === DAGGER && game.urole?.key === 'rogue') {
        view = game.urace?.mnum === 4
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
        view = raw.corpsenm === PM_LICHEN
            ? { class: 'Comestibles', name: 'tin of lichen', plural: 'tins of lichen' }
            : raw.corpsenm === 322
                ? { class: 'Comestibles', name: 'tin of newt meat', plural: 'tins of newt meat' }
                : raw.corpsenm == null
                    ? { class: 'Comestibles', name: 'tin of spinach', plural: 'tins of spinach' }
                    : { class: 'Comestibles', name: 'tin', plural: 'tins' };
    }
    const buc = raw.blessed ? 'blessed' : raw.cursed ? 'cursed' : 'uncursed';
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

function addStartingItem(raw) {
    const item = inventoryItem(raw);
    const merge = game.inventory.find(other => other.otyp === item.otyp
        && other.enchantment === item.enchantment && other.buc === item.buc
        && other.corpsenm === item.corpsenm && other.spe === item.spe);
    if (merge) {
        merge.quantity += item.quantity;
        merge.quan = merge.quantity;
        return merge;
    }
    item.invlet = String.fromCharCode(97 + game.inventory.length);
    game.inventory.push(item);
    return item;
}

function useStartingItem(item) {
    if (item.otyp === ARROW || item.otyp === YA || item.otyp === DART
        || item.otyp === FLINT) {
        if (!game.uquiver) {
            game.uquiver = item;
            item.ready = true;
        }
    } else if (item.otyp === SPEAR || item.otyp === MACE || item.otyp === LONG_SWORD) {
        game.uwep = item;
        item.wielded = true;
    } else if (item.otyp === DAGGER || item.otyp === SCALPEL
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
    } else if (item.otyp === BOW || item.otyp === SLING || item.otyp === LANCE) {
        game.uswapwep = item;
        item.alternate = true;
    } else if (item.otyp === SHORT_SWORD || item.otyp === YUMI) {
        if (!game.uwep) {
            game.uwep = item;
            item.wielded = true;
        } else if (!game.uswapwep) {
            game.uswapwep = item;
            item.alternate = true;
        }
    } else if (item.otyp === CLOAK_OF_DISPLACEMENT || item.otyp === ROBE) {
        game.uarmc = item;
        item.worn = true;
    } else if (item.otyp === HAWAIIAN_SHIRT) {
        game.uarmu = item;
        item.worn = true;
    } else if (item.otyp === SMALL_SHIELD) {
        game.uarms = item;
        item.worn = true;
    } else if (item.otyp === HELMET) {
        game.uarmh = item;
        item.worn = true;
    } else if (item.otyp === LEATHER_GLOVES) {
        game.uarmg = item;
        item.worn = true;
    } else if (item.otyp === SPLINT_MAIL || item.otyp === RING_MAIL
        || item.otyp === LEATHER_ARMOR) {
        game.uarm = item;
        item.worn = true;
    } else if (item.oclass === SPBOOK_CLASS && item.spellName) {
        game.spells.push({
            name: item.spellName,
            level: item.spellLevel,
            category: item.spellCategory,
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
    const levelOne = new Set([372, SPE_DETECT_MONSTERS, SPE_HEALING]);
    const throughLevelThree = new Set([
        ...levelOne, 378, 382, 383, 385, 386,
    ]);
    const allowed = alreadyHasLevelOne ? throughLevelThree : levelOne;
    return allowed.has(otyp)
        && !game.inventory.some(item => item.otyp === otyp);
}

// Direct port of ini_inv() for fixed and class-generated inventory entries.
function iniInv(table) {
    let index = 0;
    let quan = trquan(table[index]);
    while (table[index].cls) {
        const trobj = table[index];
        let raw;
        if (trobj.typ === UNDEF_TYP) {
            do raw = mkobj(trobj.cls, false);
            while (game.urole?.key === 'priest' && trobj.cls === SPBOOK_CLASS
                && !priestSpellbookAllowed(raw.otyp));
        } else {
            raw = mksobj(trobj.typ, true, false);
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

export function uInitInventoryAttrs() {
    const role = game.urole?.key;
    if (role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk') return false;
    game.inventory = [];
    game.uwep = game.uswapwep = game.uquiver = null;
    game.uarm = game.uarms = game.uarmc = game.uarmu = game.uarmg = game.uarmh = null;
    game.moves = 1;
    if (role === 'caveman') {
        iniInv(CAVEMAN_INVENTORY);
        if (game.flags?.explore) {
            iniInv([
                { typ: WAN_WISHING, spe: 3, cls: WAND_CLASS, min: 1, max: 1, bless: 0 },
                { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
            ]);
        }
    } else if (role === 'rogue') {
        iniInv(ROGUE_INVENTORY);
        if (!rn2(5)) iniInv(oneItem(BLINDFOLD));
        // C ref: u_init.c u_init_role().  Orcs receive two random food-class
        // objects after the role-specific loadout (and Rogue blindfold roll).
        if (game.urace?.mnum === 4) {
            iniInv([
                { typ: UNDEF_TYP, spe: UNDEF_SPE, cls: FOOD_CLASS, min: 2, max: 2, bless: 0 },
                { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
            ]);
        }
    } else if (role === 'tourist') {
        game._goldCount = rnd(1000);
        iniInv(TOURIST_INVENTORY);
        if (!rn2(25)) iniInv(oneItem(TIN_OPENER));
        else if (!rn2(25)) iniInv(oneItem(LEASH));
        else if (!rn2(25)) iniInv(oneItem(TOWEL));
        else if (!rn2(20)) iniInv(oneItem(MAGIC_MARKER, 19));
        if (game.flags?.explore) {
            iniInv([
                { typ: WAN_WISHING, spe: 3, cls: WAND_CLASS, min: 1, max: 1, bless: 0 },
                { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
            ]);
        }
        // ini_inv(Money): its object is kept outside the lettered inventory.
        rn2(1);
        mksobj(GOLD_PIECE, true, false);
    } else if (role === 'samurai') {
        game._goldCount = 0;
        iniInv(SAMURAI_INVENTORY);
        if (!rn2(5)) iniInv(oneItem(BLINDFOLD));
        if (game.flags?.explore) {
            iniInv([
                { typ: WAN_WISHING, spe: 3, cls: WAND_CLASS, min: 1, max: 1, bless: 0 },
                { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
            ]);
        }
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
        rn2(1);
        mksobj(GOLD_PIECE, true, false);
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
    } else {
        iniInv(RANGER_INVENTORY);
    }
    initAttributes();
    game.discoveries = role === 'healer' ? [
        { class: 'Armor', name: 'pair of leather gloves', appearance: 'fencing gloves' },
        { class: 'Spellbooks', name: 'spellbook of healing', appearance: 'wrinkled' },
        { class: 'Spellbooks', name: 'spellbook of extra healing', appearance: 'dog eared' },
        { class: 'Spellbooks', name: 'spellbook of stone to flesh', appearance: 'stained' },
        { class: 'Potions', name: 'potion of full healing', appearance: 'white', preknown: true },
        { class: 'Potions', name: 'potion of healing', appearance: 'milky' },
        { class: 'Potions', name: 'potion of extra healing', appearance: 'effervescent' },
        { class: 'Wands', name: 'wand of sleep', appearance: 'platinum' },
    ] : role === 'priest' ? [
        { class: 'Armor', name: 'small shield', appearance: 'wooden shield' },
        { class: 'Spellbooks', name: 'spellbook of healing', appearance: 'purple' },
        { class: 'Spellbooks', name: 'spellbook of detect monsters', appearance: 'silver' },
        { class: 'Potions', name: 'potion of water', appearance: 'clear' },
    ] : role === 'caveman' ? [
        ...(game.flags?.explore ? [{
            class: 'Wands', name: 'wand of wishing', appearance: 'hexagonal',
        }] : []),
        { class: 'Gems/Stones', name: 'flint stone', appearance: 'gray' },
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
    game.urole.rank = game.urole.title?.[0] || game.urole.name;
    return true;
}

export function setInitialArmorClass() {
    if (game.urole?.key === 'caveman') game.u.uac = 8;
    else if (game.urole?.key === 'ranger') game.u.uac = 7;
    else if (game.urole?.key === 'rogue') game.u.uac = 7;
    else if (game.urole?.key === 'samurai') game.u.uac = 4;
    else if (game.urole?.key === 'tourist') game.u.uac = 10;
    else if (game.urole?.key === 'valkyrie') game.u.uac = 6;
    else if (game.urole?.key === 'priest') game.u.uac = 7;
    else if (game.urole?.key === 'healer') game.u.uac = 8;
    else if (game.urole?.key === 'knight') game.u.uac = 3;
    else if (game.urole?.key === 'monk') game.u.uac = 4;
}
