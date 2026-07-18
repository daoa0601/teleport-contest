// detect.js — Searching and detection.
// C ref: detect.c — dosearch(), dosearch0().

import { game } from './gstate.js';

// The full search implementation will reveal adjacent secret doors, traps,
// and hidden monsters.  An ordinary unsuccessful search still consumes time.
export async function dosearch() {
    game.context.move = 1;
}
