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
    ARROW, YA, DART, DAGGER, SHORT_SWORD, KATANA, BOW, YUMI,
    SPLINT_MAIL, HAWAIIAN_SHIRT, CLOAK_OF_DISPLACEMENT,
    CREDIT_CARD, EXPENSIVE_CAMERA, TOWEL, LEASH, TIN_OPENER, MAGIC_MARKER,
    BLINDFOLD,
    CRAM_RATION, FOOD_RATION, TIN, EUCALYPTUS_LEAF, APPLE, ORANGE, PEAR,
    MELON, BANANA, CARROT, SPRIG_OF_WOLFSBANE, CLOVE_OF_GARLIC, SLIME_MOLD,
    CREAM_PIE, CANDY_BAR, FORTUNE_COOKIE, PANCAKE, LEMBAS_WAFER,
    POT_EXTRA_HEALING, SCR_MAGIC_MAPPING, WAN_WISHING, GOLD_PIECE,
} from './object_data.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const WAND_CLASS = 11;
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

const SAMURAI_INVENTORY = [
    { typ: KATANA, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: SHORT_SWORD, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: YUMI, spe: 0, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: YA, spe: 0, cls: WEAPON_CLASS, min: 26, max: 45, bless: UNDEF_BLESS },
    { typ: SPLINT_MAIL, spe: 0, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
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
    [BOW, { class: 'Weapons', name: 'bow', plural: 'bows', enchanted: true }],
    [ARROW, { class: 'Weapons', name: 'arrow', plural: 'arrows', enchanted: true }],
    [DART, {
        class: 'Weapons', name: 'dart', plural: 'darts', enchanted: true, omitUncursed: true,
    }],
    [KATANA, {
        class: 'Weapons', name: 'katana', plural: 'katanas', enchanted: true,
        omitUncursed: true,
    }],
    [SHORT_SWORD, {
        class: 'Weapons', name: 'wakizashi', plural: 'wakizashi', enchanted: true,
        omitUncursed: true,
    }],
    [YUMI, { class: 'Weapons', name: 'yumi', plural: 'yumi', enchanted: true }],
    [YA, {
        class: 'Weapons', name: 'ya', plural: 'ya', enchanted: true, omitUncursed: true,
    }],
    [SPLINT_MAIL, {
        class: 'Armor', name: 'splint mail', plural: 'splint mails', enchanted: true,
        rustproof: true,
    }],
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
    [SCR_MAGIC_MAPPING, {
        class: 'Scrolls', name: 'scroll of magic mapping', plural: 'scrolls of magic mapping',
    }],
    [EXPENSIVE_CAMERA, {
        class: 'Tools', name: 'expensive camera', plural: 'expensive cameras',
        charged: true, showBuc: false,
    }],
    [CREDIT_CARD, { class: 'Tools', name: 'credit card', plural: 'credit cards' }],
    [TIN_OPENER, { class: 'Tools', name: 'tin opener', plural: 'tin openers' }],
    [LEASH, { class: 'Tools', name: 'leash', plural: 'leashes' }],
    [TOWEL, { class: 'Tools', name: 'towel', plural: 'towels' }],
    [MAGIC_MARKER, {
        class: 'Tools', name: 'magic marker', plural: 'magic markers',
        charged: true, showBuc: false,
    }],
    [BLINDFOLD, { class: 'Tools', name: 'blindfold', plural: 'blindfolds' }],
    [WAN_WISHING, {
        class: 'Wands', name: 'wand of wishing', plural: 'wands of wishing',
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
    const pw = initialRoll(g.urole?.enadv) + initialRoll(g.urace?.enadv);

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
    if (role !== 'ranger' && role !== 'samurai' && role !== 'tourist') return null;

    let pettype = 16; // PM_LITTLE_DOG
    if (role === 'tourist') {
        if (g.preferred_pet === 'c') pettype = 32; // PM_KITTEN
        else if (g.preferred_pet !== 'd') pettype = rn2(2) ? 32 : 16;
    }

    const candidates = collectNearbyCoords(g.u.ux, g.u.uy, 3);
    const spot = candidates.find(({ x, y }) => monsterGoodPos(x, y));
    if (!spot) return null;

    rnd(2); // next_ident()
    // adj_lev() reduces both little dogs and kittens to level one for a
    // level-one hero on dungeon level one.
    let hp = d(1, 8);
    if (hp === 1) hp++;
    const female = !!rn2(2);
    if (role === 'tourist') {
        // peace_minded(); initedog() below ultimately makes the pet tame.
        rn2(16);
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
        symbol: pettype === 32 ? 'f' : 'd',
        name: role === 'ranger' ? 'Sirius' : role === 'samurai' ? 'Hachi' : '',
        pet: true,
    };
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
    if (raw.otyp === TIN) {
        view = raw.corpsenm === PM_LICHEN
            ? { class: 'Comestibles', name: 'tin of lichen', plural: 'tins of lichen' }
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
    if (item.otyp === ARROW || item.otyp === YA || item.otyp === DART) {
        if (!game.uquiver) {
            game.uquiver = item;
            item.ready = true;
        }
    } else if (item.otyp === DAGGER || item.otyp === KATANA) {
        game.uwep = item;
        item.wielded = true;
    } else if (item.otyp === BOW) {
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
    } else if (item.otyp === CLOAK_OF_DISPLACEMENT) {
        game.uarmc = item;
        item.worn = true;
    } else if (item.otyp === HAWAIIAN_SHIRT) {
        game.uarmu = item;
        item.worn = true;
    } else if (item.otyp === SPLINT_MAIL) {
        game.uarm = item;
        item.worn = true;
    }
}

// Direct port of ini_inv() for fixed and class-generated inventory entries.
function iniInv(table) {
    let index = 0;
    let quan = trquan(table[index]);
    while (table[index].cls) {
        const trobj = table[index];
        const raw = trobj.typ === UNDEF_TYP
            ? mkobj(trobj.cls, false) : mksobj(trobj.typ, true, false);

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
    if (role !== 'ranger' && role !== 'samurai' && role !== 'tourist') return false;
    game.inventory = [];
    game.uwep = game.uswapwep = game.uquiver = null;
    game.uarm = game.uarmc = game.uarmu = null;
    game.moves = 1;
    if (role === 'tourist') {
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
    } else {
        iniInv(RANGER_INVENTORY);
    }
    initAttributes();
    game.discoveries = role === 'tourist' ? [
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
    if (game.urole?.key === 'ranger') game.u.uac = 7;
    else if (game.urole?.key === 'samurai') game.u.uac = 4;
    else if (game.urole?.key === 'tourist') game.u.uac = 10;
}
