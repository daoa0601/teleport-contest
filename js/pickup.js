// C pickup.c: command pickup, automatic pickup, and floor inspection.

import { game } from './gstate.js';
import {
    floorObjectDescription, pricedFloorObjectDescription, showFloorPile,
} from './floor_object_display.js';
import { moreUntilDismissed } from './tty_prompts.js';
import { tryCallObjectType } from './object_call.js';
import {
    newsym, flushPendingTopline, flush_screen, pline, plineWithContinuation, docrt,
    bot, map_object,
} from './display.js';
import { dungeonFeatureSentenceAt } from './invent.js';
import { showMultiSelectWindow } from './windows.js';
import { mergable } from './object_merge.js';
import { assignInventoryLetter, inventoryItem } from './u_init.js';
import { carryableObjectCount, liftObject } from './lift_object.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { deleteObject } from './object_delete.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { heroCanReachFloor } from './floor_reach.js';
import { pickupLocationProblem } from './pickup_location.js';
import { finishGhostlyPickup } from './bones_object.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { touchArtifactByHero } from './artifact_touch.js';
import {
    EGG, SLIME_MOLD, TIN, LOADSTONE, GOLD_PIECE, CORPSE, DART, SACK, OIL_LAMP,
    SCR_SCARE_MONSTER, RIN_CONFLICT, OBJECT_WEIGHT,
} from './object_data.js';
import { stopRun } from './runmode.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { exerciseAttribute } from './attrib.js';
import {
    OBJECT_CLASS_LABELS, objectClassForType, recordObjectEncounter,
} from './object_knowledge.js';
import { nearCapacity, pickupLoadPrefix } from './weight.js';
import { addHeroGoldObject, heroGoldAmount } from './hero_gold.js';
import { heroIsBlind } from './senses.js';
import { touchPetrifyingCorpse } from './stoning.js';
import { heroCannotTake } from './polyself.js';
import { addShopObjectToBill, billedPickupQuote, unpaidObjectCost } from './shk.js';
import { readEngravingAt } from './engrave.js';
import { A_WIS, STONE, DOOR, D_BROKEN, IS_POOL, IS_LAVA, is_pit } from './const.js';

export function basePickupObjectDescription(object) {
    const quantity = objectQuantity(object);
    if (object.otyp === GOLD_PIECE)
        return `${quantity} gold piece${quantity === 1 ? '' : 's'}`;
    if (object.otyp === DART) {
        if (quantity > 1) return `${quantity} darts`;
        return object.opoisoned ? 'a poisoned dart' : 'a dart';
    }
    if (object.otyp === SACK)
        return object.cknown && !object.contents?.length
            ? 'an empty bag' : 'a bag';
    if (object.otyp === 219) return 'a bag'; // unidentified bag of holding
    if (object.otyp === OIL_LAMP) return 'a lamp';
    if (object.oclass === 4 || object.class === 'Rings') {
        return floorObjectDescription(object);
    }
    if (object.oclass === 13 || (object.otyp >= 438 && object.otyp <= 474))
        return floorObjectDescription(object);
    return floorObjectDescription(object);
}

function pickupObjectDescription(object) {
    const description = basePickupObjectDescription(object);
    if (!object?.unpaid) return description;
    const price = unpaidObjectCost(object);
    return price > 0
        ? `${description} (unpaid, ${price} zorkmid${price === 1 ? '' : 's'})`
        : description;
}

function pickupObjectClass(object) {
    if (object.otyp === DART) return 'Weapons';
    if (object.otyp === SACK || object.otyp === OIL_LAMP) return 'Tools';
    if (object.otyp === CORPSE) return 'Comestibles';
    if (object.otyp === GOLD_PIECE) return 'Coins';
    if (object.oclass === 4 || object.otyp === RIN_CONFLICT) return 'Rings';
    if (object.oclass === 5) return 'Amulets';
    if (object.otyp >= 438 && object.otyp <= 474) return 'Gems/Stones';
    if (object.class === 'Gems') return 'Gems/Stones';
    if (object.class) return object.class;
    const oclass = object.oclass || objectClassForType(object.otyp);
    const label = OBJECT_CLASS_LABELS[oclass];
    if (label === 'Large rocks') return 'Rocks';
    if (label === 'Iron balls') return 'Balls';
    if (label === 'Venoms') return 'Other';
    return label || 'Other';
}

