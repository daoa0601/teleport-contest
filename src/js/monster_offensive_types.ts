import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { d, rn2, rnd } from './rng.js';

export type MonsterOffensiveKind =
    | 'ray-wand'
    | 'horn'
    | 'immediate-wand'
    | 'potion'
    | 'earth-scroll'
    | 'camera';

export interface MonsterOffensiveChoice {
    kind: MonsterOffensiveKind;
    object: GameObject;
}

export interface MonsterOffensiveOptions {
    state: PlayingGameState;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
    publish?: MessagePublisher;
}

// Native use_offensive(): zero continues ordinary combat, one exits as an
// attacker-death result, and two means the item action spent the attack.
export interface MonsterOffensiveResult {
    nativeResult: 0 | 1 | 2;
    heroDied: boolean;
}

export type MonsterOffensivePhase =
    | { status: 'selected'; choice: MonsterOffensiveChoice }
    | { status: 'completed'; result: MonsterOffensiveResult };
