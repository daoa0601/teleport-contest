import { seeTrap } from './trap.js';
// C dig.c:use_pick_axe()/use_pick_axe2(). Digging effort lives in hero_digging.

import { monsterHasMapPosition } from './monster_location.js';
import { heroIsHallucinating } from './senses.js';
import { nomul } from './command_state.js';
import { artifactById } from './artifacts.js';
import { makeMonsterFlee } from './monster_flee.js';
import { heroIsPunished } from './ball.js';
import {
    BEAR_TRAP,
    DIGTYP_UNDIGGABLE,
    IRONBARS,
    IS_OBSTRUCTED,
    IS_TREE,
    IS_WATERWALL,
    Is_airlevel,
    Is_waterlevel,
    KILLED_BY,
    LANDMINE,
    LAVAWALL,
    SHOPBASE,
    TT_PIT,
    TT_WEB,
    WEB,
    is_hole,
    is_pit,
    isok,
    xdir,
    ydir,
} from './const.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { wipeHeroEngraving } from './engrave.js';
import { fireDamageObject } from './fire_damage.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requireGameLevel } from './gstate.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { loseHeroHp } from './hero_damage.js';
import { diggingTarget, startHeroDigging } from './hero_digging.js';
import { triggerHeroTrap } from './hero_traps.js';
import { gotoLevel } from './level_change.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_MOVE, monsterTypeName } from './monster_data.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { BOULDER, OBJECT_NAMES, STATUE } from './object_data.js';
import { ownedObjectAction, ownedObjectName } from './objnam.js';
import { roomsAt, roomForRoomno } from './room.js';
import { d, rn2, rnd } from './rng.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { confusePromptDirection } from './tty_prompts.js';
import { heroStrengthDamageBonus } from './weapon_damage.js';
import { isPick } from './weapon_type.js';
import { connectPits } from './pit_connections.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import { monsterName } from './monster_name.js';

export interface PickAxeDirection {
    dx: number;
    dy: number;
    dz: number;
}

export interface PickAxeResult {
    spentTime: boolean;
    resume?: boolean;
    cancelled?: true;
    died?: true;
}

interface PickAxeDirectionOptions {
    state?: GameState;
    attackMonster: (monster: Monster) => void | Promise<unknown>;
    payShopkeeper: () => void | Promise<unknown>;
}

interface PickAxeOptions extends PickAxeDirectionOptions {
    ensureWielded: () => Promise<{ ready: boolean }>;
    // getdir() owns direction validation and the first impairment check.
    readDirection: (prompt: string) => Promise<PickAxeDirection | null>;
}

const M1_WALLWALK = 0x00000008;
const GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const LONG_WORM = MONSTER_NAME.indexOf('long worm');
// hack.h orders DIR_DOWN before DIR_UP after the eight compass directions.
const DIRECTION_KEYS = ['h', 'y', 'k', 'u', 'l', 'n', 'j', 'b', '>', '<'];

function compassVector(direction: number) {
    const dx = xdir[direction],
        dy = ydir[direction];
    if (dx === undefined || dy === undefined)
        throw new RangeError(`Unknown compass direction ${direction}`);
    return { dx, dy };
}

function requirePickAxeDirection(hero: Hero): asserts hero is Hero & PickAxeDirection {
    if (hero.dx === undefined || hero.dy === undefined || hero.dz === undefined)
        throw new Error('Using a pick-axe requires a chosen direction.');
}

function diggingLocation(x: number, y: number, state: GameState) {
    const location = requireGameLevel(state).at(x, y);
    if (!location) throw new Error(`Digging target (${x}, ${y}) is outside the map.`);
    return location;
}

function trapAt(x: number, y: number, state: GameState) {
    return requireGameLevel(state).traps.find((trap) => trap.tx === x && trap.ty === y);
}

function impaired(state: GameState) {
    const hero = state.u;
    return (
        hero.confused ||
        (hero.confusionTurns ?? 0) > 0 ||
        hero.stunned ||
        (hero.stunnedTurns ?? 0) > 0 ||
        heroIsHallucinating(state)
    );
}

function suggestedDirections(tool: GameObject, state: GameState) {
    const hero = state.u;
    const downOK = heroCanReachFloor(state);
    return DIRECTION_KEYS.filter((key, direction) => {
        if (hero.uswallow) return true;
        if (direction >= 8) return (direction === 8) === downOK;
        const vector = compassVector(direction);
        if (hero.umonnum === GRID_BUG && vector.dx && vector.dy) return false;
        const x = hero.ux + vector.dx,
            y = hero.uy + vector.dy;
        return isok(x, y) && diggingTarget(tool, x, y, state) !== DIGTYP_UNDIGGABLE;
    }).join('');
}

function tendedShopAt(monster: Monster, state: GameState) {
    const level = requireGameLevel(state);
    return roomsAt(level, monster.mx, monster.my, SHOPBASE).some((roomno) => {
        const room = roomForRoomno(level, roomno);
        const keeper = room?.resident;
        return keeper && !keeper.dead && (keeper.mhp ?? 1) > 0;
    });
}

