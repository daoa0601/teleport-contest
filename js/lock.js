// lock.js — Doors, containers, and their locks.
// C refs: lock.c — picking_lock()/picking_at()/lock_action(), picklock(),
// pick_lock(), autokey(), breakchestlock(), forcelock(), doforce(),
// reset_pick()/maybe_reset_pick(), u_have_forceable_weapon(),
// stumble_on_door_mimic(), doopen()/doopen_indir(), obstructed(), doclose(),
// boxlock(), doorlock().
import { currency } from './currency.js';
import { currentAttribute, currentStrength, exerciseAttribute } from './attrib.js';
import { A_CON, A_DEX, A_STR, P_DAGGER, P_FLAIL, P_LANCE, P_PICK_AXE, AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_KICK, DBWALL, DOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, SHOPBASE, SHOP_DOOR_COST, TT_PIT, isok, A_WIS, AUTOUNLOCK_UNTRAP, AUTOUNLOCK_FORCE, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, SDOOR, Is_rogue_level } from './const.js';
import { commandResultCancelled } from './cmd.js';
import { game, requireGameLevel, requirePlayingGame, requireLiveGame } from './gstate.js';
import { BAG_OF_TRICKS, CHEST, LARGE_BOX, OBJECT_LARGE_DAMAGE, OBJECT_SUBTYPE, CORPSE, ICE_BOX, CREDIT_CARD, LOCK_PICK, SKELETON_KEY, WAN_OPENING, WAN_LOCKING, WAN_STRIKING, SPE_KNOCK, SPE_WIZARD_LOCK, SPE_FORCE_BOLT } from './object_data.js';
import { doloot } from './pickup.js';
import { flushPendingTopline } from './tty_topline.js';
import { feel_location, feel_newsym, newsym, canSeeMonster, displayLiquidName, glyphAt, canSpotMonster, map_invisible } from './display.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { vision_note_blocker_change, cansee, vision_recalc } from './vision.js';
import { findDrawbridgeAt } from './dbridge.js';
import { recordMappedOverviewState } from './dungeon.js';
import { hasDoorAppearance, stumbleOntoMimic } from './mimic.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { roomsAt } from './room.js';
import { heroPassesWalls } from './hero_species.js';
import { heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { isContainer } from './container.js';
import { rnl, rn2 } from './rng.js';
import { pline, plineWithContinuation } from './pline.js';
import { placeObject, stack_object } from './floor_object.js';
import { consumeInventoryItem, delobj, inventoryItemDescription } from './invent.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { objectMaterial } from './o_init.js';
import { withIndefiniteArticle } from './objnam.js';
import { definiteName, objectName, observeObjectForNaming, ownedObjectName, pluralizeObjectNoun, singularObjectName, simpleObjectNameWithArticle, simpleObjectTypeName } from './objnam.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName } from './terrain_name.js';
import { objectResistsDestruction } from './zap.js';
import { isWeaponTool, isBlade } from './object_properties.js';
import { startCorpseTimeout, unlinkObject } from './mkobj.js';
import { applySupportedPotionVapor, randomBottleName } from './potion.js';
import { promptYesNoQuit, promptYesNo } from './query.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { costlySpot, currentShopResident, chargeAlteredUnpaidObject, stolenValue, addShopDamage, deleteObject } from './shk.js';
import { artifactById, touchArtifactByHero } from './artifacts.js';
import { heroFingerName } from './body_parts.js';
import { triggerChestTrap } from './chest_trap.js';
import { monsterAtPosition } from './steed.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './do_name.js';
import { maybeAbsorbItem } from './steal.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { untrap, untrapAbilityProblem } from './untrap.js';
import { possessiveName } from './hacklib.js';
import { heroIsUnaware } from './hero_sleep.js';
import { formatHeardMessage } from './hero_speech.js';
import { triggerMonsterDoorTrap } from './monmove.js';
import { stopHeroOccupation } from './occupation.js';
import { impossible } from './diagnostics.js';
// Lock forcing.
// C ref: lock.c doforce(), forcelock(), and breakchestlock().
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
// C lock.c:picking_at(): the hero's lock-picking occupation targets this
// door square. Only the door form matches, exactly as C compares
// gx.xlock.door == &levl[x][y].
export function pickingAt(state, x, y) {
    const occupation = state._occupation;
    return !!occupation && occupation.key === 'pick-lock'
        && !!occupation.door
        && occupation.x === x && occupation.y === y;
}
// Native lock.c keeps progress separately from the running occupation.
export function resetPick(state = game) {
    state._lockAttempt = null;
}
export function maybeResetPick(container, state = game) {
    const attempt = state._lockAttempt;
    if (container ? attempt?.container === container : attempt?.container?.where !== 'inventory')
        resetPick(state);
}
// Applying keys, picks and cards. C lock.c:pick_lock(), picklock(), autokey().
export function autoUnlockFlags(state = game) {
    const setting = state.flags.autounlock;
    if (setting === undefined || setting === true)
        return AUTOUNLOCK_APPLY_KEY;
    if (typeof setting === 'number')
        return setting;
    if (!setting)
        return 0;
    const choices = setting.split(setting.includes('+') ? '+' : /\s+/);
    const unlockTypes = [
        { name: 'untrap', flag: AUTOUNLOCK_UNTRAP },
        { name: 'apply-key', flag: AUTOUNLOCK_APPLY_KEY },
        { name: 'kick', flag: AUTOUNLOCK_KICK },
        { name: 'force', flag: AUTOUNLOCK_FORCE },
    ];
    let flags = 0;
    for (const value of choices) {
        const choice = value.trim().toLowerCase();
        if (!choice)
            continue;
        if ('none'.startsWith(choice))
            return 0;
        const compact = choice.replace(/[ _-]/g, '');
        for (const type of unlockTypes) {
            if (type.name.startsWith(choice) || type.name.replace('-', '') === compact) {
                flags |= type.flag;
                break;
            }
        }
    }
    return flags;
}
export function isHeroMagicKey(tool, state = game) {
    if (!tool)
        return false;
    return artifactById(tool.oartifact, state)?.name === 'The Master Key of Thievery'
        && (state.urole?.key === 'rogue' ? !tool.cursed : !!tool.blessed);
}
export function autokey(opening, state = game) {
    let key = null, pick = null, card = null;
    let foreignKey = null, foreignPick = null, foreignCard = null;
    for (const tool of state.inventory) {
        const artifact = artifactById(tool.oartifact, state);
        const foreign = artifact?.questArtifact && artifact.name.toLowerCase() !== state.urole?.artifactName.toLowerCase();
        if (foreign) {
            if (tool.otyp === SKELETON_KEY && !foreignKey)
                foreignKey = tool;
            else if (tool.otyp === LOCK_PICK && !foreignPick)
                foreignPick = tool;
            else if (tool.otyp === CREDIT_CARD && !foreignCard)
                foreignCard = tool;
        }
        else {
            if (tool.otyp === SKELETON_KEY && (!key || isHeroMagicKey(tool, state)))
                key = tool;
            else if (tool.otyp === LOCK_PICK && !pick)
                pick = tool;
            else if (tool.otyp === CREDIT_CARD && !card)
                card = tool;
        }
    }
    if (!opening)
        card = foreignCard = null;
    if (!key && !pick && !card)
        key = foreignKey;
    if (!pick && !card)
        pick = foreignPick;
    if (!card)
        card = foreignCard;
    return key || pick || card;
}
export function lockToolName(tool, state = game) {
    observeObjectForNaming(tool);
    return ownedObjectName(tool, state, { capitalized: false });
}
// True includes the native "learned something" result, which takes a turn.
export async function pickLock(tool, { state = game, target = null, container = null, } = {}) {
    requirePlayingGame(state);
    const previous = state._lockAttempt;
    // Native uses picktyp 0 for both a missing tool and blunt forcing.
    const samePickType = previous?.key === 'pick-lock'
        ? previous.tool?.otyp === tool?.otyp
        : previous?.key === 'force-lock' && !previous.picktyp && !tool;
    if (previous?.usedtime && samePickType) {
        if (heroHasNoHands(state)) {
            const noun = tool?.otyp === LOCK_PICK ? 'pick' : tool?.otyp === CREDIT_CARD ? 'card' : 'key';
            await plineWithContinuation(`Unfortunately, you can no longer hold the ${noun}.`);
            resetPick(state);
        }
        else if (state.u.uswallow || previous.container && !heroCanReachFloor(state, { checkPit: true })) {
            await plineWithContinuation('Unfortunately, you can no longer reach the lock.');
            resetPick(state);
        }
        else {
            const attempt = previous.key === 'pick-lock' ? previous : {
                key: 'pick-lock', text: '', remaining: 51, tool,
                container: previous.container,
                x: previous.container?.ox ?? state.u.ux,
                y: previous.container?.oy ?? state.u.uy,
                chance: previous.chance, usedtime: previous.usedtime,
            };
            attempt.text = lockAction(attempt);
            attempt.magicKey = isHeroMagicKey(tool, state);
            await plineWithContinuation(`You resume your attempt at ${attempt.text}.`);
            state._lockAttempt = state._occupation = attempt;
        }
        return true;
    }
    if (heroHasNoHands(state)) {
        await plineWithContinuation(`You can't hold ${tool ? await inventoryItemDescription(tool) : 'that'} -- you have no hands!`);
        return false;
    }
    if (state.u.uswallow) {
        await plineWithContinuation(`You can't ${tool?.otyp === CREDIT_CARD ? '' : 'lock or '}unlock ${state.u.ustuck ? monsterName(state.u.ustuck) : 'the monster'}.`);
        return false;
    }
    const automatic = target !== null || container !== null;
    let position = target;
    if (!position) {
        const direction = await promptDirection();
        if (!direction) {
            await plineWithContinuation('Never mind.');
            return false;
        }
        position = { x: state.u.ux + direction.dx, y: state.u.uy + direction.dy };
        if (!isok(position.x, position.y)) {
            await plineWithContinuation('Invalid location!');
            return false;
        }
    }
    const { x, y } = position;
    if (x === state.u.ux && y === state.u.uy)
        return pickBoxLock(tool, container, automatic, state);
    return pickDoorLock(tool, x, y, automatic, state);
}
async function pickBoxLock(tool, container, automatic, state) {
    const { ux: x, uy: y } = state.u;
    if ((state.u.dz ?? 0) < 0 && !automatic) {
        await plineWithContinuation(`There isn't any sort of lock up ${state.u.levitating || state.levitating ? 'here' : 'there'}.`);
        return true;
    }
    if (isLavaAt(x, y, state)) {
        await plineWithContinuation(`Doing that would probably melt ${tool ? lockToolName(tool, state) : 'your tool'}.`);
        return true;
    }
    if (isPoolAt(x, y, state) && !(state.underwater || state.u.uinwater)) {
        await plineWithContinuation(`The ${displayLiquidName('water', state)} has no lock.`);
        return true;
    }
    const boxes = (state.level?.objects[x]?.[y] ?? []).filter(box => (box.otyp === CHEST || box.otyp === LARGE_BOX) && (!automatic || box === container));
    for (const box of boxes) {
        if (!heroCanReachFloor(state, { checkPit: true })) {
            await plineWithContinuation(`You can't reach ${definiteName(objectName(box), state)} from up here.`);
            return true;
        }
        const flags = autoUnlockFlags(state);
        if (automatic && flags & AUTOUNLOCK_UNTRAP && !untrapAbilityProblem(state, { checkFloor: true })) {
            const answer = box.tknown ? box.otrapped ? 'y' : 'n'
                : await promptYesNoQuit(`Check ${ownedObjectName(box, state, { capitalized: false })} for a trap?`);
            if (answer === 'q')
                return false;
            if (answer === 'y') {
                await untrap({ state, container: box });
                return true;
            }
        }
        if (automatic && flags & AUTOUNLOCK_APPLY_KEY) {
            if (!tool || await promptYesNoQuit(`Unlock it with ${lockToolName(tool, state)}?`) !== 'y')
                return false;
        }
        else {
            const verb = box.obroken ? 'fix its lock' : !box.olocked ? 'lock it'
                : tool?.otyp === LOCK_PICK ? 'pick its lock' : 'unlock it';
            observeObjectForNaming(box, { state });
            const description = await inventoryItemDescription(box);
            box.lknown = true;
            const answer = await promptYesNoQuit(`There is ${description} here; ${verb}?`);
            if (answer === 'q')
                return false;
            if (answer === 'n')
                continue;
        }
        if (box.obroken) {
            await plineWithContinuation(`You can't fix its broken lock with ${tool ? simpleObjectNameWithArticle(tool, state) : 'that'}.`);
            return true;
        }
        if (tool?.otyp === CREDIT_CARD && !box.olocked) {
            await plineWithContinuation(`You can't do that with a ${simpleObjectTypeName(tool.otyp, state)}.`);
            return true;
        }
        if (automatic && tool) {
            const touch = await touchArtifactByHero(tool, artifactById(tool.oartifact, state), { state });
            if (!touch.allowed || touch.died)
                return true;
        }
        startPicking(tool, { container: box }, state);
        return true;
    }
    if (!boxes.length)
        await plineWithContinuation("There doesn't seem to be any sort of lock here.");
    return true;
}
async function pickDoorLock(tool, x, y, automatic, state) {
    requirePlayingGame(state);
    if (state.u.utrap && state.u.utraptype === TT_PIT) {
        await plineWithContinuation("You can't reach over the edge of the pit.");
        return false;
    }
    const door = state.level.requireAt(x, y);
    const monster = monsterAtPosition(state.level, x, y);
    if (monster && canSeeMonster(monster) && M_AP_TYPE(monster) !== M_AP_FURNITURE && M_AP_TYPE(monster) !== M_AP_OBJECT) {
        await plineWithContinuation(tool?.otyp === CREDIT_CARD && (monster.isshk || monster.mnum === MONSTER_NAME.indexOf('Oracle'))
            ? '"No checks, no credit, no problem."'
            : `I don't think ${monsterName(monster)} would appreciate that.`);
        return true;
    }
    if (hasDoorAppearance(monster)) {
        await stumbleOntoMimic(monster, state);
        if (tool)
            await maybeAbsorbItem(monster, tool, state);
        return true;
    }
    if (door.typ !== DOOR) {
        const previousGlyph = glyphAt(x, y)?.glyph;
        recordMappedOverviewState();
        const previousTerrain = door.lastseentyp;
        await feel_location(x, y);
        const learned = glyphAt(x, y)?.glyph !== previousGlyph || door.lastseentyp !== previousTerrain;
        const portcullis = door.typ === DBWALL && findDrawbridgeAt(x, y, state) !== null;
        await plineWithContinuation(`You ${heroIsBlind(state) ? 'feel' : 'see'} no ${portcullis ? 'lock on the drawbridge' : 'door there'}.`);
        return learned;
    }
    if (door.doormask === D_NODOOR || door.doormask === D_ISOPEN || door.doormask === D_BROKEN) {
        await plineWithContinuation(door.doormask === D_NODOOR ? 'This doorway has no door.'
            : door.doormask === D_ISOPEN ? 'You cannot lock an open door.' : 'This door is broken.');
        return true;
    }
    if (autoUnlockFlags(state) & AUTOUNLOCK_UNTRAP && !untrapAbilityProblem(state)) {
        const answer = await promptYesNoQuit('Check this door for a trap?');
        if (answer === 'q')
            return false;
        if (answer === 'y') {
            await untrap({ state, door: { x, y } });
            return true;
        }
    }
    if (tool?.otyp === CREDIT_CARD && !(door.doormask & D_LOCKED)) {
        await plineWithContinuation("You can't lock a door with a credit card.");
        return true;
    }
    const action = door.doormask & D_LOCKED ? 'Unlock' : 'Lock';
    const answer = await promptYesNoQuit(`${action} it${automatic && tool ? ` with ${lockToolName(tool, state)}` : ''}?`);
    if (answer !== 'y' || !tool)
        return false;
    if (automatic) {
        const touch = await touchArtifactByHero(tool, artifactById(tool.oartifact, state), { state });
        if (!touch.allowed || touch.died)
            return true;
    }
    startPicking(tool, { door, x, y }, state);
    return true;
}
function startPicking(tool, target, state) {
    const attempt = {
        key: 'pick-lock', text: '', remaining: 51, usedtime: 0, tool,
        x: target.x ?? state.u.ux, y: target.y ?? state.u.uy,
        ...target, chance: lockPickChance(tool, target.container, state), magicKey: isHeroMagicKey(tool, state),
    };
    attempt.text = lockAction(attempt);
    state._lockAttempt = state._occupation = attempt;
}
export async function continuePicking(occupation, state = game) {
    requirePlayingGame(state);
    const box = occupation.container;
    const door = occupation.door;
    if (box) {
        if (box.where !== 'floor' || box.ox !== state.u.ux || box.oy !== state.u.uy) {
            occupation.usedtime = 0;
            state._occupation = null;
            return false;
        }
    }
    else if (door) {
        if (state.level.at(state.u.ux + (state.u.dx ?? 0), state.u.uy + (state.u.dy ?? 0)) !== door) {
            occupation.usedtime = 0;
            state._occupation = null;
            return false;
        }
        if (door.doormask === D_NODOOR || door.doormask === D_ISOPEN || door.doormask === D_BROKEN) {
            await plineWithContinuation(door.doormask === D_NODOOR ? 'This doorway has no door.'
                : door.doormask === D_ISOPEN ? 'You cannot lock an open door.' : 'This door is broken.');
            occupation.usedtime = 0;
            state._occupation = null;
            return false;
        }
    }
    else {
        // A declined #force drops the box target of an interrupted pick;
        // native picklock() then matches no door against the hero's
        // direction tile and silently stops.
        occupation.usedtime = 0;
        state._occupation = null;
        return false;
    }
    const usedtime = occupation.usedtime++;
    const action = lockAction(occupation);
    if (usedtime >= 50 || heroHasNoHands(state)) {
        await plineWithContinuation(`You give up your attempt at ${action}.`);
        await exerciseAttribute(A_DEX, true, state);
    }
    else if (rn2(100) >= occupation.chance)
        return true;
    else if ((box?.otrapped || door && door.doormask & D_TRAPPED) && occupation.magicKey) {
        occupation.chance += 20;
        if (box) {
            if (!box.tknown)
                await plineWithContinuation('You find a trap!');
            box.tknown = true;
        }
        if (await promptYesNo('Do you want to try to disarm it?') === 'y') {
            const locked = door ? !!(door.doormask & D_LOCKED) : !!box?.olocked;
            if (door)
                door.doormask &= ~D_TRAPPED;
            else if (box) {
                box.otrapped = false;
                box.tknown = false;
            }
            await plineWithContinuation(`You succeed in disarming the trap.  The ${door ? 'door' : box?.otyp === CHEST ? 'chest' : 'box'} is still ${locked ? '' : 'un'}locked.`);
            await exerciseAttribute(A_WIS, true, state);
        }
        else {
            await plineWithContinuation(`You stop ${action}.`);
            await exerciseAttribute(A_WIS, false, state);
        }
    }
    else {
        await plineWithContinuation(`You succeed in ${action}.`);
        if (door) {
            if (door.doormask & D_TRAPPED) {
                if (await triggerBoobyTrap('door', { bodypart: true, state }))
                    return false;
                door.doormask = D_NODOOR;
                vision_note_blocker_change(occupation.x, occupation.y);
                if (roomsAt(state.level, occupation.x, occupation.y, SHOPBASE).length)
                    addShopDamage(occupation.x, occupation.y, SHOP_DOOR_COST, state);
                await newsym(occupation.x, occupation.y);
            }
            else
                door.doormask = door.doormask & D_LOCKED ? D_CLOSED : D_LOCKED;
        }
        else if (box) {
            box.olocked = !box.olocked;
            box.lknown = true;
            if (box.otrapped) {
                const trap = await triggerChestTrap(box, { state, bodyPart: heroFingerName(state) });
                if (trap?.died)
                    return false;
            }
        }
        await exerciseAttribute(A_DEX, true, state);
    }
    occupation.usedtime = 0;
    state._occupation = null;
    return false;
}
function lockAction(attempt) {
    if (attempt.door && !(attempt.door.doormask & D_LOCKED))
        return 'locking the door';
    if (attempt.container && !attempt.container.olocked)
        return `locking the ${attempt.container.otyp === CHEST ? 'chest' : 'box'}`;
    if (attempt.tool?.otyp === LOCK_PICK || attempt.tool?.otyp === CREDIT_CARD)
        return 'picking the lock';
    if (attempt.door)
        return 'unlocking the door';
    if (attempt.container)
        return `unlocking the ${attempt.container.otyp === CHEST ? 'chest' : 'box'}`;
    // A target-less leftover resumes under the generic picking label.
    return 'picking the lock';
}
function lockPickChance(tool, box, state) {
    if (!tool)
        return 0;
    const dexterity = currentAttribute(A_DEX, state);
    const rogue = state.urole?.key === 'rogue';
    let chance;
    switch (tool.otyp) {
        case CREDIT_CARD:
            chance = (box ? dexterity : 2 * dexterity) + (rogue ? 20 : 0);
            break;
        case LOCK_PICK:
            chance = (box ? 4 : 3) * dexterity + (rogue ? (box ? 25 : 30) : 0);
            break;
        default:
            chance = (box ? 75 : 70) + dexterity;
            break;
    }
    if (box?.cursed)
        chance = Math.trunc(chance / 2);
    return chance;
}
// C lock.c:doorlock()/obstructed(). Traversal owns wand discovery, billable
// shop damage, drawbridge effects, and the decision to target a door.
const WAND_CLASS = 11;
export async function changeDoorByMagic(source, x, y, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const door = state.level.at(x, y);
    if (!door || ![DOOR, SDOOR].includes(door.typ))
        return false;
    const opening = [WAN_OPENING, SPE_KNOCK].includes(source.otyp);
    const locking = [WAN_LOCKING, SPE_WIZARD_LOCK].includes(source.otyp);
    const striking = [WAN_STRIKING, SPE_FORCE_BOLT].includes(source.otyp);
    if (door.typ === SDOOR) {
        if (!opening && !striking)
            return false;
        // Magic exposes a closed door; it does not preserve a secret lock.
        door.typ = DOOR;
        door.doormask = D_CLOSED | (door.doormask & D_TRAPPED);
        await newsym(x, y);
        if (cansee(x, y))
            await plineWithContinuation('A door appears in the wall!');
        if (opening)
            return true;
    }
    let changed = true, message = null, loudness = 0;
    if (locking) {
        const quietly = source.oclass === WAND_CLASS && !source.dknown;
        if (Is_rogue_level(state.u.uz)) {
            const visible = cansee(x, y);
            if (visible)
                await plineWithContinuation('A cloud of dust springs up in the older, more primitive doorway.');
            else
                await publishHeard('a swoosh.', state);
            if (await doorObstructed(x, y, quietly, state)) {
                if (visible)
                    await plineWithContinuation('The cloud quickly dissipates.');
                return false;
            }
            door.typ = SDOOR;
            door.doormask = D_NODOOR;
            vision_note_blocker_change(x, y);
            if (visible)
                await plineWithContinuation('The doorway vanishes!');
            await newsym(x, y);
            return true;
        }
        if (await doorObstructed(x, y, quietly, state))
            return false;
        if (state.level.traps.some(trap => trap.tx === x && trap.ty === y)) {
            await plineWithContinuation('A cloud of dust springs up in the doorway, but quickly dissipates.');
            return false;
        }
        switch (door.doormask & ~D_TRAPPED) {
            case D_CLOSED:
                message = 'The door locks!';
                break;
            case D_ISOPEN:
                message = 'The door swings shut, and locks!';
                break;
            case D_BROKEN:
                message = 'The broken door reassembles and locks!';
                break;
            case D_NODOOR:
                message = 'A cloud of dust springs up and assembles itself into a door!';
                break;
            default:
                changed = false;
                break;
        }
        door.doormask = D_LOCKED | (door.doormask & D_TRAPPED);
        vision_note_blocker_change(x, y);
        await newsym(x, y);
    }
    else if (opening) {
        if (door.doormask & D_LOCKED) {
            message = 'The door unlocks!';
            door.doormask = D_CLOSED | (door.doormask & D_TRAPPED);
        }
        else
            changed = false;
    }
    else if (striking) {
        if (!(door.doormask & (D_LOCKED | D_CLOSED)))
            changed = false;
        else if (door.doormask & D_TRAPPED) {
            const occupant = monsterAtPosition(state.level, x, y);
            const saw = occupant ? canSeeMonster(occupant) : cansee(x, y);
            door.doormask = D_NODOOR;
            vision_note_blocker_change(x, y);
            await newsym(x, y);
            const sees = occupant ? canSeeMonster(occupant) : cansee(x, y);
            if (occupant)
                await triggerMonsterDoorTrap(occupant, saw || sees, { state });
            else {
                loudness = 40;
                if (state.flags.verbose) {
                    if ((saw || sees) && !heroIsUnaware(state))
                        await plineWithContinuation('KABOOM!!  You see a door explode.');
                    else if (!heroIsDeaf(state)) {
                        const dx = x - state.u.ux, dy = y - state.u.uy;
                        await publishHeard(`a ${dx * dx + dy * dy > 49 ? 'distant' : 'nearby'} explosion.`, state);
                    }
                }
            }
        }
        else {
            const saw = cansee(x, y);
            door.doormask = D_BROKEN;
            vision_note_blocker_change(x, y);
            const sees = cansee(x, y);
            await newsym(x, y);
            if (state.flags.verbose) {
                if ((saw || sees) && !heroIsUnaware(state))
                    await plineWithContinuation('The door crashes open!');
                else if (!heroIsDeaf(state))
                    await publishHeard('a crashing sound.', state);
            }
            if (state.vision_full_recalc)
                await vision_recalc(0);
            loudness = 20;
        }
    }
    else
        await impossible(`magic (${source.otyp}) attempted on door.`);
    if (message && cansee(x, y))
        await plineWithContinuation(message);
    if (loudness) {
        await wakeMonstersNearWithMessages(x, y, loudness, state);
        if (roomsAt(state.level, x, y, SHOPBASE).length)
            addShopDamage(x, y, 0, state);
    }
    if (changed && state._occupation?.key === 'pick-lock' && state._occupation.door === door) {
        await stopHeroOccupation(state);
        resetPick(state);
    }
    return changed;
}
// C lock.c:obstructed().
export async function doorObstructed(x, y, quietly, state) {
    const occupant = monsterAtPosition(state.level, x, y);
    if (occupant && M_AP_TYPE(occupant) !== M_AP_FURNITURE) {
        if (M_AP_TYPE(occupant) === M_AP_OBJECT) {
            if (!quietly)
                await plineWithContinuation("Something's in the way.");
            return true;
        }
        if (!quietly) {
            let name = monsterName(occupant, { capitalized: true, augmentIt: true, state });
            if ((occupant.mx !== x || occupant.my !== y) && canSpotMonster(occupant))
                name = `${possessiveName(name)} tail`;
            await plineWithContinuation(`${name} blocks the way!`);
        }
        if (!canSpotMonster(occupant))
            await map_invisible(x, y);
        return true;
    }
    if (state.level.objects?.[x]?.[y]?.length) {
        if (!quietly)
            await plineWithContinuation("Something's in the way.");
        return true;
    }
    return false;
}
async function publishHeard(text, state) {
    const message = formatHeardMessage(text, state);
    if (message)
        await plineWithContinuation(message);
}
// C lock.c:stumble_on_door_mimic(): check the disguise itself, even when
// the hero senses the monster.
// lock.c checks the disguise itself, even when the hero senses the monster.
export async function stumbleOnDoorMimic(x, y, state = game) {
    if (!state.level || state.u.protectionFromShapeChangers || state.protectionFromShapeChangers)
        return false;
    const monster = monsterAtPosition(state.level, x, y);
    if (!hasDoorAppearance(monster))
        return false;
    await stumbleOntoMimic(monster, state);
    return true;
}
//# sourceMappingURL=lock.js.map