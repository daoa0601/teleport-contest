// Moving a floor object with the kick command.
// C refs: dokick.c really_kick_object() and zap.c bhit(KICKED_WEAPON).
import { artifactById } from './artifacts.js';
import { currentAttribute, currentStrength } from './attrib.js';
import { heroFootName, heroLegName } from './body_parts.js';
import { triggerChestTrap } from './chest_trap.js';
import { containerImpactDamage } from './container_impact.js';
import { A_DEX, DOOR, D_CLOSED, D_LOCKED, IS_OBSTRUCTED, SHOPBASE, STATUE_TRAP, Is_airlevel, Is_waterlevel, WEB, ZAP_POS, is_pit, isok, } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, remove_object, stack_object } from './floor_object.js';
import { splitObjectStack } from './object_stack.js';
import { impactDisturbsZombies } from './object_impact.js';
import { heroHasMartialKick } from './kick_rules.js';
import { breakChestLock } from './lock.js';
import { game } from './gstate.js';
import { hitMonsterWithKickedObject } from './hero_ranged_attack.js';
import { breakFloorObject } from './object_breakage.js';
import { BOULDER, CHEST, CORPSE, LARGE_BOX } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { flyKickedObject, snuffThrownCandle } from './thrown_object.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { inventoryItemDescription } from './invent.js';
import { objectDescription } from './object_description.js';
import { corpseName, killerObjectName, objectCombatName, objectNameIsPlural, observeObjectForNaming } from './objnam.js';
import { makePlural } from './object_grammar.js';
import { costlyAdjacent, costlySpot, addShopObjectToBill, removeObjectAndContentsFromBill } from './shk.js';
import { findObjectOwner, stolenValue } from './shop_loss.js';
import { costlyGold, donateGold } from './shop_sell.js';
import { containedGold } from './gold.js';
import { roomsAt } from './room.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { revealTrap } from './trap_lifecycle.js';
import { isIceAt, isPoolAt } from './terrain_properties.js';
import { resolveGoldMonsterContact } from './gold_throw.js';
import { angerAttackedMonster, wakeAttackedMonster } from './monster_anger.js';
import { adjustHeroAlignment } from './alignment.js';
import { surfaceName } from './terrain_name.js';
import { scatterFloorObjects } from './scatter.js';
import { objectWeight } from './weight.js';
function trapAt(state, x, y) {
    return state.level?.traps?.find(trap => trap.tx === x && trap.ty === y) || null;
}
function closedDoor(location) {
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}
function quantity(object) {
    return object.quan ?? object.quantity ?? 1;
}
function unitWeight(object) {
    if (quantity(object) === 1)
        return objectWeight(object);
    return objectWeight({ ...object, quan: 1, quantity: 1 });
}
function kickRange(object, state, dx, dy, martial, rollOne) {
    let slide = false;
    let range = Math.trunc(currentStrength(state) / 2)
        - Math.trunc((object.oclass === 12 ? objectWeight(object) : unitWeight(object)) / 40);
    if (martial)
        range += rollOne(3);
    if (isPoolAt(object.ox, object.oy, state)) {
        range = Math.trunc(range / 3) + 1;
    }
    else if (Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz)) {
        range += rollOne(3);
    }
    else {
        if (isIceAt(object.ox, object.oy, state)) {
            range += rollOne(3);
            slide = true;
        }
        if (object.greased) {
            range += rollOne(3);
            slide = true;
        }
    }
    if (artifactById(object.oartifact ?? 0, state)?.name === 'Mjollnir')
        range = 1;
    const nextX = object.ox + dx;
    const nextY = object.oy + dy;
    const next = state.level?.at?.(nextX, nextY);
    if (!isok(nextX, nextY) || !next || !ZAP_POS(next.typ) || closedDoor(next))
        range = 1;
    return { range, slide };
}
export async function kickFloorObject(x, y, { state = game, dx = state.u?.dx ?? 0, dy = state.u?.dy ?? 0, publish = plineWithContinuation, random = rn2, rollOne = rnd, captureFlight = null, } = {}) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object)
        return false;
    if (object.otyp === BOULDER || object === state.uball || object === state.u.uball
        || object === state.uchain || object === state.u.uchain)
        return false;
    const trap = trapAt(state, x, y);
    const passesWalls = state.u.passesWalls;
    if (trap && ((is_pit(trap.ttyp) && !passesWalls)
        || trap.ttyp === WEB)) {
        revealTrap(trap, state);
        await publish(`You can't kick something that's in a ${heroIsHallucinating(state) ? 'tizzy' : trap.ttyp === WEB ? 'web' : 'pit'}!`);
        return true;
    }
    if (trap?.ttyp === STATUE_TRAP) {
        await activateStatueTrapAt(x, y, { state });
        return true;
    }
    if ((state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0)
        && random(3) === 0) {
        await publish('Your clumsy kick missed.');
        return true;
    }
    if (!(state.uarmf || state.u.uarmf) && object.otyp === CORPSE
        && touchPetrifies(object.corpsenm) && !heroResistsStoning(state)) {
        await publish(`You kick ${corpseName(object, { definite: true })} with your bare ${makePlural(heroFootName(state))}.`);
        const result = await resolveImmediatePetrification({ state, publish,
            killer: `kicking ${killerObjectName(object, state)} barefoot` });
        if (result.died || state.program_state.gameover)
            return true;
    }
    const martial = heroHasMartialKick(state);
    const { range, slide } = kickRange(object, state, dx, dy, martial, rollOne);
    const owner = findObjectOwner(object, x, y, state);
    let costly = !!owner && !!(costlySpot(x, y, state)
        || costlyAdjacent(owner, x, y, state) && object.unpaid);
    const isGold = object.oclass === 12;
    observeObjectForNaming(object, { state });
    await publish(`You kick ${objectDescription(isGold ? object
        : { ...object, quan: 1, quantity: 1 }, { state })}.`);
    const source = state.level?.at(x, y);
    const heroSquare = state.level?.at(state.u.ux, state.u.uy);
    if (source && (IS_OBSTRUCTED(source.typ) || closedDoor(source))) {
        const stuck = !martial && random(20) > currentAttribute(A_DEX, state)
            || heroSquare && (IS_OBSTRUCTED(heroSquare.typ) || closedDoor(heroSquare));
        const subject = heroIsBlind(state) ? 'It'
            : `The ${objectCombatName(object, { state })}`;
        const plural = !heroIsBlind(state) && objectNameIsPlural(object, state);
        if (stuck) {
            await publish(`${subject} ${plural ? "don't" : "doesn't"} come loose.`);
            return random(3) === 0 || martial;
        }
        await publish(`${subject} ${plural ? 'come' : 'comes'} loose.`);
        remove_object(object, state);
        newsym(x, y);
        const shop = roomsAt(state.level, x, y, SHOPBASE)[0];
        if (costly && (!costlySpot(state.u.ux, state.u.uy, state)
            || shop === undefined || !state.u.urooms?.includes(shop))) {
            if (object.no_charge)
                object.no_charge = false;
            else
                await addShopObjectToBill(object, state, { ininv: false, publish });
        }
        const effects = await applyFloorEffects(object, state.u.ux, state.u.uy, { state, publish, random, verb: 'fall' });
        if (!effects.finished) {
            await placeObject(object, state.u.ux, state.u.uy, state);
            impactDisturbsZombies(object, true, state);
            await stack_object(object, state);
        }
        newsym(state.u.ux, state.u.uy);
        return true;
    }
    const box = object.otyp === CHEST || object.otyp === LARGE_BOX;
    if (box) {
        const trapped = object.otrapped;
        if (range < 2)
            await publish('THUD!');
        await containerImpactDamage(object, x, y, { state, publish, random, fromInventory: false });
        const opens = random(object.olocked ? 5 : 3) === 0
            || martial && random(2) === 0;
        if (opens) {
            if (object.olocked) {
                await publish('You break open the lock!');
                await breakChestLock(object, false, state);
            }
            else {
                await publish('The lid slams open, then falls shut.');
                object.lknown = true;
            }
            if (trapped)
                await triggerChestTrap(object, { state, publish, random, bodyPart: heroLegName(state) });
            return true;
        }
        if (range < 2)
            return true;
    }
    const { destroyed } = await breakFloorObject(object, {
        state,
        publish,
        random,
    });
    // A fatal vapor or oil blast ends the action even though the bottle
    // itself reports not destroyed.
    if (destroyed || state.program_state?.gameover)
        return true;
    if (range < 2) {
        if (!box)
            await publish('Thump!');
        return random(3) === 0 || martial;
    }
    if (object.oclass === 12 && quantity(object) > 1) {
        if (random(20) !== 0) {
            if (!heroIsDeaf(state))
                await publish('Thwwpingg!');
            const messages = ['scatter the coins', 'knock coins all over the place',
                'send coins flying in all directions'];
            await publish(`You ${messages[random(messages.length)]}!`);
            await scatterFloorObjects(x, y, rollOne(3), {
                state, onlyObject: object, mayDestroy: false, mayFracture: false,
                mayHitHero: true, mayHitMonsters: true, heroCaused: true,
                publish, random, rollOne,
            });
            newsym(x, y);
            return true;
        }
        if (quantity(object) > 300) {
            await publish('Thump!');
            return random(3) === 0 || martial;
        }
    }
    const moving = object.oclass !== 12 && quantity(object) > 1
        ? splitObjectStack(object, 1, state)
        : object;
    if (!moving)
        throw new Error('A kicked stack must yield an object.');
    if (slide && !heroIsBlind(state)) {
        const name = inventoryItemDescription(moving);
        await publish(`Whee!  ${name.charAt(0).toUpperCase() + name.slice(1)} ${quantity(moving) === 1 ? 'slides' : 'slide'} across the ${surfaceName(x, y, state)}.`);
    }
    remove_object(moving, state);
    state._kickedObject = moving;
    try {
        await snuffThrownCandle(moving, state, publish);
        newsym(x, y);
        const flight = await flyKickedObject({
            state,
            object: moving,
            dx,
            dy,
            range,
            captureFlight,
            publish,
            random,
        });
        if (flight.destroyed || flight.migrated)
            return true;
        if (flight.contact) {
            if (isGold) {
                if (await resolveGoldMonsterContact({ state, monster: flight.contact, gold: moving,
                    wakeMonster: actor => wakeAttackedMonster(actor),
                    angerMonster: actor => angerAttackedMonster(actor),
                    adjustAlignment: amount => adjustHeroAlignment(amount, state) }))
                    return true;
            }
            else {
                const contact = await hitMonsterWithKickedObject(flight.contact, moving, { state, target: { x: flight.x, y: flight.y } });
                if (contact.heroDied || contact.consumed)
                    return true;
            }
        }
        const destinationShop = roomsAt(state.level, flight.x, flight.y, SHOPBASE)[0];
        const sourceShop = roomsAt(state.level, x, y, SHOPBASE)[0];
        if (costly && owner && (!costlySpot(flight.x, flight.y, state) || sourceShop !== destinationShop)) {
            if (isGold)
                await costlyGold(x, y, quantity(moving), { state, publish });
            else
                await stolenValue(moving, x, y, !!owner.mpeaceful, { state, publish, silent: false });
            costly = false;
        }
        const effects = await applyFloorEffects(moving, flight.x, flight.y, { state, publish, random, verb: 'fall' });
        if (effects.finished)
            return true;
        if (costly && owner) {
            if (moving.unpaid)
                removeObjectAndContentsFromBill(moving, state, { resident: owner });
            const gold = containedGold(moving, true);
            if (gold > 0)
                await donateGold(gold, owner, { selling: false, publish });
        }
        await placeObject(moving, flight.x, flight.y, state);
        impactDisturbsZombies(moving, true, state);
        await stack_object(moving, state);
        newsym(flight.x, flight.y);
        return true;
    }
    finally {
        if (state._kickedObject === moving)
            state._kickedObject = null;
    }
}
//# sourceMappingURL=object_kick.js.map