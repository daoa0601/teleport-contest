// gstate.js — Global game state reference.
// All game modules import `game` from here.

export let game = {};

export function resetGame(nextState = {}) {
    game = nextState;
    return game;
}
