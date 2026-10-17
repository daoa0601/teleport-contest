// Hero boulder pushes. C hack.c:moverock(), moverock_core(), and dopush().
import { exerciseAttribute } from './attrib.js';
import { dropBoulderIntoLiquid } from './boulder_pool.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { A_STR, DOOR, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, HOLE, IRONBARS, IS_OBSTRUCTED, Is_airlevel, Is_rogue_level, LANDMINE, LEVEL_TELEP, MIGR_RANDOM, P_BASIC, P_RIDING, ROLLING_BOULDER_TRAP, SHOPBASE, STONE, TELEP_TRAP, TRAPDOOR, WT_SQUEEZABLE_INV, W_NONDIGGABLE, is_pit, isok, } from './const.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { isRider } from './corpse_species.js';
import { canSpotMonster, feel_location, glyphAt, map_invisible, map_object, newsym, plineWithContinuation, unmap_invisible, } from './display.js';
import { levelAtDepth } from './dungeon.js';
import { useUpFloorObject } from './floor_consumption.js';
import { applyFloorEffects } from './floor_effects.js';
import { moveObject, placeObject, remove_object } from './floor_object.js';
import { game, requirePlayingGame } from './gstate.js';
import { depth } from './hacklib.js';
import { heroLocomotion } from './hero_locomotion.js';
import { heroPassesWalls, heroSpecies } from './hero_species.js';
import { publishHeardMessage } from './hero_speech.js';
import { explodeLandMine } from './landmine_explosion.js';
import { randomTeleportDepth } from './level_teleport.js';
import { MONSTER_FLAGS2, MONSTER_NAME, monsterIsNoncorporeal } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { BOULDER, CORPSE } from './object_data.js';
import { disturbBuriedZombies } from './object_impact.js';
import { relocateObjectRandomly } from './object_teleport.js';
import { objectCombatName, objectNameIsPlural } from './objnam.js';
import { autopickupAllows } from './pickup.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { heroIsVerySmall } from './polyself.js';
import { sokobanGuilt } from './rock_breakage.js';
import { launchRollingBoulder } from './rolling_boulder.js';
import { roomsAt } from './room.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { addShopObjectToBill, billForObject, costlySpot, removeObjectAndContentsFromBill, shopResident, } from './shk.js';
import { findObjectOwner, stolenValue } from './shop_loss.js';
import { relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition, goodPosition } from './teleport_rules.js';
import { surfaceName } from './terrain_name.js';
import { feelTrap, seeTrap } from './trap.js';
import { deleteTrap } from './trap_lifecycle.js';
import { cansee, vision_recalc } from './vision.js';
import { invWeight } from './weight.js';
const M2_ROCKTHROW = 0x08000000;
export async function pushBouldersAt(sx, sy, dx, dy) {
    requirePlayingGame(game);
    try {
        return await pushBoulders(sx, sy, dx, dy);
    }
    finally {
        // next_boulder aliases corpsenm in C and only changes push prose.
        for (const object of game.level.objects[sx]?.[sy] ?? [])
            if (object.otyp === BOULDER)
                object.corpsenm = 0;
    }
}
async function pushBoulders(sx, sy, dx, dy) {
    requirePlayingGame(game);
    const level = game.level;
    const rx = sx + dx, ry = sy + dy;
    let first = true;
    for (let boulder = boulderAt(sx, sy); boulder; boulder = boulderAt(sx, sy)) {
        const glyph = glyphAt(sx, sy);
        if (heroIsBlind(game) && !(glyph?.kind === 'object' && glyph.otyp === BOULDER)) {
            await plineWithContinuation('That feels like a boulder.');
            map_object(boulder, true);
            endVoluntaryMultiTurn(game);
            return false;
        }
        boulder.corpsenm = first ? 0 : 1;
        first = false;
        if (level.objects[sx]?.[sy]?.[0] !== boulder)
            await moveObject(boulder, sx, sy);
        endVoluntaryMultiTurn(game);
        if (game.context.nopick)
            return stepOntoBoulder(sx, sy);
        if (game.u.levitating || Is_airlevel(game.u.uz)) {
            if (heroIsBlind(game))
                feel_location(sx, sy);
            await plineWithContinuation(`You don't have enough leverage to push the ${objectCombatName(boulder)}.`);
            return false;
        }
        if (heroIsVerySmall(game) && !game.u.usteed) {
            if (heroIsBlind(game))
                feel_location(sx, sy);
            await plineWithContinuation(`You're too small to push that ${objectCombatName(boulder)}.`);
            return cannotPush(boulder, sx, sy);
        }
        const target = level.at(rx, ry);
        const diagonalDoor = dx && dy && target?.typ === DOOR
            && (Is_rogue_level(game.u.uz) || !!(target.doormask & ~(D_NODOOR | D_BROKEN)));
        if (!isok(rx, ry) || !target || IS_OBSTRUCTED(target.typ)
            || target.typ === IRONBARS || diagonalDoor || boulderAt(rx, ry)) {
            await cannotPushMessage(boulder, sx, sy);
            return cannotPush(boulder, sx, sy);
        }
        const trap = level.traps.find(candidate => candidate.tx === rx && candidate.ty === ry);
        const monster = monsterAtPosition(level, rx, ry);
        const costly = !!costlySpot(sx, sy)
            && !!shopResident(roomsAt(level, sx, sy, SHOPBASE)[0]);
        if (level.flags.sokoban_rules && dx && dy) {
            if (heroIsBlind(game))
                feel_location(sx, sy);
            await plineWithContinuation(`The ${objectCombatName(boulder)} won't roll diagonally on this ${surfaceName(sx, sy)}.`);
            return cannotPush(boulder, sx, sy);
        }
        if (await reviveNasty(rx, ry))
            return false;
        if (monster && !monsterIsNoncorporeal(monster)
            && (!monster.mtrapped || !trap || !is_pit(trap.ttyp))) {
            await monsterBlocksBoulder(boulder, monster, sx, sy, rx, ry);
            return cannotPush(boulder, sx, sy);
        }
        if (target.typ === DOOR && target.doormask & (D_CLOSED | D_LOCKED)) {
            await cannotPushMessage(boulder, sx, sy);
            return cannotPush(boulder, sx, sy);
        }
        disturbBuriedZombies(sx, sy);
        const trapEffect = trap
            ? await pushIntoTrap(boulder, trap, sx, sy, rx, ry, dx, dy, costly) : 'ignored';
        if (game.program_state.gameover)
            return false;
        if (trapEffect === 'handled')
            return !boulderAt(sx, sy);
        if (trapEffect === 'push') {
            await moveBoulder(boulder, sx, sy, rx, ry, costly);
            continue;
        }
        const sank = await dropBoulderIntoLiquid(boulder, rx, ry, game, { pushing: true });
        if (game.program_state.gameover)
            return false;
        if (sank)
            continue;
        // Native relinks to the head of fobj before dopush().
        if (level.objects.some(column => column?.some(pile => pile?.some(object => (object._fobjOrder ?? 0) > (boulder._fobjOrder ?? 0))))) {
            remove_object(boulder);
            await placeObject(boulder, sx, sy);
        }
        await moveBoulder(boulder, sx, sy, rx, ry, costly);
    }
    return true;
}
export function heroCouldMoveOntoBoulder(sx, sy, state = game) {
    if (heroPassesWalls(state))
        return true;
    if (state.u.usteed)
        return false;
    if (heroThrowsRocks(state)) {
        return !state.u.dx || !state.u.dy
            || !(IS_OBSTRUCTED(state.level?.at(state.u.ux, sy)?.typ ?? STONE)
                && IS_OBSTRUCTED(state.level?.at(sx, state.u.uy)?.typ ?? STONE));
    }
    return heroIsVerySmall(state) || !state.inventory.length || invWeight(state) <= -WT_SQUEEZABLE_INV;
}
function boulderAt(x, y) {
    return game.level?.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
}
function heroThrowsRocks(state = game) {
    return !!((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & M2_ROCKTHROW);
}
async function stepOntoBoulder(x, y) {
    const old = glyphAt(x, y);
    feel_location(x, y);
    if (heroThrowsRocks()) {
        await plineWithContinuation(`You ${heroLocomotion('step')} over a boulder here.`);
    }
    else if (heroCouldMoveOntoBoulder(x, y)) {
        await plineWithContinuation(`You squeeze yourself ${game.u.flying ? 'over' : 'against'} the boulder.`);
    }
    else {
        await plineWithContinuation('There is a boulder in your way.');
        if (glyphAt(x, y)?.glyph !== old?.glyph)
            game.context.move = 1;
        return false;
    }
    sokobanGuilt(game);
    return true;
}
async function cannotPushMessage(boulder, x, y) {
    const what = `the ${objectCombatName(boulder)}`;
    const steed = game.u.usteed;
    await plineWithContinuation(steed
        ? `${monsterName(steed, { article: 'your', capitalized: true })} tries to move ${what}, but cannot.`
        : `You try to move ${what}, but in vain.`);
    if (heroIsBlind(game))
        feel_location(x, y);
}
async function cannotPush(boulder, x, y) {
    if (heroThrowsRocks()) {
        const canPickup = !game.level?.flags.sokoban_rules
            && (game.inventory.filter(object => object.oclass !== 12).length < 52
                || !game.inventory.some(object => object.otyp === BOULDER));
        const willPickup = canPickup && game.flags.pickup && !game.context.nopick && autopickupAllows(boulder);
        const steed = game.u.usteed;
        if (steed && (game.u.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
            await plineWithContinuation(`You aren't skilled enough to ${willPickup ? 'pick up' : 'push aside'} the ${objectCombatName(boulder)} from ${monsterName(steed, { article: 'your' })}.`);
        }
        else {
            await plineWithContinuation(`However, you ${willPickup ? 'easily pick it up' : 'maneuver over it'}${canPickup && !willPickup ? ' and could pick it up' : ''}.`);
            sokobanGuilt(game);
        }
        return true;
    }
    if (!heroCouldMoveOntoBoulder(x, y))
        return false;
    await plineWithContinuation('However, you can squeeze yourself into a small opening.');
    sokobanGuilt(game);
    return true;
}
async function monsterBlocksBoulder(boulder, monster, sx, sy, rx, ry) {
    if (heroIsBlind(game))
        feel_location(sx, sy);
    let heardOrSeen = false;
    if (canSpotMonster(monster)) {
        await plineWithContinuation(`There's ${monsterName(monster, { article: 'a' })} on the other side.`);
        heardOrSeen = true;
    }
    else {
        await publishHeardMessage(`a monster behind the ${objectCombatName(boulder)}.`, plineWithContinuation);
        heardOrSeen = !heroIsDeaf(game);
        map_invisible(rx, ry);
    }
    if (game.flags.verbose !== false) {
        const who = game.u.usteed ? monsterName(game.u.usteed, { article: 'your' }) : 'you';
        const subject = heardOrSeen ? `Perhaps that's why ${who}` : who.charAt(0).toUpperCase() + who.slice(1);
        await plineWithContinuation(`${subject} cannot move ${heardOrSeen ? 'it' : `the ${objectCombatName(boulder)}`}.`);
    }
}
async function pushIntoTrap(boulder, trap, sx, sy, rx, ry, dx, dy, costly) {
    requirePlayingGame(game);
    if (trap.ttyp === LANDMINE && rn2(10)) {
        remove_object(boulder);
        await placeObject(boulder, rx, ry);
        newsym(sx, sy);
        const bang = !heroIsDeaf(game) || !heroIsBlind(game) ? 'KAABLAMM!!' : 'Gadzooks';
        await plineWithContinuation(`${bang}!  The ${objectCombatName(boulder)} ${objectNameIsPlural(boulder) ? 'trigger' : 'triggers'} ${trap.madeby_u ? 'your' : 'a'} land mine.`);
        await explodeLandMine(trap, game, { seeSquare: cansee(rx, ry), heroCaused: true });
        if (game.program_state.gameover)
            return 'handled';
        await fillPitWithBoulderAt(game.u.ux, game.u.uy);
        if (cansee(rx, ry))
            newsym(rx, ry);
        return 'handled';
    }
    if (is_pit(trap.ttyp)) {
        remove_object(boulder);
        // Removing a boulder queues a full vision update in this port.
        // Finish that update before native's temporary IN_SIGHT override.
        if (!heroIsBlind(game) && game.vision_full_recalc)
            vision_recalc(0);
        const row = game.viz_array?.[ry];
        if (!heroIsBlind(game) && row)
            row[rx] = (row[rx] ?? 0) | 2;
        const result = await applyFloorEffects(boulder, rx, ry, { verb: 'fall' });
        if (game.program_state.gameover)
            return 'handled';
        if (!result.finished)
            await placeObject(boulder, rx, ry);
        if (monsterAtPosition(game.level, rx, ry) && !heroIsBlind(game))
            newsym(rx, ry);
        return 'handled';
    }
    if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
        const what = objectCombatName(boulder);
        const plural = objectNameIsPlural(boulder);
        const trapDoor = trap.ttyp === TRAPDOOR;
        const action = trapDoor ? 'trigger' : 'fall';
        const verb = plural ? action : `${action}s`;
        const motion = trapDoor ? verb : `${verb} into`;
        await plineWithContinuation(heroIsBlind(game)
            ? `Kerplunk!  You no longer feel the ${what}.`
            : `The ${what} ${motion} and ${plural ? 'plug' : 'plugs'} a ${trapDoor ? 'trap door' : 'hole'} in the ${surfaceName(rx, ry)}!`);
        deleteTrap(trap);
        await useUpFloorObject(boulder, 1);
        await buryFloorObjectsAt(rx, ry);
        const location = game.level.requireAt(rx, ry);
        location.wall_info &= ~W_NONDIGGABLE;
        location.candig = 1;
        if (cansee(rx, ry))
            newsym(rx, ry);
        return 'handled';
    }
    if (trap.ttyp === TELEP_TRAP || trap.ttyp === LEVEL_TELEP) {
        const newDepth = trap.ttyp === LEVEL_TELEP ? randomTeleportDepth(game) : null;
        if (newDepth === depth(game.u.uz, game.dungeons))
            return 'push';
        const who = game.u.usteed
            ? monsterName(game.u.usteed, { article: 'your', capitalized: true }) : 'You';
        await plineWithContinuation(`${who} ${game.u.usteed ? 'pushes' : 'push'} the ${objectCombatName(boulder)} and suddenly it disappears!`);
        boulder.corpsenm = 0;
        if (newDepth === null)
            await relocateObjectRandomly(boulder);
        else {
            if (costly)
                await stolenValue(boulder, rx, ry, !trap.tseen, { silent: false });
            remove_object(boulder);
            const destination = levelAtDepth(newDepth);
            boulder.no_charge = false;
            boulder.where = 'migrating';
            boulder.ox = destination.dnum;
            boulder.oy = destination.dlevel;
            boulder.owornmask = MIGR_RANDOM;
            boulder.migration = { source: { ...game.u.uz }, destination, arrival: MIGR_RANDOM };
            (game.migratingObjects ??= []).unshift(boulder);
        }
        if (game.program_state.gameover)
            return 'handled';
        seeTrap(trap);
        return 'handled';
    }
    if (trap.ttyp === ROLLING_BOULDER_TRAP) {
        let x = rx, y = ry;
        while (isok(x + dx, y + dy)) {
            x += dx;
            y += dy;
            if (x === trap.launch.x && y === trap.launch.y
                || x === trap.launch2?.x && y === trap.launch2.y)
                break;
        }
        await plineWithContinuation(`The ${objectCombatName(boulder)} suddenly ${objectNameIsPlural(boulder) ? 'roll' : 'rolls'} away from you!`);
        feelTrap(trap);
        await launchRollingBoulder({ x: sx, y: sy }, { x, y }, { known: true, state: game });
        return 'handled';
    }
    return 'ignored';
}
async function moveBoulder(boulder, sx, sy, rx, ry, costly) {
    requirePlayingGame(game);
    const moves = game.moves;
    const previous = game._lastPushedBoulder === boulder ? game._lastBoulderPushMove : moves + 1;
    const giveMessage = previous === undefined || moves > previous + 2 || moves < previous;
    if (game.u.usteed) {
        if (giveMessage)
            await plineWithContinuation(`${monsterName(game.u.usteed, { article: 'your', capitalized: true })} moves the ${objectCombatName(boulder)}.`);
    }
    else {
        const easy = heroThrowsRocks();
        if (giveMessage)
            await plineWithContinuation(`With ${easy ? 'little' : 'great'} effort you move the ${objectCombatName(boulder)}.`);
        if (!easy)
            await exerciseAttribute(A_STR, true);
    }
    game._lastPushedBoulder = boulder;
    game._lastBoulderPushMove = moves;
    unmap_invisible(rx, ry, false);
    boulder.corpsenm = 0;
    await moveObject(boulder, rx, ry);
    if (heroIsBlind(game)) {
        feel_location(rx, ry);
        feel_location(sx, sy);
    }
    else
        newsym(sx, sy);
    if (costly && !costlySpot(rx, ry)) {
        await addShopObjectToBill(boulder, game, { ininv: false });
        return;
    }
    if (!costly && costlySpot(rx, ry) && boulder.unpaid) {
        const keeper = shopResident(roomsAt(game.level, rx, ry, SHOPBASE)[0]);
        if (keeper && billForObject(boulder, game, keeper)) {
            removeObjectAndContentsFromBill(boulder, game, { resident: keeper });
            return;
        }
    }
    if (boulder.unpaid) {
        const owner = findObjectOwner(boulder, sx, sy, game);
        if (owner && !roomsAt(game.level, rx, ry, SHOPBASE).includes(owner.eshk.shoproom))
            await stolenValue(boulder, sx, sy, true, { silent: false });
    }
}
async function reviveNasty(x, y) {
    requirePlayingGame(game);
    let revived = false;
    for (const corpse of [...game.level.objects[x]?.[y] ?? []]) {
        if (corpse.otyp !== CORPSE
            || !(isRider(corpse.corpsenm) || MONSTER_NAME[corpse.corpsenm ?? -1] === 'Wizard of Yendor'))
            continue;
        const occupant = monsterAtPosition(game.level, x, y);
        if (occupant)
            await moveRevivalOccupant(occupant, x, y);
        await plineWithContinuation('You sense movement on the other side.', { noRepeat: true });
        const revival = await reviveCorpseImmediately(corpse);
        if (revival)
            for (const message of revival.messages)
                await plineWithContinuation(message);
        revived = revival?.kind === 'revived';
    }
    const monster = revived ? monsterAtPosition(game.level, x, y) : null;
    if (monster && !goodPosition(x, y, { kind: 'monster', monster }))
        await moveRevivalOccupant(monster, x, y);
    return revived;
}
async function moveRevivalOccupant(monster, x, y) {
    const position = findNearbyMonsterPosition(monster.mnum, x, y);
    if (position)
        await relocateMonsterTo(monster, position.x, position.y);
}
//# sourceMappingURL=boulder_push.js.map