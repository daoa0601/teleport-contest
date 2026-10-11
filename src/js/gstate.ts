// gstate.js — Global game state reference.
// All game modules import `game` from here.

import { CommandBindings } from './command_bindings.js';
import { createGameState } from './game_state.js';
import { requireInitializedHero } from './hero_types.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { GameDisplay } from './game_display.js';

export let game: GameState = createGameState();

export function resetGame(nextState: GameState = createGameState()): GameState {
    game = nextState;
    game.warn_obj_cnt = 0;
    game.bhitpos = { x: 0, y: 0 };
    game.notonhead = false;
    game._monsterSwallower = null;
    game._monsterEngulf = null;
    game.commandBindings = new CommandBindings();
    return game;
}

// World transitions share the live map, input, and display owners.
export function requireLiveGame(state: GameState): void {
    if (state !== game)
        throw new TypeError('World transitions require the live game state.');
}

// Level generation can use the allocated hero before attributes are rolled.
export function requireGameLevel(state: GameState = game): GameMap {
    if (!state.level) throw new Error('This operation requires a dungeon level.');
    return state.level;
}

export function requireGameDisplay(state: GameState = game): GameDisplay {
    if (!state.nhDisplay) throw new Error('This operation requires a game display.');
    return state.nhDisplay;
}

// Gameplay needs the completed hero and level; option parsing and startup do not.
export function requirePlayingGame(state: GameState): asserts state is PlayingGameState {
    if (!state.level || !state.urole || !state.urace)
        throw new Error('This operation requires a started game.');
    requireInitializedHero(state.u);
}

export function requireInitializedGame(state: GameState = game): PlayingGameState {
    requirePlayingGame(state);
    return state;
}
