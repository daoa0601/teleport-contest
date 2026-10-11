// C shk.c:paybill(), inherits(), set_repo_loc(), and finish_paybill().
// Settlement precedes disclosure; only the later repossession drops inventory.
import { monsterHeadName } from './body_parts.js';
import { dropHeroInventoryForBones } from './bones_death.js';
import { LOW_PM, PL_NSIZ, isok } from './const.js';
import { currency } from './currency.js';
import { impossible } from './diagnostics.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { heroGoldAmount } from './hero_gold.js';
import { monsterHasHead } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { releaseAllMonsterLeashes } from './monster_leash.js';
import { monsterObjectPronoun, monsterPossessive, shopkeeperName } from './monster_name.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { rn2 } from './rng.js';
import { costlyAdjacent, shopkeeperInOwnShop } from './shk.js';
import { addUpBill, homeShopkeeper, moneyToMonster, pacifyShopkeeper, rileShopkeeper, setPaidShopkeeper } from './shop_damage.js';
import { hasShopkeeperData, requireShopGame } from './shop_types.js';
import { cansee } from './vision.js';
export async function settleShopkeepersOnExit(outcome, { silent = false, publish = plineWithContinuation, random = rn2 } = {}) {
    if (outcome === 'escaped')
        return false;
    requireShopGame(game);
    game._shopRepossession = { shopkeeper: null, location: { x: 0, y: 0 } };
    const first = preferredShopkeeper();
    const options = { croaked: outcome !== 'quit', silent, publish, random };
    let count = 0;
    let taken = false;
    if (first)
        taken = await inheritHeroInventory(first, ++count, options);
    for (const keeper of exitShopkeepers()) {
        const local = shopkeeperIsLocal(keeper);
        if (keeper !== first) {
            const claimed = await inheritHeroInventory(keeper, ++count, options);
            taken = taken || claimed;
        }
        // Bones must not retain a keeper whose shop belongs to another level.
        if (!local)
            await removeMonsterFromGame(keeper);
    }
    return taken;
}
export async function finishShopkeeperRepossession() {
    const repository = game._shopRepossession;
    const keeper = repository?.shopkeeper ?? null;
    let { x, y } = repository?.location ?? { x: 0, y: 0 };
    if (!isok(x, y)) {
        if (keeper)
            await impossible(`finish_paybill: bad location <${x},${y}>.`, { state: game });
        ({ x, y } = heroRepositoryPosition());
    }
    releaseAllMonsterLeashes(game);
    const money = heroGoldAmount(game);
    if (keeper && money)
        await moneyToMonster(keeper, money);
    await dropHeroInventoryForBones(x, y);
}
function preferredShopkeeper() {
    let resident = null;
    let creditor = null;
    let hostile = null;
    let localKeeper = null;
    for (const keeper of exitShopkeepers()) {
        const shop = keeper.eshk;
        const local = shopkeeperIsLocal(keeper);
        if (local && game.u.ushops?.includes(shop.shoproom)) {
            if (!resident || shopkeeperHasDebt(keeper))
                resident = keeper;
        }
        else if (shopkeeperHasDebt(keeper)) {
            creditor ??= keeper;
        }
        else if (shop.following || !keeper.mpeaceful) {
            hostile ??= keeper;
        }
        else if (local) {
            localKeeper ??= keeper;
        }
    }
    return resident ?? creditor ?? hostile ?? localKeeper;
}
// C next_shkp(FALSE). Capture the list before this pass because mongone()
// removes its current member while the native loop retains the next pointer.
function* exitShopkeepers() {
    for (const keeper of [...(game.level?.monsters ?? [])]) {
        if (keeper.dead || keeper.mhp <= 0 || !keeper.isshk)
            continue;
        if (!hasShopkeeperData(keeper))
            throw new Error('Shopkeeper lacks shop history.');
        if (!keeper.mpeaceful && !keeper.eshk.surcharge)
            rileShopkeeper(keeper);
        yield keeper;
    }
}
async function inheritHeroInventory(keeper, count, options) {
    const { croaked, silent, publish, random } = options;
    const shop = keeper.eshk;
    const heroInShop = !!game.u.ushops?.includes(shop.shoproom);
    keeper.minvis = 0;
    keeper.perminvis = 0;
    if (count > 1) {
        if (cansee(keeper.mx, keeper.my) && croaked && !silent) {
            const shake = monsterHasHead(keeper) && !random(2)
                ? `, shakes ${monsterPossessive(keeper, { noIt: true, random })} ${monsterHeadName(keeper.mnum)},`
                : '';
            await publish(`${shopkeeperName(keeper, { capitalized: true })} ${monsterIsHelpless(keeper) ? 'wakes up, ' : ''}looks at your corpse${shake} and ${shopkeeperInOwnShop(keeper) ? 'sighs' : 'disappears'}.`);
        }
        await returnShopkeeperHome(keeper);
        return completeShopSettlement(keeper, heroInShop);
    }
    if (heroInShop && shopkeeperInOwnShop(keeper) && !shopkeeperHasDebt(keeper)
        && keeper.mpeaceful && !shop.following && (game.u.ugrave_arise ?? -1) < LOW_PM) {
        const taken = game.inventory.length > 0;
        if (taken && !silent)
            await publish(`${shopkeeperName(keeper, { capitalized: true })} gratefully inherits all your possessions.`);
        return completeShopSettlement(keeper, taken);
    }
    let loss = 0;
    const owed = shopkeeperHasDebt(keeper);
    if (owed) {
        if (heroInShop && shopkeeperInOwnShop(keeper))
            loss = addUpBill(keeper) + (shop.debit ?? 0);
        loss = Math.max(loss, shop.robbed ?? 0);
    }
    let taken = false;
    if (shop.following || !keeper.mpeaceful || owed) {
        if (game.inventory.length > 0) {
            const money = heroGoldAmount(game);
            const adjacent = dist2(keeper.mx, keeper.my, game.u.ux, game.u.uy) <= 2;
            const takes = `${monsterIsHelpless(keeper) ? 'wakes up and ' : ''}${adjacent ? '' : 'comes and '}takes`;
            if (loss > money || !loss || heroInShop) {
                shop.robbed = Math.max(0, (shop.robbed ?? 0) - money);
                if (money > 0)
                    await moneyToMonster(keeper, money);
                if (!silent)
                    await publish(`${shopkeeperName(keeper, { capitalized: true })} ${takes} all your possessions.`);
                taken = true;
            }
            else {
                await moneyToMonster(keeper, loss);
                if (!silent) {
                    const customer = (shop.customer ?? '').slice(0, PL_NSIZ) === game.plname.slice(0, PL_NSIZ);
                    await publish(`${shopkeeperName(keeper, { capitalized: true })} ${takes} the ${loss} ${currency(loss, { random })} ${customer ? 'you ' : ''}owed ${monsterObjectPronoun(keeper, { noIt: true })}.`);
                }
                pacifyShopkeeper(keeper);
                shop.following = 0;
                shop.robbed = 0;
            }
        }
        await returnShopkeeperHome(keeper);
    }
    return completeShopSettlement(keeper, taken);
}
async function returnShopkeeperHome(keeper) {
    requireShopGame(game);
    if (monsterIsHelpless(keeper)) {
        keeper.msleeping = 0;
        keeper.mfrozen = 0;
        keeper.mcanmove = 1;
    }
    if (!shopkeeperInOwnShop(keeper))
        await homeShopkeeper(keeper, game);
}
function completeShopSettlement(keeper, taken) {
    setPaidShopkeeper(keeper);
    if (taken && !game._shopRepossession?.shopkeeper) {
        let location = heroRepositoryPosition();
        if (!game.u.ushops?.includes(keeper.eshk.shoproom)
            || costlyAdjacent(keeper, location.x, location.y)) {
            const { shk: home, shd: door } = keeper.eshk;
            location = {
                x: home.x + Math.sign(home.x - door.x),
                y: home.y + Math.sign(home.y - door.y),
            };
        }
        game._shopRepossession = { shopkeeper: keeper, location };
    }
    return taken;
}
function heroRepositoryPosition() {
    return { x: game.u.ux || game.u.ux0, y: game.u.ux ? game.u.uy : game.u.uy0 };
}
function shopkeeperHasDebt(keeper) {
    const shop = keeper.eshk;
    return !!(shop.billct || shop.debit || shop.robbed);
}
function shopkeeperIsLocal(keeper) {
    const level = keeper.eshk.shoplevel;
    const heroLevel = game.u.uz;
    return !!heroLevel && level.dnum === heroLevel.dnum && level.dlevel === heroLevel.dlevel;
}
//# sourceMappingURL=shop_settlement.js.map