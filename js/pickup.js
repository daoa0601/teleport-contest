// C pickup.c: command pickup, automatic pickup, and floor inspection.

import { game } from './gstate.js';
import {
    floorObjectDescription, pricedFloorObjectDescription, showFloorPile,
} from './floor_object_display.js';
import { tryCallObjectType } from './object_call.js';
import {
    newsym, flushPendingTopline, flush_screen, pline, plineWithContinuation,
    bot, map_object,
} from './display.js';
import { dungeonFeatureSentenceAt } from './invent.js';
import { showMultiSelectWindow } from './windows.js';
import { mergable } from './object_merge.js';
import { addInventoryItem } from './u_init.js';
import { remove_object } from './floor_object.js';
import { carryableObjectCount, liftObject } from './lift_object.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { deleteObject } from './object_delete.js';
import { heroCanReachFloor } from './floor_reach.js';
import { pickupLocationProblem } from './pickup_location.js';
import { finishGhostlyPickup } from './bones_object.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { touchArtifactByHero } from './artifact_touch.js';
import {
    EGG, SLIME_MOLD, TIN, LOADSTONE, GOLD_PIECE, CORPSE, SCR_SCARE_MONSTER,
} from './object_data.js';
import { stopRun } from './runmode.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { exerciseAttribute } from './attrib.js';
import {
    OBJECT_CLASS_LABELS, OBJECT_CLASS_SYMBOLS, objectClassForType, recordObjectEncounter,
} from './object_knowledge.js';
import { nearCapacity, pickupLoadPrefix } from './weight.js';
import { heroIsBlind } from './senses.js';
import { touchPetrifyingCorpse } from './stoning.js';
import { heroCannotTake } from './polyself.js';
import { heroIsUnaware } from './teleport.js';
import { addShopObjectToBill, billedPickupQuote, costlySpot, unpaidObjectCost } from './shk.js';
import { readEngravingAt } from './engrave.js';
import {
    A_WIS, STONE, DOOR, D_BROKEN, IS_POOL, IS_LAVA, is_pit,
    LOST_NONE, LOST_THROWN, LOST_STOLEN, LOST_DROPPED, LOST_EXPLODING,
} from './const.js';

const PICKUP_CLASS_ORDER = [
    // C options.c:def_inv_order.  query_objlist() assigns menu accelerators
    // while walking this configured class order, not the floor-chain order.
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems/Stones', 'Rocks',
    'Balls', 'Chains', 'Other',
];

export async function pickupAtHero() {
    const count = Math.max(0, game._commandCount || 0);
    game._commandCount = 0;
    const source = pickupSourceAtHero();
    const objects = pickupObjects(source);
    const problem = pickupLocationProblem({ state: game, objects, monster: source.monster });
    if (problem) {
        for (const message of problem.messages) await plineWithContinuation(message);
        game.context.move = problem.spendsTurn ? 1 : 0;
        return;
    }
    if (!source.monster && heroCannotTake(game)) {
        await pline('You are physically incapable of picking anything up.');
        game.context.move = 0;
        return;
    }
    const selected = await choosePickupObjects(objects, count);
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
    const loc = game.level.at(x, y);
    const objects = pickupObjects(source);
    if (!monster) {
        const deepLiquid = (IS_POOL(loc?.typ) && !(game.u.uinwater || game.underwater))
            || IS_LAVA(loc?.typ);
        if (game.context.nopick || !source.objects.length || deepLiquid) {
            await describePickupDecor(loc);
            await readPickupEngraving(x, y);
            return;
        }
        const trap = game.level.traps.find(trap => trap.tx === x && trap.ty === y);
        if (!heroCanReachFloor(game, { checkPit: is_pit(trap?.ttyp) })) {
            await describePickupDecor(loc);
            return;
        }
        const busy = !game._runState && (game.multi || game._delayedAction
            || game._helplessTurns > 0 || game._occupation?.key === '.'
            || game._occupation?.key === 'study-book');
        if (busy || !game.flags.pickup || heroCannotTake(game)) {
            await checkHere(source, false);
            if (heroCannotTake(game))
                await pline('You are physically incapable of picking anything up.');
            return;
        }
        if (objects.length && game._runState?.mode !== 8) stopRun();
    }
    const { picked } = await takeSelectedObjects(source, objects.filter(autopickupAllows));
    if (!monster && !game.program_state?.gameover) await checkHere(source, picked > 0);
}

