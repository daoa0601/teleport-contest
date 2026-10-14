// C pickup.c:dotip(), tipcontainer(), and its destination and admission checks.
import {
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, IS_ALTAR,
    LOST_DROPPED, MENU_ITEMFLAGS_SELECTED, MENU_TRADITIONAL, NHW_MENU, PICK_ONE,
} from './const.js';
import { game, requireGameLevel } from './gstate.js';
import type { GameObject } from './object_types.js';
import { displayLiquidName, plineWithContinuation as pline } from './display.js';
import { heroHandName } from './body_parts.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { useHornOfPlenty } from './horn_of_plenty.js';
import { triggerChestTrap } from './chest_trap.js';
import { magicBagExplodes, thawObject } from './container.js';
import { currency } from './currency.js';
import { landObjectOnAltar } from './altar_object.js';
import { useUpFloorObject } from './floor_consumption.js';
import { floorObjectDescription } from './floor_object_display.js';
import { floorReachProblem, heroCanReachFloor } from './floor_reach.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { loseHeroHp } from './hero_damage.js';
import { inventoryItemDescription } from './invent.js';
import { monsterName } from './monster_name.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { addObjectToContainer } from './object_container.js';
import { consumeObjectCharge } from './object_charge.js';
import { deleteObject } from './object_delete.js';
import { dropObjectAtHero, hitFloorWithObject, updateHeroEncumbrance } from './object_drop.js';
import { unlinkObject } from './object_location.js';
import { objectName, observeObjectForNaming, pluralizeObjectNoun, simpleObjectName } from './objnam.js';
import { verbForSubject } from './object_grammar.js';
import {
    BAG_OF_HOLDING, BAG_OF_TRICKS, CAN_OF_GREASE, CRAM_RATION, FOOD_RATION,
    HORN_OF_PLENTY, ICE_BOX, LARGE_BOX, LEMBAS_WAFER, MAGIC_LAMP,
    OIL_LAMP, POT_OIL, STATUE, TALLOW_CANDLE, WAX_CANDLE,
} from './object_data.js';
import { heroHasNoHands, heroHasNoLimbs } from './polyself.js';
import { isQuantumBox, observeQuantumCat } from './quantum_cat.js';
import { promptYesNoQuit } from './query.js';
import { d, rn2 } from './rng.js';
import { scatterFloorObjects } from './scatter.js';
import { heroIsBlind } from './senses.js';
import {
    addShopObjectToBill, chargeUnpaidUsage, costlySpot, currentShopResident,
    objectTypeKnown, removeOneObjectFromBill, carriedObjectOwner,
} from './shk.js';
import { stolenValue } from './shop_loss.js';
import { surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu,
    tty_select_menu, tty_start_menu,
} from './tty_menu.js';
import { heroHasFreeHand } from './weapon_type.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';

export async function dotip(): Promise<void> {
    game.context.move = 0;
    const { ux: x, uy: y } = game.u;
    const containers = (requireGameLevel().objects[x]?.[y] ?? []).filter(nativeContainer);
    if (containers.length && (!game.iflags.menu_requested
        || game.flags.menu_style === MENU_TRADITIONAL && containers.length > 1)
        && await canTipFloorContainer(containers.length)) {
        if (containers.length > 1) {
            const selected = await chooseFloorContainer(containers);
            if (selected === null) return;
            if (selected !== 'inventory') {
                await tipContainer(selected);
                game.context.move = 1;
                return;
            }
        } else {
            const container = containers[0];
            if (!container) throw new Error('The floor container disappeared before tipping');
            observeObjectForNaming(container);
            const answer = await promptYesNoQuit(`There is ${floorObjectDescription(container)} here, tip it?`);
            if (answer === 'q') return;
            if (answer === 'y') {
                await tipContainer(container);
                game.context.move = 1;
                return;
            }
        }
    }
    const object = await chooseInventoryObject('tip', object => {
        if (object.oclass === 12) return GETOBJ_EXCLUDE;
        return nativeContainer(object) || object.otyp === HORN_OF_PLENTY
            && object.dknown && objectTypeKnown(object, game) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    }, { forcePrompt: true });
    if (!object) return;
    if (nativeContainer(object) || object.otyp === HORN_OF_PLENTY) {
        await tipContainer(object);
        // Selecting a container takes time even if its destination is cancelled.
        game.context.move = 1;
        return;
    }
    await tipOtherObject(object);
}

