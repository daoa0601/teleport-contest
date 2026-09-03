import { rhack } from '../../js/cmd.js';
import { game } from '../../js/gstate.js';
import { addHeroGoldObject } from '../../js/hero_gold.js';
import { pushKey, pushKeys } from '../../js/input.js';
import { mksobj } from '../../js/mklev.js';
import { GOLD_PIECE } from '../../js/object_data.js';
import { createMonsterAt } from './monsters.js';

const PM_LEPRECHAUN = 63;

export function carriedGold(amount, id) {
    const gold = looseGold(amount, id);
    addHeroGoldObject(game, gold);
    return gold;
}

function looseGold(amount, id = undefined) {
    const gold = mksobj(GOLD_PIECE, false, false);
    gold.quan = gold.quantity = amount;
    if (id !== undefined) gold.o_id = id;
    return gold;
}

export async function createGoldMonster({
    mnum = PM_LEPRECHAUN,
    x = 13,
    y = 10,
    mx = x,
    my = y,
    hitPoints = 12,
    maxHitPoints = hitPoints,
    level = 5,
    ...overrides
} = {}) {
    const bornOnHero = mx === game.u.ux && my === game.u.uy;
    const monster = await createMonsterAt(
        mnum, bornOnHero ? mx + 1 : mx, my,
    );
    Object.assign(monster, {
        mx,
        my,
        mhp: hitPoints,
        mhpmax: maxHitPoints,
        m_lev: level,
        mfrozen: 0,
        meating: 0,
        mcan: 0,
        ...overrides,
    });
    return monster;
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
