// invent.js — Inventory display and look-here commands.
// C ref: invent.c — ddoinv(), display_inventory(), dolook().
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { encyclopediaEntries } from './encyclopedia.js';
import { objectBlessingDescription, objectDescription } from './object_description.js';
import { primaryHandDescriptionDetail } from './object_equipment_description.js';
import { ATTRIBUTE_DISPLAY_ORDER } from './attrib.js';
import { bot, clearMessageWindow, consumeHallucinatedMenuObjectGlyph, docrt, flushPendingTopline, flush_screen, formatStrength, pline, plineWithContinuation, showMessageMenu, } from './display.js';
import { showChoiceWindow, showInventoryWindow, showMultiSelectWindow, } from './windows.js';
import { nhgetch } from './input.js';
import { reassignInventoryLetters } from './inventory_prompt.js';
import { inventoryClassOrder, inventorySortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { ALTAR, MENU_TRADITIONAL, MV_KNOWS_EGG, PICK_NONE, PICK_ONE, W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_TOOL, is_pit, } from './const.js';
import { ALCHEMY_SMOCK, ARROW as FIRST_OBJECT, BAG_OF_TRICKS, EGG, CHEST, FORTUNE_COOKIE, GOLD_PIECE, HAWAIIAN_SHIRT, LARGE_BOX, MAGIC_MARKER, HEAVY_IRON_BALL, LOCK_PICK, CREDIT_CARD, SKELETON_KEY, OBJECT_BIMANUAL, OBJECT_INITIAL_KNOWN, OBJECT_NAMES, SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, STATUE, TIN, TIN_OPENER, TOWEL, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, BEARTRAP, BELL, BELL_OF_OPENING, BLINDFOLD, BRASS_LANTERN, BULLWHIP, CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CORPSE, CREAM_PIE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, DWARVISH_MATTOCK, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA, FIGURINE, GRAPPLING_HOOK, HORN_OF_PLENTY, LAND_MINE, LEASH, LENSES, MAGIC_LAMP, MAGIC_WHISTLE, MEAT_RING, MIRROR, OBJECT_DESCRIPTIONS, OBJECT_UNIQUE, OIL_LAMP, PICK_AXE, POT_OIL, SADDLE, STETHOSCOPE, TALLOW_CANDLE, TINNING_KIT, TIN_WHISTLE, UNICORN_HORN, WAX_CANDLE, WOODEN_FLUTE, } from './object_data.js';
import { MONSTER_GROWTH_TARGET } from './monster_data.js';
import { definiteName, objectCombatName, objectName, observeObjectForNaming, simpleObjectName, singularObjectName } from './objnam.js';
import { learnObjectType, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { getLine, promptYesNoAllQuit } from './query.js';
import { isGrayStone, isWeaponTool, objectUsesCharges } from './object_properties.js';
import { ammunitionMatchesLauncher, isBlade, isTwoWeaponObject } from './weapon_type.js';
import { heroCanUseTwoWeapons } from './two_weapon.js';
import { heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { heroFingerName, heroHandName } from './body_parts.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { objectIsVulnerableToErosion } from './object_erosion.js';
import { discoverArtifact } from './artifacts.js';
import { isContainer } from './container.js';
import { isEdibleFood } from './food_selection.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { objectWeight } from './weight.js';
import { readFloorEngraving, showFloorPile } from './floor_object_display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName } from './terrain_name.js';
import { dungeonFeatureSentenceAt } from './dungeon_feature.js';
import { impossible } from './diagnostics.js';
import { armorSimpleName, armorSlotFor } from './armor.js';
import { objectTypeKnown, currentShopResident, shopkeeperInOwnShop } from './shk.js';
const COIN_CLASS = 12;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
// C check_invent_gold(): only malformed purses may be reorganized.
export async function checkInventoryGold(why, state = game) {
    const gold = state.inventory.filter(object => object.oclass === COIN_CLASS);
    const wrongSlots = gold.filter(object => object.invlet !== '$').length;
    if (gold.length <= 1 && wrongSlots === 0)
        return false;
    const wrongSlotMessage = wrongSlots > 1 ? 'gold in wrong slots'
        : wrongSlots === 1 ? 'gold in wrong slot' : '';
    await impossible(`${why}: ${wrongSlotMessage}${wrongSlots && gold.length > 1 ? ' and ' : ''}${gold.length > 1 ? 'multiple gold stacks' : ''}`, { state });
    return true;
}
function objectNeedsFullIdentification(object) {
    if (!object || object.oclass === COIN_CLASS)
        return false;
    const typeKnown = OBJECT_INITIAL_KNOWN[object.otyp] || object.typeKnown
        || game._knownObjectTypes?.has(object.otyp);
    if (!object.known || !object.bknown || !object.dknown || !typeKnown)
        return true;
    if ((!object.cknown && (isContainer(object) || object.otyp === STATUE))
        || (!object.lknown && [CHEST, LARGE_BOX].includes(object.otyp)))
        return true;
    if (object.oartifact && !game._artifactDiscoveries?.includes(object.oartifact))
        return true;
    if (object.rknown || !([2, 3, 15].includes(object.oclass) || isWeaponTool(object)))
        return false;
    return ['rust', 'burn', 'rot', 'corrosion', 'crack'].some(kind => objectIsVulnerableToErosion(object, kind));
}
function learnEggType(mnum, state) {
    const adult = MONSTER_GROWTH_TARGET[mnum] ?? mnum;
    if (!Array.isArray(state.mvitals))
        state.mvitals = [];
    const vital = state.mvitals[adult]
        || (state.mvitals[adult] = { mvflags: 0, born: 0, died: 0 });
    vital.mvflags = (vital.mvflags ?? 0) | MV_KNOWS_EGG;
}
export function fullyIdentifyObject(object, state = game) {
    const realObjectType = object.otyp >= FIRST_OBJECT;
    if (realObjectType)
        learnObjectType(object.otyp, state);
    if (object.oartifact)
        discoverArtifact(object.oartifact, state);
    if (realObjectType)
        object.typeKnown = true;
    object.known = true;
    object.bknown = true;
    object.rknown = true;
    if (realObjectType && !heroIsHallucinating(state))
        object.dknown = true;
    object.buc = object.blessed ? 'blessed'
        : object.cursed ? 'cursed' : 'uncursed';
    const canonical = OBJECT_NAMES[object.otyp];
    if (canonical && object.oclass === SCROLL_CLASS) {
        object.name = `scroll of ${canonical}`;
        object.plural = `scrolls of ${canonical}`;
    }
    else if (canonical && object.oclass === SPBOOK_CLASS) {
        object.name = `spellbook of ${canonical}`;
        object.plural = `spellbooks of ${canonical}`;
    }
    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = true;
        object.lknown = true;
    }
    else if (object.otyp === TIN) {
        object.cknown = true;
    }
    if (object.otyp === EGG && object.corpsenm !== undefined && eggHasMonsterSpecies(object))
        learnEggType(object.corpsenm, state);
}
function identificationBuc(object) {
    if (object.oclass === COIN_CLASS)
        return game.flags.goldX ? 'X' : 'U';
    if (!object.bknown)
        return 'X';
    return object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
function hasUnpaidContents(object) {
    return !!object.unpaid || (object.contents || []).some(hasUnpaidContents);
}
function traditionalIdentifyChoices(candidates) {
    const classes = [...new Set(candidates.map(object => OBJECT_CLASS_SYMBOLS[object.oclass]))];
    const inventory = game.inventory;
    // Native count_buc() lets a priest recognize even objects which are
    // omitted by this identification's eligibility filter.
    if (game.urole?.key === 'priest') {
        for (const object of inventory)
            object.bknown = object.oclass !== COIN_CLASS;
    }
    const eligible = inventory.filter(objectNeedsFullIdentification);
    let choices = classes.join('') + ' ';
    if (inventory.some(hasUnpaidContents))
        choices += 'u';
    for (const category of 'BUCX') {
        if (eligible.some(object => identificationBuc(object) === category))
            choices += category;
    }
    if (inventory.some(object => object.pickup_prev))
        choices += 'P';
    return choices + 'aim';
}
async function parseIdentificationCategories(answer) {
    const classes = [];
    const beatitudes = new Set();
    let unpaid = false, picked = false, all = false, menu = false;
    for (const symbol of answer) {
        if (symbol === ' ' || symbol === 'A')
            continue;
        if (symbol === 'a')
            all = true;
        else if (symbol === 'm')
            menu = true;
        else if (symbol === 'u')
            unpaid = true;
        else if (symbol === 'P')
            picked = true;
        else if (symbol === 'B' || symbol === 'U' || symbol === 'C' || symbol === 'X')
            beatitudes.add(symbol);
        else {
            const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
            if (objectClass <= 0)
                await plineWithContinuation(`You don't have any ${symbol}'s.`);
            else if (!classes.includes(objectClass))
                classes.push(objectClass);
        }
    }
    return { classes, beatitudes, unpaid, picked, all, menu };
}
function matchesIdentificationCategories(object, categories) {
    if (categories.unpaid && !hasUnpaidContents(object))
        return false;
    if (categories.beatitudes.size && !categories.beatitudes.has(identificationBuc(object)))
        return false;
    return !categories.picked || !!object.pickup_prev;
}
// C ggetobj()/askchain(), restricted to identify. Category order controls
// which class is questioned first; identifying never splits a stack.
async function identifyTraditionally(limit) {
    const identified = [];
    while (limit > 0) {
        const candidates = game.inventory.filter(objectNeedsFullIdentification);
        if (!candidates.length)
            return { identified, remaining: 0 };
        const choices = traditionalIdentifyChoices(candidates);
        await flushPendingTopline();
        clearMessageWindow();
        const answer = await getLine(`What kinds of thing do you want to identify? [${choices}]`, (_character, key) => key >= 32 && key < 127);
        // Native ggetobj returns zero here; identify_pack asks again while
        // identification allowance remains. The per-item q choice quits.
        if (answer === null)
            continue;
        if (answer.includes('i')) {
            await showInventoryWindow(inventorySections(candidates, false), { pickMode: PICK_ONE });
            continue;
        }
        const categories = await parseIdentificationCategories(answer);
        if (categories.menu)
            return { identified, remaining: limit };
        let all = categories.all;
        let questioned = 0;
        const letterOrder = '$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#';
        const inventory = [...game.inventory].sort((a, b) => (a.invlet == null ? -1 : letterOrder.indexOf(a.invlet))
            - (b.invlet == null ? -1 : letterOrder.indexOf(b.invlet)));
        const classes = categories.classes.length ? categories.classes : [null];
        for (const objectClass of classes) {
            for (const [index, object] of inventory.entries()) {
                if ((objectClass !== null && object.oclass !== objectClass)
                    || !objectNeedsFullIdentification(object)
                    || !matchesIdentificationCategories(object, categories))
                    continue;
                let response = 'y';
                if (!all) {
                    observeObjectForNaming(object);
                    const letter = game.flags.fixinv === false
                        ? letterOrder.charAt(Math.min(index + (inventory[0]?.oclass === COIN_CLASS ? 0 : 1), 53))
                        : object.invlet;
                    const description = inventoryItemDescription(object, {
                        primaryHandDetail: inventoryPrimaryHandDetail(object),
                    });
                    await flushPendingTopline();
                    response = await promptYesNoAllQuit(`${letter} - ${description}?`, 'n');
                }
                if (response === 'q')
                    return { identified, remaining: 0 };
                questioned++;
                if (response === 'n')
                    continue;
                if (response === 'a')
                    all = true;
                await identifyAndDescribe(object);
                identified.push(object);
                if (!--limit)
                    return { identified, remaining: 0 };
            }
        }
        await plineWithContinuation(questioned ? 'That was all.' : 'No applicable objects.');
    }
    return { identified, remaining: 0 };
}
async function identificationMenu(candidates, first) {
    await flushPendingTopline();
    clearMessageWindow();
    const sections = inventorySections(candidates, false).map(section => ({
        ...section,
        items: section.items.map(item => {
            if (item.key === undefined)
                throw new Error('Identification item has no inventory letter');
            const object = candidates.find(candidate => candidate.invlet === item.key);
            if (!object)
                throw new Error(`No inventory object for identification letter ${item.key}`);
            return { ...item, key: item.key, value: object };
        }),
    }));
    return await showMultiSelectWindow({
        title: `What would you like to identify ${first ? 'first' : 'next'}?`,
        sections, signalEscape: true,
    });
}
async function identifyAndDescribe(object) {
    fullyIdentifyObject(object);
    observeObjectForNaming(object);
    await plineWithContinuation(`${object.invlet} - ${inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}
// C invent.c:identify_pack()/menu_identify(). Each selection is identified
// and described before another menu opens, so resumed input sees the result.
export async function identifyPack(idLimit, learningIdentify = false) {
    let candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
    if (!candidates.length) {
        await plineWithContinuation(`You have already identified ${learningIdentify ? 'the rest' : 'all'} of your possessions.`);
        return [];
    }
    if (!idLimit || idLimit >= candidates.length) {
        const identified = [];
        for (const object of candidates) {
            if (!objectNeedsFullIdentification(object))
                continue;
            await identifyAndDescribe(object);
            identified.push(object);
        }
        return identified;
    }
    const traditional = game.flags.menu_style === MENU_TRADITIONAL
        ? await identifyTraditionally(idLimit) : { identified: [], remaining: idLimit };
    const identified = traditional.identified;
    let remaining = traditional.remaining;
    candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
    let first = true;
    let tries = 5;
    while (remaining > 0 && candidates.length) {
        const selected = await identificationMenu(candidates, first);
        if (selected === null)
            break;
        if (!selected.length) {
            if (!--tries) {
                await plineWithContinuation("That's enough tries!");
                break;
            }
            await plineWithContinuation('Choose an item; use ESC to decline.');
            continue;
        }
        const accepted = selected.slice(0, remaining);
        for (const object of accepted)
            await identifyAndDescribe(object);
        identified.push(...accepted);
        remaining -= accepted.length;
        candidates = (game.inventory || []).filter(objectNeedsFullIdentification);
        if (remaining > 0 && !candidates.length)
            await plineWithContinuation('That was all.');
        first = false;
    }
    return identified;
}
export function bucAdjectiveForName(item) {
    return objectBlessingDescription(item);
}
// Materialize only at a menu/prinv boundary. Hallucinated colors use display RNG.
export function inventoryPrimaryHandDetail(item) {
    return primaryHandDescriptionDetail(item);
}
export function inventoryItemDescription(item, options = {}) {
    return objectDescription(item, options);
}
export async function consumeInventoryItem(item, state = game) {
    requireLiveGame(state);
    const quantity = item?.quantity ?? item?.quan ?? 1;
    if (quantity > 1) {
        item.in_use = false;
        item.quantity = quantity - 1;
        item.quan = quantity - 1;
        item.owt = objectWeight(item);
        state._capacityDirty = true;
        return;
    }
    await useUpInventoryStack(item, state);
}
function rerollItemDescription(item) {
    // invent.c:reroll_menu() brackets distant_name(doname) with
    // override_ID.  Identify a temporary view rather than mutating the live
    // object or discovery tables for a character which might be rejected.
    return inventoryItemDescription({
        ...item,
        known: true,
        typeKnown: true,
        bknown: true,
        dknown: true,
        rknown: true,
        overrideIdentified: true,
    });
}
function rerollAttributeLine() {
    const values = game.u?.acurr?.a || [];
    const displayed = ATTRIBUTE_DISPLAY_ORDER.map(attribute => values[attribute]);
    return `St:${formatStrength(displayed[0])} Dx:${displayed[1] ?? '?'} `
        + `Co:${displayed[2] ?? '?'} In:${displayed[3] ?? '?'} Wi:${displayed[4] ?? '?'} `
        + `Ch:${displayed[5] ?? '?'}`;
}
async function rerollFallbackPrompt() {
    const message = 'Reroll this character? [yn] (n) ';
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    for (;;) {
        const key = await nhgetch();
        const answer = String.fromCharCode(key).toLowerCase();
        if (answer === 'y' || answer === 'n')
            return answer === 'y';
        if ([27, 32, 10, 13].includes(key))
            return false;
    }
}
// C ref: invent.c:reroll_menu().  This menu is a startup transaction, not a
// command: accepting another roll changes no turn state and keeps consuming
// the live RNG stream from its current position.
export async function rerollMenu() {
    const acceptKey = game.flags?.lootabc ? 'a' : 'p';
    const rerollKey = game.flags?.lootabc ? 'b' : 'r';
    const entries = [
        { key: acceptKey, text: 'start the game with this character' },
        { key: rerollKey, text: 'reroll another character' },
        '',
        ...(game.inventory || []).map(item => {
            observeObjectForNaming(item, { distant: true });
            return rerollItemDescription(item);
        }),
        '',
        rerollAttributeLine(),
    ];
    const key = await showChoiceWindow({
        title: 'Reroll this character?',
        entries,
        validKeys: [
            acceptKey.charCodeAt(0), rerollKey.charCodeAt(0),
            27, 32, 10, 13,
        ],
    });
    const choice = String.fromCharCode(key);
    const reroll = choice === rerollKey ? true
        : choice === acceptKey ? false : await rerollFallbackPrompt();
    if (reroll) {
        const roleplay = game.u.uroleplay;
        if (!roleplay)
            throw new Error('Reroll requires initialized roleplay options');
        roleplay.numrerolls = (roleplay.numrerolls || 0) + 1;
    }
    return reroll;
}
function inventorySections(items = game.inventory || [], includeGold = true) {
    return inventorySectionsInOrder(sortObjects(items, { mode: inventorySortMode() }), includeGold);
}
function inventorySectionsInOrder(items, includeGold = true) {
    const grouped = new Map();
    for (const item of items) {
        if (!includeGold && item.oclass === COIN_CLASS)
            continue;
        observeObjectForNaming(item);
        consumeHallucinatedMenuObjectGlyph(item);
        const heading = game.flags.sortpack === false ? null : objectClassHeading(item.oclass);
        let section = grouped.get(heading);
        if (!section) {
            section = [];
            grouped.set(heading, section);
        }
        section.push({
            ...(item.invlet == null ? {} : { key: item.invlet }),
            text: inventoryItemDescription(item, {
                primaryHandDetail: inventoryPrimaryHandDetail(item),
            }),
        });
    }
    return [...grouped].map(([heading, items]) => ({ heading, items }));
}
async function showItemActionMenu(item) {
    const repairGold = item.oclass === COIN_CLASS && await checkInventoryGold('item-action');
    return showChoiceWindow({
        title: `Do what with ${definiteName(objectCombatName(item))}?`,
        entries: itemActionEntries(item, game, repairGold),
        validKeys: [27, 32, 10, 13],
    });
}
export async function inventoryActionForObject(item) {
    return { key: inventoryActionKey(await showItemActionMenu(item)), item };
}
function itemActionEntries(item, state, repairGold) {
    const itemName = simpleObjectName(item, state);
    const entries = [];
    const alreadyWorn = !!((item.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY));
    const stack = item.quan > 1;
    const shoot = ammunitionMatchesLauncher(item, state.uwep);
    if (item === state.uwep || item === state.uswapwep || item === state.uquiver) {
        const quivered = item === state.uquiver;
        const verb = quivered ? 'Quiver' : 'Wield';
        const action = quivered ? 'un-ready' : 'un-wield';
        const noun = item.oclass === 2 || isWeaponTool(item) ? 'weapon' : 'item';
        entries.push({ key: '-', text: `${verb} '-' to ${action} ${stack ? `these ${noun}s` : `this ${noun}`}` });
    }
    const apply = itemApplyText(item, state);
    if (apply)
        entries.push({ key: 'a', text: apply });
    if (item.oclass !== COIN_CLASS && item.dknown && !item.oartifact && item.otyp !== SPE_NOVEL) {
        const named = !!(item.oextra?.oname || item.oname);
        entries.push({ key: 'c', text: `${named ? 'Rename or un-name' : 'Name'} ${OBJECT_UNIQUE[item.otyp] ? 'the' : stack ? 'this stack of' : 'this specific'} ${itemName}` });
    }
    const callName = state._objectCallNames?.[item.otyp];
    if (item.dknown && objectTypeCallable(item, state) && (!objectTypeKnown(item, state) || callName)) {
        const noun = OBJECT_UNIQUE[item.otyp] ? definiteName(itemName, state)
            : stack ? itemName : makePlural(itemName);
        entries.push({ key: 'C', text: `${callName ? 'Re-call or un-call' : 'Call'} the type for ${noun}` });
    }
    if (!alreadyWorn)
        entries.push({ key: 'd', text: `Drop this ${stack ? 'stack' : 'item'}` });
    if (item.otyp === TIN) {
        const opener = state.uwep?.otyp === TIN_OPENER ? ' with your tin opener' : '';
        entries.push({ key: 'e', text: `Open ${stack ? 'one of these tins' : 'this tin'}${opener} and eat the contents` });
    }
    else if (isEdibleFood(item, state)) {
        entries.push({ key: 'e', text: `Eat ${stack ? 'one of these' : 'this'}` });
    }
    if (item.otyp === TOWEL) {
        entries.push({ key: 'E', text: 'Wipe the floor with this towel' });
    }
    else if (item.otyp === MAGIC_MARKER) {
        entries.push({ key: 'E', text: 'Scribble graffiti on the floor' });
    }
    else if ([2, 4, 11, 13].includes(item.oclass)) {
        const engraves = isBlade(item) || item.oclass === 11
            || (item.oclass === 4 || item.oclass === 13) && !!state.objectToughness?.[item.otyp];
        const verb = engraves ? 'Engrave' : 'Write';
        const surface = surfaceName(state.u.ux, state.u.uy, state);
        entries.push({ key: 'E', text: `${verb} on the ${surface} with ${stack ? 'one of these items' : 'this item'}` });
    }
    if (item === state.uquiver) {
        const launcher = shoot && state.uwep
            ? ` with your wielded ${simpleObjectName(state.uwep, state)}` : '';
        entries.push({ key: 'f', text: `${shoot ? 'Shoot' : 'Throw'} ${stack ? 'one of these' : 'this'}${launcher}` });
    }
    if (item.oclass !== COIN_CLASS || repairGold)
        entries.push({ key: 'i', text: 'Adjust inventory by assigning new letter' });
    if (stack && item.oclass !== COIN_CLASS)
        entries.push({ key: 'I', text: 'Adjust inventory by splitting this stack' });
    if (state.level?.at(state.u.ux, state.u.uy)?.typ === ALTAR && !state.u.uswallow) {
        if (item.otyp === CORPSE)
            entries.push({ key: 'O', text: 'Offer this corpse as a sacrifice at this altar' });
        else if ([AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(item.otyp))
            entries.push({ key: 'O', text: 'Offer this amulet as a sacrifice at this altar' });
    }
    const keeper = item.unpaid ? currentShopResident(state) : null;
    if (keeper && shopkeeperInOwnShop(keeper, state))
        entries.push({ key: 'p', text: `Buy this unpaid ${stack ? 'stack' : 'item'}` });
    if (!alreadyWorn) {
        const wear = accessoryActionText(item, state);
        if (wear)
            entries.push({ key: 'P', text: wear });
    }
    if (item.oclass === 8)
        entries.push({ key: 'q', text: `Quaff (drink) ${stack ? 'one of these potions' : 'this potion'}` });
    if ([2, 13].includes(item.oclass) && item !== state.uquiver)
        entries.push({ key: 'Q', text: `Quiver this ${stack ? 'stack' : 'item'} for easy ${shoot ? 'shooting' : 'throwing'} with 'f'ire` });
    const reading = itemReadingText(item, state);
    if (reading)
        entries.push({ key: 'r', text: reading });
    if ((item.owornmask ?? 0) & W_ACCESSORY) {
        const accessory = (item.owornmask ?? 0) & W_AMUL ? 'amulet'
            : (item.owornmask ?? 0) & W_RING ? 'ring'
                : (item.owornmask ?? 0) & W_TOOL ? 'eyewear' : 'accessory';
        entries.push({ key: 'R', text: `Remove this ${accessory}` });
    }
    if ([OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN].includes(item.otyp))
        entries.push({ key: 'R', text: `Rub this ${itemName}` });
    else if (item.oclass === 13 && isGrayStone(item))
        entries.push({ key: 'R', text: 'Rub something on this stone' });
    if (!alreadyWorn) {
        const goldStack = stack && item.otyp === GOLD_PIECE;
        const quantity = stack ? goldStack ? 'them' : 'one of these' : 'this item';
        const fireAlias = item === state.uquiver && !goldStack ? " (same as 'f')" : '';
        entries.push({ key: 't', text: `${shoot ? 'Shoot' : 'Throw'} ${quantity}${fireAlias}` });
    }
    if ((item.owornmask ?? 0) & W_ARMOR)
        entries.push({ key: 'T', text: 'Take off this armor' });
    if (isContainer(item) && (item.contents?.length || !item.cknown)
        || item.otyp === HORN_OF_PLENTY && (item.spe > 0 || !item.known))
        entries.push({ key: 'T', text: 'Tip all the contents out of this container' });
    if (item.otyp === FAKE_AMULET_OF_YENDOR && !item.known
        || item.oartifact || OBJECT_UNIQUE[item.otyp] || item.otyp === CRYSTAL_BALL)
        entries.push({ key: 'V', text: 'Try to invoke a unique power of this object' });
    if (item !== state.uwep && !heroHasNoHands(state) && !heroIsVerySmall(state)) {
        const weapon = item.oclass === 2 || isWeaponTool(item)
            || item.otyp === TOWEL && item.spe > 0 || item.otyp === HEAVY_IRON_BALL;
        if (weapon) {
            entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'} as your weapon` });
        }
        else if (item.otyp === TIN_OPENER) {
            entries.push({ key: 'w', text: 'Wield the tin opener to easily open tins' });
        }
        else if (!alreadyWorn) {
            entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'} in your ${makePlural(heroHandName(state))}` });
        }
    }
    if (!alreadyWorn && item.oclass === 3) {
        const slot = armorSlotFor(item.otyp);
        const worn = slot ? state[slot] : null;
        entries.push({ key: 'W', text: worn ? `[already wearing ${withIndefiniteArticle(armorSimpleName(worn, state))}]`
                : 'Wear this armor' });
    }
    if (item === state.uwep)
        entries.push({ key: 'x', text: state.uswapwep
                ? 'Swap this with your alternate weapon' : 'Ready this as an alternate weapon' });
    else if (item === state.uswapwep)
        entries.push({ key: 'x', text: 'Swap this with your main weapon' });
    if ((item === state.uwep || item === state.uswapwep)
        && (state.u.twoweap || heroCanUseTwoWeapons(state) && !state.uarms
            && isTwoWeaponObject(state.uwep) && state.uwep && !OBJECT_BIMANUAL[state.uwep.otyp]
            && isTwoWeaponObject(state.uswapwep) && state.uswapwep && !OBJECT_BIMANUAL[state.uswapwep.otyp]))
        entries.push({ key: 'X', text: `Toggle two-weapon combat ${state.u.twoweap ? 'off' : 'on'}` });
    if (item.oclass === 11)
        entries.push({ key: 'z', text: 'Zap this wand to release its magic' });
    if (encyclopediaEntries(singularObjectName(item, state), state).length)
        entries.push({ key: '/', text: `Look up information about ${stack ? 'these' : 'this'}` });
    return entries;
}
function itemApplyText(item, state) {
    const light = item.lamplit ? 'Extinguish' : 'Light';
    if (item.oclass === COIN_CLASS)
        return 'Flip a coin';
    if (item.otyp === CREAM_PIE)
        return 'Hit yourself with this cream pie';
    if (item.otyp === BULLWHIP)
        return 'Lash out with this whip';
    if (item.otyp === GRAPPLING_HOOK)
        return 'Grapple something with this hook';
    if (item.otyp === BAG_OF_TRICKS)
        return objectTypeKnown(item, state) ? 'Reach into this bag' : 'Open this container';
    if (isContainer(item))
        return 'Open this container';
    switch (item.otyp) {
        case CAN_OF_GREASE: return 'Use the can to grease an item';
        case LOCK_PICK:
        case CREDIT_CARD:
        case SKELETON_KEY: return 'Use this tool to pick a lock';
        case TINNING_KIT: return 'Use this kit to tin a corpse';
        case LEASH: return 'Tie a pet to this leash';
        case SADDLE: return 'Place this saddle on a pet';
        case MAGIC_WHISTLE:
        case TIN_WHISTLE: return 'Blow this whistle';
        case EUCALYPTUS_LEAF: return 'Use this leaf as a whistle';
        case STETHOSCOPE: return 'Listen through the stethoscope';
        case MIRROR: return 'Show something its reflection';
        case BELL:
        case BELL_OF_OPENING: return 'Ring the bell';
        case CANDELABRUM_OF_INVOCATION: return `${light} the candelabrum`;
        case TALLOW_CANDLE:
        case WAX_CANDLE: {
            const candelabrum = state.inventory.find(object => object.otyp === CANDELABRUM_OF_INVOCATION);
            const multiple = item.quan !== 1;
            if (candelabrum && candelabrum.spe < 7)
                return `Attach ${multiple ? 'these' : 'this'} to your candelabrum, or ${item.lamplit ? 'extinguish' : 'light'} ${multiple ? 'them' : 'it'}`;
            return `${light} ${multiple ? 'these' : 'this'} ${simpleObjectName(item, state)}`;
        }
        case OIL_LAMP:
        case MAGIC_LAMP:
        case BRASS_LANTERN: return `${light} this light source`;
        case EXPENSIVE_CAMERA: return 'Take a photograph';
        case TOWEL: return 'Clean yourself off with this towel';
        case CRYSTAL_BALL: return 'Peer into this crystal ball';
        case MAGIC_MARKER: return 'Write on something with this marker';
        case FIGURINE: return 'Make this figurine transform';
        case UNICORN_HORN: return 'Use this unicorn horn';
        case LAND_MINE:
        case BEARTRAP: return 'Arm this trap';
        case PICK_AXE:
        case DWARVISH_MATTOCK: return 'Dig with this digging tool';
        default: break;
    }
    if (item.otyp === POT_OIL && objectTypeKnown(item, state))
        return `${light} this oil`;
    if (item.oclass === 8)
        return `Dip something into ${item.quan > 1 ? 'one of these' : 'this'} potion${item.quan === 1 ? '' : 's'}`;
    if (item.otyp === HORN_OF_PLENTY && objectTypeKnown(item, state))
        return 'Blow into the horn of plenty';
    if (item.otyp >= WOODEN_FLUTE && item.otyp <= DRUM_OF_EARTHQUAKE)
        return 'Play this musical instrument';
    return item.oclass === 11 ? 'Break this wand' : null;
}
export function objectTypeCallable(object, state = game) {
    return !!state._objectCallNames?.[object.otyp]
        || ![AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(object.otyp)
            && [3, 4, 5, 6, 8, 9, 10, 11, 13, 17].includes(object.oclass)
            && !!(state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]);
}
function accessoryActionText(item, state) {
    if (item.oclass === 5)
        return state.uamul ? '[already wearing an amulet]' : 'Put this amulet on';
    if (item.oclass === 4 || item.otyp === MEAT_RING)
        return state.uleft && state.uright ? `[both ring ${makePlural(heroFingerName(state))} in use]` : 'Put this ring on';
    if ([BLINDFOLD, TOWEL, LENSES].includes(item.otyp)) {
        if (state.ublindf)
            return '[already wearing eyewear]';
        return item.otyp === LENSES ? 'Put these lenses on' : `Put this on${item.otyp === TOWEL ? ' to blindfold yourself' : ''}`;
    }
    return null;
}
// C iactions.c:item_reading_classification(). Reading advice depends on
// what the hero knows about the type, rather than the object's charges.
function itemReadingText(item, state) {
    const known = !!OBJECT_INITIAL_KNOWN[item.otyp] || !!item.typeKnown
        || !!state._knownObjectTypes?.has(item.otyp);
    if (item.otyp === FORTUNE_COOKIE)
        return 'Read the message inside this cookie';
    if (item.otyp === OBJECT_NAMES.indexOf('T-shirt'))
        return 'Read the slogan on the shirt';
    if (item.otyp === ALCHEMY_SMOCK)
        return 'Read the slogan on the apron';
    if (item.otyp === HAWAIIAN_SHIRT)
        return 'Look at the pattern on the shirt';
    if (item.oclass === SCROLL_CLASS) {
        const magic = item.dknown && (item.otyp !== SCR_BLANK_PAPER || !known)
            ? ' to activate its magic' : '';
        return `Read this scroll${magic}`;
    }
    if (item.oclass !== SPBOOK_CLASS)
        return null;
    const novel = item.otyp === SPE_NOVEL;
    const blank = item.otyp === SPE_BLANK_PAPER && known;
    const tome = item.otyp === SPE_BOOK_OF_THE_DEAD && known;
    const verb = novel || blank ? 'Read' : tome ? 'Examine' : 'Study';
    const noun = novel ? simpleObjectName(item, state) : tome ? 'tome' : 'spellbook';
    return `${verb} this ${noun}`;
}
function inventoryActionKey(code) {
    const key = String.fromCharCode(code);
    switch (key) {
        case '-':
        case 'a':
        case 'c':
        case 'C':
        case 'd':
        case 'e':
        case 'E':
        case 'f':
        case 'i':
        case 'I':
        case 'O':
        case 'p':
        case 'P':
        case 'q':
        case 'Q':
        case 'r':
        case 'R':
        case 't':
        case 'T':
        case 'V':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
        case 'z':
        case '/':
        case '\x1b':
        case ' ':
        case '\n':
        case '\r':
            return key;
        default:
            throw new RangeError(`Unexpected inventory action key ${code}`);
    }
}
export async function ddoinv() {
    const inventory = game.inventory || [];
    const { key } = await selectInventoryObject();
    const selected = inventory.find(item => item.invlet === String.fromCharCode(key));
    let action = null;
    if (selected) {
        action = await inventoryActionForObject(selected);
    }
    await bot();
    await flush_screen(1);
    game.context.move = 0;
    return action;
}
// C invent.c:display_used_invlets(). A split's original letter is omitted;
// all remaining carried slots, including gold, stay visible.
export async function selectUsedInventoryLetter(avoidLetter) {
    const items = game.inventory.filter(item => item.invlet !== avoidLetter);
    // This menu walks the carried chain once per pack class; sortloot does
    // not reorder items within a class, even when it sorts other menus.
    const ordered = game.flags.sortpack === false ? items
        : inventoryClassOrder().flatMap(oclass => items.filter(item => item.oclass === oclass));
    const result = await showInventoryWindow(inventorySectionsInOrder(ordered), {
        title: 'Inventory letters used:', pickMode: PICK_ONE,
    });
    return result.key;
}
// C end.c:really_done() discovers every carried type and marks all of the
// object's knowledge bits before disclose() calls display_inventory().
// Keep that state transition separate from the ordinary `i` command, whose
// descriptions are still constrained by what the hero learned in play.
export async function showIdentifiedInventory() {
    for (const item of game.inventory || []) {
        item.typeKnown = true;
        item.known = true;
        item.bknown = true;
        item.dknown = true;
        item.rknown = true;
        item.overrideIdentified = true;
        const redundantNeutral = item.oclass === 2 || item.oclass === 11
            || (item.oclass === 6 && objectUsesCharges(item));
        item.buc = item.blessed ? 'blessed' : item.cursed ? 'cursed'
            : !redundantNeutral
                && [3, 4, 5, 6, 7, 8, 9, 10, 13].includes(item.oclass)
                ? 'uncursed' : '';
        const canonicalName = OBJECT_NAMES[item.otyp];
        if (item.oclass === 13 && canonicalName)
            item.name = canonicalName;
    }
    return selectInventoryObject({ headingAttr: 0, pickMode: PICK_NONE });
}
export async function selectInventoryObject({ items, includeGold = true, title = null, extraChoice = null, pickMode = PICK_ONE, headingAttr, menuOptions = [], } = {}) {
    const filtered = !!items?.length;
    const candidates = filtered && items ? items : game.inventory;
    const visible = includeGold ? candidates : candidates.filter(item => item.oclass !== COIN_CLASS);
    if (!visible.length && !extraChoice) {
        await pline('Not carrying anything.');
        return { key: 0, count: null };
    }
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    const wizardIdentification = game.flags.debug && game.iflags.override_ID;
    const singleton = !menuOptions.length && !game.flags.force_invmenu
        && !game.iflags.menu_requested && !wizardIdentification
        && (filtered && visible.length === 1 && !extraChoice
            || visible.length === 0 && !!extraChoice);
    if (singleton) {
        const item = visible[0];
        if (item)
            observeObjectForNaming(item);
        const letter = item ? item.invlet : '-';
        if (!letter)
            throw new Error('A carried inventory choice has no letter');
        const description = item ? inventoryItemDescription(item, {
            primaryHandDetail: inventoryPrimaryHandDetail(item),
        }) : extraChoice;
        const key = await showMessageMenu(letter, item ? pickMode : PICK_ONE, `${letter} - ${description}.`);
        return { key, count: null };
    }
    const sections = inventorySections(visible, true);
    if (extraChoice && !wizardIdentification)
        sections.unshift({
            heading: game.flags.sortpack === false ? null : 'Miscellaneous',
            items: [{ text: extraChoice, key: '-' }],
        });
    if (menuOptions.length)
        sections.push({
            heading: 'Special', items: menuOptions.map(option => ({
                text: option.text, key: option.key,
            })),
        });
    return showInventoryWindow(sections, {
        pickMode, title, ...(headingAttr === undefined ? {} : { headingAttr }),
    });
}
export async function dolook() {
    const x = game.u.ux, y = game.u.uy;
    const level = requireGameLevel();
    const objects = level.objects[x]?.[y] || [];
    const blind = heroIsBlind();
    const feature = dungeonFeatureSentenceAt(x, y);
    if (blind) {
        const where = heroCanReachFloor(game, { checkPit: true })
            ? `lying here on the ${surfaceName(x, y)}` : 'lying beneath you';
        await plineWithContinuation(`You try to feel what is ${where}.`);
        const trap = level.traps.find(trap => trap.tx === x && trap.ty === y);
        if (!heroCanReachFloor(game, { checkPit: !!trap && is_pit(trap.ttyp) })) {
            await plineWithContinuation("But you can't reach it!");
            game.context.move = 0;
            return;
        }
    }
    if (objects.length) {
        const result = await showFloorPile(objects, false, feature);
        if (result.died)
            return;
    }
    else {
        if (feature)
            await plineWithContinuation(feature);
        await readFloorEngraving(x, y);
        if (blind || !feature)
            await plineWithContinuation(`You ${blind ? 'feel' : 'see'} no objects here.`);
    }
    game.context.move = blind ? 1 : 0;
}
//# sourceMappingURL=invent.js.map