async function tipContainer(box: GameObject): Promise<void> {
    box.ox = game.u.ux;
    box.oy = game.u.uy;
    const destination = await chooseDestination(box);
    if (destination === null) return;
    const target = destination === 'floor' ? null : destination;
    if (!await canEmptyContainer(box, target, false)) return;
    if (target && !await canEmptyContainer(target, null, true)) return;

    const sourceHeld = box.where === 'inventory';
    const targetHeld = target?.where === 'inventory';
    const shopGoods = !sourceHeld && !!costlySpot(box.ox, box.oy);
    const highDrop = !game.u.uswallow && !heroCanReachFloor(game, { checkPit: true });
    const altar = !game.u.uswallow && IS_ALTAR(requireGameLevel().requireAt(box.ox, box.oy).typ);
    let terse = !highDrop && !altar && !costlySpot(box.ox, box.oy);
    let loss = 0;
    box.cknown = true;
    const contents = [...box.contents ?? []];
    if (target) {
        await pline(`${contents.length > 1 ? 'Objects tumble' : 'An object tumbles'} into the ${objectName(target)}.`);
    } else {
        await pline(`${contents.length > 1 ? 'Objects spill' : 'An object spills'} out${terse ? ':' : '.'}`);
    }

    for (const [index, object] of contents.entries()) {
        unlinkObject(object, game);
        object.ox = box.ox;
        object.oy = box.oy;
        if (box.otyp === ICE_BOX) thawObject(object, game);
        else if (box.otyp === BAG_OF_HOLDING && box.cursed && rn2(13) === 0) {
            loss += await loseBagObject(object, sourceHeld, false);
            terse = false;
            continue;
        }
        if (shopGoods) await addShopObjectToBill(object, game, { ininv: false, silent: true });
        const previousSuppression = game.iflags.suppress_price;
        if (shopGoods) game.iflags.suppress_price = true;
        try {
            if (target) {
                if (target.otyp === BAG_OF_HOLDING && magicBagExplodes(object)) {
                    await explodeTippedBag(target, object, sourceHeld);
                    break;
                }
                await addObjectToContainer(target, object);
            } else {
                const publishDropMessage = async (message: string): Promise<void> => {
                    terse = false;
                    await pline(message);
                };
                if (highDrop) {
                    object.how_lost = LOST_DROPPED;
                    await hitFloorWithObject(object, { publish: publishDropMessage });
                } else {
                    if (altar) await landObjectOnAltar(object, { publish: publishDropMessage });
                    else {
                        observeObjectForNaming(object);
                        const name = inventoryItemDescription(object);
                        await pline(terse ? `${name}${index + 1 < contents.length ? ',' : '.'}`
                            : `${capitalize(name)} ${object.quan > 1 ? 'drop' : 'drops'} to the ${surfaceName(box.ox, box.oy)}.`);
                    }
                    object.how_lost = LOST_DROPPED;
                    if (!game.program_state.gameover) await dropObjectAtHero(object, { publish: publishDropMessage });
                }
            }
        } finally {
            if (previousSuppression === undefined) delete game.iflags.suppress_price;
            else game.iflags.suppress_price = previousSuppression;
        }
        if (game.program_state.gameover) return;
    }
    if (game.program_state.gameover) return;
    if (loss) await pline(`You owe ${loss} ${currency(loss)} for lost merchandise.`);
    box.owt = objectWeight(box);
    if (target && target.where !== 'gone') target.owt = objectWeight(target);
    if (sourceHeld || targetHeld) await updateHeroEncumbrance(game, pline);
}

function nativeContainer(object: GameObject): boolean {
    return object.otyp >= LARGE_BOX && object.otyp <= BAG_OF_TRICKS;
}

async function canTipFloorContainer(count: number): Promise<boolean> {
    if (exceedsActionCapacity(game)) {
        await pline(`You can't tip ${game.flags.verbose === false ? 'a container' : count > 1 ? 'one' : 'it'} while carrying so much.`);
        return false;
    }
    const { ux: x, uy: y } = game.u;
    if (!heroCanReachFloor(game, { checkPit: true })) {
        if (floorReachProblem(game, { checkPit: true }) === 'riding' && game.u.usteed) {
            await pline(`You aren't skilled enough to reach from ${monsterName(game.u.usteed, { article: 'your' })}.`);
        } else {
            const surface = heroCanReachFloor(game) ? 'bottom of the pit' : surfaceName(x, y);
            await pline(`You can't reach the ${surface}.`);
        }
        return false;
    }
    if (isPoolAt(x, y) && !game.underwater || isLavaAt(x, y)) {
        await pline(`You cannot tip things that are deep in the ${displayLiquidName(isLavaAt(x, y) ? 'lava' : 'water')}.`);
        return false;
    }
    if (heroHasNoLimbs(game)) {
        await pline('Without limbs, you cannot tip anything.');
        return false;
    }
    return true;
}

