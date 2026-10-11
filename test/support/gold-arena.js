import { rhack } from '../../js/cmd.js';
import { game, requirePlayingGame } from '../../js/gstate.js';
import { ALTAR, AM_SHRINE, Align2amask, MM_EPRI, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../../js/const.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import { createStaffedShop } from './shop.js';
import { createRoom } from './topology.js';
import { addHeroGoldObject } from '../../js/hero_gold.js';
import { pushKey, pushKeys } from '../../js/input.js';
import { mksobj } from '../../js/mklev.js';
import { GOLD_PIECE } from '../../js/object_data.js';
import { createMonsterAt } from './monsters.js';
const PM_LEPRECHAUN = 63;
export async function carriedGold(amount, id) {
    const gold = await looseGold(amount, id);
    addHeroGoldObject(game, gold);
    return gold;
}
async function looseGold(amount, id) {
    const gold = await mksobj(GOLD_PIECE, false, false);
    gold.quan = gold.quantity = amount;
    if (id !== undefined)
        gold.o_id = id;
    return gold;
}
export async function createGoldMonster({ mnum = PM_LEPRECHAUN, x = 13, y = 10, mx = x, my = y, hitPoints = 12, maxHitPoints = hitPoints, level = 5, eshk, epri, isshk, ispriest, isgd, mpeaceful, msleeping, mcanmove, mfrozen = 0, meating = 0, mcan = 0, m_ap_type, mappearance, } = {}) {
    requirePlayingGame(game);
    const bornOnHero = mx === game.u.ux && my === game.u.uy;
    const wantsShopkeeper = !!isshk || eshk !== undefined;
    const wantsPriest = !!ispriest || epri !== undefined;
    let monster;
    if (wantsShopkeeper) {
        if (MONSTER_NAME[mnum] !== 'shopkeeper')
            throw new Error('Gold shop tests require an actual shopkeeper species');
        const shop = await createStaffedShop({
            left: mx - 1, right: mx + 1, top: my - 1, bottom: my + 1,
            keeperX: mx, keeperY: my,
        });
        const shopState = shop.shopkeeper.eshk;
        if (eshk?.robbed !== undefined)
            shopState.robbed = eshk.robbed;
        if (eshk?.credit !== undefined)
            shopState.credit = eshk.credit;
        if (eshk?.following !== undefined)
            shopState.following = eshk.following;
        if (eshk?.surcharge !== undefined)
            shopState.surcharge = eshk.surcharge;
        monster = shop.shopkeeper;
    }
    else {
        monster = await createMonsterAt(mnum, bornOnHero ? mx + 1 : mx, my, wantsPriest ? MM_EPRI | NO_MINVENT : 0);
        if (wantsPriest) {
            if (MONSTER_NAME[mnum] !== 'aligned cleric' && MONSTER_NAME[mnum] !== 'high cleric')
                throw new Error('Gold priest tests require an actual cleric species');
            // The priest is outside a nearby home temple while catching gold.
            const roomnoidx = game.level.rooms.length;
            const temple = createRoom({
                lx: mx + 2, hx: mx + 4, ly: my - 1, hy: my + 1,
                rtype: TEMPLE, roomnoidx,
            });
            game.level.rooms.push(temple);
            game.level.nroom = game.level.rooms.length;
            for (let x = temple.lx; x <= temple.hx; x++)
                for (let y = temple.ly; y <= temple.hy; y++)
                    game.level.requireAt(x, y).roomno = roomnoidx + ROOMOFFSET;
            monster.epri = {
                parentmid: monster.m_id, shroom: roomnoidx + ROOMOFFSET,
                shrpos: { x: mx + 3, y: my }, shrlevel: { ...game.u.uz },
                shralign: game.u.ualign.type,
                intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
                ...epri,
            };
            const altar = game.level.requireAt(monster.epri.shrpos.x, monster.epri.shrpos.y);
            altar.typ = ALTAR;
            altar.flags = AM_SHRINE | Align2amask(monster.epri.shralign);
            temple.resident = monster;
            game.level.flags.has_temple = true;
            monster.ispriest = true;
        }
    }
    monster.mx = mx;
    monster.my = my;
    monster.mhp = hitPoints;
    monster.mhpmax = maxHitPoints;
    monster.m_lev = level;
    monster.mfrozen = mfrozen;
    monster.meating = meating;
    monster.mcan = mcan;
    if (isshk !== undefined)
        monster.isshk = isshk;
    if (ispriest !== undefined)
        monster.ispriest = ispriest;
    if (isgd !== undefined)
        monster.isgd = isgd;
    if (mpeaceful !== undefined)
        monster.mpeaceful = mpeaceful;
    if (msleeping !== undefined)
        monster.msleeping = msleeping;
    if (mcanmove !== undefined)
        monster.mcanmove = mcanmove;
    if (m_ap_type !== undefined)
        monster.m_ap_type = m_ap_type;
    if (mappearance !== undefined)
        monster.mappearance = mappearance;
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
//# sourceMappingURL=gold-arena.js.map