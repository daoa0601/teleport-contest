// Breath and monster-spell entry points for the shared native ray owner.
// C refs: polyself.c dobreathe(), mthrowu.c breamm(), and buzzmu().
import type { MonsterAttack } from './data_types.js';
import type { Monster } from './monster_types.js';
import type { NativeRayOptions } from './ray_attack.js';
import { game } from './gstate.js';
import { effectiveBreathDamage } from './hero_breath.js';
import { castNativeRay } from './ray_attack.js';

const DIRECTIONS = Object.freeze({
    h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
});

export interface BreathRayOptions extends NativeRayOptions {
    attack?: MonsterAttack | null;
}

export async function breatheInDirection(direction: string, {
    attack, state = game, sourceMonster = null, ...options
}: BreathRayOptions = {}) {
    if (!attack) return { used: false, heroDied: false, hits: 0 };
    const type = 20 + effectiveBreathDamage(attack[1]) - 1;
    return castNativeRay(sourceMonster ? -type : type, attack[2], direction, {
        ...options, state, sourceMonster,
    });
}

// A null sourceMonster is divine retribution, not a hero-caused ray.
export async function castMonsterSpellRay(
    direction: string, originX: number, originY: number,
    attack: MonsterAttack, options: NativeRayOptions = {},
) {
    return castNativeRay(-(10 + attack[1] - 1), attack[2], direction, {
        ...options, originX, originY,
    });
}

export async function breatheFromMonster(
    sourceMonster: Monster, target: Pick<Monster, 'mx' | 'my'>,
    options: BreathRayOptions = {},
) {
    const dx = Math.sign(target.mx - sourceMonster.mx);
    const dy = Math.sign(target.my - sourceMonster.my);
    const direction = Object.entries(DIRECTIONS).find(
        ([, delta]) => delta[0] === dx && delta[1] === dy)?.[0];
    if (!direction) return { used: false, heroDied: false, hits: 0 };
    return breatheInDirection(direction, {
        sayHit: false, sayMiss: false, ...options, sourceMonster,
        originX: sourceMonster.mx, originY: sourceMonster.my,
    });
}

export function breathWeaponName(damageType: number) {
    return ['', 'fragments', 'fire', 'frost', 'sleep gas',
        'a disintegration blast', 'lightning', 'poison gas', 'acid'][damageType] || 'strange breath';
}
