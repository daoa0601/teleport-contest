// C pickup.c: command pickup, automatic pickup, floor inspection,
// container looting (doloot()), and tipping (dotip()).

import { commandResultCancelled, setMulti } from './cmd.js';
import { endVoluntaryMultiTurn, nomul } from './hack.js';
import { game, requireGameLevel } from './gstate.js';
import { isLavaAt, isPoolAt } from './dbridge.js';

import {
    definiteName, objectCombatName, objectNameIsPlural, objectQuestion,
    observeObjectForNaming, ownedSimpleObjectName, simpleObjectName,
    simpleObjectNameWithArticle,
} from './objnam.js';
import { autokey, autoUnlockFlags, pickLock } from './lock.js';

import { isForceableWeapon } from './lock.js';
import { getAdjacentLocation } from './tty_prompts.js';
import {
    ALTAR, AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_UNTRAP,
    SHOPBASE, A_WIS, STONE, W_WEP, is_pit, isok, GRAVE, P_BASIC, P_RIDING,
    LOST_THROWN, LOST_STOLEN, LOST_DROPPED, LOST_EXPLODING,
    MENU_TRADITIONAL, MENU_ITEMFLAGS_SELECTED, PLNMSG_OBJNAM_ONLY,
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST,
} from './const.js';
import { makeSingular, objectDescription } from './objnam.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './invent.js';
import { tryCallObjectType } from './do.js';
import { objectQuantity, splitObjectStack } from './mkobj.js';
import { dropObjectAtHero } from './hero_drop.js';
import { hitFloorWithObject } from './dothrow.js';
import { learnObjectType, objectClassForType, observeObject } from './o_init.js';
import { OBJECT_CLASS_SYMBOLS } from './display.js';



import {
    floorObjectDescription, pricedFloorObjectDescription, lookHere, readFloorEngraving,
} from './floor_object_display.js';

import {
    consumeHallucinatedMenuObjectGlyph, displayLiquidName, flush_screen, newsym, newsym_force,
} from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { describeDecor } from './dungeon_feature.js';
import { showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
import { addInventoryItem } from './u_init.js';
import { recordHeroPrizeAcquisition } from './hero_inventory.js';
import { remove_object } from './floor_object.js';
import { carryableObjectCount, liftObject } from './lift_object.js';

import { takeQueuedInventoryChoice } from './inventory_queued_choice.js';
import { selectInventoryObject } from './invent.js';

import { promptYesNoQuit, yn_function, getLine } from './query.js';
import { showDisclosureOverlay } from './windows.js';
import { PARANOID_AUTOALL } from './const.js';
import { useUpFloorObject } from './floor_consumption.js';
import {
    floorReachProblem, heroCanReachFloor, heroEscapedShaft, heroTeetersAtPit,
} from './floor_reach.js';
import { hideHeroUnder } from './mon.js';
import {
    addShopObjectToBill, billedPickupQuote, chargeUnpaidUsage, costlySpot, objectTypeKnown,
    removeObjectAndContentsFromBill, remoteBurglary, setSellDisposition, SELL_NORMAL,
} from './shk.js';
import { roomsAt } from './room.js';
import { pickupLocationProblem } from './pickup_location.js';
import { finishGhostlyPickup } from './bones_object.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import { unlinkMonsterObject, addObjectToContainer, unlinkObject } from './mkobj.js';
import { touchArtifactByHero } from './artifacts.js';
import {
    BAG_OF_HOLDING, BAG_OF_TRICKS, CAN_OF_GREASE, CORPSE, CRAM_RATION, FOOD_RATION,
    GOLD_PIECE, HORN_OF_PLENTY, ICE_BOX, LEMBAS_WAFER, LOADSTONE, MAGIC_LAMP,
    OIL_LAMP, POT_OIL, SCR_SCARE_MONSTER, STATUE, TALLOW_CANDLE, WAX_CANDLE,
} from './object_data.js';

import { landObjectOnAltar } from './altar_object.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { triggerChestTrap } from './chest_trap.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { useHornOfPlenty } from './horn_of_plenty.js';
import { surfaceName } from './terrain_name.js';
import { exceedsActionCapacity, nearCapacity, objectWeight, pickupLoadPrefix } from './weight.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { inventoryItemDescription, consumeObjectCharge } from './invent.js';
import {
    isContainer, magicBagExplodes, explodeBag, loseMagicBagItem, thawObject, useContainer,
} from './container.js';
import { feelPetrifyingCorpse, touchPetrifyingCorpse, willFeelPetrifyingCorpse } from './stoning.js';
import {
    monsterHasMapPosition, monsterOccupiesPosition, monsterSaddle,
} from './steed.js';
import { monsterName } from './do_name.js';
import { removeObjectFromMonsterInventory } from './monworn.js';
import { holdAnotherObject } from './hero_hold_object.js';

import { propertyIsActive } from './properties.js';
import { loseHeroHp } from './hero_damage.js';
import { rn2, rnd } from './rng.js';
import { reverseLoot } from './confused_loot.js';
import {
    heroCannotTake, heroFormHidesUnderObjects, heroHasNoHands, heroHasNoLimbs,
} from './polyself.js';
import { heroHasFreeHand } from './engrave.js';
import { heroHandName } from './body_parts.js';
import { riderCannotReachMessage } from './steed.js';
import { ceilingName } from './terrain_name.js';
import { tipWornHelmet } from './tip_hat.js';
import { currency } from './currency.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { exerciseAttribute } from './attrib.js';

import { heroIsBlind } from './senses.js';
import { heroIsUnaware } from './hero_sleep.js';
import { lookInsideSwallower } from './swallowed_inventory.js';
import { dolook } from './invent.js';

import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type {
    CountedSelection, MultiSelectItem, MultiSelectSection, PageLocalMultiSelectItem,
} from './windows.js';

interface PickupSource {
    x: number;
    y: number;
    monster: Monster | null;
    objects: GameObject[];
}
type PickupSelection = GameObject | CountedSelection<GameObject>;
type TraditionalPickup = 'canceled' | { attempted: boolean };
type ScrollPickupResult = { decision: 'stop' } | { decision: 'consumed' }
    | { decision: 'lift'; object: GameObject; count: number };
export interface AddedInventoryObject {
    object: GameObject;
    count: number;
}

export function pickupClassOrder(): string[] {
    return [...inventoryClassOrder(), 17, 0].map(objectClassHeading);
}

export async function pickupAtHero(
    count = Math.max(0, game._commandCount || 0),
    { runLocationChecks = true }: { runLocationChecks?: boolean } = {},
): Promise<void> {
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
        for (const message of problem.messages) await plineWithContinuation(message);
        game.context.move = problem.spendsTurn ? 1 : 0;
        return;
    }
    const objects = pickupObjects(source);
    game._pickupEncumbrance = 0;
    if (!source.monster && heroCannotTake(game)) {
        const look = await checkHere(source, false);
        if (look.died) return;
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
        && !game.context.nopick) endVoluntaryMultiTurn();
    let attempted: boolean;
    if (game.flags.menu_style === MENU_TRADITIONAL && !game.iflags.menu_requested) {
        const result = await pickUpTraditionally(source, count);
        // C pickup(): declining the class prompt jumps past the cover check.
        if (result === 'canceled') {
            game.context.move = 0;
            game._pickupEncumbrance = 0;
            return;
        }
        attempted = result.attempted;
    } else {
        const selected = await choosePickupObjects(source, objects, count);
        attempted = (await takeSelectedObjects(source, selected)).attempted;
    }
    await reassessHeroCover(source);
    game.context.move = attempted ? 1 : 0;
    game._pickupEncumbrance = 0;
}