// C invent.c:loot_classify() FOOD_CLASS subclasses.  The default
// sortloot=loot option applies this after class/pack ordering and before
// stable ties, so an older ration precedes a newer corpse in pickup menus.
function pickupObjectSubclass(object) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    if (oclass !== 7) return 1;
    if (object.otyp === SLIME_MOLD) return 1;
    if (object.otyp === TIN) return 3;
    if (object.otyp === EGG) return 4;
    if (object.otyp === CORPSE) return 5;
    return object.globby ? 6 : 2;
}

const OBJECT_CLASS_SYMBOL = [
    '', ')', '[', '', '=', '"', '(', '%', '!', '?', '+', '/', '$', '*',
    '`', '0', '_', '.',
];

function autopickupAllows(object) {
    const configured = game.flags?.pickup_types || '';
    if (!configured) return true;
    const symbol = OBJECT_CLASS_SYMBOL[object?.oclass] || '';
    return !!symbol && configured.includes(symbol);
}

const PICKUP_CLASS_ORDER = [
    // C options.c:def_inv_order.  query_objlist() assigns menu accelerators
    // while walking this configured class order, not the floor-chain order.
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems/Stones', 'Rocks',
    'Balls', 'Chains', 'Other',
];

function orderedPickupObjects(pile) {
    return pile.map((object, index) => ({ object, index }))
        .sort((a, b) => {
            const classOrder = PICKUP_CLASS_ORDER.indexOf(pickupObjectClass(a.object))
                - PICKUP_CLASS_ORDER.indexOf(pickupObjectClass(b.object));
            if (classOrder) return classOrder;
            const subclassOrder = pickupObjectSubclass(a.object)
                - pickupObjectSubclass(b.object);
            if (subclassOrder) return subclassOrder;
            // NetHack's floor chain has the newly-created trap dart first,
            // but merged projectile stacks are presented before singletons.
            if (a.object.otyp === DART && b.object.otyp === DART)
                return objectQuantity(b.object) - objectQuantity(a.object);
            return a.index - b.index;
        })
        .map(entry => entry.object);
}

