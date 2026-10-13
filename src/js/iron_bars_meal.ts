// C hack.c:test_move() and still_chewing(), for iron bars.

import { IRONBARS, W_NONDIGGABLE } from './const.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { feel_location, newsym, plineWithContinuation as pline } from './display.js';
import { watchDigging } from './digging_watch.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { recordGameLogEvent } from './gamelog.js';
import { clearDiggingContext, ensureDiggingContext } from './hero_digging.js';
import { spendHeroNutrition } from './hunger.js';
import { heroPassesWalls, heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterCorrodesBars, monsterPassesBars } from './monster_movement_traits.js';
import { BOULDER, HEAVY_IRON_BALL, OBJECT_WEIGHT, requireObjectData } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { dissolveBars } from './projectile_bars.js';
import { rnd } from './rng.js';
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
    if ((eatsMetal || monsterCorrodesBars(body)) && await continueChewingBars(x, y, state))
        return false;
    if (monsterPassesBars(body)) return true;
    if (state.flags.mention_walls) await pline('You cannot pass through the bars.');
    return false;
}

export async function chewIronBars({ state = game }: { state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { ux: x, uy: y } = state.u;
    const chewing = await continueChewingBars(x, y, state);
    if (chewing && state.level.at(x, y)?.typ === IRONBARS)
        await pline('You pause to swallow.');
}

async function continueChewingBars(x: number, y: number, state: PlayingGameState): Promise<boolean> {
    const location = state.level.at(x, y);
    if (!location) throw new Error('Chewing bars requires a map cell.');
    const boulder = state.level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
    const digging = ensureDiggingContext(state);
    if (digging.down) clearDiggingContext(state);
    if (!boulder && (location.wall_info & W_NONDIGGABLE)) {
        await pline('You hurt your teeth on the bars.');
        endVoluntaryMultiTurn(state);
        return true;
    }
    const eatsMetal = !!((MONSTER_FLAGS1[heroSpecies(state)] ?? 0) & M1_METALLIVORE);
    if (eatsMetal && state.u.uhunger > 1500) {
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
        digging.effort = 60 + (state.u.udaminc || 0);
        await pline(`You start chewing on a ${boulder ? 'boulder' : 'bar'}.`);
        await watchDigging(x, y, { state, magic: false });
        return true;
    }
    digging.effort += 30 + (state.u.udaminc || 0);
    if (digging.effort <= 100) {
        if (state.flags.verbose) await pline(`You continue chewing on the ${boulder ? 'boulder' : 'bars'}.`);
        await watchDigging(x, y, { state, magic: false });
        return true;
    }
    const conduct = state.u.uconduct;
    if (!conduct.food) recordGameLogEvent(`ate for the first time, by chewing through ${boulder ? 'a boulder' : 'iron bars'}`, { state });
    conduct.food = (conduct.food || 0) + 1;
    state.u.uhunger += rnd(20);
    if (boulder) {
        await deleteObject(boulder, state);
        await pline('You eat the boulder.');
        const anotherBoulder = state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
        vision_note_blocker_change(x, y);
        newsym(x, y);
        clearDiggingContext(state);
        return !!anotherBoulder;
    }
    if (eatsMetal)
        await spendHeroNutrition(-requireObjectData(OBJECT_WEIGHT, HEAVY_IRON_BALL), { state });
    await dissolveBars(x, y, state);
    vision_note_blocker_change(x, y);
    newsym(x, y);
    await pline(state.u.ux === x && state.u.uy === y
        ? 'You devour the iron bars.' : 'You eat through the bars.');
    clearDiggingContext(state);
    return false;
}
