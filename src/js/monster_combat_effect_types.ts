import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { AttackTuple, MonsterCombatDeath } from './monster_action_types.js';
import type { DamageType } from './monster_attack_types.js';
import type { MonsterDeathHandler } from './monster_death.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { d, rn2, rnd } from './rng.js';

export interface MonsterCombatEffectResult {
    damage: number;
    nativeResult: number;
    done: boolean;
    heroDied: boolean;
    skipBrainDrain?: boolean;
}

export interface MonsterCombatEffectContext {
    state: PlayingGameState;
    attack: AttackTuple;
    damage: number;
    visible: boolean;
    notOnHead: boolean;
    dieRoll: number;
    weapon: GameObject | null;
    random: typeof rn2;
    rollOne: typeof rnd;
    rollDice: typeof d;
    publish: MessagePublisher;
    applyPhysical: () => Promise<MonsterCombatEffectResult>;
    // Raw environmental death does not award growth. Effects which kill the
    // defender themselves must request growth after confirming actual death.
    finishDeath: MonsterDeathHandler;
    // Native monkilled followed by grow_up, including life-saving admission.
    killDefender: (options?: {
        damageType?: DamageType;
        cause?: string | null;
    }) => Promise<{ nativeResult: number; heroDied: boolean }>;
    growAttacker: (victim: Monster | null) => Promise<{ survived: boolean; heroDied: boolean }>;
}

export interface MonsterCombatDamageResult {
    damage: number;
    nativeResult: number;
    heroDied: boolean;
    skipBrainDrain: boolean;
    death?: MonsterCombatDeath | null;
}

export type ResolveMonsterCombatDamage = (
    attacker: Monster, defender: Monster, attack: AttackTuple,
) => Promise<MonsterCombatDamageResult>;
