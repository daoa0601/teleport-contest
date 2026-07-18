// u_init.js — Initial hero, pet, inventory, and attribute setup.
// C refs: u_init.c, attrib.c, dog.c, teleport.c, makemon.c.

import { game } from './gstate.js';
import { rn2, rnd, d } from './rng.js';
import { mksobj } from './mklev.js';
import {
    COLNO, ROWNO, STONE, ROOM, CORR, DOOR, STAIRS,
    D_ISOPEN, D_NODOOR,
} from './const.js';
import {
    DAGGER, BOW, ARROW, CLOAK_OF_DISPLACEMENT, CRAM_RATION,
} from './object_data.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const FOOD_CLASS = 7;
const UNDEF_BLESS = 2;

const RANGER_INVENTORY = [
    { typ: DAGGER, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: BOW, spe: 1, cls: WEAPON_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: ARROW, spe: 2, cls: WEAPON_CLASS, min: 50, max: 59, bless: UNDEF_BLESS },
    { typ: ARROW, spe: 0, cls: WEAPON_CLASS, min: 30, max: 39, bless: UNDEF_BLESS },
    { typ: CLOAK_OF_DISPLACEMENT, spe: 2, cls: ARMOR_CLASS, min: 1, max: 1, bless: UNDEF_BLESS },
    { typ: CRAM_RATION, spe: 0, cls: FOOD_CLASS, min: 4, max: 4, bless: 0 },
    { typ: 0, spe: 0, cls: 0, min: 0, max: 0, bless: 0 },
];

const ITEM_PRESENTATION = new Map([
    [DAGGER, { class: 'Weapons', name: 'dagger', plural: 'daggers' }],
    [BOW, { class: 'Weapons', name: 'bow', plural: 'bows' }],
    [ARROW, { class: 'Weapons', name: 'arrow', plural: 'arrows' }],
    [CLOAK_OF_DISPLACEMENT, {
        class: 'Armor', name: 'cloak of displacement', plural: 'cloaks of displacement',
    }],
    [CRAM_RATION, { class: 'Comestibles', name: 'cram ration', plural: 'cram rations' }],
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

// C ref: makedog().  Ranger has a fixed little dog, so pet_type() itself
// consumes no RNG.  Other roles remain on the existing startup path.
export function makedog() {
    const g = game;
    if (g.preferred_pet === 'n') return null;
    if (g.urole?.key !== 'ranger') return null;

    const candidates = collectNearbyCoords(g.u.ux, g.u.uy, 3);
    const spot = candidates.find(({ x, y }) => monsterGoodPos(x, y));
    if (!spot) return null;

    rnd(2); // next_ident()
    let hp = d(1, 8); // adj_lev(little dog) is one for a level-one hero
    if (hp === 1) hp++;
    const female = !!rn2(2);
    const pet = {
        mnum: 16,
        mx: spot.x,
        my: spot.y,
        mhp: hp,
        mhpmax: hp,
        female,
        mtame: 10,
        mpeaceful: 1,
        symbol: 'd',
        name: 'Sirius',
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
    const view = ITEM_PRESENTATION.get(raw.otyp) || {
        class: 'Other', name: `object ${raw.otyp}`, plural: `objects ${raw.otyp}`,
    };
    return {
        ...raw,
        ...view,
        quantity: raw.quan,
        enchantment: raw.spe,
        buc: raw.blessed ? 'blessed' : 'uncursed',
    };
}

function addStartingItem(raw) {
    const item = inventoryItem(raw);
    const merge = game.inventory.find(other => other.otyp === item.otyp
        && other.enchantment === item.enchantment && other.buc === item.buc);
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
    if (item.otyp === ARROW) {
        if (!game.uquiver) {
            game.uquiver = item;
            item.ready = true;
        }
    } else if (item.otyp === DAGGER) {
        game.uwep = item;
        item.wielded = true;
    } else if (item.otyp === BOW) {
        game.uswapwep = item;
        item.alternate = true;
    } else if (item.otyp === CLOAK_OF_DISPLACEMENT) {
        game.uarmc = item;
        item.worn = true;
    }
}

// Direct port of ini_inv() for fixed Ranger inventory entries.
function iniInv(table) {
    let index = 0;
    let quan = trquan(table[index]);
    while (table[index].cls) {
        const trobj = table[index];
        const raw = mksobj(trobj.typ, true, false);

        raw.cursed = false;
        let stop = false;
        if (raw.oclass === WEAPON_CLASS) {
            raw.quan = trquan(trobj);
            stop = true;
        }
        raw.spe = trobj.spe;
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
    if (game.urole?.key !== 'ranger') return false;
    game.inventory = [];
    game.moves = 1;
    iniInv(RANGER_INVENTORY);
    initAttributes();
    game.discoveries = [
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
}