// C pickup(): once picking up ends outside an engulfer, a hider re-checks its
// cover; taking the whole pile leaves nothing to hide under.
async function reassessHeroCover(source: PickupSource): Promise<void> {
    if (!source.monster && !game.program_state.gameover && heroFormHidesUnderObjects(game))
        await hideHeroUnder(game);
}

export async function autopickupAtHero(): Promise<void> {
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
            if (game.flags.mention_decor) await describeDecor();
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
            if (look.died) return;
            // C pickup(): this follows check_here()'s floor prose.
            if (heroCannotTake(game))
                await plineWithContinuation('You are physically incapable of picking anything up.');
            return;
        }
        // pickup.c: pickup() stops only a real run (context.run != 8) when
        // stepping onto objects, and not at all for a no-pickup move.
        // nomul(0) also requests the status refresh for the lifting message.
        if (source.objects.length && (game.context.run ?? 0) > 0
            && game.context.run !== 8 && !game.context.nopick) endVoluntaryMultiTurn();
    }
    // C autopick() walks every object on the square: autopick_testobj()
    // does not exclude the punishment chain, whose class passes the
    // default empty pickup_types.  A chain-only square therefore still
    // produces a non-empty selection, so pickup()'s menu_pickup path runs
    // reset_justpicked() across the inventory before pickup_object()
    // silently refuses uchain.  Stepping onto the chain while punished
    // clears the just-picked marks even though nothing is picked up.
    const eligible: GameObject[] = [];
    for (const object of source.objects) {
        if (await autopickupAllows(object)) eligible.push(object);
    }
    const { picked } = await takeSelectedObjects(source, eligible);
    await reassessHeroCover(source);
    if (!monster && !game.program_state?.gameover) await checkHere(source, picked > 0);
    game._pickupEncumbrance = 0;
}

async function pickUpTraditionally(source: PickupSource, count: number): Promise<TraditionalPickup> {
    const objects = [...source.objects];
    const onlyObject = objects[0];
    if (objects.length === 1 && count && onlyObject) {
        await takeSelectedObjects(source, [{ value: onlyObject, count: Math.min(count, objectQuantity(onlyObject)) }]);
        return { attempted: true };
    }
    let selection: ObjectClassSelection | null = null;
    if (objects.length >= 2) {
        await plineWithContinuation(`There are ${objects.length <= 10 ? 'several' : 'many'} objects here.`);
        selection = await queryObjectClasses('pick up', source.objects);
        if (!selection) return 'canceled';
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
        if (!matches) continue;
        let amount = objectQuantity(object);
        if (!all) {
            observeObjectForNaming(object);
            const question = await objectQuestion(object, {
                prefix: 'Pick up ', suffix: '?', fallback: 'something',
                format: async (item, state) => await objectDescription(item, { state }), shortFormat: simpleObjectNameWithArticle,
            });
            const response = await yn_function(question, amount < 2 ? 'ynaq' : 'yn#aq', 'y', true,
                { menuable: amount < 2 });
            if (response.answer === 'q') break;
            if (response.answer === 'n' || response.answer === '#' && !response.count) continue;
            if (response.answer === 'a') {
                all = true;
                if (selective) {
                    selective = false;
                    classes = [object.oclass];
                }
            } else if (response.answer === '#') {
                amount = Number(response.count < BigInt(amount) ? response.count : BigInt(amount));
            }
        }
        if (!attempted) clearJustPicked(game);
        attempted = true;
        const result = await takeSelectedObjects(source, [{ value: object, count: amount }], false, false);
        picked += result.picked;
        if (result.stopped) break;
    }
    if (picked && !source.monster && !game.program_state.gameover) await newsym_force(source.x, source.y);
    return { attempted };
}

