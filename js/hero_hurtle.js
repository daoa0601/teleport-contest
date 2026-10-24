import { trapName } from './trap_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
// Moving the hero through the air after a forceful action.
// C ref: dothrow.c hurtle() and hurtle_step().
import { formatFeltMessage } from './hero_speech.js';
import { nomul, setMulti } from './command_state.js';
import { heroHasWaterWalking } from './armor.js';
import { beginBallAndChainMove, finishBallAndChainMove, heroIsPunished, } from './ball.js';
import { D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, FIRE_TRAP, IRONBARS, IS_OBSTRUCTED, Is_waterlevel, KILLED_BY, MAGIC_PORTAL, TREE, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_WEB, Upolyd, VIBRATING_SQUARE, W_NONPASSWALL, is_hole, is_pit, isok, } from './const.js';
import { canSpotMonster, flush_screen, glyphAt, map_invisible, newsym, plineWithContinuation, } from './display.js';
import { heroTestMove } from './cmd.js';
import { game, requirePlayingGame } from './gstate.js';
import { blocksDiagonalDoor, heroBadRock, heroLiquidEffects, heroTightDiagonalReason, } from './hack.js';
import { triggerHeroTrap } from './hero_traps.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { angerMonster, wakeMonster } from './monster_anger.js';
import { monsterWearsTorsoArmor, petrifyMonsterFromContact, } from './monster_stoning.js';
import { MONSTER_BODY_META, MONSTER_FLAGS1, monsterTypeName, } from './monster_data.js';
import { BOULDER } from './object_data.js';
import { loseHeroHp } from './hero_damage.js';
import { placeHeroOnLevel } from './hero_location.js';
import { updateHeroRegions } from './regions.js';
import { monsterHasMapPosition } from './monster_location.js';
import { monsterName, monsterObjectPronoun } from './monster_name.js';
import { objectName } from './objnam.js';
import { rnd } from './rng.js';
import { checkSpecialRoom } from './shk.js';
import { resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { inventoryWeight } from './weight.js';
import { vision_recalc } from './vision.js';
import { switchHeroTerrain } from './terrain_movement.js';
import { walkPathCells } from './path_walk.js';
import { isLavaAt, isMoatAt, isPoolAt, isWaterwallAt } from './terrain_properties.js';
const M1_WALLWALK = 0x00000008;
const HUMAN_WEIGHT = 1450;
function heroForm() {
    requirePlayingGame(game);
    return Upolyd(game.u) ? game.u.umonnum : null;
}
function heroFormFlags() {
    const form = heroForm();
    return form === null ? 0 : MONSTER_FLAGS1[form] ?? 0;
}
function heroBodyWeight(state = game) {
    const form = Upolyd(state.u)
        ? state.u.umonnum
        : state.urace?.mnum;
    return form === undefined ? HUMAN_WEIGHT : MONSTER_BODY_META[form]?.[0] ?? HUMAN_WEIGHT;
}
export function kickRecoilRange(monsterMnum, state = game) {
    const targetWeight = MONSTER_BODY_META[monsterMnum]?.[0] ?? 0;
    const movingWeight = Math.max(1, heroBodyWeight(state) + inventoryWeight(state));
    return Math.max(1, Math.trunc(3 * targetWeight / movingWeight));
}
function floorBoulder(x, y) {
    return (game.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER) || null;
}
function monsterAt(x, y) {
    return game.level?.monsters?.find(monster => monsterHasMapPosition(monster) && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
function wallPassage(location) {
    const hasAbility = !!(game.u.passesWalls
        || (heroFormFlags() & M1_WALLWALK));
    return {
        hasAbility,
        mayPass: hasAbility
            && !((location.wall_info ?? 0) & W_NONPASSWALL),
    };
}
function obstacleReason(location, openDoorFrame) {
    if (location.typ === TREE)
        return 'bumping into a tree';
    if (openDoorFrame)
        return 'bumping into a door frame';
    if (location.typ === DOOR)
        return 'bumping into a closed door';
    return 'bumping into a wall';
}
// C dothrow.c:hurtle_step() losehp(..., why, KILLED_BY): "killed by bumping into a wall".
async function loseImpactHitPoints(amount, killer) {
    if (game.u.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    return loseHeroHp(amount, killer, { killerFormat: KILLED_BY });
}
function obstacleAt(x, y) {
    const hero = game.u;
    const location = game.level?.at?.(x, y);
    if (!location)
        return null;
    const diagonal = hero.ux !== x && hero.uy !== y;
    const closedDoor = location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const openDoorFrame = diagonal && location.typ === DOOR
        && !!((location.doormask ?? 0) & D_ISOPEN);
    const passage = wallPassage(location);
    if (!passage.hasAbility || !passage.mayPass) {
        if (IS_OBSTRUCTED(location.typ) || closedDoor || openDoorFrame) {
            return {
                message: openDoorFrame ? 'You hit the door frame!' : 'Ouch!',
                followup: openDoorFrame ? 'Ouch!' : null,
                reason: obstacleReason(location, openDoorFrame),
            };
        }
        if (location.typ === IRONBARS) {
            return {
                message: 'You crash into some iron bars.  Ouch!',
                reason: 'crashing into iron bars',
            };
        }
        const boulder = floorBoulder(x, y);
        if (boulder) {
            return {
                message: `You bump into a ${objectName(boulder)}.  Ouch!`,
                reason: 'bumping into a boulder',
            };
        }
        if (passage.hasAbility && !passage.mayPass) {
            return {
                message: 'You smack into something!',
                reason: 'touching the edge of the universe',
            };
        }
    }
    if ((!passage.hasAbility || !passage.mayPass) && diagonal
        && heroBadRock(game, hero.ux, y)
        && heroBadRock(game, x, hero.uy)) {
        const tight = heroTightDiagonalReason(game);
        if (tight === 1 || tight === 2) {
            return {
                message: tight === 2
                    ? 'You and all your belongings get forcefully wedged into a crevice.'
                    : 'You get forcefully wedged into a crevice.',
                reason: 'wedging into a narrow crevice',
            };
        }
    }
    return null;
}
// C test_move(TEST_MOVE), before a blow can start the hero hurtling.
export function canKnockHeroToward(dx, dy) {
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const x = ux + dx;
    const y = uy + dy;
    // A boulder passes this test ("assume you'll be able to push it"); the
    // hurtle itself then stops against it.
    return isok(x, y) && heroTestMove(x, y);
}
async function hitObstacle(obstacle, x, y, remaining) {
    await plineWithContinuation(obstacle.message);
    if (obstacle.followup)
        await plineWithContinuation(obstacle.followup);
    if (await loseImpactHitPoints(rnd(2 + remaining), obstacle.reason))
        return;
    await wakeMonstersNearWithMessages(x, y, 10);
}
function heroWearsTorsoArmor() {
    return !!(game.uarmu || game.uarm || game.uarmc
        || game.u?.uarmu || game.u?.uarm || game.u?.uarmc);
}
async function collideWithMonster(monster, x, y, options) {
    const glyph = glyphAt(x, y);
    monster.mundetected = 0;
    const name = monsterName(monster, { article: 'a', augmentIt: true });
    await plineWithContinuation(glyph?.kind === 'monster' || glyph?.kind === 'invisible'
        ? `You bump into ${name}.`
        : `You find ${name} by bumping into ${monsterObjectPronoun(monster, { noIt: true })}.`);
    await wakeMonster(monster);
    if (!canSpotMonster(monster))
        map_invisible(x, y);
    await angerMonster(monster);
    // C dothrow.c:hurtle_step() instapetrify()s an unarmored hero.
    if (touchPetrifies(monster.mnum) && !heroWearsTorsoArmor()) {
        const result = await resolveImmediatePetrification({
            killer: `bumping into ${withIndefiniteArticle(monsterTypeName(monster.mnum, !!monster.female))}`,
        });
        if (result.died)
            return;
    }
    const form = heroForm();
    if (form !== null && touchPetrifies(form) && !monsterWearsTorsoArmor(monster)) {
        await petrifyMonsterFromContact(monster, {
            creditHero: true,
            finishDeath: options.finishMonsterDeath ?? undefined,
        });
    }
    await wakeMonstersNearWithMessages(x, y, 10);
}
function anchoredMessage() {
    const type = game.u?.utraptype;
    if (type === TT_WEB)
        return 'You are anchored by the web.';
    if (type === TT_LAVA)
        return 'You are anchored by the lava.';
    if (type === TT_BURIEDBALL)
        return 'You are anchored by the buried ball.';
    if (type === TT_INFLOOR)
        return 'You are anchored by the ground.';
    return 'You are anchored by the trap.';
}
function stopHurtle() {
    nomul(0);
}
async function triggerLandingTrap(trap, options, remaining) {
    requirePlayingGame(game);
    if (!trap)
        return false;
    // Jump's final square is handled by teleds(), after the path walk.
    if (options.jumping && remaining.value < 2)
        return false;
    const before = {
        level: game.level, x: game.u.ux, y: game.u.uy,
    };
    const sokobanFall = game.level.flags.sokoban_rules
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp));
    if (trap.ttyp === VIBRATING_SQUARE)
        await plineWithContinuation('The ground vibrates as you pass it.');
    if ([VIBRATING_SQUARE, FIRE_TRAP, MAGIC_PORTAL].includes(trap.ttyp) || sokobanFall) {
        const result = sokobanFall && options.jumping
            ? { died: false } : await triggerHeroTrap(trap, options);
        if (result.died)
            return true;
        if (trap.ttyp === MAGIC_PORTAL)
            return true;
        if (sokobanFall) {
            remaining.value = 0;
            return !options.jumping;
        }
    }
    else if (trap.tseen) {
        await plineWithContinuation(`You pass right over ${withIndefiniteArticle(trapName(trap.ttyp))}.`);
    }
    return game.level !== before.level
        || game.u.ux !== before.x || game.u.uy !== before.y;
}
// drown() relocates a hero who crawls out or is rescued through teleds(),
// whose spoteffects() covers the room, trap, and look-here at the landing.
function hurtleTrapOptions(options) {
    const trapOptions = {};
    if (options.finishTeleport)
        trapOptions.finishTeleport = options.finishTeleport;
    if (options.gotoLevel)
        trapOptions.gotoLevel = options.gotoLevel;
    return trapOptions;
}
async function settleLiquid(options, remaining) {
    requirePlayingGame(game);
    const { ux: x, uy: y } = game.u;
    if (isLavaAt(x, y)) {
        if (!options.jumping || remaining.value >= 2)
            await plineWithContinuation('You move over some lava.', { noRepeat: true });
        return null;
    }
    if (!isPoolAt(x, y) || game.u.uinwater)
        return null;
    const staysAboveWater = game.u?.levitating || game.u?.levitation
        || game.u.flying
        || heroHasWaterWalking(game) || options.jumping;
    if (!isWaterwallAt(x, y) && staysAboveWater) {
        if (!Is_waterlevel(game.u?.uz)
            && (!options.jumping || remaining.value >= 2)) {
            await plineWithContinuation(`You move over ${isMoatAt(x, y) ? 'a moat' : 'a pool'}.`, { noRepeat: true });
        }
        return null;
    }
    setMulti(0);
    game._helplessReason = null;
    game._helplessDoneMessage = null;
    return heroLiquidEffects({
        chooseTeleportDestination: options.chooseTeleportDestination ?? null,
        applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y, newx: to.x, newy: to.y,
            pick, trapOptions: hurtleTrapOptions(options),
        }),
    });
}
async function moveOneSquare(x, y, options, remaining) {
    requirePlayingGame(game);
    if (!isok(x, y)) {
        await plineWithContinuation(formatFeltMessage('the spirits holding you back.'));
        return false;
    }
    updateHeroRegions(game, x, y);
    if (!remaining.value)
        return false;
    const obstacle = obstacleAt(x, y);
    if (obstacle) {
        await hitObstacle(obstacle, x, y, remaining.value);
        return false;
    }
    const monster = monsterAt(x, y);
    if (monster) {
        await collideWithMonster(monster, x, y, options);
        return false;
    }
    const hero = game.u;
    const diagonal = hero.ux !== x && hero.uy !== y;
    if (diagonal && game.level?.flags?.sokoban_rules
        && heroBadRock(game, hero.ux, y)
        && heroBadRock(game, x, hero.uy)) {
        await plineWithContinuation('You come to an abrupt halt!');
        return false;
    }
    const ballAndChain = await beginBallAndChainMove(x, y);
    if (ballAndChain?.blocked) {
        if (!options.jumping)
            return false;
    }
    if (ballAndChain && !ballAndChain.blocked)
        await finishBallAndChainMove(ballAndChain);
    const oldx = hero.ux;
    const oldy = hero.uy;
    await placeHeroOnLevel(x, y);
    newsym(oldx, oldy);
    vision_recalc(1);
    await flush_screen(1);
    const previousLocation = game.level.at(oldx, oldy);
    const currentLocation = game.level.at(x, y);
    if (!previousLocation || !currentLocation)
        throw new Error(`Hurtle moved between invalid map cells ${oldx},${oldy} and ${x},${y}`);
    if (options.jumping && previousLocation.typ !== currentLocation.typ)
        await switchHeroTerrain(game);
    await checkSpecialRoom();
    const liquid = await settleLiquid(options, remaining);
    if (liquid?.moved || liquid?.died)
        return false;
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    if (await triggerLandingTrap(trap, options, remaining))
        return false;
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value)
        await game.animationFrame?.();
    return true;
}
// C hurtle_jump() walks an irregular jump with the same collisions as hurtle.
// The caller owns trap escape, the final landing, and the one-turn delay.
export async function hurtleJumpTo(x, y, options = {}) {
    requirePlayingGame(game);
    const path = walkPathCells(game.u.ux, game.u.uy, x, y);
    const remaining = { value: path.length };
    let reached = { x: game.u.ux, y: game.u.uy };
    for (const point of path) {
        if (!await moveOneSquare(point.x, point.y, { ...options, jumping: true }, remaining))
            break;
        reached = point;
    }
    // walk_path() rolls its destination back to the preceding accepted
    // square on failure, even if a portal or liquid moved the actor.
    return reached;
}
export async function hurtleHero(dx, dy, range, { verbose = false, finishTeleport = null, gotoLevel = null, chooseTeleportDestination = null, finishMonsterDeath = null, } = {}) {
    requirePlayingGame(game);
    const ball = game.uball || game.u.uball;
    if (heroIsPunished()
        && (!ball || !game.inventory.includes(ball))) {
        await plineWithContinuation(formatFeltMessage('a tug from the iron ball.'));
        stopHurtle();
        return false;
    }
    if (game.u?.utrap) {
        await plineWithContinuation(anchoredMessage());
        stopHurtle();
        return false;
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    range = Math.max(0, Math.trunc(range));
    if (!range || (!dx && !dy) || game.u?.ustuck)
        return false;
    nomul(-range);
    game._helplessReason = 'moving through the air';
    game._helplessDoneMessage = '';
    if (verbose) {
        await plineWithContinuation(`You ${range > 1 ? 'hurtle' : 'float'} in the opposite direction.`);
    }
    const remaining = { value: range };
    const options = {
        finishTeleport, gotoLevel, chooseTeleportDestination,
        finishMonsterDeath,
    };
    while (remaining.value) {
        const x = game.u.ux + dx;
        const y = game.u.uy + dy;
        if (!await moveOneSquare(x, y, options, remaining))
            break;
    }
    return true;
}
//# sourceMappingURL=hero_hurtle.js.map