async function choosePickupObjects(objects, count) {
    const eligible = count
        ? objects.filter(object => objectQuantity(object) >= count) : objects;
    if (!eligible.length) return [];
    if (eligible.length === 1)
        return [{ value: eligible[0], count: count || objectQuantity(eligible[0]) }];
    const ordered = orderedPickupObjects(eligible);
    const sections = [];
    let letterCode = 'a'.charCodeAt(0);
    let goldAcceleratorUsed = false;
    for (const heading of PICKUP_CLASS_ORDER) {
        const items = ordered.filter(object => pickupObjectClass(object) === heading);
        if (!items.length) continue;
        sections.push({
            heading,
            items: items.map(object => {
                const isFirstGold = object.otyp === GOLD_PIECE && !goldAcceleratorUsed;
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
        title: count ? `Pick ${count} of what?` : 'Pick up what?',
        sections,
        left: 41,
        returnCounts: !count,
        pickOne: !!count,
    });
    return count && selected.length ? [{ value: selected[0], count }] : selected;
}

async function takeSelectedObjects(source, selected) {
    if (!selected.length) return { picked: 0, attempted: false };
    clearJustPicked(game);
    let picked = 0;
    let attempted = false;
    let previousCapacity = 0;
    for (const selection of selected) {
        let object = selection?.value || selection;
        if (!source.objects.includes(object)) continue;
        if (source.monster && object.owornmask) {
            await plineWithContinuation(`You can't pick the ${pickupObjectNoun(object)} up.`);
            continue;
        }
        attempted = true;
        observePickupObject(object);
        if (object.oartifact) {
            const touch = await touchArtifactByHero(object);
            if (touch.died) break;
            if (!touch.allowed) continue;
        }
        if (object.otyp === CORPSE
            && (await touchPetrifyingCorpse(object) || await reviveTouchedRider(object))) break;

        let count = selection?.value ? selection.count : objectQuantity(object);
        if (!(count > 0)) count = objectQuantity(object);
        if (object.otyp === SCR_SCARE_MONSTER) {
            const scroll = await prepareScareScrollPickup(object, count, source);
            if (scroll.decision === 'stop') break;
            if (scroll.decision === 'consumed') {
                picked++;
                continue;
            }
            object = scroll.object;
            count = scroll.count;
        }
        const lift = await liftObject({ object, count });
        if (lift.decision === 'stop') break;
        if (lift.decision !== 'lift') continue;
        if (object.otyp !== LOADSTONE)
            object = splitPickupStack(object, lift.count, source.objects);

        if (source.monster) {
            await removeObjectFromMonsterInventory(source.monster, object);
        } else {
            remove_object(object);
            newsym(source.x, source.y);
        }
        const transaction = source.monster || object === game.uball
            ? null : addShopObjectToBill(object);
        const quote = transaction && billedPickupQuote(transaction, pickupObjectNoun(object));
        if (quote) await plineWithContinuation(quote);
        const added = addPickedInventoryObject(object);
        if (added.comparisonLearned)
            await plineWithContinuation('You learn more about your items by comparing them.');
        const capacity = nearCapacity(game);
        const prefix = capacity === previousCapacity ? '' : pickupLoadPrefix(capacity);
        previousCapacity = capacity;
        await plineWithContinuation(prefix ? `${prefix} lifting ${added.message}` : added.message);
        const ghostlyMessage = finishGhostlyPickup(added.object, game);
        if (ghostlyMessage) await plineWithContinuation(ghostlyMessage);
        picked++;
        if (game.program_state?.gameover) break;
    }
    if (picked && !game.program_state?.gameover) {
        if (!source.monster) newsym(source.x, source.y);
        await bot();
    }
    return { picked, attempted };
}

export function addPickedInventoryObject(object) {
    const count = objectQuantity(object);
    const previousHowLost = object.how_lost ?? LOST_NONE;
    // Capture knowledge before addInventoryItem merges the stacks.
    const candidate = { ...object, how_lost: LOST_NONE, no_charge: false };
    const existing = game.inventory.find(item => mergable(item, candidate, game));
    const comparisonLearned = existing && !object.globby
        && previousHowLost !== LOST_THROWN && existing.how_lost !== LOST_THROWN
        && (!!existing.known !== !!object.known
            || (!!existing.rknown !== !!object.rknown && existing.oerodeproof)
            || (!!existing.bknown !== !!object.bknown && game.urole?.key !== 'priest'));
    const carried = addInventoryItem(object, null, false);
    markJustPicked(carried);
    const picked = { ...carried, quan: count, quantity: count };
    const total = count < objectQuantity(carried) && game.flags?.verbose !== false
        ? ` (${objectQuantity(carried)} in total).` : '.';
    return {
        object: carried,
        message: `${carried.invlet} - ${pickupObjectDescription(picked)}${total}`,
        comparisonLearned,
    };
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
        && costlySpot(object.ox, object.oy)) return false;
    if ((game.flags.pickup_thrown !== false && object.how_lost === LOST_THROWN)
        || (game.flags.pickup_stolen !== false && object.how_lost === LOST_STOLEN)) return true;
    if (game.flags.dropped_nopick !== false && object.how_lost === LOST_DROPPED) return false;
    if (object.how_lost === LOST_EXPLODING) return false;
    const configured = game.flags?.pickup_types || '';
    if (!configured) return true;
    const symbol = OBJECT_CLASS_SYMBOLS[object.oclass];
    return !!symbol && configured.includes(symbol);
}

function observePickupObject(object) {
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    if (heroIsBlind(game) || hallucinating) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
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

async function reviveTouchedRider(corpse) {
    if (!isRider(corpse.corpsenm)) return false;
    await pline('At your touch, the corpse suddenly moves...');
    const revival = await reviveCorpseImmediately(corpse, game);
    for (const message of revival?.messages || [])
        await plineWithContinuation(message);
    exerciseAttribute(A_WIS, false);
    return true;
}

function splitPickupStack(object, count, objects) {
    if (count >= objectQuantity(object)) return object;
    const split = splitObjectStack(object, count, game);
    if (!split) return object;
    const index = objects.indexOf(object);
    objects.splice(index < 0 ? objects.length : index + 1, 0, split);
    return split;
}

async function checkHere(source, pickedSome) {
    const { x, y } = source;
    const skipFeature = await describePickupDecor(game.level.at(x, y));
    const objects = pickupObjects(source);
    if (!objects.length) {
        await readPickupEngraving(x, y);
        return;
    }
    stopRun();
    const feature = skipFeature ? '' : dungeonFeatureSentenceAt(x, y);
    if (heroIsBlind(game)) {
        map_object(source.objects[0], false, false);
        await plineWithContinuation('You try to feel what is lying here on the floor.');
    }
    if (objects.length > 1) {
        await showFloorPile(objects, pickedSome, feature);
        return;
    }
    if (feature) await plineWithContinuation(feature);
    await plineWithContinuation(
        `You ${heroIsBlind(game) ? 'feel' : 'see'} here ${pricedFloorObjectDescription(objects[0])}.`,
    );
}

async function describePickupDecor(loc) {
    const brokenDoor = game.flags?.mention_decor && loc?.typ === DOOR
        && loc.doormask === D_BROKEN && game._prevDecorType !== DOOR;
    game._prevDecorType = loc?.typ ?? STONE;
    if (brokenDoor) await pline('There is a broken door here.');
    return brokenDoor;
}

async function readPickupEngraving(x, y) {
    const read = await readEngravingAt(x, y, {
        showMore: async message => {
            await pline(message);
            return flushPendingTopline();
        },
        showLine: plineWithContinuation,
    });
    if (read && game._runState) stopRun();
}

function orderedPickupObjects(pile) {
    return pile.map((object, index) => ({ object, index }))
        .sort((a, b) => {
            const classOrder = PICKUP_CLASS_ORDER.indexOf(pickupObjectClass(a.object))
                - PICKUP_CLASS_ORDER.indexOf(pickupObjectClass(b.object));
            if (classOrder) return classOrder;
            const subclassOrder = pickupObjectSubclass(a.object)
                - pickupObjectSubclass(b.object);
            if (subclassOrder) return subclassOrder;
            return a.index - b.index;
        })
        .map(entry => entry.object);
}

function pickupObjectClass(object) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    const label = OBJECT_CLASS_LABELS[oclass];
    if (label === 'Large rocks') return 'Rocks';
    if (label === 'Iron balls') return 'Balls';
    if (label === 'Venoms') return 'Other';
    return label || 'Other';
}

// C invent.c:loot_classify() groups food by kind before sorting names.
function pickupObjectSubclass(object) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    if (oclass !== 7) return 1;
    if (object.otyp === SLIME_MOLD) return 1;
    if (object.otyp === TIN) return 3;
    if (object.otyp === EGG) return 4;
    if (object.otyp === CORPSE) return 5;
    return object.globby ? 6 : 2;
}

function pickupObjectDescription(object) {
    const description = floorObjectDescription(object);
    if (!object?.unpaid) return description;
    const price = unpaidObjectCost(object);
    return price > 0
        ? `${description} (unpaid, ${price} zorkmid${price === 1 ? '' : 's'})`
        : description;
}

function pickupObjectNoun(object) {
    return floorObjectDescription(object).replace(/^(?:an?|the)\s+/, '');
}