async function choosePickupObjects(source: PickupSource, objects: readonly GameObject[], count: number,
    { autoSelect = true, feelCockatrice = !count, groupByClass = game.flags.sortpack !== false } = {},
): Promise<CountedSelection<GameObject>[]> {
    const eligible = count
        ? objects.filter(object => objectQuantity(object) >= count) : objects;
    if (!eligible.length) return [];
    const onlyObject = eligible[0];
    if (autoSelect && eligible.length === 1 && onlyObject && !(source.monster && objects[0]?.owornmask))
        return [{ value: onlyObject, count: count || objectQuantity(onlyObject) }];
    const ordered = orderedPickupObjects(eligible);
    const sections: MultiSelectSection<GameObject>[] = [];
    let letterCode = 'a'.charCodeAt(0);
    let firstItem = true;
    const headings = groupByClass ? pickupClassOrder() : [null];
    for (const heading of headings) {
        const items = heading === null ? ordered
            : ordered.filter(object => pickupObjectClass(object) === heading);
        if (!items.length) continue;
        const menuItems: MultiSelectItem<GameObject>[] = [];
        for (const object of items) {
            // query_objlist() names preceding entries before reverting to look_here().
            if (feelCockatrice && willFeelPetrifyingCorpse(object)) {
                if (source.monster) await lookInsideSwallower(source.monster);
                else await dolook();
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
    const allowed: CountedSelection<GameObject>[] = [];
    for (const selection of selected) {
        if (source.monster && selection.value.owornmask) {
            observeObjectForNaming(selection.value);
            const name = ownedSimpleObjectName(selection.value, game, { capitalized: false });
            await plineWithContinuation(`You can't pick ${name} up.`);
        } else allowed.push(selection);
    }
    return allowed;
}

// C pickup.c:pickup_object(): remote tools lift the original floor stack.
export async function pickupFloorObject(object: GameObject, count: number, telekinesis = false): Promise<boolean> {
    const source: PickupSource = {
        x: object.ox, y: object.oy, monster: null,
        objects: requireGameLevel().objects[object.ox]?.[object.oy] ?? [],
    };
    const result = await takeSelectedObjects(source, [{ value: object, count }], telekinesis, false);
    return result.picked > 0;
}

async function takeSelectedObjects(source: PickupSource, selected: readonly PickupSelection[], telekinesis = false, batch = true): Promise<{ picked: number; attempted: boolean; stopped: boolean }> {
    if (!selected.length) return { picked: 0, attempted: false, stopped: false };
    if (batch) clearJustPicked(game);
    let picked = 0;
    let attempted = false;
    let stopped = false;
    for (const selection of selected) {
        const counted = 'value' in selection;
        let object = counted ? selection.value : selection;
        if (!source.objects.includes(object)) continue;
        if (source.monster && object.owornmask) {
            observeObjectForNaming(object);
            const name = ownedSimpleObjectName(object, game, { capitalized: false });
            await plineWithContinuation(`You can't pick ${name} up.`);
            continue;
        }
        attempted = true;
        observePickupObject(object);
        if (object === game.uchain) continue;
        if (object.oartifact) {
            const touch = await touchArtifactByHero(object);
            if (touch.died) {
                stopped = true;
                break;
            }
            if (!touch.allowed) continue;
        }
        if (object.otyp === CORPSE
            && ((!telekinesis && await touchPetrifyingCorpse(object))
                || await reviveRiderCorpse(object, telekinesis))) {
            stopped = true;
            break;
        }

        let count = counted ? selection.count : objectQuantity(object);
        if (!(count > 0)) count = objectQuantity(object);
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
        if (lift.decision !== 'lift') continue;
        if (object.otyp !== LOADSTONE)
            object = splitPickupStack(object, lift.count);

        if (source.monster) {
            // C pickup.c:1901 pick_obj(): a swallowed pickup uses plain
            // obj_extract_self on the engulfer's inventory - no unwear,
            // no crysknife release, no skip flags.
            unlinkMonsterObject(source.monster, object);
        } else {
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
            try { transaction = await addShopObjectToBill(object); }
            finally { game.u.ushops = savedShops; }
        }
        if (transaction) observeObjectForNaming(object);
        const quote = transaction && billedPickupQuote(transaction);
        if (quote) await plineWithContinuation(quote);
        const remote = object.unpaid && shopRoom !== undefined && !savedShops.includes(shopRoom);
        const added = await addPickedInventoryObject(object);
        if (remote) await remoteBurglary(source.x, source.y);
        const message = await pickedInventoryDescription(added.object, lift.count);
        await plineWithContinuation(pickupInventoryMessage(message, 'lifting'));
        const ghostlyMessage = finishGhostlyPickup(added.object, game);
        if (ghostlyMessage) await plineWithContinuation(ghostlyMessage);
        picked++;
        if (game.program_state?.gameover) {
            stopped = true;
            break;
        }
    }
    if (batch && picked && !game.program_state?.gameover) {
        if (!source.monster) await newsym_force(source.x, source.y);
    }
    return { picked, attempted, stopped };
}

// C pickup.c:pickup_prinv(). Tool pickups retain this process-local
// baseline; pickup() and container menus reset it at their own boundaries.
export function pickupInventoryMessage(description: string, verb: 'lifting' | 'removing', state: GameState = game): string {
    const capacity = nearCapacity(state);
    const prefix = capacity === (state._pickupEncumbrance ?? 0) ? '' : pickupLoadPrefix(capacity);
    state._pickupEncumbrance = capacity;
    return prefix ? `${prefix} ${verb} ${description}` : description;
}

export async function addPickedInventoryObject(object: GameObject): Promise<AddedInventoryObject> {
    recordHeroPrizeAcquisition(object, game);
    const count = objectQuantity(object);
    const carried = await addInventoryItem(object, null, false);
    markJustPicked(carried);
    observeObjectForNaming(carried);
    return { object: carried, count };
}

// C pickup_prinv(): format after pick_obj() has settled remote shop billing.
async function pickedInventoryDescription(carried: GameObject, count: number): Promise<string> {
    const picked = { ...carried, quan: count, quantity: count };
    // Native pickup suppresses the primary-hand annotation when the new
    // objects merged into the wielded stack; other slot annotations remain.
    if (carried === game.uwep) picked.owornmask = (picked.owornmask ?? 0) & ~W_WEP;
    const merged = count < objectQuantity(carried);
    const total = merged ? game.flags.verbose === false ? ''
        : ` (${objectQuantity(carried)} in total).` : '.';
    return `${carried.invlet} - ${await floorObjectDescription(picked)}${total}`;
}

function pickupSourceAtHero(): PickupSource {
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
function pickupObjects(source: PickupSource): GameObject[] {
    return source.objects.filter(object => object !== game.uchain && object !== game.u?.uchain);
}

export async function autopickupAllows(object: GameObject): Promise<boolean> {
    if (object.where === 'floor' && !object.no_charge
        && costlySpot(object.ox, object.oy)) return false;
    if ((game.flags.pickup_thrown !== false && object.how_lost === LOST_THROWN)
        || (game.flags.pickup_stolen !== false && object.how_lost === LOST_STOLEN)) return true;
    if (game.flags.dropped_nopick !== false && object.how_lost === LOST_DROPPED) return false;
    if (object.how_lost === LOST_EXPLODING) return false;
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
        if (match) pickit = match.grab;
    }
    return pickit;
}

function observePickupObject(object: GameObject): void {
    if (!heroIsBlind(game)) observeObject(object);
}

async function prepareScareScrollPickup(object: GameObject, requested: number, telekinesis: boolean): Promise<ScrollPickupResult> {
    const count = await carryableObjectCount({ object, count: requested });
    if (count < 1) return { decision: 'stop' };

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
    await pline(`The scroll${quantity === 1 ? '' : 's'} ${
        quantity === 1 ? 'turns' : 'turn'} to dust as you ${telekinesis ? 'raise' : 'pick'} ${
        quantity === 1 ? 'it' : 'them'} up.`);
    await tryCallObjectType(scroll);
    await useUpFloorObject(scroll, scroll.quan);
    return { decision: 'consumed' };
}

async function reviveRiderCorpse(corpse: GameObject, remotely: boolean): Promise<boolean> {
    if (!isRider(corpse.corpsenm)) return false;
    await pline(`At your ${remotely ? 'attempted acquisition' : 'touch'}, the corpse suddenly moves...`);
    const revival = await reviveCorpseImmediately(corpse, game);
    for (const message of revival?.messages || [])
        await plineWithContinuation(message);
    await exerciseAttribute(A_WIS, false);
    return true;
}

function splitPickupStack(object: GameObject, count: number): GameObject {
    if (count >= objectQuantity(object)) return object;
    return splitObjectStack(object, count, game) ?? object;
}

// C pickup.c:check_here().
async function checkHere(source: PickupSource, pickedSome: boolean): Promise<{ died: boolean }> {
    const { x, y } = source;
    const skipFeature = game.flags.mention_decor ? await describeDecor() : false;
    const chain = game.uchain || game.u?.uchain;
    const count = pickupObjects(source).filter(object => object !== chain).length;
    if (!count) {
        await readFloorEngraving(x, y);
        return { died: false };
    }
    // check_here() uses nomul(0), including its pending status refresh.
    if ((game.context.run ?? 0) > 0) endVoluntaryMultiTurn();
    // C check_here() flushes movement before look_here() can page a prior
    // message. The pager itself leaves pending map changes untouched.
    await flush_screen(1);
    const { died } = await lookHere(count, { pickedSome, skipFeature });
    return { died };
}

export function orderedPickupObjects(pile: readonly GameObject[]): GameObject[] {
    return sortObjects(pile, { mode: lootSortMode() });
}

export function pickupObjectClass(object: GameObject): string {
    const oclass = object.oclass || objectClassForType(object.otyp);
    return objectClassHeading(oclass);
}

// C pickup.c:doloot().
export async function doloot() {
    await lootCommand({ unlockContainer: lootLockedContainer, chooseDirection: getAdjacentLocation });
}

// C pickup.c:do_loot_cont(): untrapping or applying a key takes precedence
// over queuing #force, even when the player declines those earlier offers.
async function lootLockedContainer(container: GameObject, containerCount: number): Promise<void> {
    if (!container.olocked) return;
    const name = definiteName(objectCombatName(container, { includeCorpseSpecies: false }));
    await pline(container.lknown ? `${name.charAt(0).toUpperCase()}${name.slice(1)} is locked.` : `Hmmm, ${name} turns out to be locked.`);
    container.lknown = true;
    const flags = autoUnlockFlags(game);
    game.context.move = 0;
    if (!flags) return;
    game.u.dz = 0;
    const tool = flags & AUTOUNLOCK_APPLY_KEY ? autokey(true) : null;
    if (tool || flags & AUTOUNLOCK_UNTRAP) {
        game.context.move = Number(await pickLock(tool, { target: { x: game.u.ux, y: game.u.uy }, container }));
        return;
    }
    if (flags & AUTOUNLOCK_FORCE && containerCount === 1 && isForceableWeapon(game.uwep)) {
        // The queued command owns its confirmation and any time spent.
        game._cannedCommands ??= [];
        game._cannedCommands.push({ kind: 'command', name: 'force' });
    }
}

// C pickup.c:able_to_loot(): floor-container admission for loot and tip.
export async function ableToLoot(x: number, y: number, looting: boolean): Promise<boolean> {
    const verb = looting ? 'loot' : 'tip';
    const trap = requireGameLevel().traps.find(trap => trap.tx === x && trap.ty === y);
    const reach = floorReachProblem(game, { checkPit: !!trap && is_pit(trap.ttyp) });
    if (reach) {
        if (game.u.usteed && (game.u.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
            await plineWithContinuation(riderCannotReachMessage());
        } else {
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

// C pickup.c:doloot_core(), do_loot_cont(), mon_beside(), and loot_mon().
interface LootCommandInput {
    unlockContainer: (container: GameObject, containerCount: number) => Promise<void>;
    chooseDirection: (prompt: string, error: string | null, x: number, y: number) => Promise<(Position & { dz: number }) | null>;
}

export async function lootCommand(input: LootCommandInput): Promise<void> {
    game.context.move = 0;
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation("You can't do that while carrying so much stuff.");
        return;
    }
    if (heroHasNoHands(game)) { await plineWithContinuation('You have no hands!'); return; }
    if (game.u.confused || (game.u.confusionTurns ?? 0) > 0) {
        if (rn2(6) && await reverseLoot()) { game.context.move = 1; return; }
        if (rn2(2)) {
            await plineWithContinuation('Being confused, you find nothing to loot.');
            game.context.move = 1;
            return;
        }
    }
    const { ux: x, uy: y } = game.u;
    if (!game.iflags.menu_requested && await lootFloorContainers(x, y, input.unlockContainer)) return;
    // C mon_beside(): MON_AT() over the 3x3 around the hero, so a long
    // worm's tail segments count even when its head is farther away.
    const beside = monBeside(x, y);
    if (!beside && !game.iflags.menu_requested) {
        await plineWithContinuation("You don't find anything here to loot.");
        return;
    }
    const target = await input.chooseDirection('Loot in what direction?', 'Invalid loot location', x, y);
    if (!target) return;
    const underfoot = target.x === x && target.y === y;
    const containers = (requireGameLevel().objects[target.x]?.[target.y] ?? []).some(isContainer);
    if (underfoot && containers) { await lootFloorContainers(x, y, input.unlockContainer); return; }
    if (target.dz < 0) {
        await plineWithContinuation(`You don't find anything to loot on the ${ceilingName(target.x, target.y, game)}.`);
        game.context.move = 1;
        return;
    }
    const monster = requireGameLevel().monsters.find(monster =>
        monsterHasMapPosition(monster, game) && monster.mhp > 0
        && monster.mx === target.x && monster.my === target.y);
    const result = monster ? await lootMonster(monster) : { asked: false, spentTime: false };
    if (game.u.confused || (game.u.confusionTurns ?? 0) > 0
        || game.u.stunned || (game.u.stunnedTurns ?? 0) > 0) game.context.move = 1;
    if (result.spentTime) return;
    if (!underfoot && containers) {
        await plineWithContinuation(monster ? `You can't loot anything ${result.asked ? 'else ' : ''}there with ${monsterName(monster)} in the way.` : 'You have to be at a container to loot it.');
    } else await plineWithContinuation(`You don't find anything ${result.asked ? 'else ' : ''}${underfoot ? 'here' : 'there'} to loot.`);
}

// C pickup.c:do_loot_cont(): the unlocked-container loot loop, including
// the carnivorous bag of tricks bite.
async function lootFloorContainers(x: number, y: number,
    unlock: LootCommandInput['unlockContainer']): Promise<boolean> {
    const pile = requireGameLevel().objects[x]?.[y] ?? [];
    const containers = pile.filter(isContainer);
    if (!containers.length) {
        if (requireGameLevel().requireAt(x, y).typ === GRAVE)
            await plineWithContinuation('You need to dig up the grave to effectively loot it...');
        return false;
    }
    if (!await ableToLoot(x, y, true)) return true;
    for (const object of pile) {
        if (willFeelPetrifyingCorpse(object)) {
            await feelPetrifyingCorpse(object);
            game.context.move = 1;
            return true;
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
    if (selected === null) return true;
    if (!selected.length) return false;
    let spentTime = false;
    let resetJustPicked = true;
    for (const [index, container] of selected.entries()) {
        if (container.olocked) {
            await unlock(container, selected.length);
            spentTime ||= !!game.context.move;
            continue;
        }
        container.lknown = true;
        if (container.otyp === BAG_OF_TRICKS) {
            await plineWithContinuation(`You carefully open the ${objectCombatName(container)}...`);
            await plineWithContinuation('It develops a huge set of teeth and bites you!');
            const damage = rnd(10);
            await loseHeroHp(propertyIsActive('halfPhysicalDamage') ? Math.ceil(damage / 2) : damage,
                'carnivorous bag');
            learnObjectType(BAG_OF_TRICKS);
            spentTime = true;
            break;
        }
        game._pending_message = '';
        await flush_screen(1);
        const result = await useContainer(container, {
            moreContainers: index + 1 < selected.length, underlay: snapshotMenuUnderlay(),
            resetJustPicked,
        });
        if (result.tookOut) resetJustPicked = false;
        spentTime ||= result.spentTime;
        if (result.heroDied || result.stopLooting || !result.container) break;
    }
    game.context.move = spentTime ? 1 : 0;
    return true;
}

// C pickup.c:loot_mon().
async function lootMonster(monster: Monster): Promise<{ asked: boolean; spentTime: boolean }> {
    let asked = false;
    let spentTime = false;
    const saddle = monster !== game.u.usteed ? monsterSaddle(monster) : null;
    if (saddle) {
        asked = true;
        const name = monsterName(monster, { suppressSaddle: true });
        const answer = await promptYesNoQuit(`Do you want to remove the saddle from ${name}?`, 'n');
        if (answer === 'q') return { asked, spentTime };
        if (answer === 'y') {
            if (heroHasNoLimbs(game)) { await plineWithContinuation("You can't do that without limbs."); return { asked, spentTime }; }
            if (saddle.cursed) {
                await plineWithContinuation(`You can't.  The saddle seems to be stuck to ${
                    monsterName(monster, { suppressSaddle: true })}.`);
                game.context.move = 1;
                return { asked, spentTime: true };
            }
            await removeObjectFromMonsterInventory(monster, saddle);
            if (game.flags.verbose !== false) await plineWithContinuation(`You take the ${simpleObjectName(saddle)} off of ${monsterName(monster)}.`);
            // C doloot()/addinv_core0() reset the batch when the saddle is acquired.
            clearJustPicked(game);
            const held = await holdAnotherObject(saddle, { dropMessage: `You drop ${await inventoryItemDescription(saddle)}!` });
            markJustPicked(held.object);
            rnd(3);
            game.context.move = 1;
            spentTime = true;
        }
    }
    if (game.u.uswallow) {
        // C loot_mon() passes the saddle inquiry flag, not the command count.
        // pickup.c:loot_mon() calls pickup() directly; only dopickup()
        // runs pickup_checks(), so an empty stomach costs no turn here.
        await pickupAtHero(asked ? 1 : 0, { runLocationChecks: false });
        spentTime = !!game.context.move;
    }
    return { asked, spentTime };
}

// C pickup.c:mon_beside(): any monster occupying one of the 3x3 squares
// around (x, y), with MON_AT() counting worm tail segments.
function monBeside(x: number, y: number): boolean {
    for (let nx = x - 1; nx <= x + 1; nx++) {
        for (let ny = y - 1; ny <= y + 1; ny++) {
            if (!isok(nx, ny)) continue;
            if (requireGameLevel().monsters.some(monster =>
                monsterHasMapPosition(monster, game)
                && monsterOccupiesPosition(monster, nx, ny)
                && monster.mhp > 0)) return true;
        }
    }
    return false;
}

// doname() wrapper for tip menus and prompts; the tip mechanics live in the
// dotip/tipcontainer functions below.
async function containerDescription(object: GameObject): Promise<string> {
    observeObjectForNaming(object);
    return await inventoryItemDescription(object);
}

// C pickup.c:dotip(). Floor containers first (menu when there are several,
// choose_tip_container_menu() below), then the carried-object prompt, then
// the spillage cases in tipOrdinaryObject().

export async function tipCommand(): Promise<void> {
    game.context.move = 0;
    const { ux: x, uy: y } = game.u;
    const containers = (requireGameLevel().objects[x]?.[y] ?? []).filter(isContainer);
    const considerFloor = !game.iflags.menu_requested
        || game.flags.menu_style === MENU_TRADITIONAL && containers.length > 1;
    if (containers.length && considerFloor) {
        let canTip = !exceedsActionCapacity(game);
        if (!canTip) await plineWithContinuation(`You can't tip ${game.flags.verbose === false
            ? 'a container' : containers.length > 1 ? 'one' : 'it'} while carrying so much.`);
        else canTip = await ableToLoot(x, y, false);
        if (canTip) {
            if (containers.length > 1) {
                const items: PageLocalMultiSelectItem<GameObject | null>[] = [];
                for (const object of containers) items.push({
                    text: await containerDescription(object), value: object,
                });
                if (game.inventory.length) items.push({ selectable: false, text: '' }, {
                    ...(containers.length <= 8 && !game.flags.lootabc ? { key: 'i' } : {}),
                    text: 'tip something being carried', value: null, itemFlags: MENU_ITEMFLAGS_SELECTED,
                });
                const picked = await showMultiSelectWindow({ title: 'Tip which container?',
                    sections: [{ items }], pageLocalKeys: true,
                    omitHeadings: true, pickOne: true, signalEscape: true });
                // pickup.c:choose_tip_container_menu() returns ECMD_CANCEL
                // when the container menu is dismissed with Escape.
                if (picked === null) { commandResultCancelled(); return; }
                const source = picked.find(object => object !== null);
                if (source) { await tipContainer(source); game.context.move = 1; return; }
            } else {
                const source = containers[0];
                if (source) {
                    const answer = await promptYesNoQuit(`There is ${await containerDescription(source)} here, tip it?`);
                    if (answer === 'q') return;
                    if (answer === 'y') { await tipContainer(source); game.context.move = 1; return; }
                }
            }
        }
    }
    const object = await chooseInventoryObject('tip', object => {
        if (object.oclass === 12) return GETOBJ_EXCLUDE;
        return isContainer(object) || object.otyp === HORN_OF_PLENTY
            && object.dknown && objectTypeKnown(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    }, { forcePrompt: true });
    if (!object) {
        commandResultCancelled(); // pickup.c:dotip() getobj ECMD_CANCEL.
        return;
    }
    if (isContainer(object) || object.otyp === HORN_OF_PLENTY) {
        await tipContainer(object);
        game.context.move = 1;
        return;
    }
    await tipOrdinaryObject(object);
}

// C pickup.c:dotip(), spillage and ordinary-object cases.
async function tipOrdinaryObject(object: GameObject): Promise<void> {
    let spill: string | null = null;
    if ([TALLOW_CANDLE, WAX_CANDLE].includes(object.otyp) && object.lamplit) spill = 'wax';
    else if (object.otyp === POT_OIL && object.lamplit
        || object.otyp === OIL_LAMP && object.age !== 0
        || object.otyp === MAGIC_LAMP && object.spe !== 0) spill = 'oil';
    else if (object.otyp === CAN_OF_GREASE && object.spe > 0) spill = 'grease';
    else if ([FOOD_RATION, CRAM_RATION, LEMBAS_WAFER].includes(object.otyp)) spill = 'crumbs';
    else if (object.oclass === 17) spill = 'venom';
    if (spill) {
        const plural = spill === 'crumbs';
        const { ux: x, uy: y } = game.u;
        const tail = isPoolAt(x, y) ? ` and gradually dissipate${plural ? '' : 's'}`
            : isLavaAt(x, y) ? ` and immediately burn${plural ? '' : 's'} away` : '';
        await plineWithContinuation(`Some ${spill} spill${plural ? '' : 's'} onto the ${surfaceName(x, y)}${tail}.`);
        if (object.otyp === CAN_OF_GREASE) await consumeObjectCharge(object);
        game.context.move = 1;
    } else if (object.oclass === 8) {
        await plineWithContinuation(`The ${objectCombatName(object)} ${object.quan === 1 ? 'is' : 'are'} securely sealed.`);
    } else if (object === (game.uarmh || game.u.uarmh)) {
        game.context.move = await tipWornHelmet(object) ? 1 : 0;
    } else await plineWithContinuation(object.otyp === STATUE ? 'Nothing interesting happens.' : 'Nothing happens.');
}

// C pickup.c:tipcontainer_gettarget(). The destination menu; tip to floor
// needs no hands, container-to-container needs a free one.
async function tipDestination(source: GameObject): Promise<{ cancelled: boolean; target: GameObject | null }> {
    const items: MultiSelectItem<GameObject | null>[] = [{
        key: '-', text: 'on the floor', value: null, itemFlags: MENU_ITEMFLAGS_SELECTED,
    }, { selectable: false, text: '' }];
    const targets = game.inventory.filter(object => object !== source && isContainer(object)
        && !(object.otyp === BAG_OF_TRICKS && object.dknown && objectTypeKnown(object)));
    const hands = targets.length === 0 || (!heroHasNoHands(game) && heroHasFreeHand(game));
    if (!hands) await plineWithContinuation(heroHasNoHands(game) ? 'You have no hands!'
        : `You have no free ${heroHandName()}.`);
    for (const object of targets) {
        if (!hands || object.olocked && object.lknown || !object.invlet)
            items.push({ selectable: false, text: `    ${await containerDescription(object)}` });
        else items.push({ key: object.invlet, text: await containerDescription(object), value: object });
    }
    const picked = await showMultiSelectWindow({ title: `Where to tip the contents of ${await containerDescription(source)}`,
        sections: [{ items }], omitHeadings: true, pickOne: true, signalEscape: true });
    return { cancelled: picked === null, target: picked?.find(object => object !== null) ?? null };
}

// C pickup.c:tipcontainer_checks().
async function tipChecks(source: GameObject, target: GameObject | null, allowEmpty: boolean): Promise<boolean> {
    if (target?.otyp === BAG_OF_TRICKS) { await useBagOfTricks(target); return false; }
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
        if (target && !await tipChecks(target, null, true)) return false;
        await emptyChargedContainer(source, target);
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

// C pickup.c:tipcontainer_checks(), bag of tricks / horn of plenty branch.
async function emptyChargedContainer(source: GameObject, target: GameObject | null): Promise<void> {
    const shopGoods = source.where !== 'inventory' && !!costlySpot(source.ox, source.oy) && !source.no_charge;
    if (shopGoods) await addShopObjectToBill(source, game, { ininv: false, silent: true });
    const oldCharges = source.spe;
    let seen = 0;
    do {
        if (source.otyp === BAG_OF_TRICKS) {
            const result = await useBagOfTricks(source, { tipping: true });
            if (!result.created) break;
            seen += result.seen;
        } else if (!await useHornOfPlenty(source, { tipping: true, target })) break;
    } while (source.spe > 0 && !game.program_state.gameover);
    if (source.spe < oldCharges) {
        if (source.otyp === BAG_OF_TRICKS && !seen) await plineWithContinuation('Nothing seems to happen.');
        source.spe = oldCharges;
        await chargeUnpaidUsage(source, { alternate: true });
        source.spe = 0;
        source.cknown = true;
    }
    if (shopGoods) removeObjectAndContentsFromBill(source);
}

// C pickup.c:tipcontainer().
async function tipContainer(source: GameObject): Promise<void> {
    source.ox = game.u.ux;
    source.oy = game.u.uy;
    const destination = await tipDestination(source);
    if (destination.cancelled || !await tipChecks(source, destination.target, false)) return;
    const target = destination.target;
    if (target && !await tipChecks(target, null, true)) return;
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
        if (source.otyp === ICE_BOX) thawObject(object, game);
        else if (source.otyp === BAG_OF_HOLDING && source.cursed && !rn2(13)) {
            loss += await loseMagicBagItem(object, held);
            terse = false;
            continue;
        }
        if (shopGoods) await addShopObjectToBill(object, game, { ininv: false, silent: true });
        const suppressed = game.iflags.suppress_price;
        if (shopGoods) game.iflags.suppress_price = true;
        try {
            if (target) {
                if (target.otyp === BAG_OF_HOLDING && magicBagExplodes(object)) {
                    await explodeBag(target, object, game, { tipping: true, triggerHeld: held });
                    if (game.program_state.gameover) return;
                    break;
                }
                await addObjectToContainer(target, object);
            } else {
                object.how_lost = LOST_DROPPED;
                if (highDrop) await hitFloorWithObject(object);
                else {
                    if (altar) await landObjectOnAltar(object);
                    else {
                        const name = await containerDescription(object);
                        await plineWithContinuation(terse ? `${name}${index + 1 < contents.length ? ',' : '.'}`
                            : `${name.charAt(0).toUpperCase()}${name.slice(1)} ${objectNameIsPlural(object) ? 'drop' : 'drops'} to the ${surfaceName(x, y)}.`);
                        if (terse) game._lastPlineKind = PLNMSG_OBJNAM_ONLY;
                    }
                    await dropObjectAtHero(object);
                    if (game._lastPlineKind !== PLNMSG_OBJNAM_ONLY) terse = false;
                }
            }
        } finally {
            if (suppressed === undefined) delete game.iflags.suppress_price;
            else game.iflags.suppress_price = suppressed;
        }
        if (game.program_state.gameover) break;
    }
    if (loss) await plineWithContinuation(`You owe ${loss} ${currency(loss)} for lost merchandise.`);
    source.owt = objectWeight(source);
    if (target && target.where !== 'gone') target.owt = objectWeight(target);
    if (held || targetHeld) await reportHeroEncumbrance();
}

// ---------------------------------------------------------------------------
// C pickup.c:query_classes(), simple_look(), allow_category().
// ---------------------------------------------------------------------------

type BucCategory = 'B' | 'U' | 'C' | 'X';
type ObjectCategory = number | BucCategory | 'u' | 'P';
export interface ObjectClassSelection {
    classes: number[];
    categories: ObjectCategory[];
    oneAtATime: boolean;
    everything: boolean;
    menu: 'none' | 'all' | 'filtered';
}

// C pickup.c:query_classes().
export async function queryObjectClasses(
    action: 'pick up' | 'take out' | 'put in', objects: readonly GameObject[],
): Promise<ObjectClassSelection | null> {
    const classes = [...new Set(objects.map(object => object.oclass))];
    if (!classes.length) return null;
    const inventory = objects === game.inventory;
    let letters = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
    if (classes.length > 1) letters += ` aA${inventory ? 'i' : ':'}`;
    letters += 'm';
    if (objects.some(hasUnpaidContents)) letters += 'u';
    const statuses = new Set(objects.map(object => {
        if (game.urole?.key === 'priest') object.bknown = object.oclass !== 12;
        return bucCategory(object);
    }));
    letters += (['B', 'U', 'C', 'X'] as const).filter(status => statuses.has(status)).join('');
    if (objects.some(object => object.pickup_prev)) letters += 'P';
    // Native filters survive ':' and 'i' while the answer itself is reset.
    const categories: ObjectCategory[] = [];
    let menuSeen = false;
    for (;;) {
        const response = await getLine(`What kinds of thing do you want to ${action}? [${letters}]`,
            (_character, key) => key >= 32 && key < 127);
        if (response === null) return null;
        const selected: number[] = [];
        let oneAtATime = false, everything = false, missing = false, filtered = false;
        let looked = false;
        for (const character of response) {
            if (character === ' ') continue;
            if (character === 'A') oneAtATime = true;
            else if (character === 'a') everything = true;
            else if (character === ':' || character === 'i') {
                if (character === 'i') {
                    if (takeQueuedInventoryChoice() === undefined) await selectInventoryObject();
                } else {
                    await lookAtObjects(objects);
                    const container = objects[0]?.container;
                    if (container) container.cknown = true;
                }
                looked = true;
                break;
            } else if (character === 'm') menuSeen = true;
            else if (isSpecialCategory(character)) {
                if (!categories.includes(character)) categories.push(character);
                filtered = true;
            } else {
                const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
                if (letters.includes(character) && oclass > 0) {
                    selected.push(oclass);
                    if (!categories.includes(oclass)) categories.push(oclass);
                } else {
                    const where = action === 'pick up' ? 'here' : action === 'take out' ? 'inside' : '';
                    await plineWithContinuation(where ? `There are no ${character}'s ${where}.` : `You have no ${character}'s.`);
                    missing = true;
                }
            }
        }
        if (looked) continue;
        if (menuSeen) return { classes: selected, categories, oneAtATime, everything,
            menu: (everything || !selected.length) && !filtered ? 'all' : 'filtered' };
        if (!selected.length && (!everything || missing)) {
            oneAtATime = true;
            everything = false;
        }
        return { classes: selected, categories, oneAtATime, everything, menu: 'none' };
    }
}

export function matchesObjectCategories(object: GameObject, selection: ObjectClassSelection): boolean {
    const classes = selection.categories.filter((category): category is number => typeof category === 'number');
    const statuses = selection.categories.filter((category): category is BucCategory =>
        category === 'B' || category === 'U' || category === 'C' || category === 'X');
    if (!selection.categories.length) return !!((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL);
    // Explicit coin selection overrides the other filter groups.
    if (object.oclass === 12 && classes.length) return classes.includes(12);
    if (game.urole?.key === 'priest' && !object.bknown) object.bknown = true;
    return (!classes.length || classes.includes(object.oclass))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!selection.categories.includes('u') || hasUnpaidContents(object))
        && (!selection.categories.includes('P') || !!object.pickup_prev);
}

export function hasBucCategory(selection: ObjectClassSelection): boolean {
    return selection.categories.some(category => typeof category === 'string' && 'BUCX'.includes(category));
}

function isSpecialCategory(character: string): character is BucCategory | 'u' | 'P' {
    return character === 'u' || character === 'P' || character === 'B'
        || character === 'U' || character === 'C' || character === 'X';
}

function bucCategory(object: GameObject): BucCategory {
    if (object.oclass === 12) return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}

// C pickup.c:simple_look().
async function lookAtObjects(objects: readonly GameObject[]): Promise<void> {
    const first = objects[0];
    if (!first) return;
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

function hasUnpaidContents(object: GameObject): boolean {
    return !!object.unpaid || !!object.contents?.some(hasUnpaidContents);
}