async function attackWithTool(
    tool: GameObject,
    monster: Monster,
    attackMonster: PickAxeDirectionOptions['attackMonster'],
    payShopkeeper: PickAxeDirectionOptions['payShopkeeper'],
    state: GameState,
    struckAt: Position,
) {
    const hero = state.u;
    const safe =
        state.flags?.safe_dog !== false &&
        monster.mpeaceful &&
        canSpotMonster(monster) &&
        !impaired(state);
    if (
        safe &&
        !state.context.forcefight &&
        artifactById(tool.oartifact, state)?.name !== 'Stormbringer'
    ) {
        const blocked =
            heroIsPunished(state) ||
            rn2(7) === 0 ||
            (monster.mnum === LONG_WORM && monster.wormno) ||
            (IS_OBSTRUCTED(diggingLocation(hero.ux, hero.uy, state).typ) &&
                !((MONSTER_FLAGS1[monster.mnum] || 0) & M1_WALLWALK));
        if (blocked || tendedShopAt(monster, state)) {
            if (
                monster.isshk &&
                canSpotMonster(monster) &&
                !state._runState &&
                !state.context.travel
            ) {
                await payShopkeeper();
                return true;
            }
            if (monster.mtame || monster.pet) {
                const flight = await makeMonsterFlee(monster, {
                    state,
                    turns: rnd(6),
                    announce: false,
                });
                if (flight.heroDied) return true;
            }
            await plineWithContinuation(`You stop.  ${monsterName(monster, { state, capitalized: true, article: 'your' })} is in the way!`);
            return true;
        }
        if (
            monster.mfrozen ||
            monster.msleeping ||
            monster.mcanmove === 0 ||
            (MONSTER_MOVE[monster.mnum] === 0 && rn2(6))
        ) {
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true, article: 'your' })} doesn't seem to move!`);
            return true;
        }
        // do_attack() leaves a safe monster alone. Applying is not movement,
        // so the caller continues against the terrain rather than swapping.
        return false;
    }
    const verdict = await prepareAppliedWeaponAttack(
        monster, tool, { state, struckAt });
    if (verdict.proceed) await attackMonster(monster);
    return true;
}

async function hurtHero(amount: number, killer: string, state: GameState) {
    if (state.u.halfPhysicalDamage) amount = Math.trunc((amount + 1) / 2);
    await loseHeroHp(amount, killer, { state, killerFormat: KILLED_BY });
}

async function wakeNearby(state: GameState) {
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state);
}

async function strikeUndiggable(tool: GameObject, x: number, y: number, state: GameState) {
    const hero = state.u;
    const location = diggingLocation(x, y, state);
    const trap = trapAt(x, y, state);
    const pile = requireGameLevel(state).objects[x]?.[y] || [];
    const boulder = pile.find((object) => object.otyp === BOULDER);
    const statue = pile.find((object) => object.otyp === STATUE);
    if (trap?.ttyp === WEB) {
        if (!trap.tseen) {
            seeTrap(trap, state);
            await plineWithContinuation('There is a spider web there!');
        }
        await plineWithContinuation(
            `${ownedObjectAction(tool, 'become', state)} entangled in the web.`,
        );
        const turns = d(2, 2);
        nomul(-turns, state);
        state._helplessReason = 'stuck in a spider web';
        state._helplessDoneMessage = 'You pull free.';
    } else if (location.typ === IRONBARS) {
        await plineWithContinuation('Clang!');
        await wakeNearby(state);
    } else if (IS_WATERWALL(location.typ) || location.typ === LAVAWALL) {
        await plineWithContinuation('Splash!');
        if (location.typ === LAVAWALL)
            await fireDamageObject(tool, { state, x, y, publish: plineWithContinuation });
    } else if (IS_TREE(location.typ)) {
        await plineWithContinuation('You need an axe to cut down a tree.');
    } else if (IS_OBSTRUCTED(location.typ)) {
        await plineWithContinuation('You need a pick to dig rock.');
    } else if (boulder || statue) {
        const target = boulder ? 'boulder' : 'statue';
        if (isPick(tool)) {
            await plineWithContinuation(`You can't reach the ${target}.`);
        } else {
            const vibrates = rn2(3) === 0;
            await plineWithContinuation(
                `Sparks fly as you whack the ${target}.${
                    vibrates ? '  The axe-handle vibrates violently!' : ''
                }`,
            );
            if (vibrates) await hurtHero(2, 'axing a hard object', state);
            await wakeNearby(state);
        }
    } else {
        const here = trapAt(hero.ux, hero.uy, state);
        if (hero.utrap && hero.utraptype === TT_PIT && here) {
            if (trap && is_pit(trap.ttyp) && connectPits(here, trap)) {
                await plineWithContinuation('You clear some debris from between the pits.');
            } else {
                await plineWithContinuation(
                    `You swing ${ownedObjectName(tool, state, { capitalized: false })}, but the rubble has no place to go.`,
                );
            }
        } else {
            await plineWithContinuation(
                `You swing ${ownedObjectName(tool, state, { capitalized: false })} through thin air.`,
            );
        }
    }
}