export function preparePickedInventoryObject(object) {
    const pickedQuantity = objectQuantity(object);
    const previousHowLost = object.how_lost ?? 0;
    // C addinv_core0() clears how_lost before mergable() so a recovered
    // thrown or dropped object can rejoin its carried stack.  Retain the old
    // value only for merged()'s comparison-message suppression.
    object.how_lost = 0;
    object.no_charge = false;
    const existing = (game.inventory || []).find(candidate =>
        mergable(candidate, object, game));
    if (existing && !existing.globby && !object.globby) {
        const existingQuantity = objectQuantity(existing);
        const totalQuantity = existingQuantity + pickedQuantity;
        if (!object.lamplit) {
            existing.age = Math.trunc(
                (((existing.age ?? 0) * existingQuantity)
                    + ((object.age ?? 0) * pickedQuantity)) / totalQuantity,
            );
        }
        existing.quantity = existing.quan = totalQuantity;
        const unitWeight = OBJECT_WEIGHT[existing.otyp];
        existing.owt = Number.isFinite(unitWeight)
            ? unitWeight * totalQuantity
            : (existing.owt ?? 0) + (object.owt ?? 0);

        if (!existing.oextra?.oname && !existing.oname) {
            if (object.oextra?.oname) {
                existing.oextra = {
                    ...(existing.oextra || {}), oname: object.oextra.oname,
                };
            } else if (object.oname) existing.oname = object.oname;
        }

        let comparisonLearned = false;
        if (!!existing.known !== !!object.known) {
            existing.known = true;
            comparisonLearned = true;
        }
        if (!!existing.rknown !== !!object.rknown) {
            existing.rknown = true;
            if (existing.oerodeproof) comparisonLearned = true;
        }
        if (!!existing.bknown !== !!object.bknown) {
            existing.bknown = true;
            if (game.urole?.key !== 'priest') comparisonLearned = true;
        }
        if (object.bypass) existing.bypass = true;
        existing.pickup_prev = true;

        object.where = 'gone';
        object.ox = object.oy = 0;
        const pickedView = {
            ...existing,
            quantity: pickedQuantity,
            quan: pickedQuantity,
        };
        const total = game.flags?.verbose === false
            ? '.' : ` (${totalQuantity} in total).`;
        return {
            object: existing,
            message: `${existing.invlet} - ${
                pickupObjectDescription(pickedView)
            }${total}`,
            comparisonLearned: comparisonLearned
                && previousHowLost !== 4
                && (existing.how_lost ?? 0) !== 4,
        };
    }

    assignInventoryLetter(object);
    object.ox = object.oy = 0;
    object.quantity = objectQuantity(object);
    object.quan = object.quantity;
    if (object.otyp === 453) {
        object.name = 'yellow gem';
        object.class = 'Gems';
    } else if (object.otyp === 462) {
        object.name = 'blue gem';
        object.plural = 'blue gems';
        object.class = 'Gems';
    } else if (object.oclass === 13) {
        // Floor descriptions already include articles and stack counts.
        // Inventory owns a singular/plural presentation instead; retaining
        // "2 white gems" as the noun would later render "2 2 white gemss".
        const presentation = inventoryItem(object);
        Object.assign(object, {
            name: presentation.name,
            plural: presentation.plural,
            class: presentation.class,
        });
    } else if (object.otyp === DART) {
        object.name = 'dart';
        object.plural = 'darts';
        object.class = 'Weapons';
    } else if (object.otyp === SACK) {
        object.name = object.cknown && !object.contents?.length
            ? 'empty bag' : 'bag';
        object.class = 'Tools';
    } else if (object.otyp === OIL_LAMP) {
        object.name = 'lamp';
        object.class = 'Tools';
    } else if (object.oclass === 4 || object.class === 'Rings') {
        object.name = floorObjectDescription(object)
            .replace(/^(?:an?|the)\s+/, '');
        object.class = 'Rings';
    } else if (object.oclass === 5 || object.class === 'Amulets') {
        object.name = floorObjectDescription(object)
            .replace(/^(?:an?|the)\s+/, '');
        object.class = 'Amulets';
    } else if (!object.name) {
        object.name = basePickupObjectDescription(object)
            .replace(/^(?:an?|the)\s+/, '');
    }
    object.where = 'inventory';
    game.inventory.push(object);
    markJustPicked(object);
    attachCursedFigurineTimer(object, game);
    return {
        object,
        message: `${object.invlet} - ${pickupObjectDescription(object)}.`,
        comparisonLearned: false,
    };
}

async function removePickupObjects(source, selected) {
    if (source.monster) {
        for (const object of selected)
            await removeObjectFromMonsterInventory(source.monster, object);
        return;
    }

    const selectedSet = new Set(selected);
    for (let index = source.objects.length - 1; index >= 0; index--) {
        if (selectedSet.has(source.objects[index]))
            source.objects.splice(index, 1);
    }
}

async function collectPickupMessages(source, selected) {
    await removePickupObjects(source, selected);
    const messages = [];
    const shopQuotes = [];
    const comparisonMessages = [];
    for (const object of selected) {
        if (object.otyp === GOLD_PIECE) {
            const quantity = objectQuantity(object);
            const pickedView = {
                ...object, quan: quantity, quantity,
            };
            const previous = heroGoldAmount(game);
            const carried = addHeroGoldObject(game, object).object;
            const total = previous ? ` (${heroGoldAmount(game)} in total)` : '';
            messages.push(`$ - ${pickupObjectDescription(pickedView)}${total}.`);
            const ghostlyMessage = finishGhostlyPickup(carried, game);
            if (ghostlyMessage) messages.push(ghostlyMessage);
        } else {
            const transaction = source.monster
                ? null : addShopObjectToBill(object);
            if (transaction) {
                const quote = billedPickupQuote(
                    transaction, pickupObjectNoun(object),
                );
                if (quote) shopQuotes.push(quote);
            }
            const prepared = preparePickedInventoryObject(object);
            messages.push(prepared.message);
            const ghostlyMessage = finishGhostlyPickup(prepared.object, game);
            if (ghostlyMessage) messages.push(ghostlyMessage);
            if (prepared.comparisonLearned) {
                comparisonMessages.push(
                    'You learn more about your items by comparing them.',
                );
            }
        }
    }
    return { messages, shopQuotes, comparisonMessages };
}

