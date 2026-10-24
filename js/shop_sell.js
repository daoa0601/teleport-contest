import { currency } from './currency.js';
// C shk.c:sellobj() - the hero drops something in a shop and can sell it -
// plus sellobj_state()'s command disposition.
import { objectMaterial } from './object_material.js';
import { monsterGoldAmount, moneyToHero } from './shop_money.js';
import { nameShopTransaction } from './shop_speech.js';
import { objectDescription } from './object_description.js';
import { definiteName, objectCombatName, observeObjectForNaming, simpleObjectName } from './objnam.js';
import { QBUFSZ, SHOPBASE } from './const.js';
import { shopkeeperName } from './monster_name.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { requireShopGame } from './shop_types.js';
import { containedGold } from './gold.js';
import { recordObjectPriceQuote, } from './object_knowledge.js';
import { CORPSE, EGG, OBJECT_COST, OBJECT_NAMES, TIN, } from './object_data.js';
import { inTown } from './room.js';
import { heroIsDeaf } from './senses.js';
import { costlySpot, objectIsUnpaid, removeObjectAndContentsFromBill, objectTypeKnown } from './shk.js';
import { objectIsCandle, objectPricingUnits, shopGetPrice, shopkeeperIsMuted, } from './shop_loss.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { promptYesNoAllQuit } from './query.js';
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const POT_FRUIT_JUICE = OBJECT_NAMES.indexOf('fruit juice');
const POT_BOOZE = OBJECT_NAMES.indexOf('booze');
const POT_WATER = OBJECT_NAMES.indexOf('water');
const POT_HEALING = OBJECT_NAMES.indexOf('healing');
const POT_FULL_HEALING = OBJECT_NAMES.indexOf('full healing');
const POT_OIL = OBJECT_NAMES.indexOf('oil');
const ICE_BOX = OBJECT_NAMES.indexOf('ice box');
const LEATHER_GLOVES = OBJECT_NAMES.indexOf('leather gloves');
const ELVEN_CLOAK = OBJECT_NAMES.indexOf('elven cloak');
const SCR_FOOD_DETECTION = OBJECT_NAMES.indexOf('food detection');
const LUMP_OF_ROYAL_JELLY = OBJECT_NAMES.indexOf('lump of royal jelly');
const WAX_CANDLE = OBJECT_NAMES.indexOf('wax candle');
const TALLOW_CANDLE = OBJECT_NAMES.indexOf('tallow candle');
const BRASS_LANTERN = OBJECT_NAMES.indexOf('brass lantern');
const OIL_LAMP = OBJECT_NAMES.indexOf('oil lamp');
const MAGIC_LAMP = OBJECT_NAMES.indexOf('magic lamp');
const CANDELABRUM_OF_INVOCATION = OBJECT_NAMES.indexOf('Candelabrum of Invocation');
const WAN_LIGHT = OBJECT_NAMES.indexOf('light', 410);
const SCR_LIGHT = OBJECT_NAMES.indexOf('light', 323);
const SPE_LIGHT = OBJECT_NAMES.indexOf('light', 366);
const DUNCE_CAP = 94;
const FIRST_REAL_GEM = OBJECT_NAMES.indexOf('dilithium crystal');
const BILLSZ = 200; // C include/mextra.h
export const SELL_NORMAL = 0;
export const SELL_DELIBERATE = 1;
export const SELL_DONTSELL = 2;
// C gs.sell_response / gs.sell_how / ga.auto_credit are command-batch
// globals bracketed by dodrop()/doddrop() through sellobj_state().  decl.c
// starts them at 'a' / SELL_NORMAL, so an accidental drop before any
// deliberate one sells without a query, like every later one.
// setSellDisposition(SELL_NORMAL) restores that automatic 'a' response; the
// parent's drop owner brackets deliberate drops and restores SELL_NORMAL in
// a finally.
let sellResponse = 'a';
let sellHow = SELL_NORMAL;
let autoCredit = false;
export function setSellDisposition(disposition) {
    sellResponse = disposition === SELL_NORMAL ? 'a' : '';
    sellHow = disposition;
    autoCredit = false;
}
function objectQuan(object) {
    return object.quan ?? object.quantity ?? 1;
}
function moneyAmount(amount, state) {
    return `${amount} ${currency(amount, { state })}`;
}
function goldPieces(amount) {
    return `${amount} gold piece${amount === 1 ? '' : 's'}`;
}
// ---- saleable(): C shknam.c:805 over the shtypes stock table ------------
const VEGETARIAN_PSEUDO = Symbol('vegetarian');
const SHOP_STOCK = [
    null, // general store: RANDOM_CLASS stocks everything
    [{ class: ARMOR_CLASS }, { class: WEAPON_CLASS }],
    [{ class: SCROLL_CLASS }, { class: SPBOOK_CLASS }],
    [{ class: POTION_CLASS }],
    [{ class: WEAPON_CLASS }, { class: ARMOR_CLASS }],
    [{ class: FOOD_CLASS }, { otyp: POT_FRUIT_JUICE }, { otyp: POT_BOOZE },
        { otyp: POT_WATER }, { otyp: ICE_BOX }],
    [{ class: 4 }, { class: GEM_CLASS }, { class: 5 }],
    [{ class: WAND_CLASS }, { otyp: LEATHER_GLOVES },
        { otyp: ELVEN_CLOAK }],
    [{ class: TOOL_CLASS }],
    [{ class: SPBOOK_CLASS }, { class: SCROLL_CLASS }],
    [{ veggy: VEGETARIAN_PSEUDO }, { otyp: POT_FRUIT_JUICE },
        { otyp: POT_HEALING }, { otyp: POT_FULL_HEALING },
        { otyp: SCR_FOOD_DETECTION }, { otyp: LUMP_OF_ROYAL_JELLY }],
    [{ otyp: WAX_CANDLE }, { otyp: TALLOW_CANDLE },
        { otyp: BRASS_LANTERN }, { otyp: OIL_LAMP }, { otyp: MAGIC_LAMP },
        { otyp: POT_OIL }, { otyp: WAN_LIGHT }, { otyp: SCR_LIGHT },
        { otyp: SPE_LIGHT }],
];
const S_BLOB = 2, S_JELLY = 10, S_FUNGUS = 32, S_VORTEX = 22, S_LIGHT = 25, S_GHOST = 54, S_ELEMENTAL = 31, S_PUDDING = 42, S_GOLEM = 55;
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const PM_LEATHER_GOLEM = MONSTER_NAME.indexOf('leather golem');
const PM_BLACK_PUDDING = MONSTER_NAME.indexOf('black pudding');
// C mondata.h vegan()/vegetarian() over monster symbols; noncorporeal()
// is exactly S_GHOST (wraiths are unsolid but not vegan).
function veganSpecies(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === undefined)
        return false;
    return [S_BLOB, S_JELLY, S_FUNGUS, S_VORTEX, S_LIGHT].includes(symbol)
        || symbol === S_GHOST
        || (symbol === S_ELEMENTAL && mnum !== PM_STALKER)
        || (symbol === S_GOLEM && mnum !== PM_FLESH_GOLEM
            && mnum !== PM_LEATHER_GOLEM);
}
function vegetarianSpecies(mnum) {
    return veganSpecies(mnum)
        || (MONSTER_SYMBOL[mnum] === S_PUDDING
            && mnum !== PM_BLACK_PUDDING);
}
// C shknam.c:380 veggy_item().
function veggyItem(object) {
    if (object.oclass !== FOOD_CLASS)
        return false;
    if (objectMaterial(object.otyp) === 3 || object.otyp === EGG)
        return true;
    // C marks spinach tins with corpsenm NON_PM (-1).
    if (object.otyp === TIN && object.corpsenm === -1)
        return object.spe === 1; // 0 = empty, 1 = spinach
    if (object.otyp === TIN || object.otyp === CORPSE) {
        return typeof object.corpsenm === 'number' && Number.isInteger(object.corpsenm)
            && object.corpsenm >= 0
            && object.corpsenm < MONSTER_NAME.length
            && vegetarianSpecies(object.corpsenm);
    }
    return false;
}
// Pure stock-membership test (probabilities are generation-only in C).
export function shopStocksObject(shoptype, object) {
    const stock = SHOP_STOCK[shoptype - SHOPBASE];
    if (stock == null)
        return true;
    return stock.some(entry => 'veggy' in entry ? veggyItem(object)
        : 'class' in entry ? object.oclass === entry.class
            : object.otyp === entry.otyp);
}
function saleable(resident, object) {
    return shopStocksObject(resident?.eshk?.shoptype ?? SHOPBASE, object);
}
// ---- pricing: C shk.c:set_cost() over the shared pure price owner ------
// Charisma and surcharge never enter the sell price.
export function shopOfferForObject(object, resident, state = game) {
    let tmp = objectPricingUnits(object)
        * shopGetPrice(object, true, state);
    let multiplier = 1;
    let divisor = 1;
    if (state.uarmh?.otyp === DUNCE_CAP) {
        divisor *= 3;
    }
    else if ((state.urole?.key === 'tourist'
        && (state.u?.ulevel ?? 1) < 15)
        || (state.uarmu && !state.uarm && !state.uarmc)) {
        divisor *= 3;
    }
    else {
        divisor *= 2;
    }
    const unknown = !object.dknown || !objectTypeKnown(object, state);
    if (unknown) {
        if (object.oclass === GEM_CLASS) {
            if ([19, 20].includes(objectMaterial(object.otyp))) {
                tmp = (object.otyp - FIRST_REAL_GEM)
                    % (6 - (resident?.m_id ?? 1) % 3);
                tmp = (tmp + 3) * objectQuan(object);
                divisor = 1;
            }
        }
        else if (tmp > 1 && (resident?.m_id ?? 1) % 4 === 0) {
            multiplier *= 3;
            divisor *= 4;
        }
    }
    if (tmp >= 1) {
        tmp *= multiplier;
        if (divisor > 1) {
            tmp = Math.trunc((Math.trunc((tmp * 10) / divisor) + 5) / 10);
        }
        if (tmp < 1)
            tmp = 1;
    }
    return tmp;
}
// ---- sellobj helpers ----------------------------------------------------
// C shk.c:1381 rouse_shk(): greed-induced recovery.
export async function rouseShopkeeper(resident, publish = plineWithContinuation) {
    if (monsterIsHelpless(resident)) {
        if (canSpotMonster(resident)) {
            await publish(`${shopkeeperName(resident)} ${resident.msleeping ? 'wakes up' : 'can move again'}.`);
        }
        resident.msleeping = 0;
        resident.mfrozen = 0;
        resident.mcanmove = 1;
    }
}
// C shk.c:3873 donate_gold().
export async function donateGold(amount, resident, { selling = true, publish = plineWithContinuation, state = game } = {}) {
    const eshk = resident.eshk;
    if ((eshk.debit ?? 0) >= amount) {
        if (eshk.loan) {
            eshk.loan = (eshk.loan ?? 0) > amount
                ? eshk.loan - amount : 0;
        }
        eshk.debit = (eshk.debit ?? 0) - amount;
        await publish(`Your debt is ${eshk.debit ? 'partially ' : ''}paid off.`);
    }
    else {
        const delta = amount - (eshk.debit ?? 0);
        eshk.credit = (eshk.credit ?? 0) + delta;
        if (eshk.debit) {
            eshk.debit = 0;
            eshk.loan = 0;
            await publish('Your debt is paid off.');
        }
        if (eshk.credit === delta) {
            await publish(`You have ${selling ? '' : 're-'}established ${moneyAmount(delta, state)} credit.`);
        }
        else {
            await publish(`${moneyAmount(delta, state)} added${selling ? '' : ' back'} to your credit; total is now ${moneyAmount(eshk.credit, state)}.`);
        }
    }
}
// C shk.c:5745 costly_gold(): picking gold up in a shop pays down credit
// first, then becomes debt and loan.
export async function costlyGold(x, y, amount, { silent = false, publish = plineWithContinuation, state = game } = {}) {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot)
        return null;
    const eshk = spot.resident.eshk;
    if ((eshk.credit ?? 0) >= amount) {
        if (!silent) {
            if ((eshk.credit ?? 0) > amount) {
                await publish(`Your credit is reduced by ${moneyAmount(amount, state)}.`);
            }
            else {
                await publish('Your credit is erased.');
            }
        }
        eshk.credit = (eshk.credit ?? 0) - amount;
    }
    else {
        const delta = amount - (eshk.credit ?? 0);
        if (!silent) {
            if (eshk.credit)
                await publish('Your credit is erased.');
            if (eshk.debit) {
                await publish(`Your debt increases by ${moneyAmount(delta, state)}.`);
            }
            else {
                await publish(`You owe ${shopkeeperName(spot.resident)} ${moneyAmount(delta, state)}.`);
            }
        }
        eshk.debit = (eshk.debit ?? 0) + delta;
        eshk.loan = (eshk.loan ?? 0) + delta;
        eshk.credit = 0;
    }
    return spot.resident;
}
// C shk.c:3103 special_stock(): the candelabrum in a lighting store.
async function specialStock(resident, object, { publish, state }) {
    if ((resident?.eshk?.shoptype ?? SHOPBASE) !== SHOPBASE + 11
        || object.otyp !== CANDELABRUM_OF_INVOCATION)
        return false;
    // C is_izchak(shkp, TRUE): a shopkeeper in town whose (prefix-stripped)
    // name is Izchak; hallucination is overridden at this call site.
    const stripped = (resident.eshk.shknam ?? '').replace(/^[^a-zA-Z]/, '');
    const izchak = !!resident.isshk
        && inTown(state.level, resident.mx, resident.my)
        && stripped === 'Izchak';
    if (izchak && !state.u?.uevent?.invoked) {
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            await publish('"No thanks, I\'d hang onto that if I were you."');
            if ((object.spe ?? 0) < 7) {
                const missing = 7 - (object.spe ?? 0);
                await publish(`"You'll need ${missing}${(object.spe ?? 0) > 0 ? ' more' : ''} candle${missing === 1 ? '' : 's'} to go along with it."`);
            }
        }
        else {
            await publish(`${shopkeeperName(resident)} seems ${(object.spe ?? 0) < 7 ? 'horrified' : 'concerned'} that you want to sell that.`);
        }
    }
    else if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
        await publish('"I won\'t stock that.  Take it out of here!"');
    }
    else {
        await publish(`${shopkeeperName(resident)} shakes their head in refusal.`);
    }
    return true;
}
// C shk.c:3064 dropped_container().
function droppedContainerContents(object, resident, sale) {
    for (const content of object.contents || []) {
        if (content.oclass === COIN_CLASS)
            continue;
        if (!content.unpaid && !(sale && saleable(resident, content)))
            content.no_charge = true;
        if (content.contents?.length)
            droppedContainerContents(content, resident, sale);
    }
}
// C shk.c:2995 contained_cost(usell = TRUE): sell-side content price.
function containedSellCost(object, resident, state) {
    let price = 0;
    for (const content of object.contents || []) {
        if (content.oclass === COIN_CLASS)
            continue;
        if (saleable(resident, content) && !content.unpaid
            && content.oclass !== BALL_CLASS
            && !(content.oclass === FOOD_CLASS && content.oeaten)
            && !(objectIsCandle(content)
                && (content.age ?? 0)
                    < 20 * (OBJECT_COST[content.otyp] ?? 0))) {
            price += shopOfferForObject(content, resident, state);
        }
        if (content.contents?.length) {
            price += containedSellCost(content, resident, state);
        }
    }
    return price;
}
function countUnpaidContents(container) {
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countUnpaidContents(content);
        if (content.unpaid)
            count += objectQuan(content);
    }
    return count;
}
function countAllContents(container) {
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countAllContents(content);
        count += objectQuan(content);
    }
    return count;
}
function isGold(object) {
    return object.oclass === COIN_CLASS;
}
function hasContents(object) {
    return !!(object.contents?.length);
}
// C sellobj() uses the shared ynaq confirmation with default yes.
function askSell(question, { query }) {
    return query(question);
}
// C safe_qbuf() reserves the offer and question before short_oname()
// abbreviates user names. Cash offers use xname/simpleonames; credit offers
// use doname/thesimpleoname. The object's full names survive the question.
async function saleQuestion(object, prefix, suffix, one, state, kind) {
    const limit = QBUFSZ - 1 - prefix.length - suffix.length;
    const describe = async (item, nameState) => {
        if (kind === 'cash')
            return objectCombatName(item, { state: nameState, includeCorpseSpecies: false });
        observeObjectForNaming(item, { state: nameState });
        return await objectDescription(item, { state: nameState });
    };
    const question = (name) => `${prefix}${name}${suffix}`;
    let name = await describe(object, state);
    if (name.length <= limit)
        return question(name);
    const callName = state._objectCallNames?.[object.otyp];
    const personalName = object.oextra?.oname || object.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...state, _objectCallNames: {
                ...state._objectCallNames, [object.otyp]: `${callName.slice(0, 8)}...`,
            } } : state;
    const shortNamedObject = personalName && personalName.length >= 12
        ? { ...object, oextra: { ...object.oextra, oname: `${personalName.slice(0, 8)}...` } }
        : object;
    if (shortCallState !== state) {
        name = await describe(object, shortCallState);
        if (name.length <= limit)
            return question(name);
    }
    if (shortNamedObject !== object) {
        name = await describe(shortNamedObject, state);
        if (name.length <= limit)
            return question(name);
    }
    const shortenBoth = shortCallState !== state && shortNamedObject !== object;
    if (shortenBoth) {
        name = await describe(shortNamedObject, shortCallState);
        if (name.length <= limit)
            return question(name);
    }
    // Native retains abbreviated names during attribute removal only when
    // both names needed shortening; the separate attempts restore them.
    const nameState = shortenBoth ? shortCallState : state;
    const plainObject = { ...(shortenBoth ? shortNamedObject : object),
        bknown: false, rknown: false, greased: false, oeroded: 0, oeroded2: 0 };
    name = await describe(plainObject, nameState);
    if (name.length > limit) {
        name = simpleObjectName(plainObject, nameState);
        if (kind === 'credit')
            name = definiteName(name, nameState);
    }
    if (name.length > limit)
        name = one ? 'that' : 'those';
    return question(name);
}
// ---- the owner: C shk.c:3927 sellobj() -----------------------------------
export async function sellHeroDroppedObject(object, x, y, state = game, { publish = plineWithContinuation, query = promptYesNoAllQuit } = {}) {
    requireLiveGame(state);
    requireShopGame(state);
    // do cheapest exclusion test first: the hero's own shop membership.
    if (!state.u.ushops.length)
        return { sold: false };
    const spot = costlySpot(x, y, state);
    if (!spot)
        return { sold: false };
    const resident = spot.resident;
    const eshk = resident.eshk;
    const container = hasContents(object);
    const gold = isGold(object);
    if (object.unpaid && !container && !gold) {
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }
    let cltmp = 0;
    let gltmp = 0;
    let cgold = false;
    if (container) {
        // find the price of contents before removing anything from the bill
        cltmp = containedSellCost(object, resident, state);
        gltmp = containedGold(object, true);
        cgold = gltmp > 0;
    }
    const saleitem = saleable(resident, object);
    let ltmp = 0;
    if (!gold && !object.unpaid && saleitem)
        ltmp = shopOfferForObject(object, resident, state);
    let offer = ltmp + cltmp;
    // you dropped something of your own - probably want to sell it
    await rouseShopkeeper(resident, publish);
    if (!resident.mpeaceful) {
        // they become shop-objects, no pay
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            await publish('"Thank you, scum!"');
        }
        else {
            await publish(`${shopkeeperName(resident)} smirks with satisfaction.`);
        }
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }
    // get one case out of the way: nothing to sell, and no gold
    if (!(gold || cgold)
        && ((offer + gltmp) === 0 || sellHow === SELL_DONTSELL)) {
        // C is_unpaid(): the flag or any unpaid descendant.
        const unpaid = objectIsUnpaid(object);
        if (container) {
            droppedContainerContents(object, resident, false);
            if (!object.unpaid)
                object.no_charge = true;
            if (unpaid)
                removeObjectAndContentsFromBill(object, state);
        }
        else {
            object.no_charge = true;
        }
        if (!unpaid && sellHow !== SELL_DONTSELL
            && !(await specialStock(resident, object, { publish, state }))) {
            await publish(`${shopkeeperName(resident)} seems uninterested.`);
        }
        return { sold: false };
    }
    if (eshk.robbed) {
        // bones; shop robbed by previous customer
        if (gold)
            offer = objectQuan(object);
        else if (cgold)
            offer += 1; // C adds the boolean, not the amount
        // In pinned C, '<' binds before '-=' in the balance update.
        // The existing nonzero robbed balance therefore clears even when
        // this contribution is worth less than the loss.
        eshk.robbed = 0;
        if (offer && !heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            await publish('"Thank you for your contribution to restock this recently plundered shop."');
        }
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }
    if (gold || cgold) {
        if (!cgold)
            gltmp = objectQuan(object);
        await donateGold(gltmp, resident, { selling: true, publish });
        if (!offer || sellHow === SELL_DONTSELL) {
            if (!gold) {
                if (container)
                    droppedContainerContents(object, resident, false);
                if (!object.unpaid)
                    object.no_charge = true;
                removeObjectAndContentsFromBill(object, state);
            }
            return { sold: false };
        }
    }
    if ((!saleitem && !(container && cltmp > 0))
        || (eshk.bill || []).length === BILLSZ
        || object.oclass === BALL_CLASS || object.oclass === CHAIN_CLASS
        || offer === 0
        || (object.oclass === FOOD_CLASS && object.oeaten)
        || (objectIsCandle(object)
            && (object.age ?? 0) < 20 * (OBJECT_COST[object.otyp] ?? 0))) {
        await publish(`${shopkeeperName(resident)} seems uninterested${cgold ? ' in the rest' : ''}.`);
        if (container)
            droppedContainerContents(object, resident, false);
        object.no_charge = true;
        return { sold: false };
    }
    const shkmoney = monsterGoldAmount(resident);
    if (!shkmoney) {
        const tmpcr = Math.trunc((offer * 9) / 10) + (offer <= 1 ? 1 : 0);
        let answer;
        if (sellHow === SELL_NORMAL || autoCredit) {
            answer = sellResponse = 'y';
        }
        else if (sellResponse !== 'n') {
            await publish(`${shopkeeperName(resident)} cannot pay you at present.`);
            recordObjectPriceQuote(object.otyp, Math.trunc(tmpcr / objectQuan(object)), 'sell');
            const prefix = `Will you accept ${moneyAmount(tmpcr, state)} in credit for `;
            answer = await askSell(await saleQuestion(object, prefix, '?', object.quan === 1, state, 'credit'), { query });
            if (answer === 'a') {
                answer = 'y';
                autoCredit = true;
            }
        }
        else {
            answer = 'n';
        }
        if (answer === 'y') {
            const creditAmount = `${tmpcr} zorkmid${tmpcr === 1 ? '' : 's'}`;
            await nameShopTransaction(resident, object, it => sellHow !== SELL_NORMAL
                ? `traded ${it} for ${creditAmount} in ${(eshk.credit ?? 0) > 0 ? 'additional ' : ''}credit.`
                : `relinquish ${it} and acquire ${creditAmount} in ${(eshk.credit ?? 0) > 0
                    ? 'additional ' : ''}credit.`, { publish, state });
            eshk.credit = (eshk.credit ?? 0) + tmpcr;
            if (container)
                droppedContainerContents(object, resident, true);
            removeObjectAndContentsFromBill(object, state);
            return { sold: true, credit: tmpcr };
        }
        if (answer === 'q')
            sellResponse = 'n';
        if (container)
            droppedContainerContents(object, resident, false);
        if (!object.unpaid)
            object.no_charge = true;
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }
    const shortFunds = offer > shkmoney;
    if (shortFunds)
        offer = shkmoney;
    if (!sellResponse) {
        let yourc = 0;
        let onlyPartially = false;
        if (container) {
            const shksc = countUnpaidContents(object);
            yourc = countAllContents(object) - shksc;
            onlyPartially = shksc > 0 && yourc > 0;
        }
        const one = !ltmp ? yourc === 1
            : objectQuan(object) === 1 && !cltmp;
        let contentsSuffix = '';
        if (cltmp && ltmp) {
            contentsSuffix = onlyPartially
                ? (yourc === 1 ? ' and item inside' : ' and items inside')
                : ' and its contents';
        }
        recordObjectPriceQuote(object.otyp, Math.trunc(offer / objectQuan(object)), 'sell');
        const prefix = `${shopkeeperName(resident)} offers${shortFunds ? ' only' : ''} ${goldPieces(offer)} for ${cltmp && !ltmp
            ? (yourc === 1 ? 'your item in ' : 'your items in ') : ''}${object.unpaid ? 'the' : 'your'} `;
        const suffix = `${contentsSuffix}.  Sell ${one ? 'it' : 'them'}?`;
        const question = await saleQuestion(object, prefix, suffix, one, state, 'cash');
        const answer = await askSell(question, { query });
        if (answer === 'q')
            sellResponse = 'n';
        if (answer === 'a')
            sellResponse = 'y';
        if (answer === 'y' || answer === 'a') {
            if (container)
                droppedContainerContents(object, resident, true);
            if (!object.unpaid && !saleitem)
                object.no_charge = true;
            removeObjectAndContentsFromBill(object, state);
            await moneyToHero(resident, offer, state);
            await nameShopTransaction(resident, object, it => sellHow !== SELL_NORMAL
                ? `sold ${it} for ${goldPieces(offer)}.`
                : `relinquish ${it} and receive ${goldPieces(offer)} in compensation.`, { publish, state });
            return { sold: true, offer };
        }
    }
    else {
        // recorded response: apply it without a new query
        if (sellResponse === 'y' || sellResponse === 'a') {
            if (container)
                droppedContainerContents(object, resident, true);
            if (!object.unpaid && !saleitem)
                object.no_charge = true;
            removeObjectAndContentsFromBill(object, state);
            await moneyToHero(resident, offer, state);
            await nameShopTransaction(resident, object, it => sellHow !== SELL_NORMAL
                ? `sold ${it} for ${goldPieces(offer)}.`
                : `relinquish ${it} and receive ${goldPieces(offer)} in compensation.`, { publish, state });
            return { sold: true, offer };
        }
    }
    if (container)
        droppedContainerContents(object, resident, false);
    if (!object.unpaid)
        object.no_charge = true;
    removeObjectAndContentsFromBill(object, state);
    return { sold: false };
}
//# sourceMappingURL=shop_sell.js.map