import { currency } from './currency.js';
// Lock forcing.
// C ref: lock.c doforce(), forcelock(), and breakchestlock().
import { autokey, autoUnlockFlags, continuePicking, pickLock } from './lock_pick.js';
import { currentAttribute, currentStrength, exerciseAttribute } from './attrib.js';
import { A_CON, A_DEX, A_STR, P_DAGGER, P_FLAIL, P_LANCE, P_PICK_AXE, AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_KICK, DBWALL, DOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, SHOPBASE, SHOP_DOOR_COST, TT_PIT, isok, } from './const.js';
import { commandResultCancelled } from './command_state.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { BAG_OF_TRICKS } from './object_data.js';
import { doloot } from './pickup.js';
import { flushPendingTopline } from './tty_topline.js';
import { feel_location, feel_newsym, newsym } from './display.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { vision_note_blocker_change } from './vision.js';
import { findDrawbridgeAt } from './dbridge.js';
import { doorObstructed } from './door_magic.js';
import { recordMappedOverviewState } from './dungeon.js';
import { stumbleOnDoorMimic } from './mimic.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
import { heroPassesWalls } from './hero_species.js';
import { heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { isContainer } from './container.js';
import { rnl, rn2 } from './rng.js';
import { pline, plineWithContinuation } from './pline.js';
import { placeObject, stack_object } from './floor_object.js';
import { consumeInventoryItem } from './invent.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { CHEST, LARGE_BOX, OBJECT_LARGE_DAMAGE, OBJECT_SUBTYPE, } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { deleteObject, delobj } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { definiteName, objectName, observeObjectForNaming, ownedObjectName, pluralizeObjectNoun, singularObjectName } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName } from './terrain_name.js';
import { resetPick } from './lock_context.js';
import { objectResistsDestruction } from './object_state.js';
import { isWeaponTool } from './object_properties.js';
import { CORPSE, ICE_BOX } from './object_data.js';
import { startCorpseTimeout } from './mkobj.js';
import { applySupportedPotionVapor, randomBottleName } from './potion_hit.js';
import { promptYesNoQuit } from './query.js';
import { heroIsBlind } from './senses.js';
import { costlySpot, currentShopResident, chargeAlteredUnpaidObject } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { isBlade } from './weapon_type.js';
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const ROCK_CLASS = 14;
const POTION_CLASS = 8;
export async function doforce(state = game) {
    if (state.u?.uswallow) {
        await pline("You can't force anything from inside here.");
        state.context.move = 0;
        return;
    }
    if (!state.uwep || !isForceableWeapon(state.uwep)) {
        await pline(forceWeaponFailure(state.uwep));
        state.context.move = 0;
        return;
    }
    if (!heroCanReachFloor(state, { checkPit: true })) {
        const surface = heroCanReachFloor(state) ? 'bottom of the pit' : surfaceName(state.u.ux, state.u.uy, state);
        await pline(`You can't reach the ${surface}.`);
        state.context.move = 0;
        return;
    }
    const prying = isBlade(state.uwep) && !isPick(state.uwep);
    const previous = state._lockAttempt;
    const samePickType = previous?.key === 'force-lock'
        ? previous.picktyp === prying
        : previous?.key === 'pick-lock' && !previous.tool && !prying;
    if (previous?.usedtime && previous.container && samePickType) {
        await pline('You resume your attempt to force the lock.');
        const attempt = previous.key === 'force-lock' ? previous : {
            key: 'force-lock', text: 'forcing the lock',
            container: previous.container, picktyp: prying,
            chance: previous.chance, usedtime: previous.usedtime,
        };
        state._lockAttempt = state._occupation = attempt;
        state.context.move = 1;
        return;
    }
    const x = state.u.ux;
    const y = state.u.uy;
    const boxes = (state.level?.objects?.[x]?.[y] || []).filter(object => object.otyp === LARGE_BOX || object.otyp === CHEST);
    // C clears only the box target before the chest question; usedtime,
    // chance, and picktyp survive so a later apply of the same tool can
    // resume the now target-less attempt (which picklock() then abandons).
    if (previous)
        previous.container = undefined;
    let reportedOpenBox = false;
    for (const box of boxes) {
        observeObjectForNaming(box, { state });
        if (box.obroken || !box.olocked) {
            box.lknown = false;
            const condition = box.obroken ? 'broken' : 'unlocked';
            await plineWithContinuation(`There is ${await inventoryItemDescription(box)} here, but its lock is `
                + `already ${condition}.`);
            box.lknown = true;
            reportedOpenBox = true;
            continue;
        }
        if (reportedOpenBox)
            await flushPendingTopline();
        const description = await inventoryItemDescription(box);
        box.lknown = true;
        const answer = await promptYesNoQuit(`There is ${description} here; force its lock?`);
        if (answer === 'q') {
            state.context.move = 0;
            return;
        }
        if (answer === 'n')
            continue;
        const weapon = state.uwep;
        const action = prying
            ? `You force ${ownedObjectName(weapon, state, { capitalized: false })} into a crack and pry.`
            : `You start bashing it with ${ownedObjectName(weapon, state, { capitalized: false })}.`;
        await pline(action);
        state._lockAttempt = state._occupation = {
            key: 'force-lock',
            text: 'forcing the lock',
            container: box,
            picktyp: prying,
            chance: 2 * (OBJECT_LARGE_DAMAGE[weapon.otyp] || 0),
            usedtime: 0,
        };
        state.context.move = 1;
        return;
    }
    if (reportedOpenBox)
        await plineWithContinuation('You decide not to force the issue.');
    else
        await pline('You decide not to force the issue.');
    state.context.move = 1;
}
// C lock.c:forcelock().
export async function continueForceLock(occupation, state = game) {
    const box = occupation.container;
    if (!box) {
        // The force occupation only runs while its chest target exists.
        occupation.usedtime = 0;
        state._occupation = null;
        return false;
    }
    if (box.ox !== state.u.ux || box.oy !== state.u.uy) {
        occupation.usedtime = 0;
        state._occupation = null;
        return false;
    }
    const usedtime = occupation.usedtime ?? 0;
    occupation.usedtime = usedtime + 1;
    const weapon = state.uwep;
    if (usedtime >= 50 || !weapon || heroHasNoHands(state)) {
        await giveUpForcing(occupation, state);
        return true;
    }
    if (occupation.picktyp) {
        if (bladeBreaks(weapon)) {
            await pline(bladeBreakMessage(weapon, state));
            await consumeInventoryItem(weapon, state);
            if (state.program_state?.gameover)
                return true;
            await plineWithContinuation('You give up your attempt to force the lock.');
            await exerciseAttribute(A_DEX, true, state);
            occupation.usedtime = 0;
            state._occupation = null;
            state.context.move = 1;
            return true;
        }
    }
    else {
        const wakeDistance = (state.u?.ulevel ?? 1) * 20;
        await wakeMonstersNearWithMessages(state.u?.ux ?? 0, state.u?.uy ?? 0, wakeDistance, state);
    }
    if (rn2(100) < occupation.chance) {
        await plineWithContinuation('You succeed in forcing the lock.');
        await exerciseAttribute(occupation.picktyp ? A_DEX : A_STR, true, state);
        const destroyed = !occupation.picktyp && rn2(3) === 0;
        await breakChestLock(box, destroyed, state);
        if (state.program_state?.gameover)
            return true;
        await newsym(state.u.ux, state.u.uy);
        resetPick(state);
        state._occupation = null;
    }
    state.context.move = 1;
    return true;
}
// C lock.c:u_have_forceable_weapon().
export function isForceableWeapon(weapon) {
    if (!weapon)
        return false;
    const weaponTool = isWeaponTool(weapon);
    if (weapon.oclass === WEAPON_CLASS || weaponTool) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] || 0;
        return skill >= P_DAGGER && skill <= P_LANCE && skill !== P_FLAIL;
    }
    return weapon.oclass === ROCK_CLASS;
}
function isPick(weapon) {
    return (weapon?.oclass === WEAPON_CLASS || weapon?.oclass === TOOL_CLASS)
        && OBJECT_SUBTYPE[weapon.otyp] === P_PICK_AXE;
}
function forceWeaponFailure(weapon) {
    if (!weapon)
        return "You can't force anything when not wielding a weapon.";
    const plural = objectQuantity(weapon) > 1;
    const description = weapon.oclass !== WEAPON_CLASS && !isWeaponTool(weapon)
        ? plural ? 'without proper' : 'without a proper'
        : plural ? 'with those' : 'with that';
    return `You can't force anything ${description} weapon${plural ? 's' : ''}.`;
}
function objectQuantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
function bladeBreaks(weapon) {
    const enchantment = weapon.spe ?? weapon.enchantment ?? 0;
    const erosion = Math.max(weapon.oeroded ?? 0, weapon.oeroded2 ?? 0);
    if (rn2(1000 - enchantment) <= 992 - erosion * 10)
        return false;
    if (weapon.cursed)
        return false;
    return !objectResistsDestruction(weapon, 0, 99);
}
function bladeBreakMessage(weapon, state) {
    const name = objectName(weapon, state);
    return objectQuantity(weapon) > 1
        ? `One of your ${pluralizeObjectNoun(weapon, name)} broke!`
        : `Your ${name} broke!`;
}
async function giveUpForcing(occupation, state) {
    await pline('You give up your attempt to force the lock.');
    if (occupation.usedtime >= 50) {
        await exerciseAttribute(occupation.picktyp ? A_DEX : A_STR, true, state);
    }
    occupation.usedtime = 0;
    state._occupation = null;
    state.context.move = 1;
}
function forceShatterMessage(object, state) {
    const thing = singularObjectName(object, state);
    const material = objectMaterial(object, state);
    const disposition = material === 5 ? 'is torn to shreds'
        : material === 2 ? 'is crushed'
            : material === 3 ? 'is pulped'
                : material === 4 ? 'is mashed'
                    : material === 19 ? 'shatters'
                        : material === 8 ? 'splinters to fragments'
                            : 'is destroyed';
    const subject = withIndefiniteArticle(thing);
    return `${subject.charAt(0).toUpperCase() + subject.slice(1)} ${disposition}!`;
}
async function shatterChestContent(object, state) {
    if (object.oclass === POTION_CLASS) {
        const bottle = randomBottleName(state);
        await plineWithContinuation(`You ${heroIsBlind(state) ? 'hear' : 'see'} ${withIndefiniteArticle(bottle)} shatter!`);
        await applySupportedPotionVapor({ potion: object, state });
    }
    else {
        await plineWithContinuation(forceShatterMessage(object, state));
    }
}
export async function breakChestLock(box, destroyIt, state) {
    if (!destroyIt) {
        const contents = box.contents;
        box.contents = [];
        try {
            await chargeAlteredUnpaidObject(box, 'break the lock on', state);
        }
        finally {
            if (contents === undefined)
                delete box.contents;
            else
                box.contents = contents;
        }
        box.olocked = false;
        box.obroken = true;
        box.lknown = true;
        return;
    }
    const x = state.u.ux;
    const y = state.u.uy;
    const shopkeeper = costlySpot(x, y, state)
        ? currentShopResident(state) : null;
    const peacefulShopkeeper = !!shopkeeper?.mpeaceful;
    let loss = 0;
    await plineWithContinuation(`In fact, you've totally destroyed ${definiteName(objectName(box, state), state)}.`);
    while (box.contents?.length) {
        const object = box.contents[0];
        if (!object)
            throw new Error('A chest with contents must have a first object.');
        unlinkObject(object, state);
        const shatters = rn2(3) === 0 || object.oclass === POTION_CLASS;
        if (shatters) {
            await shatterChestContent(object, state);
            if (state.program_state?.gameover)
                return;
            if (shopkeeper) {
                loss += await stolenValue(object, x, y, peacefulShopkeeper, { silent: true, state });
            }
            if (objectQuantity(object) === 1) {
                await deleteObject(object, state);
                continue;
            }
            await consumeInventoryItem(object, state);
        }
        if (box.otyp === ICE_BOX && object.otyp === CORPSE) {
            object.age = state.moves - (object.age ?? 0);
            startCorpseTimeout(object);
        }
        // Forcing a lock is a hero action; box contents may hold a
        // crysknife, so the drop takes the awaited placement.
        await placeObject(object, x, y, state);
        await stack_object(object, state);
    }
    if (shopkeeper) {
        loss += await stolenValue(box, x, y, peacefulShopkeeper, { silent: true, state });
    }
    if (loss) {
        await plineWithContinuation(`You owe ${loss} ${currency(loss, { state })} for objects destroyed.`);
    }
    await delobj(box, state);
}
// C refs: lock.c doclose(); cmd.c getdir()/help_dir().  Invalid direction
// help is a modal text window: bytes typed before a real More dismissal must
// not leak back into the top-level command dispatcher.
export async function doclose() {
    if (heroHasNoHands(game)) {
        await pline("You can't close anything -- you have no hands!");
        game.context.move = 0;
        return;
    }
    if (game.u.utrap && game.u.utraptype === TT_PIT) {
        await pline("You can't reach over the edge of the pit.");
        game.context.move = 0;
        return;
    }
    const direction = await promptDirection();
    if (!direction) {
        commandResultCancelled(); // lock.c:doclose() returns ECMD_CANCEL.
        game.context.move = 0;
        return;
    }
    const x = game.u.ux + direction.dx;
    const y = game.u.uy + direction.dy;
    if (x === game.u.ux && y === game.u.uy && !heroPassesWalls(game)) {
        await pline('You are in the way!');
        game.context.move = 1;
        return;
    }
    if (!isok(x, y)) {
        await pline(`You ${heroIsBlind(game) ? 'feel' : 'see'} no door there.`);
        game.context.move = 0;
        return;
    }
    const loc = game.level?.at(x, y);
    if (await stumbleOnDoorMimic(x, y)) {
        game.context.move = 1;
        return;
    }
    game.context.move = game.u.confused || game.u.confusionTurns
        || game.u.stunned || game.u.stunnedTurns ? 1 : 0;
    if (loc && heroIsBlind(game)) {
        const previousGlyph = loc.remembered_glyph?.glyph;
        recordMappedOverviewState();
        const previousTerrain = loc.lastseentyp;
        await feel_location(x, y);
        if (loc.remembered_glyph?.glyph !== previousGlyph || loc.lastseentyp !== previousTerrain)
            game.context.move = 1;
    }
    const portcullis = loc && (loc.typ === DOOR || loc.typ === DBWALL)
        && findDrawbridgeAt(x, y) !== null;
    if (portcullis || loc?.typ !== DOOR) {
        if (loc?.typ === DBWALL || loc?.typ === DRAWBRIDGE_UP)
            await pline('The drawbridge is already closed.');
        else if (portcullis || loc?.typ === DRAWBRIDGE_DOWN)
            await pline('There is no obvious way to close the drawbridge.');
        else
            await pline(`You ${heroIsBlind(game) ? 'feel' : 'see'} no door there.`);
        return;
    }
    if (loc.doormask === D_NODOOR) {
        await pline('This doorway has no door.');
        return;
    }
    requirePlayingGame(game);
    if (await doorObstructed(x, y, false, game))
        return;
    if (loc.doormask === D_BROKEN) {
        await pline('This door is broken.');
        return;
    }
    if (loc.doormask & (D_CLOSED | D_LOCKED)) {
        await pline('This door is already closed.');
        return;
    }
    if (loc.doormask === D_ISOPEN) {
        if (heroIsVerySmall(game) && !game.u.usteed) {
            await pline("You're too small to push the door closed.");
            return;
        }
        const effort = Math.trunc((currentStrength()
            + currentAttribute(A_DEX) + currentAttribute(A_CON)) / 3);
        if (game.u.usteed || rn2(25) < effort) {
            await pline('The door closes.');
            loc.doormask = D_CLOSED;
            await feel_newsym(x, y);
            vision_note_blocker_change(x, y);
        }
        else {
            await exerciseAttribute(A_STR, true);
            await pline('The door resists!');
        }
    }
    game.context.move = 1;
}
// C refs: lock.c doopen(); cmd.c get_adjacent_loc()/getdir().  Direction
// validation is owned by the same modal assistance transaction as close;
// the door mutation happens only after that transaction returns a direction.
export async function doopen(x = 0, y = 0) {
    if (heroHasNoHands(game)) {
        await pline("You can't open anything -- you have no hands!");
        game.context.move = 0;
        return;
    }
    if (!(x > 0 && y >= 0)) {
        const boxes = game.level?.objects[game.u.ux]?.[game.u.uy] ?? [];
        const inPitWithContainer = game.u.utrap && game.u.utraptype === TT_PIT
            && boxes.some(object => isContainer(object));
        const direction = await promptDirection(inPitWithContainer
            ? (_message, retry) => readDirectionKey('Open where? [.>] ', retry) : readDirectionKey);
        if (!direction) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        x = game.u.ux + direction.dx;
        y = game.u.uy + direction.dy;
    }
    if (!isok(x, y)) {
        game.context.move = 0;
        return;
    }
    const loc = game.level?.at(x, y);
    if (x === game.u.ux && y === game.u.uy
        && ((game.u.dz ?? 0) > 0 || loc?.typ !== DOOR || !(loc.doormask & (D_CLOSED | D_LOCKED)))) {
        await doloot();
        return;
    }
    if (game.u.utrap && game.u.utraptype === TT_PIT) {
        await pline("You can't reach over the edge of the pit.");
        game.context.move = 0;
        return;
    }
    if (await stumbleOnDoorMimic(x, y)) {
        game.context.move = 1;
        return;
    }
    let spentTime = !!(game.u.confused || game.u.confusionTurns
        || game.u.stunned || game.u.stunnedTurns);
    if (loc) {
        const previousGlyph = loc.remembered_glyph?.glyph;
        recordMappedOverviewState();
        const previousTerrain = loc.lastseentyp;
        await newsym(x, y);
        // doopen_indir() uses a turn when looking at the target teaches
        // the hero something, even if the target has no door to open.
        if (loc.remembered_glyph?.glyph !== previousGlyph || loc.lastseentyp !== previousTerrain)
            spentTime = true;
    }
    game.context.move = Number(spentTime);
    const portcullis = loc && (loc.typ === DOOR || loc.typ === DBWALL)
        && findDrawbridgeAt(x, y) !== null;
    if (portcullis || loc?.typ !== DOOR) {
        if (loc?.typ === DBWALL || loc?.typ === DRAWBRIDGE_UP) {
            await pline('There is no obvious way to open the drawbridge.');
            return;
        }
        if (portcullis || loc?.typ === DRAWBRIDGE_DOWN) {
            await pline('The drawbridge is already open.');
            return;
        }
        const floorPile = game.level?.objects[x]?.[y] ?? [];
        // Native Is_container includes a bag of tricks for this hint.
        const hasContainer = floorPile.some(object => object.otyp >= LARGE_BOX && object.otyp <= BAG_OF_TRICKS);
        const blind = heroIsBlind(game);
        await pline(hasContainer
            ? `${blind ? 'Feels' : 'Seems'} like something lootable over there.`
            : `You ${blind ? 'feel' : 'see'} no door there.`);
        return;
    }
    if (loc.doormask === D_BROKEN) {
        await pline('This door is broken.');
        return;
    }
    if (loc.doormask === D_NODOOR) {
        await pline('This doorway has no door.');
        return;
    }
    if (loc.doormask === D_ISOPEN) {
        await pline('This door is already open.');
        return;
    }
    if (loc.doormask & D_LOCKED) {
        game.context.move = Number(await openLockedDoor(x, y));
        return;
    }
    if (heroIsVerySmall(game)) {
        await pline("You're too small to pull the door open.");
        return;
    }
    if (rnl(20) < Math.trunc((currentStrength()
        + currentAttribute(A_DEX)
        + currentAttribute(A_CON)) / 3)) {
        await openClosedDoor(loc, x, y);
    }
    else {
        await exerciseAttribute(A_STR, true);
        await pline('The door resists!');
    }
    if (game.program_state.gameover)
        return;
    game.context.move = 1;
}
// lock.c:doopen_indir() announces opening before the explosion. The door
// remains closed across that message pause and any fatal explosion.
async function openClosedDoor(door, x, y) {
    await plineWithContinuation('The door opens.');
    if (door.doormask & D_TRAPPED) {
        if (await triggerBoobyTrap('door', { bodypart: true }))
            return;
        door.doormask = D_NODOOR;
        const level = requireGameLevel();
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, SHOP_DOOR_COST);
    }
    else
        door.doormask = D_ISOPEN;
    await feel_newsym(x, y);
    vision_note_blocker_change(x, y);
}
async function openLockedDoor(x, y) {
    await pline('This door is locked.');
    const flags = autoUnlockFlags(game);
    if (!flags)
        return Boolean(game.context.move);
    game.u.dz = 0;
    if (flags & AUTOUNLOCK_APPLY_KEY) {
        const tool = autokey(true);
        if (tool)
            return pickLock(tool, { target: { x, y } });
    }
    if (flags & AUTOUNLOCK_KICK && !game.u.usteed
        && await promptYesNoQuit('Kick it?') === 'y') {
        // lock.c queues dokick with the door direction; the open command
        // itself spends no turn, the kick that follows owns the action.
        game._cannedCommands ||= [];
        game._cannedCommands.push({
            kind: 'kick',
            dx: Math.sign(x - game.u.ux), dy: Math.sign(y - game.u.uy),
        });
        return false;
    }
    return Boolean(game.context.move);
}
//# sourceMappingURL=lock.js.map