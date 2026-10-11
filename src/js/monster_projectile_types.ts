import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';

// A shot is recorded only after its flight, impacts, and landing have finished.
export interface MonsterProjectileShot {
    source: Monster;
    weapon: GameObject;
    launched: boolean;
    heroTarget: boolean;
    target: Monster | null;
    hit: boolean;
    damage: number;
    targetDied: boolean;
    heroDied: boolean;
    caught: boolean;
    projectileBroken: boolean;
    flightPath: Position[];
    impactX: number;
    impactY: number;
}

interface MonsterWeaponVolleyBase {
    attempted: true;
    madeAttack: true;
    spentWielding?: false;
    source: Monster;
    missileStack: GameObject;
    volley: number;
    launched: boolean;
    shots: MonsterProjectileShot[];
    heroDied: boolean;
}

export interface HeroMonsterWeaponVolley extends MonsterWeaponVolleyBase {
    targetKind: 'hero';
    aimedAt: null;
}

export interface TargetMonsterWeaponVolley extends MonsterWeaponVolleyBase {
    targetKind: 'monster';
    aimedAt: Monster;
}

export type MonsterWeaponVolley = HeroMonsterWeaponVolley | TargetMonsterWeaponVolley;

export interface MonsterWeaponWield {
    attempted: true;
    launched: false;
    spentWielding: true;
    madeAttack?: false;
    heroDied: boolean;
}
