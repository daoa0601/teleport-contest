// mthrowu.js — Hero-facing ranged attacks a monster launches from its own
// square: the weapon throw or polearm poke of thrwmu() and the breath setup
// of breamu(). The monster-target twins live in monster_throw.js and
// monster_combat_breath.js; the deferred ray completion stays with the
// attack-slot machinery in monmove.js.
import { BOLT_LIM, M_ATTK_HIT, M_ATTK_MISS, M_SEEN_REFL } from './const.js';
import { dist2, distmin } from './hacklib.js';
import { AD_RBRE } from './monster_attack_types.js';
import { requirePerceivedHero, seenResistanceForDamage } from './monster_perception.js';
import { monsterLinedUpWithPerceivedHero } from './monster_ranged_alignment.js';
import { attackHeroWithPolearm } from './monster_polearm.js';
import { readyRangedMonsterWeapon, throwMonsterWeaponAtHero } from './monster_throw.js';
import { selectMonsterRangedWeapon } from './monster_weapon.js';
import { recordRandom } from './monster_action_types.js';
import { isPolearm, returningWeaponRangeSquared, willWeld } from './weapon_type.js';
import { couldsee } from './vision.js';
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
// C mthrowu.c:thrwmu(). Readies the launcher, then throws the selected
// weapon at the hero; a polearm pokes instead, and a returning weapon only
// flies inside its Mjollnir-band squared distance.
export async function attackHeroWithRangedWeapon(monster, state, random, rollOne, calls, publish) {
    requirePerceivedHero(monster);
    if (await readyRangedMonsterWeapon(monster, state)) {
        return;
    }
    const weapon = selectMonsterRangedWeapon(monster, state)?.weapon;
    if (!weapon)
        return;
    if (isPolearm(weapon)) {
        await attackHeroWithPolearm(monster, weapon, state, { random, rollOne });
        return;
    }
    const returnRange = returningWeaponRangeSquared(weapon);
    const returning = returnRange !== null && !willWeld(weapon);
    if (returning &&
        (dist2(monster.mx, monster.my, monster.mux, monster.muy) > returnRange ||
            !couldsee(monster.mx, monster.my)))
        return;
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls))
        return;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const distance = distmin(monster.mx, monster.my, heroX, heroY);
    const previousDistance = distmin(monster.mx, monster.my, state?.u?.ux0 ?? heroX, state?.u?.uy0 ?? heroY);
    if (distance > previousDistance &&
        !returning &&
        recordRandom(random, calls, BOLT_LIM - distmin(monster.mx, monster.my, monster.mux, monster.muy)) !== 0)
        return;
    return await throwMonsterWeaponAtHero(monster, state, weapon, {
        random: (range) => recordRandom(random, calls, range),
        rollOne, publish,
    });
}
// C mthrowu.c:breamu(). Rolls the breath type, applies the cough, known-
// resistance, and recharge gates, and hands the slot a deferred ray.
export function maybeBreatheAtHero(monster, attack, state, random, calls) {
    let damageType = attack[1];
    const dice = attack[2];
    const sides = attack[3];
    if (damageType === AD_RBRE)
        damageType = 1 + recordRandom(random, calls, 8);
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls))
        return { launched: false, nativeResult: M_ATTK_HIT };
    if (monster.mcan) {
        return {
            attempted: true,
            launched: false,
            nativeResult: M_ATTK_MISS,
            cough: true,
            damageType,
            dice,
            sides,
        };
    }
    if ((monster.seen_resistance || 0) & (seenResistanceForDamage(damageType) | M_SEEN_REFL))
        return {
            attempted: true,
            launched: false,
            nativeResult: M_ATTK_HIT,
            damageType,
            dice,
            sides,
        };
    if ((monster.mspec_used ?? 0) || recordRandom(random, calls, 3) === 0) {
        return {
            attempted: true,
            launched: false,
            nativeResult: M_ATTK_MISS,
            damageType,
            dice,
            sides,
        };
    }
    const targetX = isFiniteNumber(monster.mux) ? monster.mux : (state?.u?.ux ?? monster.mx);
    const targetY = isFiniteNumber(monster.muy) ? monster.muy : (state?.u?.uy ?? monster.my);
    return {
        attempted: true,
        launched: true,
        nativeResult: M_ATTK_HIT,
        deferredRay: true,
        damageType,
        dice,
        sides,
        targetX,
        targetY,
        x: monster.mx,
        y: monster.my,
        dx: Math.sign(targetX - monster.mx),
        dy: Math.sign(targetY - monster.my),
    };
}
//# sourceMappingURL=mthrowu.js.map