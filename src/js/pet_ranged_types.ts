import type { Monster } from './monster_types.js';
import type { Hero } from './hero_types.js';
import type { RandomBelow, RollOne } from './monster_action_types.js';

export type PetRangedTarget = Monster | Hero;

export interface PetTargetOptions {
    forced?: boolean;
    random?: RandomBelow;
    rollOne?: RollOne;
}

export interface PetRangedSelection {
    target: PetRangedTarget | null;
    makeNoise: boolean;
}
