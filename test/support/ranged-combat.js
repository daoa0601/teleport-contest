import {
    continueMonsterWeaponVolley, finishHeroProjectileHit, finishMonsterProjectile,
} from '../../js/monster_throw.js';
import { freshObjectRoom } from './object-room.js';

export function freshRangedCombatRoom(options = {}) {
    const level = freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 12,
        recalculateVision: false,
        ...options,
    });
    return level;
}

export async function finishRangedAttacks(attacks, state, options = {}) {
    for (const attack of attacks || []) {
        let shot = attack.shots[0];
        while (shot) {
            if (shot.heroTarget && shot.hit) {
                const result = await finishHeroProjectileHit(shot, state, options);
                if (result.died) return;
            }
            await finishMonsterProjectile(
                shot, state, options,
            );
            shot = continueMonsterWeaponVolley(attack, state, options);
        }
    }
}
