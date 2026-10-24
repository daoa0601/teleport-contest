import { game } from './gstate.js';
import { effectiveBreathDamage } from './hero_breath.js';
import { castNativeRay } from './ray_attack.js';
const DIRECTIONS = Object.freeze({
    h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
});
export async function breatheInDirection(direction, { attack, state = game, sourceMonster = null, ...options } = {}) {
    if (!attack)
        return { used: false, heroDied: false, hits: 0 };
    const type = 20 + effectiveBreathDamage(attack[1]) - 1;
    return castNativeRay(sourceMonster ? -type : type, attack[2], direction, {
        ...options, state, sourceMonster,
    });
}
// A null sourceMonster is divine retribution, not a hero-caused ray.
export async function castMonsterSpellRay(direction, originX, originY, attack, options = {}) {
    return castNativeRay(-(10 + attack[1] - 1), attack[2], direction, {
        ...options, originX, originY,
    });
}
export async function breatheFromMonster(sourceMonster, target, options = {}) {
    const dx = Math.sign(target.mx - sourceMonster.mx);
    const dy = Math.sign(target.my - sourceMonster.my);
    const direction = Object.entries(DIRECTIONS).find(([, delta]) => delta[0] === dx && delta[1] === dy)?.[0];
    if (!direction)
        return { used: false, heroDied: false, hits: 0 };
    return breatheInDirection(direction, {
        sayHit: false, sayMiss: false, ...options, sourceMonster,
        originX: sourceMonster.mx, originY: sourceMonster.my,
    });
}
export function breathWeaponName(damageType) {
    return ['', 'fragments', 'fire', 'frost', 'sleep gas',
        'a disintegration blast', 'lightning', 'poison gas', 'acid',
        'strange breath #8', 'strange breath #9'][damageType] || 'strange breath';
}
//# sourceMappingURL=breath_ray.js.map