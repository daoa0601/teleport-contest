// C pickup.c: command pickup, automatic pickup, and floor inspection.
import { game, requireGameLevel } from './gstate.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { objectName, observeObjectForNaming } from './objnam.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { floorObjectDescription, readFloorEngraving, showFloorPile, } from './floor_object_display.js';
import { tryCallObjectType } from './object_call.js';
import { newsym, flush_screen, pline, plineWithContinuation, map_object, } from './display.js';
import { dungeonFeatureSentenceAt, forceDescribeDecor } from './dungeon_feature.js';
import { surfaceName } from './terrain_name.js';
import { showMultiSelectWindow } from './windows.js';
import { addInventoryItem } from './u_init.js';
import { recordHeroPrizeAcquisition } from './hero_inventory.js';
import { remove_object } from './floor_object.js';
import { carryableObjectCount, liftObject } from './lift_object.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { useUpFloorObject } from './floor_consumption.js';
import { remoteBurglary } from './shop_departure.js';
import { roomsAt } from './room.js';
import { heroCanReachFloor } from './floor_reach.js';
import { pickupLocationProblem } from './pickup_location.js';
import { finishGhostlyPickup } from './bones_object.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { LOADSTONE, GOLD_PIECE, CORPSE, SCR_SCARE_MONSTER, } from './object_data.js';
import { stopRun } from './runmode.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { exerciseAttribute } from './attrib.js';
import { OBJECT_CLASS_SYMBOLS, objectClassForType, observeObject, } from './object_knowledge.js';
import { nearCapacity, pickupLoadPrefix } from './weight.js';
import { heroIsBlind } from './senses.js';
import { touchPetrifyingCorpse, willFeelPetrifyingCorpse } from './stoning.js';
import { heroCannotTake } from './polyself.js';
import { heroIsUnaware } from './hero_sleep.js';
import { lookInsideSwallower } from './swallowed_inventory.js';
import { dolook } from './invent.js';
import { addShopObjectToBill, billedPickupQuote, costlySpot } from './shk.js';
import { SHOPBASE, A_WIS, STONE, DOOR, D_BROKEN, ALTAR, W_WEP, is_pit, LOST_NONE, LOST_THROWN, LOST_STOLEN, LOST_DROPPED, LOST_EXPLODING, } from './const.js';
export function pickupClassOrder() {
    return [...inventoryClassOrder(), 17, 0].map(objectClassHeading);
}
export async function pickupAtHero(count = Math.max(0, game._commandCount || 0)) {
    game.multi = 0;
    const source = pickupSourceAtHero();
    const objects = pickupObjects(source);
    const problem = pickupLocationProblem({ state: game, objects, monster: source.monster });
    if (problem) {
        for (const message of problem.messages)
            await plineWithContinuation(message);
        game.context.move = problem.spendsTurn ? 1 : 0;
        return;
    }
    if (!source.monster && heroCannotTake(game)) {
        await pline('You are physically incapable of picking anything up.');
        game.context.move = 0;
        return;
    }
    const selected = await choosePickupObjects(source, objects, count);
    const { attempted } = await takeSelectedObjects(source, selected);
    game.context.move = attempted ? 1 : 0;
}
export async function autopickupAtHero() {
    if (heroIsUnaware(game)) {
        game._prevDecorType = STONE;
        return;
    }
    const source = pickupSourceAtHero();
    const { x, y, monster } = source;
    const level = requireGameLevel();
    const loc = level.at(x, y);
    const objects = pickupObjects(source);
    if (!monster) {
        const deepLiquid = (isPoolAt(x, y) && !(game.u.uinwater || game.underwater))
            || isLavaAt(x, y);
        if (game.context.nopick || !source.objects.length || deepLiquid) {
            await describePickupDecor(loc);
            await readFloorEngraving(x, y);
            return;
        }
        const trap = level.traps.find(trap => trap.tx === x && trap.ty === y);
        if (!heroCanReachFloor(game, { checkPit: !!trap && is_pit(trap.ttyp) })) {
            await describePickupDecor(loc);
            return;
        }
        const busy = !game._runState && (game.multi || game._delayedAction
            || (game._helplessTurns ?? 0) > 0 || game._occupation?.key === 'study-book');
        if (busy || !game.flags.pickup || heroCannotTake(game)) {
            const look = await checkHere(source, false);
            if (look.died)
                return;
            if (heroCannotTake(game))
                await pline('You are physically incapable of picking anything up.');
            return;
        }
        if (objects.length && game._runState?.mode !== 8)
            stopRun();
    }
    const { picked } = await takeSelectedObjects(source, objects.filter(autopickupAllows));
    if (!monster && !game.program_state?.gameover)
        await checkHere(source, picked > 0);
}
async function choosePickupObjects(source, objects, count) {
    const eligible = count
        ? objects.filter(object => objectQuantity(object) >= count) : objects;
    if (!eligible.length)
        return [];
    const onlyObject = eligible[0];
    if (eligible.length === 1 && onlyObject && !(source.monster && objects[0]?.owornmask))
        return [{ value: onlyObject, count: count || objectQuantity(onlyObject) }];
    const ordered = orderedPickupObjects(eligible);
    const sections = [];
    let letterCode = 'a'.charCodeAt(0);
    let goldAcceleratorUsed = false;
    const headings = game.flags.sortpack === false ? [null] : pickupClassOrder();
    for (const heading of headings) {
        const items = heading === null ? ordered
            : ordered.filter(object => pickupObjectClass(object) === heading);
        if (!items.length)
            continue;
        const menuItems = [];
        for (const object of items) {
            // query_objlist() names preceding entries before reverting to look_here().
            if (!count && willFeelPetrifyingCorpse(object)) {
                if (source.monster)
                    await lookInsideSwallower(source.monster);
                else
                    await dolook();
                return [];
            }
            const isFirstGold = object.otyp === GOLD_PIECE && !goldAcceleratorUsed;
            if (isFirstGold)
                goldAcceleratorUsed = true;
            observeObjectForNaming(object);
            menuItems.push({
                key: isFirstGold ? '$' : String.fromCharCode(letterCode++),
                groupAccelerator: OBJECT_CLASS_SYMBOLS[object.oclass] || '',
                text: floorObjectDescription(object),
                value: object,
            });
        }
        sections.push({ heading, items: menuItems });
    }
    game._pending_message = '';
    await flush_screen(1);
    const menu = {
        title: count ? `Pick ${count} of what?` : 'Pick up what?',
        sections,
        omitHeadings: game.flags.sortpack === false,
    };
    const selected = count
        ? (await showMultiSelectWindow({ ...menu, pickOne: true })).map(value => ({ value, count }))
        : await showMultiSelectWindow({ ...menu, returnCounts: true });
    const allowed = [];
    for (const selection of selected) {
        if (source.monster && selection.value.owornmask) {
            observeObjectForNaming(selection.value);
            await plineWithContinuation(`You can't pick the ${objectName(selection.value)} up.`);
        }
        else
            allowed.push(selection);
    }
    return allowed;
}
// C pickup.c:pickup_object(): remote tools lift the original floor stack.
export async function pickupFloorObject(object, count, telekinesis = false) {
    const source = {
        x: object.ox, y: object.oy, monster: null,
        objects: requireGameLevel().objects[object.ox]?.[object.oy] ?? [],
    };
    const result = await takeSelectedObjects(source, [{ value: object, count }], telekinesis, false);
    return result.picked > 0;
}
async function takeSelectedObjects(source, selected, telekinesis = false, batch = true) {
    if (!selected.length)
        return { picked: 0, attempted: false };
    if (batch)
        clearJustPicked(game);
    let picked = 0;
    let attempted = false;
    let previousCapacity = 0;
    for (const selection of selected) {
        const counted = 'value' in selection;
        let object = counted ? selection.value : selection;
        if (!source.objects.includes(object))
            continue;
        if (source.monster && object.owornmask) {
            observeObjectForNaming(object);
            await plineWithContinuation(`You can't pick the ${objectName(object)} up.`);
            continue;
        }
        attempted = true;
        observePickupObject(object);
        if (object === game.uchain)
            continue;
        if (object.oartifact) {
            const touch = await touchArtifactByHero(object);
            if (touch.died)
                break;
            if (!touch.allowed)
                continue;
        }
        if (object.otyp === CORPSE
            && ((!telekinesis && await touchPetrifyingCorpse(object))
                || await reviveRiderCorpse(object, telekinesis)))
            break;
        let count = counted ? selection.count : objectQuantity(object);
        if (!(count > 0))
            count = objectQuantity(object);
        if (object.otyp === SCR_SCARE_MONSTER) {
            const scroll = await prepareScareScrollPickup(object, count, telekinesis);
            if (scroll.decision === 'stop')
                break;
            if (scroll.decision === 'consumed') {
                picked++;
                continue;
            }
            object = scroll.object;
            count = scroll.count;
        }
        const lift = await liftObject({ object, count, telekinesis });
        if (lift.decision === 'stop')
            break;
        if (lift.decision !== 'lift')
            continue;
        if (object.otyp !== LOADSTONE)
            object = splitPickupStack(object, lift.count);
        if (source.monster) {
            // C pickup.c:1901 pick_obj(): a swallowed pickup uses plain
            // obj_extract_self on the engulfer's inventory - no unwear,
            // no crysknife release, no skip flags.
            unlinkMonsterObject(source.monster, object);
        }
        else {
            remove_object(object);
            newsym(source.x, source.y);
        }
        const shopRoom = !source.monster && object !== game.uball
            && costlySpot(source.x, source.y)
            ? roomsAt(game.level, source.x, source.y, SHOPBASE)[0] : undefined;
        const savedShops = game.u.ushops ?? [];
        let transaction = null;
        if (shopRoom !== undefined) {
            game.u.ushops = [shopRoom];
            try {
                transaction = await addShopObjectToBill(object);
            }
            finally {
                game.u.ushops = savedShops;
            }
        }
        if (transaction)
            observeObjectForNaming(object);
        const quote = transaction && billedPickupQuote(transaction);
        if (quote)
            await plineWithContinuation(quote);
        const remote = object.unpaid && shopRoom !== undefined && !savedShops.includes(shopRoom);
        const added = await addPickedInventoryObject(object);
        if (remote)
            await remoteBurglary(source.x, source.y);
        const message = pickedInventoryDescription(added.object, lift.count);
        const capacity = nearCapacity(game);
        const prefix = capacity === previousCapacity ? '' : pickupLoadPrefix(capacity);
        previousCapacity = capacity;
        await plineWithContinuation(prefix ? `${prefix} lifting ${message}` : message);
        const ghostlyMessage = finishGhostlyPickup(added.object, game);
        if (ghostlyMessage)
            await plineWithContinuation(ghostlyMessage);
        picked++;
        if (game.program_state?.gameover)
            break;
    }
    if (batch && picked && !game.program_state?.gameover) {
        if (!source.monster)
            newsym(source.x, source.y);
    }
    return { picked, attempted };
}
export async function addPickedInventoryObject(object) {
    recordHeroPrizeAcquisition(object, game);
    const count = objectQuantity(object);
    const carried = await addInventoryItem(object, null, false);
    markJustPicked(carried);
    observeObjectForNaming(carried);
    return { object: carried, count };
}
// C pickup_prinv(): format after pick_obj() has settled remote shop billing.
function pickedInventoryDescription(carried, count) {
    const picked = { ...carried, quan: count, quantity: count };
    // Native pickup suppresses the primary-hand annotation when the new
    // objects merged into the wielded stack; other slot annotations remain.
    if (carried === game.uwep)
        picked.owornmask = (picked.owornmask ?? 0) & ~W_WEP;
    const merged = count < objectQuantity(carried);
    const total = merged ? game.flags.verbose === false ? ''
        : ` (${objectQuantity(carried)} in total).` : '.';
    return `${carried.invlet} - ${floorObjectDescription(picked)}${total}`;
}
function pickupSourceAtHero() {
    const x = game.u?.ux, y = game.u?.uy;
    const monster = game.u?.uswallow ? game.u?.ustuck : null;
    if (monster) {
        return {
            x, y, monster,
            objects: monster.minvent || monster.inventory || [],
        };
    }
    return {
        x, y, monster: null,
        objects: game.level?.objects?.[x]?.[y] || [],
    };
}
function pickupObjects(source) {
    return source.objects.filter(object => object !== game.uchain && object !== game.u?.uchain);
}
function autopickupAllows(object) {
    if (object.where === 'floor' && !object.no_charge
        && costlySpot(object.ox, object.oy))
        return false;
    if ((game.flags.pickup_thrown !== false && object.how_lost === LOST_THROWN)
        || (game.flags.pickup_stolen !== false && object.how_lost === LOST_STOLEN))
        return true;
    if (game.flags.dropped_nopick !== false && object.how_lost === LOST_DROPPED)
        return false;
    if (object.how_lost === LOST_EXPLODING)
        return false;
    const configured = game.flags?.pickup_types || '';
    if (!configured)
        return true;
    const symbol = OBJECT_CLASS_SYMBOLS[object.oclass];
    return !!symbol && configured.includes(symbol);
}
function observePickupObject(object) {
    if (!heroIsBlind(game))
        observeObject(object);
}
async function prepareScareScrollPickup(object, requested, telekinesis) {
    const count = await carryableObjectCount({ object, count: requested });
    if (count < 1)
        return { decision: 'stop' };
    const scroll = splitPickupStack(object, count);
    if (scroll.blessed) {
        scroll.blessed = false;
        return { decision: 'lift', object: scroll, count };
    }
    if (!(scroll.spe ?? 0) && !scroll.cursed) {
        scroll.spe = 1;
        return { decision: 'lift', object: scroll, count };
    }
    const quantity = objectQuantity(scroll);
    await pline(`The scroll${quantity === 1 ? '' : 's'} ${quantity === 1 ? 'turns' : 'turn'} to dust as you ${telekinesis ? 'raise' : 'pick'} ${quantity === 1 ? 'it' : 'them'} up.`);
    await tryCallObjectType(scroll);
    await useUpFloorObject(scroll, scroll.quan);
    return { decision: 'consumed' };
}
async function reviveRiderCorpse(corpse, remotely) {
    if (!isRider(corpse.corpsenm))
        return false;
    await pline(`At your ${remotely ? 'attempted acquisition' : 'touch'}, the corpse suddenly moves...`);
    const revival = await reviveCorpseImmediately(corpse, game);
    for (const message of revival?.messages || [])
        await plineWithContinuation(message);
    await exerciseAttribute(A_WIS, false);
    return true;
}
function splitPickupStack(object, count) {
    if (count >= objectQuantity(object))
        return object;
    return splitObjectStack(object, count, game) ?? object;
}
async function checkHere(source, pickedSome) {
    const { x, y } = source;
    const skipFeature = await describePickupDecor(requireGameLevel().at(x, y));
    const objects = pickupObjects(source);
    if (!objects.length) {
        await readFloorEngraving(x, y);
        return { died: false };
    }
    stopRun();
    // C check_here() flushes movement before look_here() can page a prior
    // message. The pager itself leaves pending map changes untouched.
    await flush_screen(1);
    let feature = skipFeature ? '' : dungeonFeatureSentenceAt(x, y);
    if (heroIsBlind(game)) {
        const first = source.objects[0];
        if (first)
            map_object(first, false, false);
        if (isIceAt(x, y)) {
            await forceDescribeDecor();
            feature = '';
        }
        await plineWithContinuation(blindPickupInspectionMessage(x, y));
    }
    return await showFloorPile(source.objects, pickedSome, feature, { automatic: true });
}
async function describePickupDecor(loc) {
    const brokenDoor = !!game.flags.mention_decor && loc?.typ === DOOR
        && loc.doormask === D_BROKEN && game._prevDecorType !== DOOR;
    game._prevDecorType = loc?.typ ?? STONE;
    if (brokenDoor)
        await pline('There is a broken door here.');
    return brokenDoor;
}
function blindPickupInspectionMessage(x, y) {
    // look_here() leaves the altar description to the following floor display.
    if (isIceAt(x, y))
        return 'You try to feel what is on it.';
    return requireGameLevel().at(x, y)?.typ === ALTAR
        ? 'You try to feel what is here.'
        : `You try to feel what is lying here on the ${surfaceName(x, y)}.`;
}
export function orderedPickupObjects(pile) {
    return sortObjects(pile, { mode: lootSortMode() });
}
export function pickupObjectClass(object) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    return objectClassHeading(oclass);
}
//# sourceMappingURL=pickup.js.map