function observePickupObject(object) {
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    if (heroIsBlind(game) || hallucinating) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
}

function splitPickupStack(object, count, objects) {
    if (count >= objectQuantity(object)) return object;
    const split = splitObjectStack(object, count, game);
    if (!split) return object;
    const index = objects.indexOf(object);
    objects.splice(index < 0 ? objects.length : index + 1, 0, split);
    return split;
}

async function reviveTouchedRider(corpse) {
    if (!isRider(corpse.corpsenm)) return false;
    await pline('At your touch, the corpse suddenly moves...');
    const revival = await reviveCorpseImmediately(corpse, game);
    for (const message of revival?.messages || [])
        await plineWithContinuation(message);
    exerciseAttribute(A_WIS, false);
    return true;
}

async function prepareScareScrollPickup(object, requested, source) {
    const count = await carryableObjectCount({ object, count: requested });
    if (count < 1) return { decision: 'stop' };

    const scroll = splitPickupStack(object, count, source.objects);
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
        quantity === 1 ? 'turns' : 'turn'} to dust as you pick ${
        quantity === 1 ? 'it' : 'them'} up.`);
    await tryCallObjectType(scroll);
    deleteObject(scroll, game);
    return { decision: 'consumed' };
}

async function liftPickupSelections(source, selected) {
    const lifted = [];
    let consumed = 0;
    let attempted = false;
    for (const selection of selected) {
        let object = selection?.value || selection;
        if (!source.objects.includes(object)) continue;
        attempted = true;
        observePickupObject(object);

        if (object.oartifact) {
            const touch = await touchArtifactByHero(object);
            if (!touch.allowed || touch.died) {
                if (touch.died) break;
                continue;
            }
        }
        if (object.otyp === CORPSE) {
            if (await touchPetrifyingCorpse(object)) break;
            if (await reviveTouchedRider(object)) break;
        }

        let requested = selection?.value
            ? selection.count : objectQuantity(object);
        requested = requested > 0 ? requested : objectQuantity(object);
        if (object.otyp === SCR_SCARE_MONSTER) {
            const prepared = await prepareScareScrollPickup(
                object, requested, source,
            );
            if (prepared.decision === 'stop') break;
            if (prepared.decision === 'consumed') {
                consumed++;
                continue;
            }
            object = prepared.object;
            requested = prepared.count;
        }

        const result = await liftObject({
            object,
            count: requested,
        });
        if (result.decision === 'lift') {
            let liftedObject = object;
            if (result.count < objectQuantity(object)
                && object.otyp !== LOADSTONE) {
                liftedObject = splitObjectStack(object, result.count, game);
            }
            if (liftedObject) lifted.push(liftedObject);
        }
        if (result.decision === 'stop') break;
    }
    return { attempted, consumed, lifted };
}

function pickupObjectNoun(object) {
    return floorObjectDescription(object).replace(/^(?:an?|the)\s+/, '');
}

async function rejectWornPickupObjects(source, selected) {
    if (!source.monster) return selected;
    const allowed = [];
    for (const selection of selected) {
        const object = selection?.value || selection;
        if ((object.owornmask ?? 0) === 0) {
            allowed.push(selection);
            continue;
        }
        await plineWithContinuation(
            `You can't pick the ${pickupObjectNoun(object)} up.`,
        );
    }
    return allowed;
}

