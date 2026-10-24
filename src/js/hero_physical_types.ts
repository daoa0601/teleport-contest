import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { FinishHeroMonsterDeath } from './hero_monster_death.js';
import type { MessagePublisher } from './display.js';

// Native HMON_* modes share damage and aftermath, but retain different
// weapon, Strength, training, and contact rules.
export type HeroPhysicalAttackMode = 'melee' | 'thrown' | 'kicked' | 'applied' | 'dragged';

// The active command shares this record with recoil, which can reduce count.
export interface HeroProjectileVolley {
    count: number;
    index: number;
    objectType: number;
    shooting?: boolean;
}

export interface HeroPhysicalHitOptions {
    mode: HeroPhysicalAttackMode;
    dieRoll: number;
    twoHits?: number;
    target?: Position;
    state?: GameState;
    finishMonsterDeath?: FinishHeroMonsterDeath;
    publish?: MessagePublisher;
    volley?: HeroProjectileVolley;
}

export interface HeroPhysicalHitResult {
    // A lethal hit remains lethal for the native attack sequence even if
    // life saving subsequently restores the defender.
    survived: boolean;
    heroDied: boolean;
    objectConsumed: boolean;
}
