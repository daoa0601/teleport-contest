// Moving the hero through the air after a forceful action.
// C ref: dothrow.c hurtle() and hurtle_step().

import { heroHasWaterWalking } from './armor.js';
import {
    beginBallAndChainMove, finishBallAndChainMove, heroIsPunished,
} from './ball.js';
import {
    D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, FIRE_TRAP, IRONBARS,
    IS_LAVA, IS_OBSTRUCTED, IS_POOL, IS_WATERWALL, Is_waterlevel,
    MAGIC_PORTAL, MOAT, TREE, TRAP_EXPLANATIONS,
    TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_WEB, Upolyd,
    VIBRATING_SQUARE, W_NONPASSWALL,
    is_hole, is_pit, isok,
} from './const.js';
import {
    canSpotMonster, flush_screen, map_invisible, newsym,
    plineWithContinuation,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import {
    heroBadRock, heroLiquidEffects, heroTightDiagonalReason,
} from './hack.js';
import { triggerHeroTrap } from './hero_traps.js';
import { igniteItems } from './light.js';
import { wakeMonstersNear } from './monster_wake.js';
import { angerMonster, wakeMonster } from './monster_anger.js';
import {
    monsterWearsTorsoArmor, petrifyMonsterFromContact,
} from './monster_stoning.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, monsterTypeName,
} from './monster_data.js';
import { BOULDER } from './object_data.js';
import { loseHeroHp } from './hero_damage.js';
import { rnd } from './rng.js';
import { stopRun } from './runmode.js';
import { checkSpecialRoom } from './shk.js';
import { touchPetrifies } from './stoning.js';
import { inventoryWeight } from './weight.js';
import { destroyFireInventory } from './zap.js';
import { vision_recalc } from './vision.js';

const M1_WALLWALK = 0x00000008;
const HUMAN_WEIGHT = 1450;

function heroForm() {
    return Upolyd(game.u) ? game.u.umonnum : null;
}

function heroFormFlags() {
    return MONSTER_FLAGS1[heroForm()] ?? 0;
}

function heroBodyWeight(state = game) {
    const form = Upolyd(state.u)
        ? state.u.umonnum
        : state.urace?.malenum ?? state.urace?.mnum;
    return MONSTER_BODY_META[form]?.[0] ?? HUMAN_WEIGHT;
}

export function kickRecoilRange(monsterMnum, state = game) {
    const targetWeight = MONSTER_BODY_META[monsterMnum]?.[0] ?? 0;
    const movingWeight = Math.max(
        1, heroBodyWeight(state) + inventoryWeight(state),
    );
    return Math.max(1, Math.trunc(3 * targetWeight / movingWeight));
}

function floorBoulder(x, y) {
    return (game.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER) || null;
}

