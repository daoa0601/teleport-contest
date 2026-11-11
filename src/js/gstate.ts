// gstate.js — Global game state reference.
// All game modules import `game` from here.

import { resetErinys } from './monster_data.js';
import { CommandBindings } from './command_bindings.js';
import { createGameState } from './game_state.js';
import { requireInitializedHero } from './hero_types.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { GameDisplay } from './game_display.js';

export let game: GameState = createGameState();

// Port only: replace the global game state (C clears its globals in place).
export function resetGame(nextState: GameState = createGameState()): GameState {
    game = nextState;
    resetErinys(game.u.ualign?.abuse ?? 0);
    game.warn_obj_cnt = 0;
    game.bhitpos = { x: 0, y: 0 };
    game.notonhead = false;
    game._monsterSwallower = null;
    game._monsterEngulf = null;
    game.commandBindings = new CommandBindings();
    return game;
}

// Port only: world transitions share the live map, input, and display owners.
export function requireLiveGame(state: GameState): void {
    if (state !== game)
        throw new TypeError('World transitions require the live game state.');
}

// Port only: level generation can use the allocated hero before attributes
// are rolled.
export function requireGameLevel(state: GameState = game): GameMap {
    if (!state.level) throw new Error('This operation requires a dungeon level.');
    return state.level;
}

// Port only: validated display owner access.
export function requireGameDisplay(state: GameState = game): GameDisplay {
    if (!state.nhDisplay) throw new Error('This operation requires a game display.');
    return state.nhDisplay;
}

// Port only: gameplay needs the completed hero and level; option parsing
// and startup do not.
export function requirePlayingGame(state: GameState): asserts state is PlayingGameState {
    if (!state.level || !state.urole || !state.urace)
        throw new Error('This operation requires a started game.');
    requireInitializedHero(state.u);
}

// Port only: requirePlayingGame() plus the initialized-hero return.
export function requireInitializedGame(state: GameState = game): PlayingGameState {
    requirePlayingGame(state);
    return state;
}

// C decl.c:level_status_init(): current level readiness is process-local.
export function level_status_init(state: GameState = game): void {
    state.level_status = { making: false, loading: false, shkready: false, ready: false };
}
