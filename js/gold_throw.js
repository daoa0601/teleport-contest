import { currency } from './currency.js';
import { A_CHA, DOOR, D_CLOSED, D_LOCKED, IS_SOFT, Is_airlevel, Is_waterlevel, LOST_THROWN, ZAP_POS, isok, } from './const.js';
import { hitFloorWithObject } from './object_drop.js';
import { tossObjectUp } from './toss_up.js';
import { monsterName, possessiveName } from './monster_name.js';
import { currentAttribute } from './attrib.js';
import { canSeeMonster, canSpotMonster, newsym, pline, plineWithContinuation } from './display.js';
import { simpleArmorName } from './armor.js';
import { heroHeadName } from './body_parts.js';
import { placeObjectSynchronously, stack_object } from './floor_object.js';
import { hiddenGold } from './gold.js';
import { freeInventoryObject } from './hero_inventory.js';
import { detachHeroGold, heroGoldAmount, heroGoldObject, } from './hero_gold.js';
import { addObjectToMonsterInventory, linkObjectToMonsterInventory, } from './monster_inventory.js';
import { MONSTER_FLAGS2, monsterDigests } from './monster_data.js';
import { finishMonsterEating } from './monster_eating.js';
import { makeShopkeeperHappy } from './shop_damage.js';
import { hasShopkeeperData } from './shop_types.js';
import { sellHeroDroppedObject } from './shop_sell.js';
import { heroIsDeaf } from './senses.js';
import { OBJECT_COST } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { shipObject } from './object_migration.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { requireInitializedGame } from './gstate.js';
import { applyFloorEffects } from './floor_effects.js';
import { settleThrownShopObject } from './shk.js';
import { rn2, rnd } from './rng.js';
import { flyHeroThrownObject, heroDirectGoldThrowRange, heroThrowRange, prepareHeroThrownTarget, } from './thrown_object.js';
import { cansee } from './vision.js';
const M2_MERC = 0x00000200;
const M2_GREEDY = 0x10000000;
const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;
const MERCENARY_BASE_BRIBE = new Map([
    [PM_SOLDIER, 100],
    [PM_SERGEANT, 250],
    [PM_LIEUTENANT, 500],
    [PM_CAPTAIN, 750],
]);
function quantity(object) {
    return Math.max(0, Math.trunc(object?.quan ?? object?.quantity ?? 0));
}
function goldNoun(gold) {
    return quantity(gold) === 1 ? 'gold piece' : 'gold pieces';
}
async function missGold(monster, gold, state) {
    const spotted = cansee(monster.mx, monster.my) || canSpotMonster(monster);
    const target = state.flags.verbose !== false && spotted ? monsterName(monster, { state }) : 'it';
    await pline(`The ${goldNoun(gold)} ${quantity(gold) === 1 ? 'misses' : 'miss'} ${target}.`);
}
async function finishShopkeeperCatch(monster, value, state) {
    if (!hasShopkeeperData(monster))
        throw new Error('Shopkeeper gold payment requires shopkeeper data.');
    const robbedBefore = Math.max(0, Math.trunc(monster.eshk.robbed ?? 0));
    if (robbedBefore) {
        const robbedAfter = Math.max(0, robbedBefore - value);
        await pline(`The amount ${robbedAfter ? 'partially ' : ''}covers ${monster.female ? 'her' : 'his'} recent losses.`);
        monster.eshk.robbed = robbedAfter;
        if (!robbedAfter)
            await makeShopkeeperHappy(monster, { state });
        return;
    }
    if (monster.mpeaceful) {
        monster.eshk.credit = Math.max(0, Math.trunc(monster.eshk.credit ?? 0)) + value;
        await pline(`You have ${monster.eshk.credit} ${currency(monster.eshk.credit, { state })} in credit.`);
    }
    else if (!heroIsDeaf(state)) {
        await pline('"Thanks, scum!"');
    }
}
async function finishGuardCatch(monster, state) {
    const visible = heroGoldAmount(state);
    const hidden = hiddenGold(state, true);
    const speech = visible ? 'Drop the rest and follow me.'
        : hidden ? 'You still have hidden gold.  Drop it now.'
            : monster.mpeaceful
                ? "I'll take care of that; please move along."
                : "I'll take that; now get moving.";
    if (!heroIsDeaf(state))
        await pline(`"${speech}"`);
}
async function finishMercenaryCatch(monster, value, state) {
    const wasAngry = !monster.mpeaceful;
    let required = MERCENARY_BASE_BRIBE.get(monster.mnum) ?? 0;
    if (required && rn2(3) !== 0) {
        const charisma = Math.max(3, currentAttribute(A_CHA, state));
        required += Math.trunc((heroGoldAmount(state)
            + (state.u?.ulevel ?? 1) * rn2(5)) / charisma);
        if (value > required)
            monster.mpeaceful = 1;
    }
    if (heroIsDeaf(state))
        return;
    if (!monster.mpeaceful) {
        await pline(required
            ? '"That\'s not enough, coward!"'
            : '"I don\'t take bribes from scum like you!"');
    }
    else if (wasAngry) {
        await pline('"That should do.  Now beat it!"');
    }
    else {
        await pline(`"Thanks for the tip, ${state.flags?.female ? 'lady' : 'buddy'}."`);
    }
}
export async function resolveGoldMonsterContact({ state, monster, gold, wakeMonster, angerMonster, }) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    const greedy = !!(flags & M2_GREEDY);
    const mercenary = !!(flags & M2_MERC);
    const eligible = greedy || monster?.isshk || monster?.ispriest
        || monster?.isgd || mercenary;
    if (!eligible) {
        await wakeMonster?.(monster);
        await missGold(monster, gold, state);
        return false;
    }
    if (monster.mcanmove === 0 || monster.mcanmove === false) {
        if (canSeeMonster(monster))
            await pline(`The ${goldNoun(gold)} harmlessly ${quantity(gold) === 1 ? 'hits' : 'hit'} ${monsterName(monster, { state })}.`);
        else
            await missGold(monster, gold, state);
        return false;
    }
    const wasSleeping = !!monster.msleeping;
    const value = quantity(gold) * (OBJECT_COST[gold.otyp] ?? 1);
    monster.msleeping = 0;
    finishMonsterEating(monster, state);
    if (!monster.isgd && rn2(4) === 0)
        await angerMonster?.(monster);
    if (cansee(monster.mx, monster.my)) {
        await pline(`${monsterName(monster, { state, capitalized: true })} ${wasSleeping ? 'awakens and ' : ''}catches the gold.`);
    }
    await addObjectToMonsterInventory(monster, gold, state);
    if (monster.isshk) {
        await finishShopkeeperCatch(monster, value, state);
    }
    else if (monster.ispriest && !heroIsDeaf(state)) {
        await pline(monster.mpeaceful
            ? '"Thank you for your contribution."' : '"Thanks, scum!"');
    }
    else if (monster.isgd) {
        await finishGuardCatch(monster, state);
    }
    else if (mercenary) {
        await finishMercenaryCatch(monster, value, state);
    }
    return true;
}
async function settleGoldOnFloor(state, gold, x, y, dz = 0, sale = 'none') {
    const floor = await applyFloorEffects(gold, x, y, { state, verb: 'fall' });
    if (state.program_state?.gameover || floor.finished)
        return floor.object;
    if (dz > 0)
        await pline(`The gold hits the ${surfaceName(x, y, state)}.`);
    placeObjectSynchronously(gold, x, y);
    if (sale === 'sellobj') {
        // throw_gold() sells unconditionally inside a shop; sellobj() itself
        // decides whether the landing spot belongs to the resident keeper.
        await sellHeroDroppedObject(gold, x, y, state);
    }
    else if (sale === 'checkShopObj' && (state.u?.ushops?.length || gold.unpaid)) {
        // throwit() routes quivered coins through check_shop_obj().
        await settleThrownShopObject(gold, x, y, state);
    }
    const survivor = await stack_object(gold, state) || gold;
    newsym(x, y);
    return survivor;
}
async function resolveQuiveredGoldMonsterContact({ state, monster, gold, swallowed = false, wakeMonster = null, }) {
    // dothrow.c:omon_adj() can thaw a mobile species before thitmonst()
    // consumes its ordinary d20 targeting roll.  Coins do not enter any of
    // thitmonst()'s damaging classes, so a non-swallowed coin always reaches
    // tmiss() regardless of that targeting result or the monster's greed.
    prepareHeroThrownTarget(monster);
    rnd(20);
    if (swallowed) {
        await wakeMonster?.(monster);
        await pline(`The gold piece vanishes into ${monsterName(monster, { state, capitalized: true }).toLowerCase()}.`);
        await addObjectToMonsterInventory(monster, gold, state);
        return true;
    }
    await missGold(monster, gold, state);
    if (rn2(3) === 0)
        await wakeMonster?.(monster);
    return false;
}
export async function resolveDirectGoldThrow({ state, gold, dx = 0, dy = 0, dz = 0, captureFlight = null, wakeMonster = null, angerMonster = null, }) {
    if (!gold || gold.oclass !== 12 || !state.inventory.includes(gold))
        return false;
    await freeInventoryObject(gold, state);
    if (state.u?.uswallow && state.u?.ustuck) {
        const engulfer = state.u.ustuck;
        const swallower = monsterDigests(engulfer)
            ? `${possessiveName(monsterName(engulfer, { state }))} entrails`
            : monsterName(engulfer, { state });
        await pline(`The gold disappears into ${swallower}.`);
        await linkObjectToMonsterInventory(engulfer, gold, { state });
        return true;
    }
    if (dz) {
        // throw_gold() describes the purse bouncing off the ceiling unless
        // the level is open to the sky or the hero is in water.
        if (dz < 0 && !Is_airlevel(state.u?.uz)
            && !(state.underwater || state.u?.uinwater)
            && !Is_waterlevel(state.u?.uz)) {
            await pline(`The gold hits the ${ceilingName(state.u.ux, state.u.uy, state)}, then falls back on top of your ${heroHeadName(state)}.`);
            const helmet = state.uarmh ?? state.u?.uarmh ?? null;
            if (helmet) {
                await pline(`Fortunately, you are wearing ${withIndefiniteArticle(simpleArmorName(helmet, 'uarmh', state))}!`);
            }
        }
        await settleGoldOnFloor(state, gold, state.u.ux, state.u.uy, dz, 'sellobj');
        return true;
    }
    // throw_gold() never enters bhit() when the purse cannot leave the hero.
    const nextX = state.u.ux + dx;
    const nextY = state.u.uy + dy;
    const next = isok(nextX, nextY) ? state.level?.at(nextX, nextY) : null;
    if (!next || !ZAP_POS(next.typ)
        || next.typ === DOOR && !!(next.doormask & (D_CLOSED | D_LOCKED))) {
        await settleGoldOnFloor(state, gold, state.u.ux, state.u.uy, 0, 'sellobj');
        return true;
    }
    const range = heroDirectGoldThrowRange(gold, state);
    const { x, y, contact } = await flyHeroThrownObject({
        state, object: gold, dx, dy, range, captureFlight,
    });
    if (contact) {
        const caught = await resolveGoldMonsterContact({
            state, monster: contact, gold,
            wakeMonster, angerMonster,
        });
        if (caught)
            return true;
    }
    else if (await shipObject(gold, x, y, { state: requireInitializedGame(state) })) {
        return true;
    }
    await settleGoldOnFloor(state, gold, x, y, 0, 'sellobj');
    return true;
}
export async function resolveQuiveredGoldThrow({ state, gold, dx = 0, dy = 0, dz = 0, captureFlight = null, wakeMonster = null, }) {
    if (!gold || gold !== heroGoldObject(state) || gold !== state.uquiver)
        return false;
    gold = detachHeroGold(state, 1);
    if (!gold)
        return false;
    gold.how_lost = LOST_THROWN;
    // throwit() probes every cursed or greased horizontal object, but a coin
    // is not a throwing weapon so only grease can turn that probe into a
    // slip.  The two direction draws may convert the throw into a drop.
    if ((gold.cursed || gold.greased) && (dx || dy) && rn2(7) === 0
        && gold.greased) {
        dx = rn2(3) - 1;
        dy = rn2(3) - 1;
        if (!dx && !dy)
            dz = 1;
    }
    if (state.u?.uswallow && state.u?.ustuck) {
        return resolveQuiveredGoldMonsterContact({
            state, monster: state.u.ustuck, gold,
            swallowed: true, wakeMonster,
        });
    }
    if (dz) {
        if (dz < 0) {
            await tossObjectUp(gold, { state });
        }
        else {
            await hitFloorWithObject(gold, { state });
        }
        return true;
    }
    const underwater = !!(state.underwater || state.u?.uinwater);
    const range = underwater ? 1 : heroThrowRange(gold, state);
    const { x, y, contact } = await flyHeroThrownObject({
        state, object: gold, dx, dy, range, captureFlight,
    });
    if (contact) {
        await resolveQuiveredGoldMonsterContact({
            state, monster: contact, gold, wakeMonster,
        });
    }
    const endpoint = state.level?.at?.(x, y);
    if (endpoint && !IS_SOFT(endpoint.typ))
        rn2(100);
    await settleGoldOnFloor(state, gold, x, y, 0, 'checkShopObj');
    return true;
}
//# sourceMappingURL=gold_throw.js.map