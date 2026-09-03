import {
    continueMonsterWeaponVolley, finishDeferredRangedProjectileHit,
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

export function finishRangedAttacks(attacks, state, options = {}) {
    for (const attack of attacks || []) {
        let shot = attack.shots[0];
        while (shot) {
            finishDeferredRangedProjectileHit(
                shot, state, options.random,
            );
            shot = continueMonsterWeaponVolley(attack, state, options);
        }
    }
}
