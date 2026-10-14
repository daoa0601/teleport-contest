// C hack.c:test_move() and still_chewing(): eating terrain or a boulder.

import { DOOR, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED,
    CORR, IRONBARS, IS_OBSTRUCTED, IS_TREE, IS_WALL, ROOM, SDOOR,
    SHOPBASE, SHOP_DOOR_COST, W_NONDIGGABLE } from './const.js';
import { currentStrength } from './attrib.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { feel_location, newsym, plineWithContinuation as pline } from './display.js';
import { watchDigging } from './digging_watch.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { recordGameLogEvent } from './gamelog.js';
import { clearDiggingContext, ensureDiggingContext, mayDig } from './hero_digging.js';
import { spendHeroNutrition } from './hunger.js';
import { heroPassesWalls, heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterCorrodesBars, monsterPassesBars } from './monster_movement_traits.js';
import { BOULDER, HEAVY_IRON_BALL, OBJECT_WEIGHT, requireObjectData } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { dissolveBars } from './projectile_bars.js';
import { rnd } from './rng.js';
import { inTown, roomsAt } from './room.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { vision_note_blocker_change } from './vision.js';

const M1_METALLIVORE = 0x80000000;

export async function heroCanEnterIronBars(x: number, y: number, state: PlayingGameState): Promise<boolean> {
    if (state.level.at(x, y)?.typ !== IRONBARS) return true;
    if (state.blind) feel_location(x, y);
    if (heroPassesWalls(state)) return true;
    if (state.u.uinwater) {
        await pline('There is an obstacle there.');
        return false;
    }
    const body = { mnum: heroSpecies(state) };
    const eatsMetal = !!((MONSTER_FLAGS1[body.mnum] ?? 0) & M1_METALLIVORE);
    if ((eatsMetal || monsterCorrodesBars(body)) && await continueChewingTerrain(x, y, state))
        return false;
    if (monsterPassesBars(body)) return true;
    if (state.flags.mention_walls) await pline('You cannot pass through the bars.');
    return false;
}

export async function chewIronBars({ state = game }: { state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { ux: x, uy: y } = state.u;
    const chewing = await continueChewingTerrain(x, y, state);
    if (chewing && state.level.at(x, y)?.typ === IRONBARS)
        await pline('You pause to swallow.');
}

export async function continueChewingTerrain(x: number, y: number, state: PlayingGameState): Promise<boolean> {
    const location = state.level.at(x, y);
    if (!location) throw new Error('Chewing requires a map cell.');
    const boulder = state.level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
    const digging = ensureDiggingContext(state);
    if (digging.down) clearDiggingContext(state);
    const tree = IS_TREE(location.typ);
    const rock = IS_OBSTRUCTED(location.typ);
    const bars = location.typ === IRONBARS;
    if (!boulder && ((rock && !mayDig(x, y, state))
        || bars && (location.wall_info & W_NONDIGGABLE))) {
        await pline(`You hurt your teeth on the ${bars ? 'bars' : tree ? 'tree' : 'hard stone'}.`);
        endVoluntaryMultiTurn(state);
        return true;
    }
    const eatsMetal = !!((MONSTER_FLAGS1[heroSpecies(state)] ?? 0) & M1_METALLIVORE);
    if (bars && eatsMetal && state.u.uhunger > 1500) {
        await pline('You are too full to eat the bars.');
        endVoluntaryMultiTurn(state);
        return true;
    }
    const samePlace = digging.chew && digging.pos.x === x && digging.pos.y === y
        && digging.level.dnum === state.u.uz.dnum && digging.level.dlevel === state.u.uz.dlevel;
    if (!samePlace) {
        digging.down = false;
        digging.chew = true;
        digging.warned = false;
        digging.pos = { x, y };
        digging.level = { ...state.u.uz };
        digging.effort = (rock && !tree ? 30 : 60) + (state.u.udaminc || 0);
        const target = boulder ? 'boulder' : tree ? 'tree' : rock ? 'rock' : bars ? 'bar' : 'door';
        await pline(`You start chewing ${boulder || tree || bars ? 'on a' : 'a hole in the'} ${target}.`);
        await watchDigging(x, y, { state, magic: false });
        return true;
    }
    digging.effort += 30 + (state.u.udaminc || 0);
    if (digging.effort <= 100) {
        const target = boulder ? 'boulder' : tree ? 'tree' : rock ? 'rock' : bars ? 'bars' : 'door';
        if (state.flags.verbose) await pline(`You continue chewing on the ${target}.`);
        await watchDigging(x, y, { state, magic: false });
        return true;
    }
    const conduct = state.u.uconduct;
    const food = boulder ? 'a boulder' : tree ? 'a tree' : rock ? 'rock' : bars ? 'iron bars' : 'a door';
    if (!conduct.food) recordGameLogEvent(`ate for the first time, by chewing through ${food}`, { state });
    conduct.food = (conduct.food || 0) + 1;
    state.u.uhunger += rnd(20);
    if (boulder) {
        await deleteObject(boulder, state);
        await pline('You eat the boulder.');
        const anotherBoulder = state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
        vision_note_blocker_change(x, y);
        newsym(x, y);
        clearDiggingContext(state);
        return rock || location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED)) || !!anotherBoulder;
    }
    let message: string | null = null;
    let damage: 'damage' | 'break' | null = null;
    if (IS_WALL(location.typ)) {
        if (roomsAt(state.level, x, y, SHOPBASE).length) {
            addShopDamage(x, y, 10 * currentStrength(state), state);
            damage = 'damage';
        }
        message = 'You chew a hole in the wall.';
        if (state.level.flags.is_maze_lev) location.typ = ROOM;
        else if (state.level.flags.is_cavernous_lev && !inTown(state.level, x, y)) location.typ = CORR;
        else {
            location.typ = DOOR;
            location.doormask = D_NODOOR;
        }
    } else if (tree) {
        message = 'You chew through the tree.';
        location.typ = ROOM;
    } else if (bars) {
        if (eatsMetal)
            await spendHeroNutrition(-requireObjectData(OBJECT_WEIGHT, HEAVY_IRON_BALL), { state });
        await dissolveBars(x, y, state);
        message = state.u.ux === x && state.u.uy === y
            ? 'You devour the iron bars.' : 'You eat through the bars.';
    } else if (location.typ === SDOOR || location.typ === DOOR) {
        const secret = location.typ === SDOOR;
        if (!secret && roomsAt(state.level, x, y, SHOPBASE).length) {
            addShopDamage(x, y, SHOP_DOOR_COST, state);
            damage = 'break';
        }
        if (location.doormask & D_TRAPPED) {
            location.doormask = D_NODOOR;
            if (await triggerBoobyTrap(secret ? 'secret door' : 'door', { state })) return true;
        } else {
            message = `You chew through the ${secret ? 'secret ' : ''}door.`;
            location.doormask = D_BROKEN;
        }
        location.typ = DOOR;
    } else {
        message = 'You chew a passage through the rock.';
        location.typ = CORR;
    }
    vision_note_blocker_change(x, y);
    newsym(x, y);
    if (message) await pline(message);
    if (damage) await payForShopDamage(damage, { state });
    clearDiggingContext(state);
    return false;
}
