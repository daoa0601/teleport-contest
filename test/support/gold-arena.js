import { rhack } from '../../js/cmd.js';
import { game } from '../../js/gstate.js';
import { addHeroGoldObject } from '../../js/hero_gold.js';
import { pushKey } from '../../js/input.js';
import { mksobj } from '../../js/mklev.js';
import { GOLD_PIECE } from '../../js/object_data.js';

const PM_LEPRECHAUN = 63;

export function carriedGold(amount, id) {
    const gold = looseGold(amount, id);
    addHeroGoldObject(game, gold);
    return gold;
}

export function looseGold(amount, id = undefined) {
    const gold = mksobj(GOLD_PIECE, false, false);
    gold.quan = gold.quantity = amount;
    if (id !== undefined) gold.o_id = id;
    return gold;
}

export function liveMonster(overrides = {}) {
    return {
        m_id: 29000,
        mnum: PM_LEPRECHAUN,
        mx: 13, my: 10,
        mhp: 12, mhpmax: 12, m_lev: 5,
        mpeaceful: 0, mtame: 0,
        msleeping: 0, mcanmove: 1, mfrozen: 0, meating: 0,
        mcansee: 1, mcan: 0, mstrategy: 0,
        minvent: [], inventory: [], hasInventory: false,
        ...overrides,
    };
}

export function floorObjects(level) {
    return (level.objects || []).flatMap(column =>
        (column || []).flatMap(pile => pile || []));
}

export function floorAt(level, x, y) {
    return level.objects?.[x]?.[y] || [];
}

export async function readyGold() {
    pushKey('$');
    await rhack('Q'.charCodeAt(0));
}

export async function throwGold(direction = 'l') {
    pushKey('$');
    pushKey(direction);
    await rhack('t'.charCodeAt(0));
}

export async function fireQuiveredGold(direction = 'l') {
    pushKey(direction);
    await rhack('f'.charCodeAt(0));
}
