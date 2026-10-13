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
import { inventorySortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { MENU_TRADITIONAL, MV_KNOWS_EGG, PICK_NONE, PICK_ONE, W_ACCESSORY, W_ARMOR, is_pit, } from './const.js';
import { ARROW as FIRST_OBJECT, EGG, CHEST, LARGE_BOX, OBJECT_BIMANUAL, OBJECT_INITIAL_KNOWN, OBJECT_NAMES, STATUE, TIN, } from './object_data.js';
import { MONSTER_GROWTH_TARGET } from './monster_data.js';
import { objectName, observeObjectForNaming, simpleObjectName, singularObjectName } from './objnam.js';
import { learnObjectType, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { getLine, promptYesNoAllQuit } from './query.js';
import { isWeaponTool, objectUsesCharges } from './object_properties.js';
import { ammunitionMatchesLauncher, isBlade, isTwoWeaponObject } from './weapon_type.js';
import { heroCanUseTwoWeapons } from './two_weapon.js';
import { objectIsVulnerableToErosion } from './object_erosion.js';
import { discoverArtifact } from './artifacts.js';
import { isContainer } from './container.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { objectWeight } from './weight.js';
import { readFloorEngraving, showFloorPile } from './floor_object_display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName } from './terrain_name.js';
import { dungeonFeatureSentenceAt } from './dungeon_feature.js';
const COIN_CLASS = 12;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
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
        restoreUnderlay: true,
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
    const grouped = new Map();
    const sorted = sortObjects(items, { mode: inventorySortMode() });
    for (const item of sorted) {
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
    return showChoiceWindow({
        title: `Do what with the ${objectName(item)}?`,
        entries: itemActionEntries(item, game),
        validKeys: [27, 32, 10, 13], restoreUnderlay: true,
    });
}
function itemActionEntries(item, state) {
    const itemName = objectName(item, state);
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
    entries.push({ key: 'c', text: `Name ${stack ? 'this stack of' : 'this specific'} ${itemName}` });
    if (!alreadyWorn)
        entries.push({ key: 'd', text: `Drop this ${stack ? 'stack' : 'item'}` });
    if ([2, 4, 11, 13].includes(item.oclass)
        || [239, 245].includes(item.otyp)) {
        const verb = isBlade(item) || item.oclass === 11 ? 'Engrave' : 'Write';
        const surface = surfaceName(state.u.ux, state.u.uy, state);
        entries.push({ key: 'E', text: `${verb} on the ${surface} with ${stack ? 'one of these items' : 'this item'}` });
    }
    if (item === state.uquiver) {
        const launcher = shoot && state.uwep
            ? ` with your wielded ${simpleObjectName(state.uwep, state)}` : '';
        entries.push({ key: 'f', text: `${shoot ? 'Shoot' : 'Throw'} ${stack ? 'one of these' : 'this'}${launcher}` });
    }
    entries.push({ key: 'i', text: 'Adjust inventory by assigning new letter' });
    if (item.oclass === 4)
        entries.push({ key: 'P', text: 'Put this ring on' });
    if ([2, 13].includes(item.oclass) && item !== state.uquiver)
        entries.push({ key: 'Q', text: `Quiver this ${stack ? 'stack' : 'item'} for easy ${shoot ? 'shooting' : 'throwing'} with 'f'ire` });
    if (item.oclass === 10)
        entries.push({ key: 'r', text: 'Study this spellbook' });
    if (!alreadyWorn) {
        const fireAlias = item === state.uquiver ? " (same as 'f')" : '';
        entries.push({ key: 't', text: `${shoot ? 'Shoot' : 'Throw'} ${stack ? 'one of these' : 'this item'}${fireAlias}` });
    }
    if (item !== state.uwep)
        entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'}${item.oclass === 2 || isWeaponTool(item) ? ' as your weapon' : ' in your hands'}` });
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
    if (encyclopediaEntries(singularObjectName(item, state), state).length)
        entries.push({ key: '/', text: 'Look up information about this' });
    return entries;
}
function inventoryActionKey(code) {
    const key = String.fromCharCode(code);
    switch (key) {
        case '-':
        case 'c':
        case 'd':
        case 'E':
        case 'f':
        case 'i':
        case 'P':
        case 'Q':
        case 'r':
        case 't':
        case 'w':
        case 'x':
        case 'X':
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
        const actionKey = await showItemActionMenu(selected);
        action = {
            key: inventoryActionKey(actionKey), item: selected,
        };
    }
    await bot();
    await flush_screen(1);
    game.context.move = 0;
    return action;
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