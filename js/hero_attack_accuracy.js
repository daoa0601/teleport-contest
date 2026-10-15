// Native uhitm.c:find_roll_to_hit(), mon_maybe_unparalyze(), and missum().
import { currentAttribute } from './attrib.js';
import { heroUsesMartialArts } from './barehand_combat.js';
import { A_DEX, A_STR, STR18, Upolyd, } from './const.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { heroSeductionCompatibility } from './hero_form_contact.js';
import { heroSpecies } from './hero_species.js';
import { AT_CLAW, AT_KICK, AT_WEAP } from './monster_attack_types.js';
import { MONSTER_FLAGS2, MONSTER_LEVEL, requireMonsterData } from './monster_data.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { adjustedMonsterLevel } from './monster_hit_points.js';
import { monsterName } from './monster_name.js';
import { findMonsterArmorClass } from './monworn.js';
import { rn2 } from './rng.js';
import { weaponSkillHitBonus } from './skills.js';
import { weaponHitBonus } from './weapon_accuracy.js';
import { nearCapacity } from './weight.js';
const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
export async function findHeroMeleeHitThreshold(monster, method, weapon, { firstAttack, state = game }) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const species = heroSpecies(state);
    const luck = (hero.uluck ?? 0) + (hero.moreluck ?? 0);
    let threshold = 1 + heroAttributeHitBonus(state) + findMonsterArmorClass(monster)
        + (hero.uhitinc ?? 0) + Math.sign(luck) * Math.trunc((Math.abs(luck) + 2) / 3)
        + (polymorphed ? requireMonsterData(MONSTER_LEVEL, species) : hero.ulevel);
    let armorPenalty = 0;
    if (firstAttack)
        await applyCaitiffPenalty(monster, state);
    if (monster.mstun)
        threshold += 2;
    if (monster.mflee)
        threshold += 2;
    if (monster.msleeping)
        threshold += 2;
    if (!monster.mcanmove)
        threshold += 4;
    if (state.urole?.key === 'monk' && !polymorphed) {
        if (state.uarm || hero.uarm) {
            armorPenalty = state.urole.spellcasting.armor;
            threshold -= armorPenalty;
        }
        else if (!(state.uwep || hero.uwep) && !(state.uarms || hero.uarms)) {
            threshold += Math.trunc(hero.ulevel / 3) + 2;
        }
    }
    const elvenHero = polymorphed
        ? !!(requireMonsterData(MONSTER_FLAGS2, species) & M2_ELF)
        : state.urace?.name === 'elf';
    if (elvenHero && (requireMonsterData(MONSTER_FLAGS2, monster.mnum) & M2_ORC))
        threshold++;
    const burden = nearCapacity(state);
    if (burden)
        threshold -= burden * 2 - 1;
    if (hero.utrap)
        threshold -= 3;
    if (method === AT_WEAP || method === AT_CLAW) {
        if (weapon)
            threshold += weaponHitBonus(weapon, monster, { state });
        threshold += weaponSkillHitBonus(weapon, state);
    }
    else if (method === AT_KICK && heroUsesMartialArts(state)) {
        threshold += weaponSkillHitBonus(null, state);
    }
    return { threshold, armorPenalty };
}
export function maybeUnparalyzeMeleeDefender(monster, random = rn2) {
    if (!monster.mcanmove && random(10) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
    }
}
export async function showHeroMeleeMiss(monster, attack, wouldHaveHit, { state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    if (wouldHaveHit)
        await publish('Your armor is rather cumbersome...');
    if (heroSeductionCompatibility(monster, attack, state)) {
        await publish(`You pretend to be friendly to ${monsterName(monster, { state })}.`);
    }
    else if (canSpotMonster(monster) && state.flags.verbose !== false) {
        await publish(`You miss ${monsterName(monster, { state })}.`);
    }
    else {
        await publish('You miss it.');
    }
    if (!monster.msleeping && monster.mcanmove)
        return wakeAttackedMonster(monster);
    return { heroDied: false };
}
// weapon.c:abon(). A monster form uses adjusted monster level, including
// dungeon difficulty; its base species level is added separately above.
function heroAttributeHitBonus(state) {
    if (Upolyd(state.u))
        return adjustedMonsterLevel(heroSpecies(state)) - 3;
    const strength = currentAttribute(A_STR, state);
    const dexterity = currentAttribute(A_DEX, state);
    let bonus = strength < 6 ? -2 : strength < 8 ? -1 : strength < 17 ? 0
        : strength < STR18(50) ? 1 : strength < STR18(100) ? 2 : 3;
    if ((state.u.ulevel ?? 1) < 3)
        bonus++;
    return bonus + (dexterity < 4 ? -3 : dexterity < 6 ? -2
        : dexterity < 8 ? -1 : dexterity < 14 ? 0 : dexterity - 14);
}
//# sourceMappingURL=hero_attack_accuracy.js.map