function monsterAt(x, y) {
    return game.level?.monsters?.find(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function wallPassage(location) {
    const hasAbility = !!(game.u?.passesWalls || game.u?.passes_walls
        || (heroFormFlags() & M1_WALLWALK));
    return {
        hasAbility,
        mayPass: hasAbility
            && !((location.wall_info ?? 0) & W_NONPASSWALL),
    };
}

function obstacleReason(location, openDoorFrame) {
    if (location.typ === TREE) return 'bumping into a tree';
    if (openDoorFrame) return 'bumping into a door frame';
    if (location.typ === DOOR) return 'bumping into a closed door';
    return 'bumping into a wall';
}

async function loseImpactHitPoints(amount, killer) {
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        amount = Math.trunc((amount + 1) / 2);
    return loseHeroHp(amount, killer);
}

function obstacleAt(x, y) {
    const hero = game.u;
    const location = game.level?.at?.(x, y);
    if (!location) return null;
    const diagonal = hero.ux !== x && hero.uy !== y;
    const closedDoor = location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const openDoorFrame = diagonal && location.typ === DOOR
        && ((location.doormask ?? 0) & D_ISOPEN);

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
        if (floorBoulder(x, y)) {
            return {
                message: 'You bump into a boulder.  Ouch!',
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

    if (diagonal
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

async function hitObstacle(obstacle, x, y, remaining) {
    await plineWithContinuation(obstacle.message);
    if (obstacle.followup)
        await plineWithContinuation(obstacle.followup);
    await loseImpactHitPoints(rnd(2 + remaining), obstacle.reason);
    wakeMonstersNear(x, y, 10);
}

function monsterName(monster) {
    return monster.name || monsterTypeName(monster.mnum, !!monster.female);
}

function indefiniteName(name) {
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function indefiniteMonsterName(monster) {
    if (monster.name) return monster.name;
    return indefiniteName(monsterName(monster));
}

function heroWearsTorsoArmor() {
    return !!(game.uarmu || game.uarm || game.uarmc
        || game.u?.uarmu || game.u?.uarm || game.u?.uarmc);
}

async function collideWithMonster(monster, x, y, options) {
    monster.mundetected = 0;
    const spotted = canSpotMonster(monster, x, y);
    await plineWithContinuation(spotted
        ? `You bump into ${indefiniteMonsterName(monster)}.`
        : 'You find something by bumping into it.');
    await wakeMonster(monster);
    if (!canSpotMonster(monster, x, y)) map_invisible(x, y);
    await angerMonster(monster);

    if (touchPetrifies(monster.mnum) && !heroWearsTorsoArmor()
        && !(game.u?.stoneResistance || game.u?.stone_resistance)) {
        await plineWithContinuation('You turn to stone...');
        const died = await finishHeroDeath({
            killer: `bumping into ${indefiniteName(monsterTypeName(
                monster.mnum, !!monster.female,
            ))}`,
            deathVerb: 'turned to stone',
            deathLineShown: true,
        });
        if (died) {
            wakeMonstersNear(x, y, 10);
            return;
        }
    }
    if (touchPetrifies(heroForm()) && !monsterWearsTorsoArmor(monster)) {
        await petrifyMonsterFromContact(monster, {
            creditHero: true,
            finishDeath: options.finishMonsterDeath,
        });
    }
    wakeMonstersNear(x, y, 10);
}

function anchoredMessage() {
    const type = game.u?.utraptype;
    if (type === TT_WEB) return 'You are anchored by the web.';
    if (type === TT_LAVA) return 'You are anchored by the lava.';
    if (type === TT_BURIEDBALL)
        return 'You are anchored by the buried ball.';
    if (type === TT_INFLOOR)
        return 'You are anchored by the ground.';
    return 'You are anchored by the trap.';
}

function stopHurtle() {
    stopRun();
    game._helplessTurns = 0;
    game._helplessReason = null;
    game._helplessDoneMessage = null;
}

async function triggerLandingTrap(trap, options, remaining) {
    if (!trap) return false;
    const before = {
        level: game.level, x: game.u.ux, y: game.u.uy,
    };
    if (trap.ttyp === VIBRATING_SQUARE) {
        await plineWithContinuation('The ground vibrates as you pass it.');
        await triggerHeroTrap(trap, options);
    } else if (trap.ttyp === FIRE_TRAP || trap.ttyp === MAGIC_PORTAL) {
        await triggerHeroTrap(trap, options);
    } else if (game.level?.flags?.sokoban_rules
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) {
        await triggerHeroTrap(trap, options);
        remaining.value = 0;
        return true;
    } else if (trap.tseen) {
        const name = TRAP_EXPLANATIONS[trap.ttyp] || 'trap';
        const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
        await plineWithContinuation(`You pass right over ${article} ${name}.`);
    }
    return game.level !== before.level
        || game.u.ux !== before.x || game.u.uy !== before.y;
}

async function applyForcedLandingEffects(options) {
    await checkSpecialRoom();
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === game.u.ux && candidate.ty === game.u.uy);
    if (trap) await triggerHeroTrap(trap, options);
}

async function settleLiquid(options) {
    const location = game.level?.at?.(game.u.ux, game.u.uy);
    if (!location) return null;
    if (IS_LAVA(location.typ)) {
        await plineWithContinuation('You move over some lava.');
        return null;
    }
    if (!IS_POOL(location.typ) || game.u?.uinwater) return null;

    const staysAboveWater = game.u?.levitating || game.u?.levitation
        || game.u?.flying || game.u?.flight
        || heroHasWaterWalking(game);
    if (!IS_WATERWALL(location.typ) && staysAboveWater) {
        if (!Is_waterlevel(game.u?.uz)) {
            await plineWithContinuation(
                `You move over ${location.typ === MOAT ? 'a moat' : 'a pool'}.`,
            );
        }
        return null;
    }

    game._helplessTurns = 0;
    game._helplessReason = null;
    game._helplessDoneMessage = null;
    return heroLiquidEffects({
        chooseTeleportDestination: options.chooseTeleportDestination,
        applyLandingEffects: () => applyForcedLandingEffects(options),
        burnInventory: damage => destroyFireInventory(damage, {
            state: game,
            publish: plineWithContinuation,
        }),
        igniteInventory: () => igniteItems(game.inventory, {
            state: game,
            publish: plineWithContinuation,
        }),
    });
}

async function moveOneSquare(x, y, options, remaining) {
    if (!isok(x, y)) {
        await plineWithContinuation('You feel the spirits holding you back.');
        return false;
    }
    if (!remaining.value) return false;

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

    const ballAndChain = beginBallAndChainMove(x, y);
    if (ballAndChain?.blocked) {
        await plineWithContinuation(ballAndChain.blockedMessage);
        return false;
    }
    if (ballAndChain) ballAndChain.causeDelay = false;

    const oldx = hero.ux;
    const oldy = hero.uy;
    hero.ux0 = oldx;
    hero.uy0 = oldy;
    hero.ux = x;
    hero.uy = y;
    hero.umoved = true;
    if (hero.usteed) {
        hero.usteed.mx = x;
        hero.usteed.my = y;
    }
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(x, y);
    if (ballAndChain) finishBallAndChainMove(ballAndChain);
    await flush_screen(1);
    await checkSpecialRoom();

    const liquid = await settleLiquid(options);
    if (liquid?.moved || liquid?.died) return false;

    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (await triggerLandingTrap(trap, options, remaining)) return false;

    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value) await game.animationFrame?.();
    return true;
}

export async function hurtleHero(dx, dy, range, {
    verbose = false,
    finishTeleport = null,
    gotoLevel = null,
    chooseTeleportDestination = null,
    finishMonsterDeath = null,
} = {}) {
    if (heroIsPunished()
        && !game.inventory?.includes(game.uball || game.u?.uball)) {
        await plineWithContinuation('You feel a tug from the iron ball.');
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
    if (!range || (!dx && !dy) || game.u?.ustuck) return false;

    stopRun();
    game._helplessTurns = range;
    game._helplessReason = 'moving through the air';
    game._helplessDoneMessage = '';
    if (verbose) {
        await plineWithContinuation(
            `You ${range > 1 ? 'hurtle' : 'float'} in the opposite direction.`,
        );
    }

    const remaining = { value: range };
    const options = {
        finishTeleport, gotoLevel, chooseTeleportDestination,
        finishMonsterDeath,
    };
    while (remaining.value) {
        const x = game.u.ux + dx;
        const y = game.u.uy + dy;
        if (!await moveOneSquare(x, y, options, remaining)) break;
    }
    return true;
}
