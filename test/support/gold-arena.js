import { rhack } from '../../js/cmd.js';
import { game } from '../../js/gstate.js';
import { addHeroGoldObject } from '../../js/hero_gold.js';
import { pushKey, pushKeys } from '../../js/input.js';
import { mksobj } from '../../js/mklev.js';
import { GOLD_PIECE } from '../../js/object_data.js';
import { liveMonster } from './monsters.js';

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

export function goldMonster(overrides = {}) {
    return liveMonster({
        m_id: 29000,
        mnum: PM_LEPRECHAUN, x: 13, y: 10,
        hitPoints: 12, level: 5,
        mfrozen: 0, meating: 0, mcan: 0, hasInventory: false,
        ...overrides,
    });
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

export async function fireQuiveredGold(direction = 'l', moreKeys = '') {
    pushKey(direction);
    pushKeys(moreKeys);
    await rhack('f'.charCodeAt(0));
}
