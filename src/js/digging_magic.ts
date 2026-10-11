// C dig.c:zap_dig(), adj_pit_checks(), and pit_flow().
// Wand and spell digging use the same effect; weffects owns exercise and discovery.
import { objectIsHardHelmet } from './armor.js';
import { heroHeadName, monsterStomachName } from './body_parts.js';
import {
    ALTAR, CORR, DBWALL, DOOR, DRAWBRIDGE_DOWN, D_CLOSED, D_LOCKED,
    D_NODOOR, FOUNTAIN, IRONBARS, IS_OBSTRUCTED, IS_TREE, IS_WALL,
    Is_airlevel, Is_earthlevel, Is_waterlevel, ROOM, SCORR, SDOOR,
    SHOPBASE, SHOP_DOOR_COST, SHOP_WALL_COST, SINK, STONE, THRONE,
    TT_PIT, W_NONDIGGABLE, is_pit, isok, xdir, ydir,
} from './const.js';
import { digHole, liquidFlow } from './digging_terrain.js';
import { watchDigging } from './digging_watch.js';
import {
    flush_screen, newsym, plineWithContinuation, show_glyph_cell,
} from './display.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MapLocation, Position, Stairway, Trap } from './map_types.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import { loseHeroHp } from './hero_damage.js';
import { mayDig } from './hero_digging.js';
import { expelHero } from './hero_expulsion.js';
import { liquidForHole } from './hole.js';
import { mksobj } from './mklev.js';
import { MONSTER_GENO, monsterDigests, monsterIsWhirly } from './monster_data.js';
import { monsterName, possessiveName } from './monster_name.js';
import { ROCK } from './object_data.js';
import { observeObjectForNaming } from './objnam.js';
import { connectPits, pitsAreConjoined } from './pit_connections.js';
import { captureRayTraversalFrame } from './ray.js';
import { inTown, roomsAt } from './room.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { ceilingName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { CLR_WHITE } from './terminal.js';
import { cansee, vision_note_blocker_change } from './vision.js';

const G_UNIQ = 0x1000;

