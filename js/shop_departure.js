import { currency } from './currency.js';
// Native shop exit, robbery, and the responding watch and Keystone Kops.
// C refs: shk.c u_left_shop(), rob_shop(), call_kops(), makekops();
// wizard.c choose_stairs(). Billing and pursuit use the existing shop owners.
import { adjustHeroAlignment } from './alignment.js';
import { G_GONE, MM_NOMSG, SHOPBASE, isok } from './const.js';
import { plineWithContinuation } from './display.js';
import { roomsAt } from './room.js';
import { dungeonBuildsUp } from './dungeon.js';
import { recordGameLogEvent } from './gamelog.js';
import { game, requireLiveGame } from './gstate.js';
import { requireShopGame } from './shop_types.js';
import { depth } from './hacklib.js';
import { makemonAt } from './mklev.js';
import { angerWatchGuards } from './monster_anger.js';
import { MONSTER_NAME } from './monster_data.js';
import { possessiveName, shopkeeperName } from './monster_name.js';
import { rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { SHOP_TYPES } from './shop_data.js';
import { hotPursuitShopkeeper, setPaidShopkeeper } from './shop_damage.js';
import { shopkeeperIsMuted } from './shop_loss.js';
import { rouseShopkeeper } from './shop_sell.js';
import { shopResident, shopkeeperInOwnShop } from './shk.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
const kopSpecies = ['Keystone Kop', 'Kop Sergeant', 'Kop Lieutenant', 'Kop Kaptain']
    .map(name => MONSTER_NAME.indexOf(name));
// An empty room list denotes stepping onto the shop boundary. An actual
// departed room denotes leaving outright, including departure to a new level.
export async function leaveHeroShop(roomnos, { newLevel = false, state = game } = {}) {
    requireLiveGame(state);
    requireShopGame(state);
    const hero = state.u;
    const leaving = roomnos.length > 0;
    if (!leaving && (!state.level.at(hero.ux, hero.uy)?.edge
        || state.level.at(hero.ux0, hero.uy0)?.edge))
        return;
    const keeper = shopResident(leaving ? roomnos[0] : hero.ushops0[0], state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state))
        return;
    const shop = keeper.eshk;
    if (!(shop.bill?.length || shop.billct) && !shop.debit)
        return;
    if (!leaving && !shopkeeperIsMuted(keeper)) {
        const calm = !shop.surcharge;
        if (!heroIsDeaf(state)) {
            await plineWithContinuation(`"${state.plname}!  ${calm
                ? 'Please pay before leaving.' : "Don't you leave without paying!"}"`);
        }
        else {
            await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${calm
                ? 'points out' : 'makes it clear'} that you need to pay before leaving${calm ? '.' : '!'}`);
        }
        return;
    }
    if (await robShop(keeper, state))
        await callKops(keeper, !newLevel && !!state.level.at(hero.ux0, hero.uy0)?.edge, state);
}
// C shk.c:remote_burglary(): bill first, then pursue from the distant shop.
export async function remoteBurglary(x, y, state = game) {
    requireLiveGame(state);
    requireShopGame(state);
    const keeper = shopResident(roomsAt(state.level, x, y, SHOPBASE)[0], state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state))
        return;
    if (!keeper.eshk.billct && !keeper.eshk.debit)
        return;
    if (await robShop(keeper, state))
        await callKops(keeper, false, state);
}
async function robShop(keeper, state) {
    await rouseShopkeeper(keeper);
    const shop = keeper.eshk;
    let total = (shop.bill || []).reduce((sum, entry) => sum + entry.price * entry.bquan, 0)
        + (shop.debit || 0);
    const credit = shop.credit || 0;
    if (credit >= total) {
        await plineWithContinuation(`Your credit of ${credit} ${currency(credit, { state })} is used to cover your shopping bill.`);
        total = 0;
    }
    else {
        await plineWithContinuation('You escaped the shop without paying!');
        total -= credit;
    }
    setPaidShopkeeper(keeper, state);
    if (!total)
        return false;
    shop.robbed = (shop.robbed || 0) + total;
    await plineWithContinuation(`You stole ${total} ${currency(total, { state })} worth of merchandise.`);
    const shopType = SHOP_TYPES[shop.shoptype - SHOPBASE];
    if (!shopType)
        throw new Error(`Shopkeeper ${keeper.m_id} has invalid shop type ${shop.shoptype}`);
    recordGameLogEvent(`stole ${total} ${currency(total, { state })} worth of merchandise from ${possessiveName(shopkeeperName(keeper, { state }))} ${shopType.name}`, { state });
    if (!state.urole || !state.u.ualign)
        throw new Error('Shop robbery requires hero role and alignment');
    if (state.urole.key !== 'rogue')
        adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
    hotPursuitShopkeeper(keeper, state);
    return true;
}
async function callKops(keeper, nearShop, state) {
    const deaf = heroIsDeaf(state);
    if (!deaf)
        await plineWithContinuation('An alarm sounds!');
    const noKops = kopSpecies.every(species => (state.mvitals?.[species]?.mvflags ?? 0) & G_GONE);
    const guardsResponded = await angerWatchGuards(deaf);
    if (!guardsResponded && noKops) {
        if (state.flags.verbose && !deaf)
            await plineWithContinuation('But no one seems to respond to it.');
        return;
    }
    if (noKops)
        return;
    const stairs = pursuitStairs(state);
    if (nearShop) {
        if (state.flags.verbose)
            await plineWithContinuation('The Keystone Kops appear!');
        await makeKops({ x: state.u.ux, y: state.u.uy }, state);
        return;
    }
    if (state.flags.verbose)
        await plineWithContinuation('The Keystone Kops are after you!');
    if (stairs && isok(stairs.sx, stairs.sy))
        await makeKops({ x: stairs.sx, y: stairs.sy }, state);
    if (state.program_state.gameover)
        return;
    await makeKops({ x: keeper.mx, y: keeper.my }, state);
}
function pursuitStairs(state) {
    const stairs = [];
    for (let stair = state.stairs; stair; stair = stair.next)
        stairs.push(stair);
    if (!stairs.length)
        return null;
    const up = dungeonBuildsUp(state.u.uz, state);
    return stairs.find(stair => !stair.isladder && !!stair.up === up)
        || stairs.find(stair => stair.isladder && !!stair.up === up)
        || stairs.find(stair => stair.tolev.dnum !== state.u.uz.dnum)
        || stairs.find(stair => !stair.isladder && !!stair.up !== up)
        || stairs.find(stair => stair.isladder && !!stair.up !== up)
        || null;
}
async function makeKops(origin, state) {
    let position = origin;
    const count = Math.abs(depth(state.u.uz, state.dungeons)) + rnd(5);
    const ranks = [count, Math.trunc(count / 3) + 1, Math.trunc(count / 6), Math.trunc(count / 9)];
    for (const [rank, rankCount] of ranks.entries()) {
        if (!rankCount)
            break;
        const species = kopSpecies[rank];
        if (species === undefined)
            throw new Error(`Kop rank ${rank} has no monster species`);
        if ((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
            continue;
        for (let remaining = rankCount; remaining > 0; remaining--) {
            // Native enexto moves the center even if makemon later fails.
            const next = findNearbyMonsterPosition(species, position.x, position.y, { state });
            if (next) {
                position = next;
                await makemonAt(species, position.x, position.y, MM_NOMSG);
                if (state.program_state.gameover)
                    return;
            }
        }
    }
}
//# sourceMappingURL=shop_departure.js.map