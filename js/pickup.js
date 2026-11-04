// C pickup.c: command pickup, automatic pickup, floor inspection,
import { objectClassForType, AMULET_OF_YENDOR, BAG_OF_HOLDING, BAG_OF_TRICKS, BELL_OF_OPENING, BOULDER, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CHEST, CORPSE, CRAM_RATION, FOOD_RATION, GOLD_PIECE, HORN_OF_PLENTY, ICE_BOX, LARGE_BOX, LEASH, LEMBAS_WAFER, LOADSTONE, MAGIC_LAMP, OIL_LAMP, OILSKIN_SACK, POT_OIL, SACK, SCR_SCARE_MONSTER, SPE_BOOK_OF_THE_DEAD, SPE_WIZARD_LOCK, STATUE, TALLOW_CANDLE, WAN_CANCELLATION, WAX_CANDLE, } from './object_data.js';
import { commandResultCancelled, cmdq_add_ec, setMulti } from './cmd.js';
import { endVoluntaryMultiTurn, nomul, roomsAt, exceedsActionCapacity, nearCapacity, loseHeroHp, heroGoldAmount, calcCapacity, invWeight, MOD_ENCUMBER, weightCapacity, } from './hack.js';
import { monsterStagger } from './mondata.js';
import { MONSTER_NAME, monsterIsBig, monsterThrowsRocks } from './monster_data.js';
import { heroSpecies, heroCannotTake, heroFormHidesUnderObjects, heroHasNoHands, heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { game, requireGameLevel } from './gstate.js';
import { isLavaAt, isPoolAt, drawbridgeUnderlyingType } from './dbridge.js';
import { definiteName, objectCombatName, objectNameIsPlural, objectQuestion, observeObjectForNaming, ownedSimpleObjectName, simpleObjectName, simpleObjectNameWithArticle, makeSingular, objectDescription, makePlural, withIndefiniteArticle, wishedObjectPresentation, ownedObjectAction, definiteObjectAction, ownedObjectQuestion, corpseName, killerObjectName, } from './objnam.js';
import { autokey, autoUnlockFlags, pickLock, isForceableWeapon } from './lock.js';
import { getAdjacentLocation } from './cmd.js';
import { CQ_CANNED, ECMD_OK, ECMD_TIME, ECMD_CANCEL, ALTAR, AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_UNTRAP, SHOPBASE, A_WIS, STONE, W_WEP, W_ARMOR, W_ACCESSORY, is_pit, GRAVE, ICE, P_BASIC, P_RIDING, LOST_THROWN, LOST_STOLEN, LOST_DROPPED, LOST_EXPLODING, MENU_TRADITIONAL, MENU_FULL, MENU_PARTIAL, MENU_COMBINATION, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT, PLNMSG_OBJNAM_ONLY, PLNMSG_BACK_ON_GROUND, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, GETOBJ_EXCLUDE_SELECTABLE, PARANOID_AUTOALL, PARANOID_CONFIRM, SORTLOOT_INVLET, OBJECT_TIMER_KIND, THRONE, T_LOOTED, DRAWBRIDGE_UP, IS_FURNITURE, IS_LAVA, IS_POOL } from './const.js';
import { isok } from './cmd.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects, selectInventoryObject, inventoryItemDescription, inventoryPrimaryHandDetail, mergable, consumeObjectCharge, dolook } from './invent.js';
import { tryCallObjectType, dropObjectAtHero, dropInventoryObjectAtHero } from './do.js';
import { objectQuantity, splitObjectStack, unlinkMonsterObject, addObjectToContainer, unlinkObject, objectWeight, startCorpseTimeout, remove_object, useHornOfPlenty, isContainer, updateContainerWeights, restoreRejectedSplit, startGlobTimeout } from './mkobj.js';
import { hitFloorWithObject } from './dothrow.js';
import { learnObjectType, observeObject } from './o_init.js';
import { OBJECT_CLASS_SYMBOLS, consumeHallucinatedMenuObjectGlyph, flush_screen, newsym, newsym_force } from './display.js';
import { floorObjectDescription, pricedFloorObjectDescription, lookHere, readFloorEngraving, dungeonFeatureAt } from './invent.js';
import { pline, plineWithContinuation } from './pline.js';
import { showMultiSelectWindow, snapshotMenuUnderlay, showDisclosureOverlay, restoreMenuUnderlay, showChoiceWindow, showTextWindow } from './windows.js';
import { addInventoryItem } from './invent.js';
import { recordHeroPrizeAcquisition, finishInventoryRemoval, useUpInventoryStack, freeInventoryObject } from './invent.js';
import { takeQueuedInventoryChoice } from './inventory_queued_choice.js';
import { promptYesNoQuit, getLine, promptChoice, tty_yn_function } from './query.js';
import { yn_function, paranoidYesNoQuit } from './cmd.js';
import { useUpFloorObject } from './floor_consumption.js';
import { heroCanReachFloor } from './engrave.js';
import { hideHeroUnder, finishEnvironmentalMonsterDeath } from './mon.js';
import { addShopObjectToBill, billedPickupQuote, chargeUnpaidUsage, costlySpot, objectTypeKnown, removeObjectAndContentsFromBill, remoteBurglary, setSellDisposition, SELL_NORMAL, SELL_DELIBERATE, SELL_DONTSELL, currentShopResident, stolenValue, sellHeroDroppedObject, warnAboutRemovedPick, deleteObject } from './shk.js';
import { pickupLocationProblem } from './pickup_location.js';
import { finishGhostlyPickup } from './bones_object.js';
import { touchArtifactByHero } from './artifacts.js';
import { landObjectOnAltar } from './altar_object.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { triggerChestTrap } from './chest_trap.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { surfaceName, ceilingName, waterbodyName } from './terrain_name.js';
import { chooseInventoryObject, getobj } from './invent.js';
import { feelPetrifyingCorpse, willFeelPetrifyingCorpse, handlesPetrifyingCorpseBareHanded, petrifyFromCorpseContact } from './stoning.js';
import { monsterHasMapPosition, monsterOccupiesPosition, monsterSaddle, riderCannotReachMessage } from './steed.js';
import { displayLiquidName, monsterName } from './do_name.js';
import { removeObjectFromMonsterInventory } from './monworn.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { propertyIsActive, propertyTimeout } from './properties.js';
import { rn2, rnd, d } from './rng.js';
import { heroHasFreeHand } from './engrave.js';
import { heroHandName } from './body_parts.js';
import { tipWornHelmet } from './tip_hat.js';
import { currency } from './invent.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { exerciseAttribute } from './attrib.js';
import { heroIsBlind } from './senses.js';
import { heroIsUnaware } from './senses.js';
import { lookInsideSwallower } from './swallowed_inventory.js';
import { floorReachProblem } from './engrave.js';
import { heroEscapedShaft, heroTeetersAtPit, backOnGroundMessage } from './trap.js';
import { clearMessageWindow, displayMessageWindow } from './tty_topline.js';
import { containerContents } from './end.js';
import { bot } from './botl.js';
import { setPrimaryWeapon, setSecondaryWeapon, setQuiverObject, willWeld } from './wield.js';
import { objectShedsLight, snuffLitObject } from './light.js';
import { scatterFloorObjects } from './scatter.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { isBimanualObject } from './object_properties.js';
import { stopObjectTimer } from './timeout.js';
import { bypassObjectList, clearBypasses, nextUnbypassedObject } from './worn.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { addObjectToMonsterInventory } from './steal.js';
import { changeBoxLockByMagic } from './box_magic.js';
import { courtMonsterType } from './mkroom.js';
import { makemonAt } from './makemon.js';
export function pickupClassOrder() {
    return [...inventoryClassOrder(), 17, 0].map(objectClassHeading);
}
// The #pickup command: C hack.c:dopickup() runs the location checks and
// then pickup.c:pickup() over what remains, or loots the swallower's
// stomach when it holds the engulfer's inventory.
export async function pickupAtHero(count = Math.max(0, game._commandCount || 0), { runLocationChecks = true } = {}) {
    setMulti(0);
    const source = pickupSourceAtHero();
    // hack.c:pickup_checks() tests OBJ_AT, which counts the punishment
    // chain; the empty-floor complaints only fire when the square has no
    // object at all.  A chain-only square falls through to the pickup menu
    // path, where all_but_uchain() filters it into an empty selection.
    // Only dopickup() runs those checks; pickup.c:loot_mon() calls pickup()
    // directly, so a swallowed #loot never reports the engulfer's tongue.
    const problem = runLocationChecks
        ? pickupLocationProblem({ state: game, objects: source.objects, monster: source.monster })
        : null;
    if (problem) {
        for (const message of problem.messages)
            await plineWithContinuation(message);
        game.context.move = problem.spendsTurn ? 1 : 0;
        return;
    }
    const objects = pickupObjects(source);
    game._pickupEncumbrance = 0;
    if (!source.monster && heroCannotTake(game)) {
        const look = await checkHere(source, false);
        if (look.died)
            return;
        if (source.objects.length && game.flags.pickup)
            await plineWithContinuation('You are physically incapable of picking anything up.');
        game.context.move = 0;
        return;
    }
    // pickup.c:734: an object underfoot stops a pending run (except
    // travel's run == 8 and 'm'-prefixed no-pick moves) even for a manual
    // pickup.  nomul(0) clears the run flag and re-flags the time display,
    // which otherwise never refreshes because the lingering run value
    // suppresses moveloop's per-turn time update.
    if (!source.monster && source.objects.length
        && (game.context.run ?? 0) > 0 && game.context.run !== 8
        && !game.context.nopick)
        endVoluntaryMultiTurn();
    let attempted;
    if (game.flags.menu_style === MENU_TRADITIONAL && !game.iflags.menu_requested) {
        const result = await pickUpTraditionally(source, count);
        // C pickup(): declining the class prompt jumps past the cover check.
        if (result === 'canceled') {
            game.context.move = 0;
            game._pickupEncumbrance = 0;
            return;
        }
        attempted = result.attempted;
    }
    else {
        const selected = await choosePickupObjects(source, objects, count);
        attempted = (await takeSelectedObjects(source, selected)).attempted;
    }
    await reassessHeroCover(source);
    game.context.move = attempted ? 1 : 0;
    game._pickupEncumbrance = 0;
}
// C pickup(): once picking up ends outside an engulfer, a hider re-checks its
// cover; taking the whole pile leaves nothing to hide under.
async function reassessHeroCover(source) {
    if (!source.monster && !game.program_state.gameover && heroFormHidesUnderObjects(game))
        await hideHeroUnder(game);
}
// C pickup.c:pickup(); its autopick() pass over the square's objects runs
// before the pickup menu.
export async function autopickupAtHero() {
    if (heroIsUnaware(game)) {
        game._prevDecorType = STONE;
        return;
    }
    game._pickupEncumbrance = 0;
    const source = pickupSourceAtHero();
    const { x, y, monster } = source;
    const level = requireGameLevel();
    // C pickup() tests OBJ_AT(), which counts the punishment chain that
    // drag_ball() trails behind the hero, not just pickable items.
    if (!monster) {
        const deepLiquid = (isPoolAt(x, y) && !(game.u.uinwater || game.underwater))
            || isLavaAt(x, y);
        if (game.context.nopick || !source.objects.length || deepLiquid) {
            if (game.flags.mention_decor)
                await describeDecor();
            await readFloorEngraving(x, y);
            return;
        }
        const trap = level.traps.find(trap => trap.tx === x && trap.ty === y);
        if (!heroCanReachFloor(game, { checkPit: !!trap && is_pit(trap.ttyp) })) {
            await describeDecor();
            // pickup.c gates this on (multi && !context.run): a counted
            // walk reads the engraving, a real run does not.
            if ((game.multi && !(game.context.run ?? 0))
                || !game.flags.pickup
                || trap && (heroTeetersAtPit(game, trap) || heroEscapedShaft(trap)))
                await readFloorEngraving(x, y);
            return;
        }
        // pickup.c treats any multi without a real run (counted walks,
        // helplessness) as busy: describe the floor instead of autopicking.
        const busy = (game.multi && !(game.context.run ?? 0))
            || (game._helplessTurns ?? 0) > 0 || game._occupation?.key === 'study-book';
        if (busy || !game.flags.pickup || heroCannotTake(game)) {
            const look = await checkHere(source, false);
            if (look.died)
                return;
            // C pickup(): this follows check_here()'s floor prose.
            if (heroCannotTake(game))
                await plineWithContinuation('You are physically incapable of picking anything up.');
            return;
        }
        // pickup.c: pickup() stops only a real run (context.run != 8) when
        // stepping onto objects, and not at all for a no-pickup move.
        // nomul(0) also requests the status refresh for the lifting message.
        if (source.objects.length && (game.context.run ?? 0) > 0
            && game.context.run !== 8 && !game.context.nopick)
            endVoluntaryMultiTurn();
    }
    // C autopick() walks every object on the square: autopick_testobj()
    // does not exclude the punishment chain, whose class passes the
    // default empty pickup_types.  A chain-only square therefore still
    // produces a non-empty selection, so pickup()'s menu_pickup path runs
    // reset_justpicked() across the inventory before pickup_object()
    // silently refuses uchain.  Stepping onto the chain while punished
    // clears the just-picked marks even though nothing is picked up.
    const eligible = [];
    for (const object of source.objects) {
        if (await autopickupAllows(object))
            eligible.push(object);
    }
    const { picked } = await takeSelectedObjects(source, eligible);
    await reassessHeroCover(source);
    if (!monster && !game.program_state?.gameover)
        await checkHere(source, picked > 0);
    game._pickupEncumbrance = 0;
}
async function pickUpTraditionally(source, count) {
    const objects = [...source.objects];
    const onlyObject = objects[0];
    if (objects.length === 1 && count && onlyObject) {
        await takeSelectedObjects(source, [{ value: onlyObject, count: Math.min(count, objectQuantity(onlyObject)) }]);
        return { attempted: true };
    }
    let selection = null;
    if (objects.length >= 2) {
        await plineWithContinuation(`There are ${objects.length <= 10 ? 'several' : 'many'} objects here.`);
        selection = await query_classes('pick up', source.objects);
        if (!selection)
            return 'canceled';
        if (selection.menu !== 'none') {
            const requested = selection;
            const eligible = requested.menu === 'all' ? objects
                : objects.filter(object => matchesObjectCategories(object, requested));
            const selected = await choosePickupObjects(source, eligible, 0, {
                autoSelect: false, feelCockatrice: false, groupByClass: selection.oneAtATime,
            });
            return { attempted: (await takeSelectedObjects(source, selected)).attempted };
        }
    }
    let all = selection?.everything ?? true;
    let selective = selection?.oneAtATime ?? false;
    let classes = selection?.classes ?? [];
    let attempted = false, picked = 0;
    for (const object of objects) {
        const matches = selection && hasBucCategory(selection)
            ? matchesObjectCategories(object, selection)
            : selective || !classes.length || classes.includes(object.oclass);
        if (!matches)
            continue;
        let amount = objectQuantity(object);
        if (!all) {
            observeObjectForNaming(object);
            const question = await objectQuestion(object, {
                prefix: 'Pick up ', suffix: '?', fallback: 'something',
                format: async (item, state) => await objectDescription(item, { state }), shortFormat: simpleObjectNameWithArticle,
            });
            const response = await yn_function(question, amount < 2 ? 'ynaq' : 'yn#aq', 'y', true, { menuable: amount < 2 });
            if (response.answer === 'q')
                break;
            if (response.answer === 'n' || response.answer === '#' && !response.count)
                continue;
            if (response.answer === 'a') {
                all = true;
                if (selective) {
                    selective = false;
                    classes = [object.oclass];
                }
            }
            else if (response.answer === '#') {
                amount = Number(response.count < BigInt(amount) ? response.count : BigInt(amount));
            }
        }
        if (!attempted)
            clearJustPicked(game);
        attempted = true;
        const result = await takeSelectedObjects(source, [{ value: object, count: amount }], false, false);
        picked += result.picked;
        if (result.stopped)
            break;
    }
    if (picked && !source.monster && !game.program_state.gameover)
        await newsym_force(source.x, source.y);
    return { attempted };
}
// C pickup.c:query_objlist() for the pickup menu; its n_or_more() filter
// (count >= reference) is the quantity filter below.
async function choosePickupObjects(source, objects, count, { autoSelect = true, feelCockatrice = !count, groupByClass = game.flags.sortpack !== false } = {}) {
    const eligible = count
        ? objects.filter(object => objectQuantity(object) >= count) : objects;
    if (!eligible.length)
        return [];
    const onlyObject = eligible[0];
    if (autoSelect && eligible.length === 1 && onlyObject && !(source.monster && objects[0]?.owornmask))
        return [{ value: onlyObject, count: count || objectQuantity(onlyObject) }];
    const ordered = orderedPickupObjects(eligible);
    const sections = [];
    let letterCode = 'a'.charCodeAt(0);
    let firstItem = true;
    const headings = groupByClass ? pickupClassOrder() : [null];
    for (const heading of headings) {
        const items = heading === null ? ordered
            : ordered.filter(object => pickupObjectClass(object) === heading);
        if (!items.length)
            continue;
        const menuItems = [];
        for (const object of items) {
            // query_objlist() names preceding entries before reverting to look_here().
            if (feelCockatrice && willFeelPetrifyingCorpse(object)) {
                if (source.monster)
                    await lookInsideSwallower(source.monster);
                else
                    await dolook();
                return [];
            }
            const isFirstGold = firstItem && object.otyp === GOLD_PIECE;
            firstItem = false;
            consumeHallucinatedMenuObjectGlyph(object);
            observeObjectForNaming(object);
            menuItems.push({
                key: isFirstGold ? '$' : String.fromCharCode(letterCode++),
                groupAccelerator: OBJECT_CLASS_SYMBOLS[object.oclass] || '',
                text: await pricedFloorObjectDescription(object),
                value: object,
            });
        }
        sections.push({ heading, items: menuItems });
    }
    // C query_objlist() shows the menu without flushing: pending glyph
    // buffer updates (e.g. the moveloop boundary's hallucination redraws)
    // stay invisible until the next real flush_screen().
    const menu = {
        title: count ? `Pick ${count} of what?` : 'Pick up what?',
        sections,
        omitHeadings: !groupByClass,
    };
    const selected = count
        ? (await showMultiSelectWindow({ ...menu, pickOne: true })).map(value => ({ value, count }))
        : await showMultiSelectWindow({ ...menu, returnCounts: true });
    const allowed = [];
    for (const selection of selected) {
        if (source.monster && selection.value.owornmask) {
            observeObjectForNaming(selection.value);
            const name = ownedSimpleObjectName(selection.value, game, { capitalized: false });
            await plineWithContinuation(`You can't pick ${name} up.`);
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
        return { picked: 0, attempted: false, stopped: false };
    if (batch)
        clearJustPicked(game);
    let picked = 0;
    let attempted = false;
    let stopped = false;
    for (const selection of selected) {
        const counted = 'value' in selection;
        let object = counted ? selection.value : selection;
        if (!source.objects.includes(object))
            continue;
        if (source.monster && object.owornmask) {
            observeObjectForNaming(object);
            const name = ownedSimpleObjectName(object, game, { capitalized: false });
            await plineWithContinuation(`You can't pick ${name} up.`);
            continue;
        }
        attempted = true;
        observePickupObject(object);
        if (object === game.uchain)
            continue;
        if (object.oartifact) {
            const touch = await touchArtifactByHero(object);
            if (touch.died) {
                stopped = true;
                break;
            }
            if (!touch.allowed)
                continue;
        }
        if (object.otyp === CORPSE
            && ((!telekinesis && await touchPetrifyingCorpse(object))
                || await reviveRiderCorpse(object, telekinesis))) {
            stopped = true;
            break;
        }
        let count = counted ? selection.count : objectQuantity(object);
        if (!(count > 0))
            count = objectQuantity(object);
        if (object.otyp === SCR_SCARE_MONSTER) {
            const scroll = await prepareScareScrollPickup(object, count, telekinesis);
            if (scroll.decision === 'stop') {
                stopped = true;
                break;
            }
            if (scroll.decision === 'consumed') {
                picked++;
                continue;
            }
            object = scroll.object;
            count = scroll.count;
        }
        const lift = await liftObject({ object, count, telekinesis });
        if (lift.decision === 'stop') {
            stopped = true;
            break;
        }
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
            await newsym(source.x, source.y);
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
        const message = await pickedInventoryDescription(added.object, lift.count);
        await plineWithContinuation(pickupInventoryMessage(message, 'lifting'));
        const ghostlyMessage = finishGhostlyPickup(added.object, game);
        if (ghostlyMessage)
            await plineWithContinuation(ghostlyMessage);
        picked++;
        if (game.program_state?.gameover) {
            stopped = true;
            break;
        }
    }
    if (batch && picked && !game.program_state?.gameover) {
        if (!source.monster)
            await newsym_force(source.x, source.y);
    }
    return { picked, attempted, stopped };
}
// C pickup.c:pickup_prinv(). Tool pickups retain this process-local
// baseline; pickup() and container menus reset it at their own boundaries.
export function pickupInventoryMessage(description, verb, state = game) {
    const capacity = nearCapacity(state);
    const prefix = capacity === (state._pickupEncumbrance ?? 0) ? '' : pickupLoadPrefix(capacity);
    state._pickupEncumbrance = capacity;
    return prefix ? `${prefix} ${verb} ${description}` : description;
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
async function pickedInventoryDescription(carried, count) {
    const picked = { ...carried, quan: count, quantity: count };
    // Native pickup suppresses the primary-hand annotation when the new
    // objects merged into the wielded stack; other slot annotations remain.
    if (carried === game.uwep)
        picked.owornmask = (picked.owornmask ?? 0) & ~W_WEP;
    const merged = count < objectQuantity(carried);
    const total = merged ? game.flags.verbose === false ? ''
        : ` (${objectQuantity(carried)} in total).` : '.';
    return `${carried.invlet} - ${await floorObjectDescription(picked)}${total}`;
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
// C pickup.c:all_but_uchain().
function pickupObjects(source) {
    return source.objects.filter(object => object !== game.uchain && object !== game.u?.uchain);
}
export async function autopickupAllows(object) {
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
    const symbol = OBJECT_CLASS_SYMBOLS[object.oclass];
    let pickit = !configured || !!symbol && configured.includes(symbol);
    // check_autopickup_exceptions() matches makesingular(doname(obj)), and
    // xname() observes the object for a sighted hero while naming it.
    const exceptions = game.iflags.autopickupExceptions;
    if (exceptions?.length) {
        observeObjectForNaming(object);
        const description = makeSingular(await objectDescription(object));
        const match = exceptions.find(rule => rule.regex.test(description));
        if (match)
            pickit = match.grab;
    }
    return pickit;
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
// C pickup.c:rider_corpse_revival(): touching (or telekinetically grabbing)
// a Rider corpse revives it and dents wisdom.
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
// C pickup.c:reset_justpicked().
export function clearJustPicked(state) {
    for (const object of state?.inventory || [])
        object.pickup_prev = false;
}
export function markJustPicked(object) {
    if (object)
        object.pickup_prev = true;
    return object;
}
// C pickup.c:check_here().
async function checkHere(source, pickedSome) {
    const { x, y } = source;
    const skipFeature = game.flags.mention_decor ? await describeDecor() : false;
    const chain = game.uchain || game.u?.uchain;
    const count = pickupObjects(source).filter(object => object !== chain).length;
    if (!count) {
        await readFloorEngraving(x, y);
        return { died: false };
    }
    // check_here() uses nomul(0), including its pending status refresh.
    if ((game.context.run ?? 0) > 0)
        endVoluntaryMultiTurn();
    // C check_here() flushes movement before look_here() can page a prior
    // message. The pager itself leaves pending map changes untouched.
    await flush_screen(1);
    const { died } = await lookHere(count, { pickedSome, skipFeature });
    return { died };
}
// C pickup.c:describe_decor(). Feature feedback on arrival; FALSE means the
// surface was the same non-furniture type, so look_here() shows its own
// feature line instead of skipping it.
export async function describeDecor({ state = game, publish = plineWithContinuation, fumbleOverride = false, levitateOverride = false, } = {}) {
    // One turn of fumbling left: slip_or_trip() interrupts the hero at the
    // end of this turn, so hold the decor message back until after it.
    if (propertyTimeout('fumbling', state) === 1 && !state.iflags.deferDecor && !fumbleOverride) {
        await deferredDecor(true, state, publish);
        return false;
    }
    const { ux: x, uy: y } = state.u;
    const location = requireGameLevel(state).requireAt(x, y);
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const previous = state._prevDecorType ?? STONE;
    const underwater = !!(state.underwater || state.u?.uinwater);
    let feature = dungeonFeatureAt(x, y, { state, probing: levitateOverride });
    const doorHere = feature === 'open door' || feature === 'doorway';
    const waterHere = feature === 'pool of water';
    if (doorHere || underwater || (surface === ICE && IS_POOL(previous)))
        feature = null;
    let described = true;
    if (surface === previous && !IS_FURNITURE(surface)) {
        described = false;
    }
    else if (feature) {
        if (waterHere)
            feature = waterbodyName(x, y, state);
        if (feature !== 'swamp' && surface !== ICE)
            feature = withIndefiniteArticle(feature);
        // C flags.verbose defaults on.
        const message = state.flags.verbose !== false
            ? `There is ${feature} here.`
            : `${feature.charAt(0).toUpperCase()}${feature.slice(1)}.`;
        await publish(message, {
            noRepeat: surface === ICE && !!state.flags.mention_decor,
        });
    }
    else if (!underwater) {
        if (IS_POOL(previous) || IS_LAVA(previous) || previous === ICE) {
            if (state._lastPlineKind !== PLNMSG_BACK_ON_GROUND) {
                await publish(backOnGroundMessage(false, state));
                state._lastPlineKind = PLNMSG_BACK_ON_GROUND;
            }
        }
    }
    state._prevDecorType = state.flags.mention_decor ? surface : STONE;
    return described;
}
// C pickup.c:deferred_decor(). Setup holds the arrival feature back behind
// an imminent fumble; catch-up describes it only while mention_decor is
// still set, otherwise the pending message is simply dropped.
export async function deferredDecor(setup, state = game, publish = plineWithContinuation) {
    if (!state.flags.mention_decor) {
        state.iflags.deferDecor = false;
    }
    else if (setup) {
        state.iflags.deferDecor = true;
    }
    else {
        await describeDecor({ state, publish });
        state.iflags.deferDecor = false;
    }
}
// C pickup.c:force_decor(). Probing reports the real floor even when
// blindness or levitation would hide its condition during an ordinary look.
export async function forceDescribeDecor({ state = game, probing = false } = {}) {
    const { ux: x, uy: y } = state.u;
    const location = requireGameLevel(state).requireAt(x, y);
    state._prevDecorType = STONE;
    await describeDecor({
        state, fumbleOverride: true, levitateOverride: probing,
    });
    location.lastseentyp = location.typ;
}
const COIN_CLASS = 12;
const INVENTORY_SLOT_COUNT = 52;
const M2_ROCKTHROW = 0x08000000;
function withQuantity(object, count) {
    return { ...object, quan: count, quantity: count };
}
function coinWeight(count) {
    return Math.trunc((Math.max(0, count) + 50) / 100);
}
function isCoin(object) {
    return object.otyp === GOLD_PIECE || object.oclass === COIN_CLASS;
}
// C carry_count() adds the stack's weight() (at least one unit for coins),
// then subtracts only the GOLD_WT() change from merging with carried gold.
function topLevelWeight(object, count, state) {
    const weight = objectWeight(withQuantity(object, count));
    if (!isCoin(object))
        return weight;
    const purse = heroGoldAmount(state);
    return weight - (coinWeight(purse) + coinWeight(count) - coinWeight(purse + count));
}
function containerWeightAfterRemoval(container, object, count) {
    const total = objectQuantity(object);
    const contents = (container.contents || []).flatMap(candidate => {
        if (candidate !== object)
            return [candidate];
        return count < total ? [withQuantity(object, total - count)] : [];
    });
    return objectWeight({ ...container, contents });
}
// C pickup.c:delta_cwt().
function weightAddedByLift(object, count, container, state) {
    const added = topLevelWeight(object, count, state);
    if (!container || !(state.inventory || []).includes(container))
        return added;
    const removed = container.otyp === BAG_OF_HOLDING
        ? objectWeight(container)
            - containerWeightAfterRemoval(container, object, count)
        : objectWeight(withQuantity(object, count));
    return added - removed;
}
function maximumLiftedCount(object, requested, container, state) {
    const current = invWeight(state) - 2 * weightCapacity(state);
    const fits = (count) => current
        + weightAddedByLift(object, count, container, state) < 0;
    if (fits(requested))
        return requested;
    const carriedContainer = !!container && (state.inventory || []).includes(container);
    if (isCoin(object) && !carriedContainer) {
        // C GOLD_CAPACITY() over the capacity left after carried gold.
        const purse = heroGoldAmount(state);
        const room = current - coinWeight(purse);
        return Math.max(0, Math.min(requested, room * -100 - (purse + 50) - 1));
    }
    let low = 0;
    let high = requested;
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle))
            low = middle;
        else
            high = middle - 1;
    }
    return low;
}
async function itemDescription(object, count = objectQuantity(object)) {
    if (isCoin(object))
        return count === 1 ? 'a gold piece' : `${count} gold pieces`;
    const view = withQuantity(object, count);
    if (!view.name) {
        const presentation = wishedObjectPresentation(object);
        view.name = presentation.name;
        view.plural = presentation.plural;
        view.class = presentation.class;
    }
    return await inventoryItemDescription(view);
}
function locationPhrase(container, state, short = false) {
    if (!container)
        return short ? 'here' : 'lying here';
    return `in ${definiteName(objectCombatName(container, { state, includeCorpseSpecies: false }), state)}`;
}
function presentTense(object) {
    return objectQuantity(object) === 1 ? 'is' : 'are';
}
async function reportPartialLift(object, count, container, telekinesis, state) {
    observeObjectForNaming(object, { state });
    const verb = container ? 'carry' : telekinesis ? 'acquire' : 'lift';
    await plineWithContinuation(`You can only ${verb} ${count === 1 ? 'one' : 'some'} of the ${await itemDescription(object)} ${locationPhrase(container, state)}.`);
}
async function reportUnliftable(object, container, state, telekinesis) {
    const verb = container ? 'carry' : telekinesis ? 'acquire' : 'lift';
    observeObjectForNaming(object, { state });
    const description = await itemDescription(object);
    const where = locationPhrase(container, state, !container);
    if ((state.inventory || []).length || heroGoldAmount(state)) {
        await plineWithContinuation(`There ${presentTense(object)} ${description} ${where}, but you cannot ${verb} any more.`);
        return;
    }
    const subject = objectQuantity(object) === 1 ? 'it ' : 'even one ';
    await plineWithContinuation(`There ${presentTense(object)} ${description} ${where}, but ${subject}is too heavy for you to ${verb}.`);
}
function inventoryObjectCount(state) {
    return (state.inventory || []).filter(object => object.otyp !== GOLD_PIECE && object.oclass !== COIN_CLASS).length;
}
function canMergeWithInventory(object, count, state) {
    const candidate = {
        ...withQuantity(object, count),
        how_lost: 0,
        no_charge: false,
    };
    return (state.inventory || []).some(carried => mergable(carried, candidate, state));
}
function heroThrowsRocks(state) {
    return heroIsPolymorphed(state)
        && state.u.umonnum !== undefined
        && monsterThrowsRocks(state.u.umonnum);
}
export function pickupBurden(state) {
    const setting = state.flags?.pickup_burden;
    if (typeof setting === 'number' && Number.isInteger(setting))
        return setting;
    const first = String(setting || 'stressed').toLowerCase().charAt(0);
    return new Map([['u', 0], ['b', 1], ['s', 2], ['n', 3],
        ['o', 4], ['t', 4], ['l', 5]]).get(first) ?? MOD_ENCUMBER;
}
function goldFollows(object, container, state) {
    const list = container
        ? container.contents || []
        : state.level?.objects?.[object.ox]?.[object.oy] || [];
    const index = list.indexOf(object);
    return index >= 0 && list.slice(index + 1).some(candidate => candidate.otyp === GOLD_PIECE || candidate.oclass === COIN_CLASS);
}
function resetRejectedScareScroll(object, container) {
    if (!container && object.otyp === SCR_SCARE_MONSTER)
        object.spe = 0;
}
export async function carryableObjectCount({ object, container = null, count = objectQuantity(object), telekinesis = false, state = game, }) {
    const total = objectQuantity(object);
    const requested = Math.max(0, Math.min(Math.trunc(count || total), total));
    const lifted = maximumLiftedCount(object, requested, container, state);
    if (lifted < requested && lifted > 0)
        await reportPartialLift(object, lifted, container, telekinesis, state);
    if (lifted < 1)
        await reportUnliftable(object, container, state, telekinesis);
    return lifted;
}
export async function liftObject({ object, container = null, count = objectQuantity(object), telekinesis = false, state = game, }) {
    const total = objectQuantity(object);
    count = Math.max(0, Math.min(Math.trunc(count || total), total));
    if (object.otyp === BOULDER && state.level?.flags?.sokoban_rules) {
        await plineWithContinuation(`You cannot get your hand around this ${objectCombatName(object, { state, includeCorpseSpecies: false })}.`);
        return { decision: 'stop', count: 0 };
    }
    const ignoresWeight = object.otyp === LOADSTONE
        || (object.otyp === BOULDER && heroThrowsRocks(state));
    if (ignoresWeight) {
        const sameType = (state.inventory || []).some(carried => carried.otyp === object.otyp);
        if (inventoryObjectCount(state) < INVENTORY_SLOT_COUNT
            || !sameType || canMergeWithInventory(object, total, state)) {
            return { decision: 'lift', count };
        }
        const noun = objectCombatName(object, { state, includeCorpseSpecies: false });
        await plineWithContinuation(`You are carrying too much stuff to pick up ${total === 1 ? 'another' : 'more'} ${noun}.`);
        return { decision: 'stop', count: 0 };
    }
    const liftedCount = await carryableObjectCount({
        object, container, count, telekinesis, state,
    });
    if (liftedCount < 1) {
        resetRejectedScareScroll(object, container);
        return { decision: 'stop', count: 0 };
    }
    if (object.otyp !== GOLD_PIECE && object.oclass !== COIN_CLASS
        && inventoryObjectCount(state) >= INVENTORY_SLOT_COUNT
        && !canMergeWithInventory(object, liftedCount, state)) {
        await plineWithContinuation(`Your knapsack cannot accommodate any more items${goldFollows(object, container, state) ? ' (except gold)' : ''}.`);
        resetRejectedScareScroll(object, container);
        return { decision: 'stop', count: 0 };
    }
    const extraWeight = weightAddedByLift(object, liftedCount, container, state);
    const previousBurden = Math.max(nearCapacity(state), pickupBurden(state));
    const nextBurden = calcCapacity(state, extraWeight);
    if (nextBurden > previousBurden) {
        if (telekinesis) {
            resetRejectedScareScroll(object, container);
            return { decision: 'skip', count: 0 };
        }
        const action = container ? 'removing' : 'lifting';
        observeObjectForNaming(object, { state });
        const answer = await promptYesNoQuit(`${pickupLoadPrefix(nextBurden)} ${action} ${await itemDescription(object, liftedCount)}.  Continue?`);
        // pickup.c lift_object() clears WIN_MESSAGE after every answer, so
        // the question is gone before any later floor-pile window.
        clearMessageWindow();
        if (answer !== 'y') {
            resetRejectedScareScroll(object, container);
            return {
                decision: answer === 'q' ? 'stop' : 'skip',
                count: 0,
            };
        }
    }
    return { decision: 'lift', count: liftedCount };
}
export function orderedPickupObjects(pile) {
    return sortObjects(pile, { mode: lootSortMode() });
}
export function pickupObjectClass(object) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    return objectClassHeading(oclass);
}
// C pickup.c:doloot().
export async function doloot() {
    await doloot_core();
}
// C pickup.c:do_loot_cont().
async function do_loot_cont(container, containerIndex, containerCount, resetJustPicked) {
    if (container.olocked) {
        const name = definiteName(objectCombatName(container, { includeCorpseSpecies: false }));
        await pline(container.lknown ? `${name.charAt(0).toUpperCase()}${name.slice(1)} is locked.` : `Hmmm, ${name} turns out to be locked.`);
        container.lknown = true;
        const flags = autoUnlockFlags(game);
        game.context.move = 0;
        if (!flags)
            return { spentTime: false, container };
        game.u.dz = 0;
        const tool = flags & AUTOUNLOCK_APPLY_KEY ? autokey(true) : null;
        if (tool || flags & AUTOUNLOCK_UNTRAP) {
            game.context.move = Number(await pickLock(tool, { target: { x: game.u.ux, y: game.u.uy }, container }));
            return { spentTime: !!game.context.move, container };
        }
        if (flags & AUTOUNLOCK_FORCE && containerCount === 1 && isForceableWeapon(game.uwep)) {
            // The queued command owns its confirmation and any time spent
            // (pickup.c:2141-2143).
            cmdq_add_ec(CQ_CANNED, 'doforce');
        }
        return { spentTime: false, container };
    }
    container.lknown = true;
    if (container.otyp === BAG_OF_TRICKS) {
        await plineWithContinuation(`You carefully open the ${objectCombatName(container)}...`);
        await plineWithContinuation('It develops a huge set of teeth and bites you!');
        const damage = rnd(10);
        await loseHeroHp(propertyIsActive('halfPhysicalDamage') ? Math.ceil(damage / 2) : damage, 'carnivorous bag');
        learnObjectType(BAG_OF_TRICKS);
        return { spentTime: true, stopLooting: true, container };
    }
    // C wintty.c tty_display_nhwindow(NHW_MENU) pages a NEED_MORE
    // topline before the menu is drawn, so do_loot_cont()'s pending
    // "turns out to be locked" line is acknowledged with --More--
    // ahead of use_container()'s prompt; nothing here discards it.
    await flush_screen(1);
    return await use_container(container, {
        moreContainers: containerIndex < containerCount, underlay: snapshotMenuUnderlay(),
        resetJustPicked,
    });
}
// C pickup.c:able_to_loot(): floor-container admission for loot and tip.
export async function ableToLoot(x, y, looting) {
    const verb = looting ? 'loot' : 'tip';
    const trap = requireGameLevel().traps.find(trap => trap.tx === x && trap.ty === y);
    const reach = floorReachProblem(game, { checkPit: !!trap && is_pit(trap.ttyp) });
    if (reach) {
        if (game.u.usteed && (game.u.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
            await plineWithContinuation(riderCannotReachMessage());
        }
        else {
            const surface = heroCanReachFloor(game) ? 'bottom of the pit' : surfaceName(x, y);
            await plineWithContinuation(`You can't reach the ${surface}.`);
        }
        return false;
    }
    const lava = isLavaAt(x, y);
    if (lava || isPoolAt(x, y) && (looting || !(game.underwater || game.u.uinwater))) {
        await plineWithContinuation(`You cannot ${verb} things that are deep in the ${displayLiquidName(lava ? 'lava' : 'water')}.`);
        return false;
    }
    if (heroHasNoLimbs(game)) {
        await plineWithContinuation(`Without limbs, you cannot ${verb} anything.`);
        return false;
    }
    if (looting && !heroHasFreeHand(game)) {
        await plineWithContinuation(`Without a free ${heroHandName()}, you cannot loot anything.`);
        return false;
    }
    return true;
}
// C pickup.c:doloot_core().
export async function doloot_core() {
    game.context.move = 0;
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation("You can't do that while carrying so much stuff.");
        return;
    }
    if (heroHasNoHands(game)) {
        await plineWithContinuation('You have no hands!');
        return;
    }
    if (game.u.confused || (game.u.confusionTurns ?? 0) > 0) {
        if (rn2(6) && await reverseLoot()) {
            game.context.move = 1;
            return;
        }
        if (rn2(2)) {
            await plineWithContinuation('Being confused, you find nothing to loot.');
            game.context.move = 1;
            return;
        }
    }
    const { ux: x, uy: y } = game.u;
    let checkFloor = !game.iflags.menu_requested;
    let directionChosen = false;
    for (;;) {
        // The loop is C's lootcont label, revisited for an underfoot direction.
        if (checkFloor) {
            const pile = requireGameLevel().objects[x]?.[y] ?? [];
            const containers = pile.filter(isContainer);
            if (containers.length) {
                if (!await ableToLoot(x, y, true))
                    return;
                for (const object of pile) {
                    if (willFeelPetrifyingCorpse(object)) {
                        await feelPetrifyingCorpse(object);
                        game.context.move = 1;
                        return;
                    }
                }
                const items = [];
                if (containers.length > 1) {
                    for (const object of containers) {
                        observeObjectForNaming(object);
                        items.push({ text: await inventoryItemDescription(object), value: object });
                    }
                }
                const selected = containers.length === 1 ? containers
                    : await showMultiSelectWindow({ title: 'Loot which containers?', omitHeadings: true,
                        pageLocalKeys: true,
                        sections: [{ items }], signalEscape: true });
                if (selected === null)
                    return;
                if (selected.length) {
                    let spentTime = false;
                    let resetJustPicked = true;
                    for (const [index, container] of selected.entries()) {
                        const result = await do_loot_cont(container, index + 1, selected.length, resetJustPicked);
                        if (result.tookOut)
                            resetJustPicked = false;
                        spentTime ||= result.spentTime;
                        if (result.heroDied || result.stopLooting || !result.container)
                            break;
                    }
                    game.context.move = spentTime ? 1 : 0;
                    return;
                }
                if (directionChosen)
                    return;
            }
            else if (requireGameLevel().requireAt(x, y).typ === GRAVE) {
                await plineWithContinuation('You need to dig up the grave to effectively loot it...');
            }
        }
        if (!monBeside(x, y) && !game.iflags.menu_requested) {
            await plineWithContinuation("You don't find anything here to loot.");
            return;
        }
        const target = await getAdjacentLocation('Loot in what direction?', 'Invalid loot location', x, y);
        if (!target)
            return;
        const underfoot = target.x === x && target.y === y;
        const containers = (requireGameLevel().objects[target.x]?.[target.y] ?? []).some(isContainer);
        if (underfoot && containers) {
            checkFloor = true;
            directionChosen = true;
            continue;
        }
        if (target.dz < 0) {
            await plineWithContinuation(`You don't find anything to loot on the ${ceilingName(target.x, target.y, game)}.`);
            game.context.move = 1;
            return;
        }
        const monster = requireGameLevel().monsters.find(monster => monsterHasMapPosition(monster, game) && monster.mhp > 0
            && monster.mx === target.x && monster.my === target.y);
        const prevInquiry = !!monster && monster !== game.u.usteed && !!monsterSaddle(monster);
        const timepassed = monster ? await loot_mon(monster) : 0;
        if (game.u.confused || (game.u.confusionTurns ?? 0) > 0
            || game.u.stunned || (game.u.stunnedTurns ?? 0) > 0)
            game.context.move = 1;
        if (timepassed)
            return;
        if (!underfoot && containers) {
            await plineWithContinuation(monster ? `You can't loot anything ${prevInquiry ? 'else ' : ''}there with ${monsterName(monster)} in the way.` : 'You have to be at a container to loot it.');
        }
        else
            await plineWithContinuation(`You don't find anything ${prevInquiry ? 'else ' : ''}${underfoot ? 'here' : 'there'} to loot.`);
        return;
    }
}
// C pickup.c:loot_mon().
async function loot_mon(monster) {
    let asked = false;
    let timepassed = 0;
    const saddle = monster !== game.u.usteed ? monsterSaddle(monster) : null;
    if (saddle) {
        asked = true;
        const name = monsterName(monster, { suppressSaddle: true });
        const answer = await promptYesNoQuit(`Do you want to remove the saddle from ${name}?`, 'n');
        if (answer === 'q')
            return timepassed;
        if (answer === 'y') {
            if (heroHasNoLimbs(game)) {
                await plineWithContinuation("You can't do that without limbs.");
                return timepassed;
            }
            if (saddle.cursed) {
                await plineWithContinuation(`You can't.  The saddle seems to be stuck to ${monsterName(monster, { suppressSaddle: true })}.`);
                game.context.move = 1;
                return 1;
            }
            await removeObjectFromMonsterInventory(monster, saddle);
            if (game.flags.verbose !== false)
                await plineWithContinuation(`You take the ${simpleObjectName(saddle)} off of ${monsterName(monster)}.`);
            // C doloot()/addinv_core0() reset the batch when the saddle is acquired.
            clearJustPicked(game);
            const held = await holdAnotherObject(saddle, { dropMessage: `You drop ${await inventoryItemDescription(saddle)}!` });
            markJustPicked(held.object);
            timepassed = rnd(3);
            game.context.move = 1;
        }
    }
    if (game.u.uswallow) {
        // C loot_mon() passes the saddle inquiry flag, not the command count.
        // pickup.c:loot_mon() calls pickup() directly; only dopickup()
        // runs pickup_checks(), so an empty stomach costs no turn here.
        await pickupAtHero(asked ? 1 : 0, { runLocationChecks: false });
        timepassed = Number(!!game.context.move);
    }
    return timepassed;
}
// C pickup.c:mon_beside(): any monster occupying one of the 3x3 squares
// around (x, y), with MON_AT() counting worm tail segments.
function monBeside(x, y) {
    for (let nx = x - 1; nx <= x + 1; nx++) {
        for (let ny = y - 1; ny <= y + 1; ny++) {
            if (!isok(nx, ny))
                continue;
            if (requireGameLevel().monsters.some(monster => monsterHasMapPosition(monster, game)
                && monsterOccupiesPosition(monster, nx, ny)
                && monster.mhp > 0))
                return true;
        }
    }
    return false;
}
// doname() wrapper for tip menus and prompts; the tip mechanics live in the
// dotip/tipcontainer functions below.
async function containerDescription(object) {
    observeObjectForNaming(object);
    return await inventoryItemDescription(object);
}
// C pickup.c:choose_tip_container_menu().
async function choose_tip_container_menu(containers) {
    const items = [];
    for (const object of containers)
        items.push({
            text: await containerDescription(object), value: object,
        });
    if (game.inventory.length)
        items.push({ selectable: false, text: '' }, {
            ...(containers.length <= 8 && !game.flags.lootabc ? { key: 'i' } : {}),
            text: 'tip something being carried', value: null, itemFlags: MENU_ITEMFLAGS_SELECTED,
        });
    const picked = await showMultiSelectWindow({ title: 'Tip which container?',
        sections: [{ items }], pageLocalKeys: true,
        omitHeadings: true, pickOne: true, signalEscape: true });
    // pickup.c:choose_tip_container_menu() returns ECMD_CANCEL
    // when the container menu is dismissed with Escape.
    if (picked === null) {
        commandResultCancelled();
        return ECMD_CANCEL;
    }
    const source = picked.find(object => object !== null);
    if (source) {
        await tipContainer(source);
        game.context.move = 1;
        return ECMD_TIME;
    }
    return ECMD_OK;
}
// C pickup.c:tip_ok().
function tip_ok(object) {
    if (object.oclass === 12)
        return GETOBJ_EXCLUDE;
    return isContainer(object) || object.otyp === HORN_OF_PLENTY
        && object.dknown && objectTypeKnown(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
}
// C pickup.c:dotip().
export async function dotip() {
    game.context.move = 0;
    const { ux: x, uy: y } = game.u;
    // C pickup.c:container_at(x, y, TRUE): the count decides the tip menu.
    const containers = (requireGameLevel().objects[x]?.[y] ?? []).filter(isContainer);
    const considerFloor = !game.iflags.menu_requested
        || game.flags.menu_style === MENU_TRADITIONAL && containers.length > 1;
    if (containers.length && considerFloor) {
        let canTip = !exceedsActionCapacity(game);
        if (!canTip)
            await plineWithContinuation(`You can't tip ${game.flags.verbose === false
                ? 'a container' : containers.length > 1 ? 'one' : 'it'} while carrying so much.`);
        else
            canTip = await ableToLoot(x, y, false);
        if (canTip) {
            if (containers.length > 1) {
                if (await choose_tip_container_menu(containers) !== ECMD_OK)
                    return;
            }
            else {
                const source = containers[0];
                if (source) {
                    const answer = await promptYesNoQuit(`There is ${await containerDescription(source)} here, tip it?`);
                    if (answer === 'q')
                        return;
                    if (answer === 'y') {
                        await tipContainer(source);
                        game.context.move = 1;
                        return;
                    }
                }
            }
        }
    }
    const object = await chooseInventoryObject('tip', tip_ok, { forcePrompt: true });
    if (!object) {
        commandResultCancelled(); // pickup.c:dotip() getobj ECMD_CANCEL.
        return;
    }
    if (isContainer(object) || object.otyp === HORN_OF_PLENTY) {
        await tipContainer(object);
        game.context.move = 1;
        return;
    }
    let spill = null;
    if ([TALLOW_CANDLE, WAX_CANDLE].includes(object.otyp) && object.lamplit)
        spill = 'wax';
    else if (object.otyp === POT_OIL && object.lamplit
        || object.otyp === OIL_LAMP && object.age !== 0
        || object.otyp === MAGIC_LAMP && object.spe !== 0)
        spill = 'oil';
    else if (object.otyp === CAN_OF_GREASE && object.spe > 0)
        spill = 'grease';
    else if ([FOOD_RATION, CRAM_RATION, LEMBAS_WAFER].includes(object.otyp))
        spill = 'crumbs';
    else if (object.oclass === 17)
        spill = 'venom';
    if (spill) {
        const plural = spill === 'crumbs';
        const { ux: x, uy: y } = game.u;
        const tail = isPoolAt(x, y) ? ` and gradually dissipate${plural ? '' : 's'}`
            : isLavaAt(x, y) ? ` and immediately burn${plural ? '' : 's'} away` : '';
        await plineWithContinuation(`Some ${spill} spill${plural ? '' : 's'} onto the ${surfaceName(x, y)}${tail}.`);
        if (object.otyp === CAN_OF_GREASE)
            await consumeObjectCharge(object);
        game.context.move = 1;
    }
    else if (object.oclass === 8) {
        await plineWithContinuation(`The ${objectCombatName(object)} ${object.quan === 1 ? 'is' : 'are'} securely sealed.`);
    }
    else if (object === (game.uarmh || game.u.uarmh)) {
        game.context.move = await tipWornHelmet(object) ? 1 : 0;
    }
    else
        await plineWithContinuation(object.otyp === STATUE ? 'Nothing interesting happens.' : 'Nothing happens.');
}
// C pickup.c:tipcontainer_gettarget(). The destination menu; tip to floor
// needs no hands, container-to-container needs a free one.
// C pickup.c:u_handsy() is the hands test for the container choice.
async function tipDestination(source) {
    const items = [{
            key: '-', text: 'on the floor', value: null, itemFlags: MENU_ITEMFLAGS_SELECTED,
        }, { selectable: false, text: '' }];
    const targets = game.inventory.filter(object => object !== source && isContainer(object)
        && !(object.otyp === BAG_OF_TRICKS && object.dknown && objectTypeKnown(object)));
    // C pickup.c:u_handsy(): no hands at all, or no free one, blocks a
    // container-to-container tip.
    const hands = targets.length === 0 || (!heroHasNoHands(game) && heroHasFreeHand(game));
    if (!hands)
        await plineWithContinuation(heroHasNoHands(game) ? 'You have no hands!'
            : `You have no free ${heroHandName()}.`);
    for (const object of targets) {
        if (!hands || object.olocked && object.lknown || !object.invlet)
            items.push({ selectable: false, text: `    ${await containerDescription(object)}` });
        else
            items.push({ key: object.invlet, text: await containerDescription(object), value: object });
    }
    const picked = await showMultiSelectWindow({ title: `Where to tip the contents of ${await containerDescription(source)}`,
        sections: [{ items }], omitHeadings: true, pickOne: true, signalEscape: true });
    return { cancelled: picked === null, target: picked?.find(object => object !== null) ?? null };
}
// C pickup.c:tipcontainer_checks().
async function tipcontainer_checks(source, target, allowEmpty) {
    if (target?.otyp === BAG_OF_TRICKS) {
        await useBagOfTricks(target);
        return false;
    }
    source.lknown = true;
    if (source.olocked) {
        await plineWithContinuation(`The ${simpleObjectName(source)} is locked.`);
        return false;
    }
    if (source.otrapped) {
        await triggerChestTrap(source);
        if ((game.multi ?? 0) >= 0 && !game._helplessTurns) {
            nomul(-1);
            game._helplessReason = 'tipping a container';
            game._helplessDoneMessage = '';
        }
        return false;
    }
    if (source.otyp === BAG_OF_TRICKS || source.otyp === HORN_OF_PLENTY) {
        if (target && !await tipcontainer_checks(target, null, true))
            return false;
        const shopGoods = source.where !== 'inventory' && !!costlySpot(source.ox, source.oy) && !source.no_charge;
        if (shopGoods)
            await addShopObjectToBill(source, game, { ininv: false, silent: true });
        const oldCharges = source.spe;
        let seen = 0;
        do {
            if (source.otyp === BAG_OF_TRICKS) {
                const result = await useBagOfTricks(source, { tipping: true });
                if (!result.created)
                    break;
                seen += result.seen;
            }
            else if (!await useHornOfPlenty(source, { tipping: true, target }))
                break;
        } while (source.spe > 0 && !game.program_state.gameover);
        if (source.spe < oldCharges) {
            if (source.otyp === BAG_OF_TRICKS && !seen)
                await plineWithContinuation('Nothing seems to happen.');
            source.spe = oldCharges;
            await chargeUnpaidUsage(source, { alternate: true });
            source.spe = 0;
            source.cknown = true;
        }
        if (shopGoods)
            removeObjectAndContentsFromBill(source);
        return false;
    }
    if (isQuantumBox(source)) {
        await observeQuantumCat(source);
        source.cknown = true;
        if (!source.contents?.length) {
            await plineWithContinuation(`${source.where === 'inventory' ? 'Your ' : 'The '}box is now empty.`);
            return allowEmpty;
        }
    }
    if (!allowEmpty && !source.contents?.length) {
        source.cknown = true;
        await plineWithContinuation(`The ${simpleObjectName(source)} is empty.`);
        return false;
    }
    return true;
}
// C pickup.c:tipcontainer().
async function tipContainer(source) {
    source.ox = game.u.ux;
    source.oy = game.u.uy;
    const destination = await tipDestination(source);
    if (destination.cancelled || !await tipcontainer_checks(source, destination.target, false))
        return;
    const target = destination.target;
    if (target && !await tipcontainer_checks(target, null, true))
        return;
    const { ux: x, uy: y } = game.u;
    const held = source.where === 'inventory';
    const targetHeld = target?.where === 'inventory';
    const highDrop = !game.u.uswallow && !heroCanReachFloor(game, { checkPit: true });
    const altar = !game.u.uswallow && requireGameLevel().requireAt(x, y).typ === ALTAR;
    const shopGoods = !held && !!costlySpot(x, y);
    let terse = !(highDrop || altar || costlySpot(x, y));
    let loss = 0;
    const contents = [...source.contents ?? []];
    source.cknown = true;
    await plineWithContinuation(target ? `${contents.length > 1 ? 'Objects tumble' : 'An object tumbles'} into the ${objectCombatName(target)}.`
        : `${contents.length > 1 ? 'Objects spill' : 'An object spills'} out${terse ? ':' : '.'}`);
    setSellDisposition(SELL_NORMAL);
    for (const [index, object] of contents.entries()) {
        unlinkObject(object);
        object.ox = x;
        object.oy = y;
        if (source.otyp === ICE_BOX)
            thawObject(object, game);
        else if (source.otyp === BAG_OF_HOLDING && source.cursed && !rn2(13)) {
            loss += await loseMagicBagItem(object, held);
            terse = false;
            continue;
        }
        if (shopGoods)
            await addShopObjectToBill(object, game, { ininv: false, silent: true });
        const suppressed = game.iflags.suppress_price;
        if (shopGoods)
            game.iflags.suppress_price = true;
        try {
            if (target) {
                if (target.otyp === BAG_OF_HOLDING && magicBagExplodes(object)) {
                    await explodeBag(target, object, game, { tipping: true, triggerHeld: held });
                    if (game.program_state.gameover)
                        return;
                    break;
                }
                await addObjectToContainer(target, object);
            }
            else {
                object.how_lost = LOST_DROPPED;
                if (highDrop)
                    await hitFloorWithObject(object);
                else {
                    if (altar)
                        await landObjectOnAltar(object);
                    else {
                        const name = await containerDescription(object);
                        await plineWithContinuation(terse ? `${name}${index + 1 < contents.length ? ',' : '.'}`
                            : `${name.charAt(0).toUpperCase()}${name.slice(1)} ${objectNameIsPlural(object) ? 'drop' : 'drops'} to the ${surfaceName(x, y)}.`);
                        if (terse)
                            game._lastPlineKind = PLNMSG_OBJNAM_ONLY;
                    }
                    await dropObjectAtHero(object);
                    if (game._lastPlineKind !== PLNMSG_OBJNAM_ONLY)
                        terse = false;
                }
            }
        }
        finally {
            if (suppressed === undefined)
                delete game.iflags.suppress_price;
            else
                game.iflags.suppress_price = suppressed;
        }
        if (game.program_state.gameover)
            break;
    }
    if (loss)
        await plineWithContinuation(`You owe ${loss} ${currency(loss)} for lost merchandise.`);
    source.owt = objectWeight(source);
    if (target && target.where !== 'gone')
        target.owt = objectWeight(target);
    if (held || targetHeld)
        await encumber_msg();
}
// C pickup.c:query_classes().
// collect_obj_classes() supplies the classes; tally_BUCX() supplies BUC
// categories, including a priest's free identification.
export async function query_classes(action, objects) {
    const classes = [...new Set(objects.map(object => object.oclass))];
    if (!classes.length)
        return null;
    const inventory = objects === game.inventory;
    let letters = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
    if (classes.length > 1)
        letters += ` aA${inventory ? 'i' : ':'}`;
    letters += 'm';
    if (objects.some(hasUnpaidContents))
        letters += 'u';
    const statuses = new Set(objects.map(object => {
        if (game.urole?.key === 'priest')
            object.bknown = object.oclass !== 12;
        return bucCategory(object);
    }));
    letters += ['B', 'U', 'C', 'X'].filter(status => statuses.has(status)).join('');
    if (objects.some(object => object.pickup_prev))
        letters += 'P';
    // Native filters survive ':' and 'i' while the answer itself is reset.
    const categories = [];
    let menuSeen = false;
    for (;;) {
        const response = await getLine(`What kinds of thing do you want to ${action}? [${letters}]`, (_character, key) => key >= 32 && key < 127);
        if (response === null)
            return null;
        const selected = [];
        let oneAtATime = false, everything = false, missing = false, filtered = false;
        let looked = false;
        for (const character of response) {
            if (character === ' ')
                continue;
            if (character === 'A')
                oneAtATime = true;
            else if (character === 'a')
                everything = true;
            else if (character === ':' || character === 'i') {
                if (character === 'i') {
                    if (takeQueuedInventoryChoice() === undefined)
                        await selectInventoryObject();
                }
                else {
                    await lookAtObjects(objects);
                    const container = objects[0]?.container;
                    if (container)
                        container.cknown = true;
                }
                looked = true;
                break;
            }
            else if (character === 'm')
                menuSeen = true;
            else if (character === 'u' || character === 'P' || character === 'B'
                || character === 'U' || character === 'C' || character === 'X') {
                if (!categories.includes(character))
                    categories.push(character);
                filtered = true;
            }
            else {
                const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
                if (letters.includes(character) && oclass > 0) {
                    selected.push(oclass);
                    if (!categories.includes(oclass))
                        categories.push(oclass);
                }
                else {
                    const where = action === 'pick up' ? 'here' : action === 'take out' ? 'inside' : '';
                    await plineWithContinuation(where ? `There are no ${character}'s ${where}.` : `You have no ${character}'s.`);
                    missing = true;
                }
            }
        }
        if (looked)
            continue;
        if (menuSeen)
            return { classes: selected, categories, oneAtATime, everything,
                menu: (everything || !selected.length) && !filtered ? 'all' : 'filtered' };
        if (!selected.length && (!everything || missing)) {
            oneAtATime = true;
            everything = false;
        }
        return { classes: selected, categories, oneAtATime, everything, menu: 'none' };
    }
}
export function matchesObjectCategories(object, selection) {
    const classes = selection.categories.filter((category) => typeof category === 'number');
    const statuses = selection.categories.filter((category) => category === 'B' || category === 'U' || category === 'C' || category === 'X');
    if (!selection.categories.length)
        return !!((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL);
    // Explicit coin selection overrides the other filter groups.
    if (object.oclass === 12 && classes.length)
        return classes.includes(12);
    if (game.urole?.key === 'priest' && !object.bknown)
        object.bknown = true;
    return (!classes.length || classes.includes(object.oclass))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!selection.categories.includes('u') || hasUnpaidContents(object))
        && (!selection.categories.includes('P') || !!object.pickup_prev);
}
export function hasBucCategory(selection) {
    return selection.categories.some(category => typeof category === 'string' && 'BUCX'.includes(category));
}
function bucCategory(object) {
    if (object.oclass === 12)
        return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
// C pickup.c:simple_look().
async function lookAtObjects(objects) {
    const first = objects[0];
    if (!first)
        return;
    if (objects.length === 1) {
        observeObjectForNaming(first);
        await plineWithContinuation(await objectDescription(first));
        return;
    }
    const lines = [''];
    for (const object of objects) {
        observeObjectForNaming(object);
        lines.push(await objectDescription(object));
    }
    await showDisclosureOverlay(lines, { restoreUnderlay: true });
}
function hasUnpaidContents(object) {
    return !!object.unpaid || !!object.contents?.some(hasUnpaidContents);
}
// C pickup.c:encumber_msg().
export async function encumber_msg(state = game, publish = plineWithContinuation) {
    const previous = state._encumbranceLevel ?? 0;
    const capacity = nearCapacity(state);
    let message = '';
    if (previous < capacity) {
        switch (capacity) {
            case 1:
                message = 'Your movements are slowed slightly because of your load.';
                break;
            case 2:
                message = 'You rebalance your load.  Movement is difficult.';
                break;
            case 3:
                message = `You ${monsterStagger(heroSpecies(state), 'stagger')} under your heavy load.  Movement is very hard.`;
                break;
            case 4:
                message = 'You can barely move a handspan with this load!';
                break;
            case 5:
                message = "You can't even move a handspan with this load!";
                break;
        }
    }
    else if (previous > capacity) {
        switch (capacity) {
            case 0:
                message = 'Your movements are now unencumbered.';
                break;
            case 1:
                message = 'Your movements are only slowed slightly by your load.';
                break;
            case 2:
                message = 'You rebalance your load.  Movement is still difficult.';
                break;
            case 3:
                message = `You ${monsterStagger(heroSpecies(state), 'stagger')} under your load.  Movement is still very hard.`;
                break;
        }
    }
    if (message)
        await publish(message);
    // pline() can wait for a pager; C commits oldcap after it returns.
    if (previous !== capacity)
        state.context.botl = true;
    state._encumbranceLevel = capacity;
}
export function pickupLoadPrefix(level) {
    return [
        '',
        'You have a little trouble',
        'You have trouble',
        'You have much trouble',
        'You have extreme difficulty',
        'You have extreme difficulty',
    ][level] || '';
}
// C pickup.c:reverse_loot(): confused looting can display old loot or
// give away a random fraction of one carried gold stack.
export async function reverseLoot() {
    if (!rn2(3)) {
        let remaining = game.inventory.length;
        for (const object of game.inventory) {
            if (!rn2(remaining + 1)) {
                observeObjectForNaming(object);
                await pline(`You find old loot: ${object.invlet} - ${await inventoryItemDescription(object, { primaryHandDetail: inventoryPrimaryHandDetail(object) })}.`);
                return true;
            }
            remaining--;
        }
        return false;
    }
    let gold = game.inventory.find(object => object.oclass === 12);
    if (!gold)
        return false;
    const amount = Math.trunc((rnd(5) * objectQuantity(gold) + 4) / 5);
    if (amount < objectQuantity(gold))
        gold = splitObjectStack(gold, amount) ?? gold;
    await removeHeroEquipment(gold);
    const { ux: x, uy: y } = game.u;
    const level = requireGameLevel();
    const square = level.requireAt(x, y);
    if (square.typ !== THRONE) {
        await dropInventoryObjectAtHero(gold);
        if (level.objects[x]?.[y]?.some(object => object.otyp === GOLD_PIECE))
            await pline('Ok, now there is loot here.');
        return true;
    }
    const coffers = royalCoffers();
    if (coffers) {
        await pline('"Thank you for your contribution to reduce the debt."');
        await freeInventoryObject(gold);
        await addObjectToContainer(coffers, gold);
        coffers.owt = objectWeight(coffers);
        coffers.cknown = false;
        if (!coffers.olocked)
            await changeBoxLockByMagic(coffers, { otyp: SPE_WIZARD_LOCK });
    }
    else {
        const collector = square.looted !== T_LOOTED ? await makemonAt(courtMonsterType(), x, y) : null;
        if (collector) {
            await freeInventoryObject(gold);
            await addObjectToMonsterInventory(collector, gold);
            await pline('The exchequer accepts your contribution.');
            if (!rn2(10))
                square.looted = T_LOOTED;
        }
        else {
            await pline(`You drop ${await inventoryItemDescription(gold)}.`);
            await dropInventoryObjectAtHero(gold);
        }
    }
    return true;
}
function royalCoffers() {
    const { ux: x, uy: y } = game.u;
    const chests = requireGameLevel().objects.flatMap(column => column?.flatMap(pile => pile ?? []) ?? [])
        .filter(object => object.otyp === CHEST)
        .sort((left, right) => (right._fobjOrder ?? 0) - (left._fobjOrder ?? 0));
    const royal = chests.find(object => object.spe === 2);
    if (royal)
        return royal;
    const distance = (object) => (object.ox - x) ** 2 + (object.oy - y) ** 2;
    return chests.reduce((nearest, object) => !nearest || distance(object) < distance(nearest) ? object : nearest, null);
}
const FORBIDDEN_CONTENTS = new Set([
    AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION,
    BELL_OF_OPENING,
    SPE_BOOK_OF_THE_DEAD,
]);
const quantity = objectQuantity;
async function lootObjectDescription(object, primaryHandDetail = null, withPrice = false) {
    // objnam.c:doname() names one gold piece "a gold piece" and appends
    // the wield/quiver suffixes, so no local coin formatting is allowed.
    return await inventoryItemDescription(object, { primaryHandDetail, withPrice });
}
function className(object) {
    return objectClassHeading(object.oclass || objectClassForType(object.otyp));
}
function objectsByClass(objects) {
    const groups = new Map();
    for (const object of objects) {
        const name = className(object);
        const members = groups.get(name) ?? [];
        members.push(object);
        groups.set(name, members);
    }
    const headings = [...inventoryClassOrder(), 17, 0].map(objectClassHeading);
    return headings.filter(name => groups.has(name))
        .map(name => ({ name, members: groups.get(name) ?? [] }));
}
function menuBucCategory(object) {
    if (object.oclass === 12)
        return game.flags?.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest')
        object.bknown = true;
    if (!object.bknown)
        return 'X';
    if (object.blessed)
        return 'B';
    if (object.cursed)
        return 'C';
    return 'U';
}
// C pickup.c:query_category(), for menu_loot's ALL_TYPES/UNPAID/BUCX/
// CHOOSE_ALL/JUSTPICKED flags. Special filters stay out of menu inversion.
async function categoryChoices(objects) {
    const groups = objectsByClass(objects);
    const showAll = groups.length > 1;
    const verifyAll = !!((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL);
    const choices = [{
            key: 'A', text: 'Auto-select every relevant item',
            itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: () => false, filter: 'auto' },
        }];
    if (!verifyAll || showAll) {
        const firstHint = verifyAll ? !game._autoAllImpliedHintShown : !game._autoAllHintShown;
        if (firstHint || game.flags.cmdassist !== false)
            choices.push({ selectable: false, text: verifyAll
                    ? "    (if no other choices are picked, 'a' is implied)"
                    : '    (ignored unless some other choices are also picked)' });
        if (verifyAll)
            game._autoAllImpliedHintShown = true;
        else
            game._autoAllHintShown = true;
    }
    choices.push({ selectable: false, text: '' });
    if (showAll)
        choices.push({
            key: 'a', text: 'All types', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: () => true, filter: 'all' },
        });
    choices.push(...groups.map((group, index) => ({
        key: String.fromCharCode((showAll ? 98 : 97) + index),
        text: group.name,
        groupAccelerator: OBJECT_CLASS_SYMBOLS[group.members[0]?.oclass ?? 0] || '',
        value: { matches: (object) => className(object) === group.name, filter: 'class' },
    })));
    const special = [];
    if (objects.some(hasUnpaidContents))
        special.push({
            key: 'u', text: 'Unpaid items', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: hasUnpaidContents, filter: 'unpaid' },
        });
    const bucNames = {
        B: 'Items known to be Blessed', C: 'Items known to be Cursed',
        U: 'Items known to be Uncursed', X: 'Items of unknown Bless/Curse status',
    };
    for (const category of ['B', 'C', 'U', 'X']) {
        if (objects.some(object => menuBucCategory(object) === category))
            special.push({
                key: category, text: bucNames[category], itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
                value: { matches: object => menuBucCategory(object) === category, filter: 'buc' },
            });
    }
    // C pickup.c:count_justpicked()/find_justpicked(): the marked stacks
    // of the previous pickup.
    const justPicked = objects.filter(object => object.pickup_prev);
    const onePicked = justPicked.length === 1 ? justPicked[0] : null;
    if (onePicked) {
        // pickup.c:query_category() names the single just-picked stack via
        // doname(); xname() observes the object while the hero can see.
        observeObjectForNaming(onePicked);
    }
    if (justPicked.length)
        special.push({
            key: 'P', text: onePicked ? `Just picked up: ${await lootObjectDescription(onePicked, inventoryPrimaryHandDetail(onePicked))}`
                : 'Items you just picked up', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
            value: { matches: object => !!object.pickup_prev, filter: 'picked' },
        });
    if (special.length)
        choices.push({ selectable: false, text: '' }, ...special);
    return choices;
}
// allow_category(): match one selection in every active filter group.
// Selecting coins by class takes precedence over the other filters.
function categoryMatcher(filters) {
    if (filters.some(filter => filter.filter === 'all'))
        return () => true;
    const classes = filters.filter(filter => filter.filter === 'class');
    const groups = ['class', 'buc', 'unpaid', 'picked'];
    return object => {
        if (object.otyp === GOLD_PIECE && classes.length)
            return classes.some(filter => filter.matches(object));
        return groups.every(group => {
            const members = filters.filter(filter => filter.filter === group);
            return !members.length || members.some(filter => filter.matches(object));
        });
    };
}
export async function chooseObjectCategories(title, objects) {
    if (game.flags.menu_style !== undefined && game.flags.menu_style !== MENU_FULL)
        return { matchers: [() => true], autoSelect: false };
    const groups = objectsByClass(objects);
    const knownBuc = new Set(objects.map(menuBucCategory));
    const onlyGroup = groups[0];
    if (groups.length === 1 && onlyGroup && knownBuc.size <= 1
        && !objects.some(hasUnpaidContents))
        return { matchers: [object => className(object) === onlyGroup.name], autoSelect: false };
    const selected = await showMultiSelectWindow({
        title, sections: [{ heading: '', items: await categoryChoices(objects) }], omitHeadings: true,
        returnCounts: true,
    });
    let autoSelect = selected.some(choice => choice.value.filter === 'auto');
    const filters = selected.filter(choice => choice.value.filter !== 'auto').map(choice => choice.value);
    const picked = selected.find(choice => choice.value.filter === 'picked');
    const matchers = filters.length ? [categoryMatcher(filters)] : [];
    if (autoSelect) {
        if ((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL) {
            const answer = await paranoidYesNoQuit(!!((game.flags.paranoia_bits ?? 0) & PARANOID_CONFIRM), 'Really autoselect All?');
            if (answer === 'q')
                return { matchers: [], autoSelect: false };
            autoSelect = answer === 'y';
            if (!matchers.length)
                matchers.push(() => true);
        }
        else if (!matchers.length) {
            await plineWithContinuation('No relevant items selected.');
            autoSelect = false;
        }
    }
    return { matchers, autoSelect, ...(picked ? { justPickedCount: Math.max(0, picked.count) } : {}) };
}
async function selectionSections(objects, useInventoryLetters) {
    const ordered = sortObjects(objects, {
        mode: lootSortMode({ inventoryLetters: useInventoryLetters }),
    });
    for (const object of ordered)
        observeObjectForNaming(object);
    let nextLetter = 0;
    const groups = game.flags.sortpack === false ? [{ name: null, members: ordered }]
        : objectsByClass(ordered);
    const sections = [];
    for (const group of groups) {
        const items = [];
        for (const object of group.members) {
            // pickup.c:query_objlist() draws obj_to_glyph() for every menu
            // item before naming it, which consumes a display-RNG draw per
            // item while hallucinating.
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({
                key: object.otyp === GOLD_PIECE ? '$'
                    : useInventoryLetters && object.invlet
                        ? object.invlet
                        : String.fromCharCode(97 + nextLetter++),
                // pickup.c:query_objlist() names menu entries with
                // doname_with_price(), so shop goods inside a floor
                // container are quoted "for sale".
                text: await lootObjectDescription(object, inventoryPrimaryHandDetail(object), true),
                value: object,
            });
        }
        sections.push({ heading: group.name, items });
    }
    return sections;
}
async function chooseObjects(title, objects, useInventoryLetters) {
    if (!objects.length)
        return [];
    return showMultiSelectWindow({
        title,
        sections: await selectionSections(objects, useInventoryLetters),
        omitHeadings: game.flags.sortpack === false,
        returnCounts: true,
    });
}
export function magicBagExplodes(object, depth = 0) {
    if ((object.otyp === WAN_CANCELLATION
        || object.otyp === BAG_OF_TRICKS)
        && (object.spe ?? 0) <= 0)
        return false;
    const dangerous = object.otyp === BAG_OF_HOLDING
        || object.otyp === BAG_OF_TRICKS
        || object.otyp === WAN_CANCELLATION;
    if (dangerous
        && rn2(1 << Math.min(depth, 7)) <= depth)
        return true;
    return (object.contents || []).some(content => magicBagExplodes(content, depth + 1));
}
async function scatterBagContents(container, state, held) {
    container.in_use = true;
    const contents = [...(container.contents || [])];
    for (const object of contents) {
        if (rn2(13) === 0) {
            unlinkObject(object, state);
            await loseMagicBagItem(object, held, state, true);
            continue;
        }
        object.ox = state.u.ux;
        object.oy = state.u.uy;
        await scatterFloorObjects(object.ox, object.oy, 4, {
            state, onlyObject: object, mayFracture: false,
            publish: plineWithContinuation, heroCaused: !state.context.mon_moving,
            finishMonsterKill: finishHeroMonsterKill,
            finishMonsterDeath: async (monster, options = {}) => {
                if (state.context.mon_moving)
                    return await finishEnvironmentalMonsterDeath(monster, state, options);
                if (options.deathMessage)
                    await plineWithContinuation(options.deathMessage);
                const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, { showKillMessage: false, publish: plineWithContinuation });
                return { survived: !death.killed, heroDied: death.heroDied };
            },
        });
        if (state.program_state.gameover)
            return;
    }
}
// C pickup.c:in_container() names the trigger before either bag blows up.
export async function explodeBag(container, trigger, state, { tipping = false, triggerHeld = true, rebillTrigger = false } = {}) {
    observeObjectForNaming(trigger, { state });
    await plineWithContinuation(tipping ? `As ${await lootObjectDescription(trigger)} ${trigger.quan === 1 ? 'tumbles' : 'tumble'} inside, you are blasted by a magical explosion!`
        : `As you put ${await lootObjectDescription(trigger)} inside, you are blasted by a magical explosion!`, { urgent: true });
    if (rebillTrigger)
        await addShopObjectToBill(trigger, state, { ininv: false, silent: true });
    if (trigger.otyp === BAG_OF_HOLDING)
        await scatterBagContents(trigger, state, triggerHeld);
    if (state.program_state.gameover)
        return { moved: false, stop: true, message: null };
    await deleteObject(trigger, state);
    const held = container.where === 'inventory';
    if (!held && costlySpot(container.ox, container.oy, state)) {
        const noCharge = container.no_charge;
        await addShopObjectToBill(container, state, { ininv: false });
        if (noCharge === undefined)
            delete container.no_charge;
        else
            container.no_charge = noCharge;
    }
    await scatterBagContents(container, state, held);
    if (state.program_state.gameover)
        return { moved: false, stop: true, message: null };
    if (held)
        await useUpInventoryStack(container, state);
    else
        await useUpFloorObject(container, container.quan, { state });
    await loseHeroHp(d(6, 6), 'magical explosion', { state });
    if (!tipping)
        await bot();
    return { moved: false, destroyedContainer: true, message: null };
}
// C mbag_item_gone(): announce before settling the loss and freeing the item.
export async function loseMagicBagItem(object, held, state = game, silent = false) {
    if (!silent) {
        const known = object.dknown;
        // The message uses prior knowledge, but doname() observes the item.
        observeObjectForNaming(object, { state });
        const name = await lootObjectDescription(object);
        await plineWithContinuation(known
            ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${objectNameIsPlural(object, state) ? 'have' : 'has'} vanished!`
            : `You ${heroIsBlind(state) ? 'notice' : 'see'} ${name} disappear!`);
    }
    const keeper = currentShopResident(state);
    const loss = keeper && (held ? object.unpaid : costlySpot(state.u.ux, state.u.uy, state))
        ? await stolenValue(object, state.u.ux, state.u.uy, keeper.mpeaceful, { state, silent: true }) : 0;
    await deleteObject(object, state);
    return loss;
}
// C pickup.c:boh_loss(): a cursed bag of holding sometimes tosses a
// carried item; pickup.c:is_boh_item_gone() is the 1-in-13 roll.
async function loseCursedBagContents(container, state) {
    if (container.otyp !== BAG_OF_HOLDING || !container.cursed
        || !container.contents?.length)
        return 0;
    let loss = 0;
    for (const object of [...container.contents]) {
        if (rn2(13) !== 0)
            continue;
        unlinkObject(object, state);
        loss += await loseMagicBagItem(object, container.where === 'inventory', state);
    }
    return loss;
}
export function ageStoresFuel(object) {
    return [BRASS_LANTERN, OIL_LAMP, CANDELABRUM_OF_INVOCATION,
        TALLOW_CANDLE, WAX_CANDLE, POT_OIL].includes(object.otyp);
}
function freezeObject(object, state) {
    if (ageStoresFuel(object) || object.ageRelative)
        return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = true;
    if (object.otyp === CORPSE) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.ROT_CORPSE);
        stopObjectTimer(object, OBJECT_TIMER_KIND.REVIVE_MON);
        const traits = object.oextra?.omonst;
        if (object.corpsenm === MONSTER_NAME.indexOf('ice troll') && traits)
            traits.mcan = 0;
    }
    else if (object.globby) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.SHRINK_GLOB);
    }
}
export function thawObject(object, state) {
    if (ageStoresFuel(object))
        return;
    object.age = (state.moves ?? 0) - (object.age ?? 0);
    object.ageRelative = false;
    if (object.otyp === CORPSE) {
        object.norevive = (object.oextra?.omonst?.mnum ?? object.corpsenm)
            !== MONSTER_NAME.indexOf('ice troll');
        startCorpseTimeout(object);
    }
    else if (object.globby) {
        startGlobTimeout(object, state, state.moves ?? 0);
    }
}
function cannotFit(object) {
    if ([LARGE_BOX, CHEST, ICE_BOX, BOULDER].includes(object.otyp))
        return true;
    return object.otyp === STATUE
        && object.corpsenm !== undefined && monsterIsBig(object.corpsenm);
}
function weldedPrimary(object, state) {
    const primary = state.uwep || state.u?.uwep;
    return object === primary && willWeld(object);
}
function rejectedPutMessage(container, object, state) {
    if (object === state.uball || object === state.uchain
        || object === state.u?.uball || object === state.u?.uchain) {
        return 'You must be kidding.';
    }
    if (object === container)
        return 'That would be an interesting topological exercise.';
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))
        return `You cannot ${container.otyp === ICE_BOX ? 'refrigerate' : 'stash'} something you are wearing.`;
    if (object.otyp === LOADSTONE && object.cursed) {
        object.bknown = true;
        return `The stone${quantity(object) === 1 ? '' : 's'} won't leave your person.`;
    }
    if (FORBIDDEN_CONTENTS.has(object.otyp)) {
        return `The ${objectCombatName(object, { state })} cannot be confined in such trappings.`;
    }
    if (object.otyp === LEASH && object.leashmon) {
        observeObjectForNaming(object, { state });
        return `The ${objectCombatName(object, { state })} ${quantity(object) === 1 ? 'is' : 'are'} attached to your pet.`;
    }
    if (weldedPrimary(object, state)) {
        object.bknown = true;
        observeObjectForNaming(object, { state });
        const hand = heroHandName(state);
        return `${ownedObjectAction(object, 'are', state)} welded to your ${isBimanualObject(object) ? makePlural(hand) : hand}!`;
    }
    return null;
}
function transferQuantity(object, count) {
    const total = quantity(object);
    return count > 0 ? Math.min(Math.trunc(count), total) : total;
}
function splitForTransfer(object, count, state) {
    const amount = transferQuantity(object, count);
    const split = splitObjectStack(object, amount, state);
    if (!split)
        return { object, parent: null };
    // splitObjectStack already carried the bill across the split.
    return { object: split, parent: object };
}
// C pickup.c:fatal_corpse_mistake(): handling one corpse from the stack, with
// the death reason from killer_xname() describing the whole stack.
export async function touchPetrifyingCorpse(object) {
    if (!handlesPetrifyingCorpseBareHanded(object))
        return null;
    const result = await petrifyFromCorpseContact(`Touching ${corpseName(object, { singular: true, includeArticle: true })} is a fatal mistake.`, killerObjectName(object));
    if (!result)
        await displayMessageWindow();
    return result;
}
export async function putIntoContainer(container, object, state = game, count = -1) {
    const transfer = splitForTransfer(object, count, state);
    object = transfer.object;
    const rejected = rejectedPutMessage(container, object, state);
    if (rejected) {
        await restoreRejectedSplit(transfer, state);
        return { moved: false, message: rejected,
            noRepeat: !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) };
    }
    if (state.uwep === object)
        await setPrimaryWeapon(null, state);
    if (state.uswapwep === object)
        await setSecondaryWeapon(null, state);
    if (state.uquiver === object)
        await setQuiverObject(null, state);
    if (await touchPetrifyingCorpse(object)) {
        await restoreRejectedSplit(transfer, state);
        return { moved: false, stop: true, message: null };
    }
    if (cannotFit(object)) {
        const message = `You cannot fit the ${objectCombatName(object, { state })} into the ${objectCombatName(container, { state })}.`;
        await restoreRejectedSplit(transfer, state);
        return { moved: false, message };
    }
    state.inventory = state.inventory.filter(candidate => candidate !== object);
    object.where = 'free';
    await finishInventoryRemoval(object, state);
    if (state.program_state?.gameover)
        return { moved: false, stop: true, message: null };
    if (objectShedsLight(object))
        await snuffLitObject(object, state);
    const floorShop = container.where !== 'inventory' && costlySpot(state.u.ux, state.u.uy, state);
    const wasUnpaid = object.unpaid;
    if (floorShop && object.oclass !== 12)
        await sellHeroDroppedObject(object, state.u.ux, state.u.uy, state);
    if (container.otyp === ICE_BOX)
        freezeObject(object, state);
    else if (container.otyp === BAG_OF_HOLDING
        && magicBagExplodes(object)) {
        return await explodeBag(container, object, state, { rebillTrigger: !!(wasUnpaid && floorShop) });
    }
    observeObjectForNaming(container, { state });
    observeObjectForNaming(object, { state });
    const message = `You put ${await lootObjectDescription(object)} into the ${objectCombatName(container, { state })}.`;
    await plineWithContinuation(message);
    if (floorShop && object.oclass === 12)
        await sellHeroDroppedObject(object, container.ox, container.oy, state);
    await addObjectToContainer(container, object, state);
    container.cknown = true;
    updateContainerWeights(container);
    await bot();
    return {
        moved: true,
        message,
    };
}
// C pickup.c:out_container().
export async function takeFromContainer(container, object, state = game, count = -1, { resetJustPicked = false } = {}) {
    if (!container.contents?.includes(object))
        return { moved: false, message: null };
    if (object.oartifact) {
        const touch = await touchArtifactByHero(object);
        if (!touch.allowed || touch.died) {
            return {
                moved: false,
                stop: touch.died,
                message: null,
            };
        }
    }
    if (await touchPetrifyingCorpse(object)) {
        return { moved: false, stop: true, message: null };
    }
    const lift = await liftObject({
        object,
        container,
        count: transferQuantity(object, count),
        state,
    });
    if (lift.decision !== 'lift') {
        return {
            moved: false,
            stop: lift.decision === 'stop',
            message: null,
        };
    }
    // C out_container(): a loadstone is never split here.
    if (object.otyp !== LOADSTONE)
        object = splitForTransfer(object, lift.count, state).object;
    unlinkObject(object, state);
    if (container.otyp === ICE_BOX)
        thawObject(object, state);
    if (!object.unpaid && container.where !== 'inventory'
        && costlySpot(container.ox, container.oy, state)) {
        object.ox = container.ox;
        object.oy = container.oy;
        await addShopObjectToBill(object, state, { ininv: false });
    }
    await warnAboutRemovedPick(object, state);
    if (resetJustPicked)
        clearJustPicked(state);
    const { object: carried, count: addedCount } = await addPickedInventoryObject(object);
    container.cknown = true;
    updateContainerWeights(container);
    observeObjectForNaming(carried, { state });
    // C prinv()/xprname() formats the surviving stack itself, with only the
    // removed quantity substituted: the stack keeps its identity, so
    // doname()'s twoweapon primary still names the hand rather than
    // degrading a partial stack to "(wielded)".
    const total = quantity(carried);
    const merged = addedCount > 0 && addedCount < total;
    const savedQuantity = carried.quantity;
    carried.quan = addedCount || total;
    carried.quantity = carried.quan;
    let named;
    try {
        named = await lootObjectDescription(carried, inventoryPrimaryHandDetail(carried));
    }
    finally {
        carried.quan = total;
        if (savedQuantity === undefined)
            delete carried.quantity;
        else
            carried.quantity = savedQuantity;
    }
    const suffix = merged ? state.flags.verbose === false ? ''
        : ` (${total} in total).` : '.';
    const description = `${carried.invlet || '$'} - ${named}${suffix}`;
    return {
        moved: true,
        message: pickupInventoryMessage(description, 'removing', state),
    };
}
// C pickup.c:traditional_loot(): unlike pickup's floor loop, 'a' accepts
// every remaining eligible class, and a completed traversal prints a tail.
async function traditional_loot(container, putIn, resetPicked) {
    if (!putIn)
        game._pickupEncumbrance = 0;
    const objects = putIn ? game.inventory : container.contents ?? [];
    const selection = await query_classes(putIn ? 'put in' : 'take out', objects);
    if (!selection)
        return { results: [], spentTime: false };
    if (selection.menu !== 'none')
        return await menu_loot(container, putIn, resetPicked, selection);
    const order = sortObjects(objects, { mode: SORTLOOT_INVLET });
    const passes = !selection.oneAtATime && selection.classes.length ? selection.classes : [null];
    const byCategory = selection.categories.some(category => typeof category === 'string');
    const results = [];
    const batch = () => ({ results, spentTime: results.some(result => result.moved) });
    const chain = () => putIn ? game.inventory : container.contents ?? [];
    let all = selection.everything, first = true, questioned = false;
    try {
        for (const oclass of passes) {
            bypassObjectList(chain(), false);
            let letterCode = 'a'.charCodeAt(0) - 1;
            if (chain()[0]?.oclass === 12)
                letterCode--;
            let object;
            while ((object = nextUnbypassedObject(chain(), game, order))) {
                if (letterCode === 'z'.charCodeAt(0))
                    letterCode = 'A'.charCodeAt(0);
                else if (letterCode === 'Z'.charCodeAt(0))
                    letterCode = '#'.charCodeAt(0);
                else
                    letterCode++;
                if (oclass !== null && object.oclass !== oclass || putIn && object === container
                    || byCategory && !matchesObjectCategories(object, selection))
                    continue;
                let amount = quantity(object);
                if (!all) {
                    observeObjectForNaming(object);
                    const letter = game.flags.fixinv === false ? String.fromCharCode(letterCode) : object.invlet ?? '#';
                    const itemPrefix = putIn ? `${letter} - ` : '';
                    const question = await objectQuestion(object, {
                        prefix: first ? `${putIn ? 'Put in' : 'Take out'}: ` : '', suffix: '?', fallback: 'item',
                        format: async (item, state) => `${itemPrefix}${await objectDescription(item, { state })}`,
                        shortFormat: (item, state) => `${itemPrefix}${simpleObjectNameWithArticle(item, state)}`,
                    });
                    first = false;
                    const response = await tty_yn_function(question, amount < 2 ? 'ynaq' : 'yn#aq', 'n');
                    if (response.answer === 'q')
                        return batch();
                    questioned = true;
                    if (response.answer === 'n' || response.answer === '#' && !response.count)
                        continue;
                    if (response.answer === 'a')
                        all = true;
                    if (response.answer === '#' && !(object.otyp === LOADSTONE && object.cursed)
                        && !weldedPrimary(object, game))
                        amount = Number(response.count < BigInt(amount) ? response.count : BigInt(amount));
                }
                questioned = true;
                const transfer = splitForTransfer(object, amount, game);
                const result = putIn ? await putIntoContainer(container, transfer.object)
                    : await takeFromContainer(container, transfer.object, game, -1, { resetJustPicked: resetPicked });
                results.push(result);
                if (!result.moved && !result.destroyedContainer)
                    await restoreRejectedSplit(transfer, game);
                if (result.message && (!putIn || !result.moved))
                    await plineWithContinuation(result.message, { noRepeat: !result.moved && (result.noRepeat ?? false) });
                if (result.moved && !putIn) {
                    resetPicked = false;
                    if (object.oclass === 12)
                        await bot();
                }
                if (result.stop || result.destroyedContainer || game.program_state.gameover)
                    return batch();
            }
        }
        await plineWithContinuation(questioned ? 'That was all.' : 'No applicable objects.');
        return batch();
    }
    finally {
        clearBypasses();
    }
}
// C pickup.c:menu_loot().
async function menu_loot(container, putIn, resetPicked = false, retry = null) {
    game._pickupEncumbrance = 0;
    const candidates = putIn ? game.inventory : container.contents ?? [];
    if (putIn ? !candidates.some(object => object !== container) : !candidates.length)
        return { results: [], spentTime: false };
    const action = putIn ? 'Put in' : 'Take out';
    const categories = retry ? { autoSelect: false, matchers: [
            (object) => retry.menu === 'all' || matchesObjectCategories(object, retry),
        ] } : await chooseObjectCategories(`${action} what type of objects?`, candidates);
    const eligible = candidates.filter(object => categories.matchers.some(matches => matches(object)));
    if (!putIn && categories.matchers.length)
        container.cknown = true;
    const onePicked = putIn && categories.justPickedCount !== undefined
        && candidates.filter(object => object.pickup_prev).length === 1
        ? candidates.find(object => object.pickup_prev) : null;
    if (!categories.autoSelect && onePicked) {
        // C's just-picked shortcut keeps a rejected split and uses a turn.
        const transfer = splitForTransfer(onePicked, categories.justPickedCount ?? -1, game);
        const result = await putIntoContainer(container, transfer.object);
        if (!result.moved && result.message)
            await plineWithContinuation(result.message, { noRepeat: result.noRepeat ?? false });
        return { results: [result], spentTime: true };
    }
    const selected = categories.autoSelect
        ? eligible.map(value => ({ value, count: -1 }))
        : await chooseObjects(`${action} what?`, eligible, putIn);
    const results = [];
    let resetJustPicked = resetPicked;
    for (const selection of selected) {
        let result;
        if (putIn) {
            result = await putIntoContainer(container, selection.value, game, selection.count);
        }
        else {
            const transfer = splitForTransfer(selection.value, selection.count, game);
            result = await takeFromContainer(container, transfer.object, game, -1, { resetJustPicked });
            if (!result.moved)
                await restoreRejectedSplit(transfer, game);
        }
        results.push(result);
        if (result.message && (!putIn || !result.moved))
            await plineWithContinuation(result.message, { noRepeat: !result.moved && (result.noRepeat ?? false) });
        if (!putIn && result.moved) {
            resetJustPicked = false;
            if (selection.value.oclass === 12)
                await bot();
        }
        if (result.stop || putIn && result.destroyedContainer)
            break;
    }
    return { results, spentTime: categories.autoSelect
            ? results.some(result => result.moved) : selected.length > 0 };
}
function actionKeys() {
    const menuStyle = game.flags.menu_style ?? MENU_FULL;
    return game.flags.lootabc && (menuStyle === MENU_PARTIAL || menuStyle === MENU_FULL)
        ? { takeOut: 'a', putIn: 'b', both: 'c', reverse: 'd', stash: 'e' }
        : { takeOut: 'o', putIn: 'i', both: 'b', reverse: 'r', stash: 's' };
}
// C pickup.c:in_or_out_menu(): the "Do what with <container>?" menu with
// look/out/in/both/reversed/stash/next/quit choices.
async function chooseAction(container, usedTime, moreContainers) {
    const keys = actionKeys();
    const hasContents = !!container.contents?.length;
    const mayTakeOut = hasContents || !container.cknown;
    const mayPutIn = (game.inventory || []).some(object => object !== container);
    const title = mayTakeOut
        ? await ownedObjectQuestion(container, {
            prefix: 'Do what with ', suffix: '?', fallback: 'it', capitalized: false,
        })
        : await ownedObjectQuestion(container, {
            prefix: '', suffix: ' is empty.  Do what with it?', fallback: 'This', capitalized: true,
        });
    const menuStyle = game.flags.menu_style ?? MENU_FULL;
    if (menuStyle === MENU_TRADITIONAL || menuStyle === MENU_COMBINATION) {
        const visibleChoices = `:${mayTakeOut ? 'o' : ''}${mayPutIn ? 'i' : ''}`
            + `${mayTakeOut ? 'b' : ''}${mayPutIn ? 'rs' : ''} ${moreContainers ? 'n' : ''}q`
            + ((game.flags.cmdassist ?? true) ? ' or ?' : '');
        return await promptChoice(title, [':', 'o', 'i', 'b', 'r', 's', 'n', 'q', '?'], moreContainers ? 'n' : 'q', { visibleChoices });
    }
    if (!mayTakeOut && !mayPutIn)
        return keys.both;
    const simpleName = definiteName(simpleObjectName(container));
    const entries = [{ key: ':', text: `Look inside ${simpleName}` }];
    if (mayTakeOut)
        entries.push({ key: keys.takeOut, text: 'take something out' });
    if (mayPutIn)
        entries.push({ key: keys.putIn, text: 'put something in' });
    if (mayTakeOut)
        entries.push({
            key: keys.both, text: `${mayPutIn ? 'both; ' : ''}take out, then put in`,
        });
    if (mayPutIn) {
        entries.push({
            key: keys.reverse, text: `${mayTakeOut ? 'both reversed; ' : ''}put in, then take out`,
        });
        entries.push({ key: keys.stash, text: `stash one item into ${simpleName}` });
    }
    entries.push('');
    if (moreContainers)
        entries.push({ key: 'n', marker: '*', text: 'loot next container' });
    entries.push({ key: 'q', marker: moreContainers ? '-' : '*', text: usedTime ? 'done' : 'do nothing' });
    const chosen = await showChoiceWindow({
        title,
        entries,
    });
    if (chosen === 0)
        return moreContainers ? 'n' : 'q';
    return chosen === 27 ? 'q' : String.fromCharCode(chosen);
}
// C pickup.c:stash_ok().
function stash_ok(object, container) {
    return object === container ? GETOBJ_EXCLUDE_SELECTABLE : GETOBJ_SUGGEST;
}
// C pickup.c:use_container().
export async function use_container(container, { held = false, moreContainers = false, underlay = null, resetJustPicked = false, } = {}) {
    setSellDisposition(container.no_charge ? SELL_DONTSELL : SELL_DELIBERATE);
    try {
        if (heroHasNoHands(game)) {
            await pline('You have no hands!');
            return { spentTime: false, container };
        }
        if (!heroHasFreeHand(game)) {
            await pline(`You have no free ${heroHandName()}.`);
            return { spentTime: false, container };
        }
        container.contents ||= [];
        container.lknown = true;
        if (container.olocked) {
            await plineWithContinuation(`${definiteObjectAction(container, 'are')} locked.`);
            if (held)
                await pline('You must put it down to unlock.');
            return { spentTime: false, container };
        }
        if (container.otrapped) {
            if (held) {
                const name = definiteName(objectCombatName(container, { includeCorpseSpecies: false }));
                await plineWithContinuation(`You open ${name}...`);
            }
            const trap = await triggerChestTrap(container);
            if (!trap?.died && (game.multi ?? 0) >= 0) {
                nomul(-1);
                game._helplessReason = 'opening a container';
                game._helplessDoneMessage = '';
            }
            return {
                spentTime: true,
                stopLooting: true,
                heroDied: !!trap && 'died' in trap && trap.died,
                container: trap?.destroyed ? null : container,
            };
        }
        const quantumCat = isQuantumBox(container);
        let spentTime = await observeQuantumCat(container);
        let tookOut = false;
        const cursedBag = container.otyp === BAG_OF_HOLDING && container.cursed && container.contents.length > 0;
        const loss = await loseCursedBagContents(container, game);
        if (loss) {
            spentTime = true;
            await plineWithContinuation(`You owe ${loss} ${currency(loss)} for lost merchandise.`);
            updateContainerWeights(container);
        }
        const emptyMessage = container.contents.length ? ''
            : `${ownedSimpleObjectName(container)} is ${quantumCat || cursedBag ? 'now ' : ''}empty.`;
        const keys = actionKeys();
        let action;
        for (;;) {
            action = await chooseAction(container, spentTime, moreContainers);
            if (action === '?') {
                const help = ['Container actions:', '',
                    ' : -- Look: examine contents', ' o -- Out: take things out', ' i -- In: put things in',
                    ' b -- Both: first take things out, then put things in',
                    ' r -- Reversed: put things in, then take things out',
                    ' s -- Stash: put one item in', '',
                    ...(moreContainers ? [' n -- Next: loot next selected container'] : []),
                    ' q -- Quit: finished', ' ? -- Help: display this text.', ''];
                await showTextWindow(help);
                continue;
            }
            if (action !== ':')
                break;
            if (!container.cknown)
                spentTime = true;
            await containerContents([container], false, false, true);
            if (underlay)
                restoreMenuUnderlay(underlay);
        }
        const takeOut = [keys.takeOut, keys.both, keys.reverse].includes(action);
        const putIn = [keys.putIn, keys.both, keys.reverse].includes(action);
        const putInFirst = action === keys.reverse;
        if (takeOut && !putInFirst) {
            if (!container.contents.length) {
                if (!container.cknown)
                    spentTime = true;
                container.cknown = true;
                await pline(emptyMessage);
            }
            else {
                const transfer = game.flags.menu_style === MENU_TRADITIONAL
                    ? await traditional_loot(container, false, resetJustPicked)
                    : await menu_loot(container, false, resetJustPicked);
                if (transfer.spentTime)
                    spentTime = true;
                tookOut = transfer.results.some(result => result.moved);
            }
        }
        if (!game.program_state.gameover && (putIn || action === keys.stash)) {
            const hasOtherInventory = (game.inventory || [])
                .some(object => object !== container);
            if (!hasOtherInventory) {
                await pline(`You don't have anything${game.inventory.length ? ' else' : ''} to ${action === keys.stash ? 'stash' : 'put in'}.`);
            }
            else if (action === keys.stash) {
                const choice = await getobj('stash', object => stash_ok(object, container), { forcePrompt: true, allowCount: true });
                const object = choice.object;
                if (object) {
                    // getobj() leaves unsplittable objects whole for in_container's refusal.
                    const unsplittable = object.otyp === LOADSTONE && object.cursed || weldedPrimary(object, game);
                    const count = unsplittable ? -1 : choice.count ?? -1;
                    const result = await putIntoContainer(container, object, game, count);
                    if (!result.moved && result.message)
                        await plineWithContinuation(result.message, { noRepeat: result.noRepeat ?? false });
                    if (result.moved || result.destroyedContainer || result.stop)
                        spentTime = true;
                    if (result.destroyedContainer)
                        return { spentTime, container: null };
                }
            }
            else {
                const transfer = game.flags.menu_style === MENU_TRADITIONAL
                    ? await traditional_loot(container, true, false)
                    : await menu_loot(container, true);
                if (transfer.spentTime)
                    spentTime = true;
                if (transfer.results.some(result => result.destroyedContainer))
                    return { spentTime, container: null };
            }
        }
        if (!game.program_state.gameover && takeOut && putInFirst) {
            if (!container.contents.length) {
                if (!container.cknown)
                    spentTime = true;
                container.cknown = true;
                await pline(emptyMessage);
            }
            else {
                const transfer = game.flags.menu_style === MENU_TRADITIONAL
                    ? await traditional_loot(container, false, resetJustPicked)
                    : await menu_loot(container, false, resetJustPicked);
                if (transfer.spentTime)
                    spentTime = true;
                tookOut = transfer.results.some(result => result.moved);
            }
        }
        if (game.program_state.gameover)
            return { spentTime: true, container, heroDied: true };
        if (spentTime)
            container.cknown = true;
        if (underlay)
            restoreMenuUnderlay(underlay);
        // C pickup.c use_container() ends with no redraw of its own: the tty
        // menu dismissal already restored the covered screen from the glyph
        // buffer, and a map recomputation here would replace remembered glyphs
        // (such as a just-wiped engraving) that the buffer still holds. The
        // flush only repaints the current buffer, like native flush_screen().
        await flush_screen(1);
        return { spentTime, container, tookOut, stopLooting: action === 'q' || action === '\x1b' };
    }
    finally {
        setSellDisposition(SELL_NORMAL);
    }
}
//# sourceMappingURL=pickup.js.map