export async function zapDigWithObject(
    _object: GameObject | null, { state = game }: { state?: GameState } = {},
): Promise<void> {
    requireLiveGame(state);
    const hero = state.u;
    const level = requireGameLevel(state);
    if (hero.uswallow) {
        if (!hero.ustuck) throw new Error('Swallowed digging requires an engulfing monster.');
        await pierceEngulfer(hero.ustuck, state);
        return;
    }
    if (hero.dz) {
        await digVertically(state, hero.dz);
        return;
    }

    const dx = hero.dx, dy = hero.dy;
    if (dx === undefined || dy === undefined) throw new Error('Digging requires a selected direction.');
    const maze = level.flags.is_maze_lev && !Is_earthlevel(hero.uz);
    const ownPit = hero.utrap && hero.utraptype === TT_PIT
        ? trapAt(hero.ux, hero.uy, state) : null;
    const direction = xdir.findIndex((offsetX, index) => index < 8
        && offsetX === dx && ydir[index] === dy);
    let x = hero.ux + dx, y = hero.uy + dy;
    let depth = rn2(18) + 8;
    let shopDoor = false, shopWall = false;
    let flowingPit: Position | null = null;
    const visibleCells: Position[] = [];

    await flush_screen(0);
    try {
        while (--depth >= 0 && isok(x, y)) {
            const location = level.requireAt(x, y);
            if (cansee(x, y)) {
                visibleCells.push({ x, y });
                show_glyph_cell(x, y, '*', CLR_WHITE, false);
            }
            await captureRayTraversalFrame(state);

            if (ownPit) {
                let adjacentPit = trapAt(x, y, state);
                if (direction >= 0 && !pitsAreConjoined(adjacentPit, ownPit)) {
                    if (!adjacentPit || !is_pit(adjacentPit.ttyp)) {
                        const rejection = adjacentPitRejection(x, y, state);
                        if (rejection === null) {
                            await digHole({ pitOnly: true, byMagic: true,
                                coordinate: { x, y }, state });
                            if (state.program_state.gameover) return;
                            adjacentPit = trapAt(x, y, state);
                        } else if (rejection) {
                            await plineWithContinuation(rejection);
                        }
                    }
                    if (adjacentPit && is_pit(adjacentPit.ttyp)) {
                        connectPits(ownPit, adjacentPit);
                        flowingPit = { x, y };
                    }
                    if (isPoolAt(x, y, state) || isLavaAt(x, y, state))
                        flowingPit = { x: x - dx, y: y - dy };
                    break;
                }
            } else if (closedDoor(location) || location.typ === SDOOR) {
                if (roomsAt(level, x, y, SHOPBASE).length) {
                    addShopDamage(x, y, SHOP_DOOR_COST, state);
                    shopDoor = true;
                }
                if (location.typ === SDOOR) location.typ = DOOR;
                else if (cansee(x, y))
                    await plineWithContinuation('The door is razed!');
                await watchDigging(x, y, { state });
                clearTerrainFlags(location);
                location.doormask = D_NODOOR;
                vision_note_blocker_change(x, y);
                depth -= 2;
                if (maze) break;
            } else if (maze) {
                const wall = IS_WALL(location.typ);
                const tree = IS_TREE(location.typ);
                if (wall || tree || location.typ === STONE || location.typ === SCORR) {
                    if (!(location.wall_info & W_NONDIGGABLE)) {
                        if (wall && roomsAt(level, x, y, SHOPBASE).length) {
                            addShopDamage(x, y, SHOP_WALL_COST, state);
                            shopWall = true;
                        }
                        location.typ = wall || tree ? ROOM : CORR;
                        clearTerrainFlags(location);
                        vision_note_blocker_change(x, y);
                    } else if (!heroIsBlind(state)) {
                        await plineWithContinuation(tree
                            ? 'The tree shudders but is unharmed.'
                            : `The ${wall ? 'wall' : 'rock'} glows then fades.`);
                    }
                    break;
                }
            } else if (IS_OBSTRUCTED(location.typ)) {
                if (!mayDig(x, y, state)) break;
                if (IS_WALL(location.typ) || location.typ === SDOOR) {
                    if (roomsAt(level, x, y, SHOPBASE).length) {
                        addShopDamage(x, y, SHOP_WALL_COST, state);
                        shopWall = true;
                    }
                    await watchDigging(x, y, { state });
                    location.typ = level.flags.is_cavernous_lev
                        && !inTown(level, x, y) ? CORR : DOOR;
                    depth -= 2;
                } else if (IS_TREE(location.typ)) {
                    location.typ = ROOM;
                    depth -= 2;
                } else {
                    location.typ = CORR;
                    depth--;
                }
                clearTerrainFlags(location);
                vision_note_blocker_change(x, y);
            }
            x += dx;
            y += dy;
        }
    } finally {
        if (!state.program_state.gameover)
            for (const cell of visibleCells) newsym(cell.x, cell.y);
    }

    if (flowingPit && isok(flowingPit.x, flowingPit.y)) {
        const trap = trapAt(flowingPit.x, flowingPit.y, state);
        if (trap && is_pit(trap.ttyp)) {
            const liquid = liquidForHole(trap.tx, trap.ty, state, { fillIfAny: true });
            if (liquid !== ROOM) await floodConnectedPits(trap, liquid, state);
        }
    }
    if (state.program_state.gameover) return;
    if (shopDoor || shopWall)
        await payForShopDamage(shopDoor ? 'destroy' : 'dig into', { state });
}

async function pierceEngulfer(monster: Monster, state: GameState): Promise<void> {
    if (monsterIsWhirly(monster)) return;
    const digesting = monsterDigests(monster);
    if (digesting) {
        const owner = possessiveName(monsterName(monster, { state }));
        await plineWithContinuation(
            `You pierce ${owner} ${monsterStomachName(monster.mnum)} wall!`);
    }
    const generation = MONSTER_GENO[monster.mnum];
    if (generation === undefined) throw new Error(`Missing monster generation flags for ${monster.mnum}`);
    monster.mhp = generation & G_UNIQ
        ? Math.trunc((monster.mhp + 1) / 2) : 1;
    await expelHero(monster, { state, message: !digesting });
}

