// C pickup.c:dotip(), choose_tip_container_menu(), tipcontainer(),
// tipcontainer_gettarget(), and tipcontainer_checks().
import { ALTAR, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, LOST_DROPPED,
    MENU_ITEMFLAGS_SELECTED, MENU_TRADITIONAL, PLNMSG_OBJNAM_ONLY } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { plineWithContinuation as pline } from './display.js';
import { isContainer, magicBagExplodes, explodeBag, loseMagicBagItem, thawObject } from './container.js';
import { ableToLoot } from './container_location.js';
import { heroHasNoHands } from './polyself.js';
import { heroHasFreeHand } from './weapon_type.js';
import { heroHandName } from './body_parts.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { inventoryItemDescription } from './invent.js';
import { objectCombatName, objectNameIsPlural, observeObjectForNaming, simpleObjectName } from './objnam.js';
import { BAG_OF_HOLDING, BAG_OF_TRICKS, CAN_OF_GREASE, CRAM_RATION, FOOD_RATION,
    HORN_OF_PLENTY, ICE_BOX, LEMBAS_WAFER, MAGIC_LAMP, OIL_LAMP, POT_OIL,
    STATUE, TALLOW_CANDLE, WAX_CANDLE } from './object_data.js';
import { consumeObjectCharge } from './object_charge.js';
import { dropObjectAtHero, hitFloorWithObject } from './object_drop.js';
import { landObjectOnAltar } from './altar_object.js';
import { addObjectToContainer } from './object_container.js';
import { unlinkObject } from './object_location.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { triggerChestTrap } from './chest_trap.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { useHornOfPlenty } from './horn_of_plenty.js';
import { promptYesNoQuit } from './query.js';
import { surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { heroCanReachFloor } from './floor_reach.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';
import { reportHeroEncumbrance } from './attrib.js';
import { addShopObjectToBill, chargeUnpaidUsage, costlySpot,
    objectTypeKnown, removeObjectAndContentsFromBill } from './shk.js';
import { setSellDisposition, SELL_NORMAL } from './shop_sell.js';
import { showMultiSelectWindow } from './windows.js';
import { rn2 } from './rng.js';
import { currency } from './currency.js';
import { tipWornHelmet } from './tip_hat.js';
import type { GameObject } from './object_types.js';
import type { MultiSelectItem, PageLocalMultiSelectItem } from './windows.js';

function description(object: GameObject): string {
    observeObjectForNaming(object);
    return inventoryItemDescription(object);
}

export async function tipCommand(): Promise<void> {
    game.context.move = 0;
    const { ux: x, uy: y } = game.u;
    const containers = (requireGameLevel().objects[x]?.[y] ?? []).filter(isContainer);
    const considerFloor = !game.iflags.menu_requested
        || game.flags.menu_style === MENU_TRADITIONAL && containers.length > 1;
    if (containers.length && considerFloor) {
        let canTip = !exceedsActionCapacity(game);
        if (!canTip) await pline(`You can't tip ${game.flags.verbose === false
            ? 'a container' : containers.length > 1 ? 'one' : 'it'} while carrying so much.`);
        else canTip = await ableToLoot(x, y, false);
        if (canTip) {
            if (containers.length > 1) {
                const items: PageLocalMultiSelectItem<GameObject | null>[] = containers.map(object => ({
                    text: description(object), value: object,
                }));
                if (game.inventory.length) items.push({ selectable: false, text: '' }, {
                    ...(containers.length <= 8 && !game.flags.lootabc ? { key: 'i' } : {}),
                    text: 'tip something being carried', value: null, itemFlags: MENU_ITEMFLAGS_SELECTED,
                });
                const picked = await showMultiSelectWindow({ title: 'Tip which container?',
                    sections: [{ items }], pageLocalKeys: true,
                    omitHeadings: true, pickOne: true, signalEscape: true });
                if (picked === null) return;
                const source = picked.find(object => object !== null);
                if (source) { await tipContainer(source); game.context.move = 1; return; }
            } else {
                const source = containers[0];
                if (source) {
                    const answer = await promptYesNoQuit(`There is ${description(source)} here, tip it?`);
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
    if (!object) return;
    if (isContainer(object) || object.otyp === HORN_OF_PLENTY) {
        await tipContainer(object);
        game.context.move = 1;
        return;
    }
    await tipOrdinaryObject(object);
}

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
        await pline(`Some ${spill} spill${plural ? '' : 's'} onto the ${surfaceName(x, y)}${tail}.`);
        if (object.otyp === CAN_OF_GREASE) await consumeObjectCharge(object);
        game.context.move = 1;
    } else if (object.oclass === 8) {
        await pline(`The ${objectCombatName(object)} ${object.quan === 1 ? 'is' : 'are'} securely sealed.`);
    } else if (object === (game.uarmh || game.u.uarmh)) {
        game.context.move = await tipWornHelmet(object) ? 1 : 0;
    } else await pline(object.otyp === STATUE ? 'Nothing interesting happens.' : 'Nothing happens.');
}

async function tipDestination(source: GameObject): Promise<{ cancelled: boolean; target: GameObject | null }> {
    const items: MultiSelectItem<GameObject | null>[] = [{
        key: '-', text: 'on the floor', value: null, itemFlags: MENU_ITEMFLAGS_SELECTED,
    }, { selectable: false, text: '' }];
    const targets = game.inventory.filter(object => object !== source && isContainer(object)
        && !(object.otyp === BAG_OF_TRICKS && object.dknown && objectTypeKnown(object)));
    const hands = !heroHasNoHands(game) && heroHasFreeHand(game);
    if (targets.length && !hands) await pline(heroHasNoHands(game) ? 'You have no hands!'
        : `You have no free ${heroHandName()}.`);
    for (const object of targets) {
        if (!hands || object.olocked && object.lknown || !object.invlet)
            items.push({ selectable: false, text: `    ${description(object)}` });
        else items.push({ key: object.invlet, text: description(object), value: object });
    }
    const picked = await showMultiSelectWindow({ title: `Where to tip the contents of ${description(source)}`,
        sections: [{ items }], omitHeadings: true, pickOne: true, signalEscape: true });
    return { cancelled: picked === null, target: picked?.find(object => object !== null) ?? null };
}

async function tipChecks(source: GameObject, target: GameObject | null, allowEmpty: boolean): Promise<boolean> {
    if (target?.otyp === BAG_OF_TRICKS) { await useBagOfTricks(target); return false; }
    source.lknown = true;
    if (source.olocked) {
        await pline(`The ${simpleObjectName(source)} is locked.`);
        return false;
    }
    if (source.otrapped) {
        await triggerChestTrap(source);
        if ((game.multi ?? 0) >= 0 && !game._helplessTurns) {
            game.multi = -1;
            game._helplessTurns = 1;
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
            await pline(`${source.where === 'inventory' ? 'Your ' : 'The '}box is now empty.`);
            return allowEmpty;
        }
    }
    if (!allowEmpty && !source.contents?.length) {
        source.cknown = true;
        await pline(`The ${simpleObjectName(source)} is empty.`);
        return false;
    }
    return true;
}

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
        if (source.otyp === BAG_OF_TRICKS && !seen) await pline('Nothing seems to happen.');
        source.spe = oldCharges;
        await chargeUnpaidUsage(source, { alternate: true });
        source.spe = 0;
        source.cknown = true;
    }
    if (shopGoods) removeObjectAndContentsFromBill(source);
}

async function tipContainer(source: GameObject): Promise<void> {
    source.ox = game.u.ux;
    source.oy = game.u.uy;
    const destination = await tipDestination(source);
    if (destination.cancelled || !await tipChecks(source, destination.target, false)) return;
    const target = destination.target;
    if (target && !await tipChecks(target, null, true)) return;
    const { ux: x, uy: y } = game.u;
    const held = source.where === 'inventory';
    const highDrop = !game.u.uswallow && !heroCanReachFloor(game, { checkPit: true });
    const altar = !game.u.uswallow && requireGameLevel().requireAt(x, y).typ === ALTAR;
    const shopGoods = !held && !!costlySpot(x, y);
    let terse = !(highDrop || altar || costlySpot(x, y));
    let loss = 0;
    const contents = [...source.contents ?? []];
    source.cknown = true;
    await pline(target ? `${contents.length > 1 ? 'Objects tumble' : 'An object tumbles'} into the ${objectCombatName(target)}.`
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
                        const name = description(object);
                        await pline(terse ? `${name}${index + 1 < contents.length ? ',' : '.'}`
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
    if (loss) await pline(`You owe ${loss} ${currency(loss)} for lost merchandise.`);
    source.owt = objectWeight(source);
    if (target && target.where !== 'gone') target.owt = objectWeight(target);
    if (held || target?.where === 'inventory') await reportHeroEncumbrance();
}
