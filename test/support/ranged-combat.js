import {
    continueMonsterWeaponVolley, hitHeroWithMonsterProjectile, finishMonsterProjectile,
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
    const effects = { publish: async () => {}, ...options };
    for (const attack of attacks || []) {
        let shot = attack.shots[0];
        while (shot) {
            if (shot.heroTarget) {
                const result = await hitHeroWithMonsterProjectile(shot, state, effects);
                if (result.died) return;
            }
            await finishMonsterProjectile(
                shot, state, effects,
            );
            shot = continueMonsterWeaponVolley(attack, state, options);
        }
    }
}
