// C mhitu.c:getmattk(). Select one live attack slot and apply its contextual
// replacement before any hit rolls. The pinned sysconf leaves SEDUCE enabled.
import { artifactById } from './artifacts.js';
import { M_ATTK_MISS } from './const.js';
import { requireLiveGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { AD_ACID, AD_COLD, AD_DISE, AD_DREN, AD_ELEC, AD_FAMN, AD_FIRE, AD_PEST, AD_PHYS, AD_POLY, AD_STCK, AD_STUN, AT_CLAW, AT_ENGL, AT_HUGS, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { MONSTER_ATTACKS, monsterIsShade } from './monster_data.js';
import { isHomeElemental } from './monster_hit_points.js';
import { monsterHasColdResistance } from './monster_resistance.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { CORPSE } from './object_data.js';
import { touchPetrifies } from './stoning.js';
export function selectAttack(attacker, defender, attackIndex, previousResults, state) {
    requireLiveGame(state);
    const attackerSpecies = actorSpecies(attacker, state);
    const attacks = MONSTER_ATTACKS[attackerSpecies];
    const attack = attacks?.[attackIndex];
    if (!attack || !Number.isInteger(attackIndex))
        throw new RangeError(`Species ${attackerSpecies} has no attack slot ${attackIndex}.`);
    const [method, damage, dice, sides] = attack;
    if (attackIndex > 0 && (previousResults[attackIndex - 1] ?? M_ATTK_MISS) > M_ATTK_MISS
        && [AD_DISE, AD_PEST, AD_FAMN].includes(damage)
        && damage === attacks?.[attackIndex - 1]?.[1]) {
        return [method, AD_STUN, dice, sides];
    }
    if (damage === AD_DREN && isHero(defender, state)) {
        return energyDrainAttack(attack, state);
    }
    // Native youmonst.mspec_used stays zero. The hero's ability delays are
    // separate state; monster cooldowns must never suppress a hero's form.
    if (!isHero(attacker, state) && attacker.mspec_used
        && (method === AT_ENGL || method === AT_HUGS || damage === AD_STCK || damage === AD_POLY)) {
        if ([AD_ACID, AD_ELEC, AD_COLD, AD_FIRE].includes(damage))
            return [AT_TUCH, damage, 1, 6];
        return sides === 0 ? [AT_TUCH, AD_PHYS, 0, 0] : [AT_CLAW, AD_PHYS, 1, 6];
    }
    if (attackIndex === 0 && !isHero(attacker, state)
        && method === AT_WEAP && damage !== AD_PHYS
        && !(attacks?.[1]?.[0] === AT_WEAP && attacks[1][1] === AD_PHYS)) {
        const weapon = monsterWieldedWeapon(attacker);
        const petrifyingWeapon = weapon?.otyp === CORPSE && touchPetrifies(weapon.corpsenm);
        const artifact = artifactById(weapon?.oartifact, state);
        if (attacker.mcan || petrifyingWeapon
            || artifact?.enumName === 'STORMBRINGER' || artifact?.enumName === 'VORPAL_BLADE')
            return [method, AD_PHYS, dice, sides];
    }
    if (attackIndex === 0 && method === AT_TUCH && damage === AD_COLD
        && actorResistsCold(defender, state) && !monsterIsShade({ mnum: actorSpecies(defender, state) })) {
        return [method, AD_PHYS, Math.trunc((dice + 1) / 2), sides === 10 ? 6 : sides];
    }
    // Every replacement above used C's alternate buffer, including unchanged
    // energy dice. Only an unmodified source slot gets the home-plane bonus.
    return isHomeElemental(attackerSpecies) ? [method, damage, dice * 2, sides] : attack;
}
function isHero(actor, state) {
    return actor === state.u;
}
function actorSpecies(actor, state) {
    return isHero(actor, state) ? heroSpecies(state) : actor.mnum;
}
function actorResistsCold(actor, state) {
    return isHero(actor, state) ? !!state.u.coldResistance : monsterHasColdResistance(actor);
}
function energyDrainAttack(attack, state) {
    const [method, damage] = attack;
    let [, , dice, sides] = attack;
    const level = Math.max(state.u.ulevel, 6);
    if (state.u.uen <= 5 * level && dice > 1) {
        dice--;
        if (state.u.uenmax <= 2 * level && sides > 3)
            sides -= 3;
    }
    else if (state.u.uen > 12 * level) {
        dice++;
        if (state.u.uenmax > 20 * level)
            sides += 3;
    }
    return [method, damage, dice, sides];
}
//# sourceMappingURL=attack_selection.js.map