async function digVertically(state: GameState, direction: number): Promise<void> {
    const hero = state.u;
    if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)
        || state.underwater || hero.uinwater) return;
    const stairs = stairsAt(hero.ux, hero.uy, state);
    if (direction > 0 && !stairs) {
        await watchDigging(hero.ux, hero.uy, { state });
        await digHole({ byMagic: true, state });
        return;
    }
    if (stairs) {
        await plineWithContinuation(`The beam bounces off the ${
            stairs.isladder ? 'ladder' : 'stairs'} and hits the ${
            ceilingName(hero.ux, hero.uy, state)}.`);
    }
    await plineWithContinuation(
        `You loosen a rock from the ${ceilingName(hero.ux, hero.uy, state)}.`);
    await plineWithContinuation(`It falls on your ${heroHeadName(state)}!`);
    const helmet = state.uarmh || hero.uarmh;
    const damage = rnd(objectIsHardHelmet(helmet) ? 2 : 6);
    const halfPhysical = hero.halfPhysicalDamage;
    if (await loseHeroHp(halfPhysical ? Math.ceil(damage / 2) : damage,
        'falling rock', { state })) return;
    const rock = await mksobj(ROCK, false, false);
    placeCreatedObject(rock, hero.ux, hero.uy, state);
    observeObjectForNaming(rock, { state });
    await stack_object(rock, state);
    newsym(hero.ux, hero.uy);
}

// null permits digging; an empty string rejects it without a message.
function adjacentPitRejection(x: number, y: number, state: GameState): string | null {
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ;
    // adj_pit_checks clears the native rm.flags union before checking it.
    // This also clears door locks, ice underlay, and nondiggable rock flags.
    clearTerrainFlags(location);
    if (isPoolAt(x, y, state) || isLavaAt(x, y, state)) return '';
    if (closedDoor(location) || type === SDOOR || IS_WALL(type))
        return 'The foundation is too hard to dig through from this angle.';
    if (IS_TREE(type)) return "The tree's roots glow then fade.";
    if (type === IRONBARS) return 'The bars go much deeper than your pit.';
    if (type === SINK) return 'A tangled mass of plumbing remains below the sink.';
    const stairs = stairsAt(x, y, state);
    if (stairs?.isladder) return 'The ladder is unaffected.';
    const support = type === FOUNTAIN ? 'fountain' : type === THRONE ? 'throne'
        : type === ALTAR ? 'altar' : stairs ? 'stairs'
            : type === DRAWBRIDGE_DOWN || type === DBWALL ? 'drawbridge' : null;
    return support ? `The ${possessiveName(support)} supporting structures remain intact.` : null;
}

async function floodConnectedPits(trap: Trap | null | undefined, liquid: number, state: GameState): Promise<void> {
    if (!trap || !is_pit(trap.ttyp)) return;
    // Deleting a flooded pit clears its neighbors' links; retain its old exits.
    const { tx: x, ty: y, conjoined = 0 } = trap;
    const location = requireGameLevel(state).requireAt(x, y);
    location.typ = liquid;
    clearTerrainFlags(location);
    const message = state.u.ux === x && state.u.uy === y
        ? 'Suddenly %s flows in from the adjacent pit!' : null;
    await liquidFlow(x, y, liquid, trap, message, { state });
    if (state.program_state.gameover) return;
    for (let direction = 0; direction < 8; direction++) {
        if (conjoined & (1 << direction)) {
            const dx = xdir[direction], dy = ydir[direction];
            if (dx === undefined || dy === undefined)
                throw new RangeError(`Invalid connected pit direction ${direction}`);
            await floodConnectedPits(trapAt(x + dx, y + dy, state), liquid, state);
            if (state.program_state.gameover) return;
        }
    }
}

function trapAt(x: number, y: number, state: GameState): Trap | undefined {
    return requireGameLevel(state).traps.find(trap => trap.tx === x && trap.ty === y);
}

function stairsAt(x: number, y: number, state: GameState): Stairway | null {
    for (let stairs = state.stairs; stairs; stairs = stairs.next)
        if (stairs.sx === x && stairs.sy === y) return stairs;
    return null;
}

function closedDoor(location: MapLocation): boolean {
    return location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

function clearTerrainFlags(location: MapLocation): void {
    location.flags = 0;
    location.doormask = 0;
    location.wall_info = 0;
    location.altarmask = 0;
    location.ladder = 0;
    location.drawbridgemask = 0;
    location.looted = 0;
    location.icedpool = 0;
    location.emptygrave = 0;
}