async function chooseFloorContainer(containers: readonly GameObject[]): Promise<GameObject | 'inventory' | null> {
    const window = tty_create_nhwindow<GameObject | 'inventory'>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const object of containers) {
            observeObjectForNaming(object);
            tty_add_menu(window, { identifier: object, text: floorObjectDescription(object) });
        }
        if (game.inventory.length) {
            tty_add_menu(window, { identifier: null, text: '' });
            tty_add_menu(window, { identifier: 'inventory', text: 'tip something being carried',
                ...(containers.length <= 8 && !game.flags.lootabc ? { selector: 'i' } : {}),
                itemflags: MENU_ITEMFLAGS_SELECTED });
        }
        tty_end_menu(window, 'Tip which container?');
        const result = await tty_select_menu(window, PICK_ONE);
        if (result.cancelled) return null;
        return result.selections.find(selection => selection.identifier !== 'inventory')?.identifier
            ?? 'inventory';
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

async function chooseDestination(box: GameObject): Promise<GameObject | 'floor' | null> {
    const window = tty_create_nhwindow<GameObject | 'floor'>(NHW_MENU);
    try {
        await tty_start_menu(window);
        tty_add_menu(window, { identifier: 'floor', selector: '-', text: 'on the floor', itemflags: MENU_ITEMFLAGS_SELECTED });
        tty_add_menu(window, { identifier: null, text: '' });
        let hands: boolean | null = null;
        for (const object of game.inventory) {
            if (object === box || !nativeContainer(object)
                || object.otyp === BAG_OF_TRICKS && object.dknown && objectTypeKnown(object, game)) continue;
            if (hands === null) {
                hands = !heroHasNoHands(game) && heroHasFreeHand(game);
                if (!hands) await pline(heroHasNoHands(game) ? 'You have no hands!' : `You have no free ${heroHandName(game)}.`);
            }
            observeObjectForNaming(object);
            const eligible = hands && !(object.olocked && object.lknown);
            tty_add_menu(window, { identifier: eligible ? object : null,
                ...(eligible && object.invlet ? { selector: object.invlet } : {}),
                text: `${eligible ? '' : '    '}${inventoryItemDescription(object)}` });
        }
        observeObjectForNaming(box);
        tty_end_menu(window, `Where to tip the contents of ${inventoryItemDescription(box)}`);
        const result = await tty_select_menu(window, PICK_ONE);
        if (result.cancelled) return null;
        return result.selections.find(selection => selection.identifier !== 'floor')?.identifier ?? 'floor';
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

async function canEmptyContainer(box: GameObject, target: GameObject | null, allowEmpty: boolean): Promise<boolean> {
    if (target?.otyp === BAG_OF_TRICKS) {
        await useBagOfTricks(target);
        return false;
    }
    box.lknown = true;
    if (box.olocked) {
        await pline(`The ${simpleObjectName(box)} is locked.`);
        return false;
    }
    if (box.otrapped) {
        await triggerChestTrap(box);
        if ((game.multi ?? 0) >= 0 && !(game._helplessTurns ?? 0) && !game.program_state.gameover) {
            game.multi = -1;
            game._helplessTurns = 1;
            game._helplessReason = 'tipping a container';
            game._helplessDoneMessage = '';
        }
        return false;
    }
    if (box.otyp === BAG_OF_TRICKS || box.otyp === HORN_OF_PLENTY) {
        if (target && !await canEmptyContainer(target, null, true)) return false;
        await emptyMagicContainer(box, target);
        return false;
    }
    if (isQuantumBox(box)) {
        const owner = carriedObjectOwner(box);
        await observeQuantumCat(box);
        box.cknown = true;
        if (!box.contents?.length) {
            await pline(`${owner} box is now empty.`);
            return allowEmpty;
        }
    }
    if (!allowEmpty && !box.contents?.length) {
        box.cknown = true;
        await pline(`The ${simpleObjectName(box)} is empty.`);
        return false;
    }
    return true;
}

async function emptyMagicContainer(box: GameObject, target: GameObject | null): Promise<void> {
    const oldCharges = box.spe;
    const shopGoods = box.where !== 'inventory' && !!costlySpot(box.ox, box.oy);
    if (shopGoods && !box.no_charge) await addShopObjectToBill(box, game, { ininv: false, silent: true });
    let seen = 0, totalSeen = 0;
    do {
        if (box.otyp === BAG_OF_TRICKS) {
            const released = await useBagOfTricks(box, { tipping: true });
            if (!released.created) break;
            seen += released.seen;
            totalSeen += seen;
        } else if (!await useHornOfPlenty(box, { tipping: true, target })) break;
    } while (box.spe > 0 && !game.program_state.gameover);
    if (game.program_state.gameover) return;
    if (box.spe < oldCharges) {
        if (box.otyp === BAG_OF_TRICKS && !totalSeen) await pline('Nothing seems to happen.');
        box.spe = oldCharges;
        await chargeUnpaidUsage(box, { alternate: true });
        box.spe = 0;
        box.cknown = true;
    }
    if (shopGoods && !box.no_charge) removeOneObjectFromBill(box);
}

async function loseBagObject(object: GameObject, held: boolean, silent: boolean): Promise<number> {
    if (!silent) {
        const known = object.dknown;
        const name = inventoryItemDescription(object);
        await pline(known ? `${capitalize(name)} ${object.quan > 1 ? 'have' : 'has'} vanished!`
            : `You ${heroIsBlind(game) ? 'notice' : 'see'} ${name} disappear!`);
    }
    let loss = 0;
    const keeper = currentShopResident();
    if (keeper && (held ? object.unpaid : costlySpot(game.u.ux, game.u.uy)))
        loss = await stolenValue(object, game.u.ux, game.u.uy, keeper.mpeaceful);
    await deleteObject(object);
    return loss;
}

async function scatterTippedBag(box: GameObject, held: boolean): Promise<void> {
    box.in_use = true;
    for (const object of [...box.contents ?? []]) {
        if (rn2(13) === 0) {
            unlinkObject(object, game);
            await loseBagObject(object, held, true);
        } else {
            object.ox = game.u.ux;
            object.oy = game.u.uy;
            await scatterFloorObjects(game.u.ux, game.u.uy, 4, {
                onlyObject: object, mayFracture: false, heroCaused: true, publish: pline,
                finishMonsterKill: finishHeroMonsterKill,
                finishMonsterDeath: async (monster, death) => {
                    if (death?.deathMessage) await pline(death.deathMessage);
                    const killed = await finishHeroMonsterKill(monster, monster.mx, monster.my, {
                        showKillMessage: false, noCorpse: death?.noCorpse ?? false,
                    });
                    return { monster, survived: !killed };
                },
            });
        }
        if (game.program_state.gameover) return;
    }
}

async function explodeTippedBag(target: GameObject, trigger: GameObject, sourceHeld: boolean): Promise<void> {
    observeObjectForNaming(trigger);
    await pline(`As ${inventoryItemDescription(trigger)} ${trigger.quan > 1 ? 'tumble' : 'tumbles'} inside, you are blasted by a magical explosion!`, { urgent: true });
    if (trigger.otyp === BAG_OF_HOLDING) await scatterTippedBag(trigger, sourceHeld);
    if (game.program_state.gameover) return;
    await deleteObject(trigger);
    const held = target.where === 'inventory';
    await scatterTippedBag(target, held);
    if (game.program_state.gameover) return;
    if (held) await useUpInventoryStack(target);
    else await useUpFloorObject(target, target.quan);
    if (!game.program_state.gameover) await loseHeroHp(d(6, 6), 'magical explosion');
}

async function tipOtherObject(object: GameObject): Promise<void> {
    const type = object.otyp;
    const spill = spillageFrom(object);
    if (spill) {
        const { ux: x, uy: y } = game.u;
        const after = isPoolAt(x, y) ? ` and gradually ${verbForSubject(spill, 'dissipate')}`
            : isLavaAt(x, y) ? ` and immediately ${verbForSubject(spill, 'burn')} away` : '';
        await pline(`Some ${spill} ${verbForSubject(spill, 'spill')} onto the ${surfaceName(x, y)}${after}.`);
        if (type === CAN_OF_GREASE) await consumeObjectCharge(object);
        game.context.move = 1;
        return;
    }
    if (object.oclass === 8) {
        const noun = objectName(object);
        const name = object.quan > 1 ? pluralizeObjectNoun(object, noun) : noun;
        await pline(`The ${name} ${object.quan > 1 ? 'are' : 'is'} securely sealed.`);
        return;
    }
    await pline(type === STATUE ? 'Nothing interesting happens.' : 'Nothing happens.');
}

function spillageFrom(object: GameObject): string | null {
    const type = object.otyp;
    if ((type === WAX_CANDLE || type === TALLOW_CANDLE) && object.lamplit) return 'wax';
    if (type === POT_OIL && object.lamplit || type === OIL_LAMP && object.age !== 0
        || type === MAGIC_LAMP && object.spe !== 0) return 'oil';
    if (type === CAN_OF_GREASE && object.spe > 0) return 'grease';
    if ([FOOD_RATION, CRAM_RATION, LEMBAS_WAFER].includes(type)) return 'crumbs';
    return object.oclass === 17 ? 'venom' : null;
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
