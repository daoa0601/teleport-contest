import {
    AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC,
    AD_DRST, AD_ACID, AD_SPC1, AD_SPC2,
} from './monster_attack_types.js';
import type { DamageType } from './monster_attack_types.js';

export type InventoryDamageType = 'cold' | 'fire' | 'electric';
export type RayFloorKind = 'fire' | 'cold' | 'disintegration' | 'lightning'
    | 'acid' | 'poison' | 'magic' | 'death' | 'breath' | null;

export interface MagicDamageResult {
    damage: number;
    heroDied: boolean;
}

export interface RayFloorResult {
    absorbed: boolean;
    rangeChange: number;
    shopDamage?: boolean;
}

// Native ray types encode the source in the tens digit and the effect in units.
export function rayDamageType(type: number): DamageType {
    const effects: readonly DamageType[] = [AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE,
        AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2];
    const damage = effects[Math.abs(type) % 10];
    if (damage === undefined) throw new RangeError(`Invalid native ray type ${type}`);
    return damage;
}