async function commitPickup(source, selected) {
    if (!selected.length) {
        await docrt();
        await bot();
        await flush_screen(1);
        game.context.move = 0;
        return 0;
    }

    selected = await rejectWornPickupObjects(source, selected);
    if (!selected.length) {
        game.context.move = 0;
        return 0;
    }

    clearJustPicked(game);
    const pickup = await liftPickupSelections(source, selected);
    if (!pickup.lifted.length) {
        if (pickup.consumed && !source.monster) {
            newsym(source.x, source.y);
            await bot();
        }
        game.context.move = pickup.attempted ? 1 : 0;
        return pickup.consumed;
    }
    const {
        messages, shopQuotes, comparisonMessages,
    } = await collectPickupMessages(source, pickup.lifted);
    const capacity = nearCapacity(game);
    const loadPrefix = pickupLoadPrefix(capacity);
    const pickupMessage = loadPrefix
        ? `${loadPrefix} lifting ${messages.join('  ')}`
        : messages.join('  ');
    await docrt();
    await bot();
    if (!source.monster) newsym(source.x, source.y);
    for (const quote of shopQuotes) await plineWithContinuation(quote);
    for (const comparison of comparisonMessages)
        await moreUntilDismissed(`${comparison}--More--`);
    if (comparisonMessages.length) await pline(pickupMessage);
    else await plineWithContinuation(pickupMessage);
    // C pickup() returns ECMD_TIME with the object already linked into the
    // inventory.  moveloop's following encumber_msg() compares persistent
    // capacity state and can itself suspend while replacing this top line.
    game._capacityDirty = true;
    game.context.move = 1;
    return pickup.lifted.length + pickup.consumed;
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

export async function pickupAtHero() {
    const commandCount = Math.max(0, game._commandCount || 0);
    game._commandCount = 0;
    const source = pickupSourceAtHero();
    // pickup.c excludes the hero's attached chain from object counts and
    // selection.  It remains linked to the floor pile for ball.c.
    const objects = source.monster ? [...source.objects]
        : source.objects.filter(object => object !== game.uchain
            && object !== game.u?.uchain);
    const locationProblem = pickupLocationProblem({
        state: game, objects, monster: source.monster,
    });
    if (locationProblem) {
        for (const message of locationProblem.messages)
            await plineWithContinuation(message);
        game.context.move = locationProblem.spendsTurn ? 1 : 0;
        return;
    }
    if (!source.monster && heroCannotTake(game)) {
        await pline(
            'You are physically incapable of picking anything up.',
        );
        game.context.move = 0;
        return;
    }
    if (objects.length === 1) {
        if (commandCount > objectQuantity(objects[0])) {
            game.context.move = 0;
            return;
        }
        await commitPickup(source, [{
            value: objects[0],
            count: commandCount || objectQuantity(objects[0]),
        }]);
        return;
    }

    const eligible = commandCount
        ? objects.filter(object => objectQuantity(object) >= commandCount)
        : objects;
    if (!eligible.length) {
        game.context.move = 0;
        return;
    }
    if (commandCount && eligible.length === 1) {
        await commitPickup(source, [{
            value: eligible[0], count: commandCount,
        }]);
        return;
    }
    const ordered = orderedPickupObjects(eligible);
    const sections = [];
    let letterCode = 'a'.charCodeAt(0);
    let goldAcceleratorUsed = false;
    for (const heading of PICKUP_CLASS_ORDER) {
        const objects = ordered.filter(object => pickupObjectClass(object) === heading);
        if (!objects.length) continue;
        sections.push({
            heading,
            items: objects.map(object => {
                const isFirstGold = object.otyp === GOLD_PIECE
                    && !goldAcceleratorUsed;
                if (isFirstGold) goldAcceleratorUsed = true;
                return {
                    key: isFirstGold ? '$' : String.fromCharCode(letterCode++),
                    text: pickupObjectDescription(object),
                    value: object,
                };
            }),
        });
    }
    game._pending_message = '';
    await flush_screen(1);
    const selected = await showMultiSelectWindow({
        title: commandCount
            ? `Pick ${commandCount} of what?` : 'Pick up what?',
        sections,
        left: 41,
        returnCounts: !commandCount,
        pickOne: !!commandCount,
    });
    const counted = commandCount && selected.length
        ? [{ value: selected[0], count: commandCount }] : selected;
    await commitPickup(source, counted);
}

export async function autopickupAtHero() {
    const newx = game.u.ux, newy = game.u.uy;
    const loc = game.level.at(newx, newy);
    // C pickup.c:check_here()->describe_decor().  Ordinary open/doorless
    // doorways are deliberately quiet, while a newly-entered broken doorway
    // is a feature when mention_decor is active.
    let skipDestinationFeature = false;
    if (game.flags?.mention_decor
        && loc?.typ === DOOR && loc.doormask === D_BROKEN
        && game._prevDecorType !== DOOR) {
        await pline('There is a broken door here.');
        // pickup.c:check_here() translates describe_decor()'s true return
        // into LOOKHERE_SKIP_DFEATURE, preventing look_here() from repeating
        // the feature before its object description.
        skipDestinationFeature = true;
    }
    game._prevDecorType = loc?.typ ?? STONE;
    const floorPile = game.level?.objects?.[newx]?.[newy] || [];
    // pickup.c:check_here() and every look_here() selection omit uchain.
    // The attached ball remains an ordinary visible floor object.
    let objects = floorPile.filter(object => object !== game.uchain
        && object !== game.u?.uchain);
    // invent.c:look_here() resolves dfeature_at() before selecting its
    // zero/one/many-object presentation branch.  The feature sentence is an
    // ordinary pline before a one-object description, so tty joins both onto
    // one topline when they fit.
    const destinationFeature = skipDestinationFeature
        ? '' : dungeonFeatureSentenceAt(newx, newy);
    const floorTrap = game.level?.traps?.find(candidate =>
        candidate.tx === newx && candidate.ty === newy);
    const autopickupRequested = objects.length && game.flags?.pickup
        && !game.context.nopick;
    const deepLiquid = (IS_POOL(loc?.typ)
        && !(game.u?.uinwater || game.underwater)) || IS_LAVA(loc?.typ);
    const floorOutOfReach = !heroCanReachFloor(game, {
        checkPit: is_pit(floorTrap?.ttyp),
    });
    const cannotCarry = heroCannotTake(game);
    const hideFloorObjects = autopickupRequested
        && (deepLiquid || floorOutOfReach);
    // C pickup()/check_here(): arriving on any floor object terminates a
    // non-travel run before the next automatic square. This input boundary
    // is behaviorally significant even when autopickup leaves the object in
    // place.
    if (objects.length && game._runState?.mode !== 8
        && !game.context.nopick) stopRun();
    if (objects.length && !hideFloorObjects
        && (!game.flags?.pickup
            || (autopickupRequested && cannotCarry))) {
        if (game.blind) {
            // invent.c:look_here() emits the tactile surface probe before it
            // describes any remaining object.  Its feel_location() call also
            // records the actual pile-top glyph underneath the hero; that
            // memory becomes visible when the hero leaves the square.
            map_object(floorPile[0], false, false);
            await plineWithContinuation(
                'You try to feel what is lying here on the floor.',
            );
        }
        if (objects.length > 1) {
            await showFloorPile(objects, false, destinationFeature);
        } else {
            if (destinationFeature)
                await plineWithContinuation(destinationFeature);
            await plineWithContinuation(
                `You ${game.blind ? 'feel' : 'see'} here ${
                    pricedFloorObjectDescription(objects[0])
                }.`,
            );
        }
        if (autopickupRequested && cannotCarry) {
            await pline(
                'You are physically incapable of picking anything up.',
            );
        }
    } else if (objects.length && !hideFloorObjects && game.flags?.pickup
        && !game.context.nopick) {
        const selected = objects.filter(autopickupAllows);
        let pickedCount = 0;
        if (selected.length) {
            pickedCount = await commitPickup({
                objects: floorPile, monster: null, x: newx, y: newy,
            }, selected);
            objects = floorPile.filter(object => object !== game.uchain
                && object !== game.u?.uchain);
        }
        // pickup.c:pickup() converges every autopickup attempt at
        // check_here(n_picked > 0).  pickup_types rejects transfer, not the
        // subsequent description of objects which remain underfoot.
        if (objects.length && game.blind) {
            map_object(floorPile[0], false, false);
            await plineWithContinuation(
                'You try to feel what is lying here on the floor.',
            );
        }
        if (objects.length > 1) {
            await showFloorPile(
                objects, pickedCount > 0, destinationFeature,
            );
        } else if (objects.length === 1) {
            if (destinationFeature)
                await plineWithContinuation(destinationFeature);
            await plineWithContinuation(
                `You ${game.blind ? 'feel' : 'see'} here ${
                    pricedFloorObjectDescription(objects[0])
                }.`,
            );
        }
    }
    if (!objects.length) {
        const read = await readEngravingAt(newx, newy, {
            showMore: async message => {
                await pline(message);
                return flushPendingTopline();
            },
            showLine: message => plineWithContinuation(message),
        });
        if (read && game._runState) stopRun();
    }
}
