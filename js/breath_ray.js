import { game } from './gstate.js';
import { effectiveBreathDamage } from './zap.js';
import { buzz, ubuzz } from './zap.js';
const DIRECTIONS = Object.freeze({
    h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
});
// Part of C polyself.c:dobreathe(): the hero's ubuzz(BZ_U_BREATH(...))
// breath ray.
export async function breatheInDirection(direction, { attack, state = game, sourceMonster = null, ...options } = {}) {
    if (!attack)
        return { used: false, heroDied: false, hits: 0 };
    const type = 20 + effectiveBreathDamage(attack[1]) - 1;
    return (sourceMonster ? buzz : ubuzz)(sourceMonster ? -type : type, attack[2], direction, {
        ...options, state, sourceMonster,
    });
}
// Part of C mcastu.c:buzzmu(): the buzz(BZ_M_SPELL(...)) monster-spell
// ray.
// A null sourceMonster is divine retribution, not a hero-caused ray.
export async function castMonsterSpellRay(direction, originX, originY, attack, options = {}) {
    return buzz(-(10 + attack[1] - 1), attack[2], direction, {
        ...options, originX, originY,
    });
}
// Part of C mthrowu.c:breamm(): aiming the monster's breath at its
// target.
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
// C mthrowu.c:breathwep_name(): ordinary breath names; callers handle hallucination.
export function breathWeaponName(damageType) {
    return ['', 'fragments', 'fire', 'frost', 'sleep gas',
        'a disintegration blast', 'lightning', 'poison gas', 'acid',
        'strange breath #8', 'strange breath #9'][damageType] || 'strange breath';
}
//# sourceMappingURL=breath_ray.js.map