export async function usePickAxe(
    tool: GameObject,
    { state = game, ensureWielded, readDirection, attackMonster, payShopkeeper }: PickAxeOptions,
): Promise<PickAxeResult> {
    if (tool !== (state.uwep || state.u.uwep)) {
        const wielded = await ensureWielded();
        return { spentTime: !!wielded.ready, resume: !!wielded.ready };
    }
    const verb = isPick(tool) ? 'dig' : 'chop';
    if (state.u.utrap && state.u.utraptype === TT_WEB) {
        await plineWithContinuation(`Unfortunately, you can't ${verb} while entangled in a web.`);
        return { spentTime: false };
    }
    const direction = await readDirection(
        `In what direction do you want to ${verb}? [${suggestedDirections(tool, state)}]`,
    );
    if (!direction) return { spentTime: false, cancelled: true };
    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;
    return applyPickAxeDirection(tool, { state, attackMonster, payShopkeeper });
}

export async function applyPickAxeDirection(
    tool: GameObject,
    { state = game, attackMonster, payShopkeeper }: PickAxeDirectionOptions,
): Promise<PickAxeResult> {
    const hero = state.u;
    requirePickAxeDirection(hero);
    const verbing = isPick(tool) ? 'digging' : 'chopping';
    if (
        hero.uswallow &&
        hero.ustuck &&
        (await attackWithTool(tool, hero.ustuck, attackMonster, payShopkeeper, state,
            { x: hero.ux + hero.dx, y: hero.uy + hero.dy }))
    ) {
        return { spentTime: true };
    }
    if (state.underwater || hero.uinwater) {
        await plineWithContinuation(`Turbulence torpedoes your ${verbing} attempts.`);
    } else if (hero.dz < 0) {
        const levitating = hero.levitating || hero.levitation || state.levitating;
        await plineWithContinuation(
            levitating
                ? "You don't have enough leverage."
                : `You can't reach the ${ceilingName(hero.ux, hero.uy, state)}.`,
        );
    } else if (!hero.dx && !hero.dy && !hero.dz) {
        const damage = Math.max(1, rnd(2) + heroStrengthDamageBonus(state) + (tool.spe ?? 0));
        await plineWithContinuation(
            `You hit yourself with ${ownedObjectName(tool, state, { capitalized: false })}.`,
        );
        await hurtHero(
            damage,
            `${state.flags.female ? 'her' : 'his'} own ${OBJECT_NAMES[tool.otyp]}`,
            state,
        );
    } else if (!hero.dz) {
        confusePromptDirection(hero);
        const x = hero.ux + hero.dx,
            y = hero.uy + hero.dy;
        if (!isok(x, y)) {
            await plineWithContinuation('Clash!');
            return { spentTime: true };
        }
        const monster = requireGameLevel(state).monsters.find(
            (mon) =>
                monsterHasMapPosition(mon, state) &&
                !mon.dead &&
                (mon.mhp ?? 1) > 0 &&
                mon.mx === x &&
                mon.my === y,
        );
        if (monster && (await attackWithTool(
            tool, monster, attackMonster, payShopkeeper, state, { x, y })))
            return { spentTime: true };
        if (diggingTarget(tool, x, y, state) === DIGTYP_UNDIGGABLE)
            await strikeUndiggable(tool, x, y, state);
        else await startHeroDigging(tool, x, y, { state });
    } else if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        await plineWithContinuation(
            `You swing ${ownedObjectName(tool, state, { capitalized: false })} through thin air.`,
        );
    } else if (!heroCanReachFloor(state)) {
        await plineWithContinuation(`You can't reach the ${surfaceName(hero.ux, hero.uy, state)}.`);
    } else if (
        isPoolAt(hero.ux, hero.uy, state) || isLavaAt(hero.ux, hero.uy, state)
    ) {
        await plineWithContinuation(
            `You cannot stay under${
                isPoolAt(hero.ux, hero.uy, state) ? 'water' : ' the lava'
            } long enough.`,
        );
    } else {
        const trap = trapAt(hero.ux, hero.uy, state);
        const seenTrap = trap?.tseen ? trap : null;
        const pitEdge =
            seenTrap && is_pit(seenTrap.ttyp) && !(hero.utrap && hero.utraptype === TT_PIT);
        if (seenTrap && (pitEdge || is_hole(seenTrap.ttyp))) {
            const result = await triggerHeroTrap(seenTrap, { forceBungle: true, gotoLevel });
            if (result.died) return { spentTime: false, died: true };
            if (!hero.utrap) await plineWithContinuation("You can't reach the bottom of the pit.");
        } else if (!isPick(tool) && trap?.ttyp !== LANDMINE && trap?.ttyp !== BEAR_TRAP) {
            await plineWithContinuation(
                `${ownedObjectAction(tool, 'merely scratch', state)} the ${surfaceName(hero.ux, hero.uy, state)}.`,
            );
            wipeHeroEngraving(3, state);
        } else {
            await startHeroDigging(tool, hero.ux, hero.uy, { down: true, state });
        }
    }
    return { spentTime: true };
}
