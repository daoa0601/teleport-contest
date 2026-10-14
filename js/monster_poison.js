// Poison delivered by monster attacks. C uhitm.c:mhitm_ad_drst(),
// mhitm_really_poison(), and mhitu.c:mpoisons_subj().
import { A_CON, A_DEX, A_STR } from './const.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { AD_DRCO, AD_DRDX, AD_DRST, AT_BITE, AT_GAZE, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterTypeName } from './monster_data.js';
import { monsterHasPoisonResistance } from './monster_resistance.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { poisonHero } from './poison.js';
import { rn2 } from './rng.js';
export function poisonAttackAttribute(damageType) {
    if (damageType === AD_DRST)
        return A_STR;
    if (damageType === AD_DRDX)
        return A_DEX;
    if (damageType === AD_DRCO)
        return A_CON;
    return null;
}
export async function poisonHeroFromMonster(monster, attackType, { attribute = A_STR, fatal = 30, chance = 1, state = game, random = rn2, publish = plineWithContinuation, ...options } = {}) {
    if (chance > 1 && random(chance) !== 0)
        return { died: false };
    const subject = canSpotMonster(monster)
        ? possessiveName(monsterName(monster, { state, capitalized: true })) : 'Its';
    return poisonHero({
        ...options, state, random, publish, attribute, fatal,
        reason: `${subject} ${poisonAttackNoun(monster, attackType)}`,
        killer: monsterTypeName(monster.mnum, !!monster.female),
    });
}
export async function poisonMonsterFromAttack(attacker, defender, attackType, damage, { visible, state = game, random = rn2, publish = plineWithContinuation, }) {
    const attackerSpotted = canSpotMonster(attacker);
    const defenderSpotted = canSpotMonster(defender);
    if (visible && attackerSpotted) {
        await publish(`${possessiveName(monsterName(attacker, { state, capitalized: true }))} ${poisonAttackNoun(attacker, attackType)} was poisoned!`);
    }
    if (monsterHasPoisonResistance(defender)) {
        if (visible && attackerSpotted && defenderSpotted) {
            const target = monsterName(defender, { state });
            await publish(`The poison doesn't seem to affect ${target}.`);
        }
        return damage;
    }
    damage += 6 + random(10);
    if (damage >= defender.mhp && visible && defenderSpotted)
        await publish('The poison was deadly...');
    return damage;
}
function poisonAttackNoun(monster, attackType) {
    if (attackType === AT_WEAP)
        return monsterWieldedWeapon(monster)?.opoisoned ? 'weapon' : 'attack';
    if (attackType === AT_TUCH)
        return 'contact';
    if (attackType === AT_GAZE)
        return 'gaze';
    return attackType === AT_BITE ? 'bite' : 'sting';
}
//# sourceMappingURL=monster_poison.js.map