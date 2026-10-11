import type { GameState } from './game_state.js';

export interface PotionEffectOptions {
    state?: GameState;
}

export interface PartialPotionEffectResult {
    handled: boolean;
    unknown: number;
    nothing: boolean;
    heroDied: boolean;
}

export interface PotionEffectResult {
    // peffects returns 1 when detection bypasses ordinary discovery.
    result: -1 | 0 | 1;
    unknown: number;
    nothing: boolean;
    heroDied: boolean;
}
