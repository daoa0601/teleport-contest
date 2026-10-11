import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { AttackTuple } from './monster_action_types.js';
import type { d, rn2, rnd } from './rng.js';

export interface HeroNaturalEffectContext {
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollDice: typeof d;
    rollOne: typeof rnd;
    attack: AttackTuple;
    damage: number;
    specialDamage: number;
    target: Position;
}

// Effects can apply damage or death themselves. Only unfinished effects pass
// their remaining damage to damageum's common hit-point/death handling.
export interface HeroNaturalEffectResult {
    damage: number;
    nativeResult: number;
    done: boolean;
    heroDied: boolean;
    skipBrainDrain?: boolean;
}

export interface HeroNaturalDamageResult {
    nativeResult: number;
    heroDied: boolean;
    skipBrainDrain?: boolean;
}
