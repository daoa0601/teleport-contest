// Native dokick.c:kick_monster(): a form's kick slots replace ordinary kicking.
import { M_ATTK_DEF_DIED, M_ATTK_MISS, Upolyd, W_ARMF } from './const.js';
import { specialContactDamage } from './contact_damage.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { findHeroMeleeHitThreshold, maybeUnparalyzeMeleeDefender, showHeroMeleeMiss, } from './hero_attack_accuracy.js';
import { resolveHeroNaturalDamage } from './hero_natural_damage.js';
import { heroSpecies } from './hero_species.js';
import { AT_KICK } from './monster_attack_types.js';
import { MONSTER_ATTACKS, monsterIsShade, requireMonsterData } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { applyHeroContactPassive } from './monster_passive.js';
import { rnd } from './rng.js';
export async function kickWithMonsterForm(monster, x, y) {
    requirePlayingGame(game);
    if (!Upolyd(game.u)
        || !requireMonsterData(MONSTER_ATTACKS, heroSpecies(game)).some(attack => attack[0] === AT_KICK))
        return false;
    const accuracy = await findHeroMeleeHitThreshold(monster, AT_KICK, null, { firstAttack: true });
    maybeUnparalyzeMeleeDefender(monster);
    for (let index = 0; index < 6; index++) {
        if (game.multi < 0 || (game._helplessTurns ?? 0) > 0)
            break;
        // A passive can change the body. Native kicking reads its live slots
        // directly, while retaining the accuracy calculated before the loop.
        const attack = requireMonsterData(MONSTER_ATTACKS, heroSpecies(game))[index];
        if (!attack || attack[0] !== AT_KICK)
            continue;
        const dieRoll = rnd(20);
        const special = specialContactDamage(game.u, monster, W_ARMF).damage;
        if (monsterIsShade(monster) && special === 0) {
            await plineWithContinuation(`Your kick passes harmlessly through ${monsterName(monster)}.`);
            break;
        }
        let hit = false;
        let defenderSurvived = true;
        if (accuracy.threshold > dieRoll) {
            await plineWithContinuation(`You kick ${monsterName(monster)}.`);
            const result = await resolveHeroNaturalDamage(monster, attack, special, { target: { x, y } });
            if (result.heroDied)
                return true;
            hit = result.nativeResult !== M_ATTK_MISS;
            defenderSurvived = !(result.nativeResult & M_ATTK_DEF_DIED);
        }
        else {
            const miss = await showHeroMeleeMiss(monster, attack, accuracy.threshold + accuracy.armorPenalty > dieRoll);
            if (miss.heroDied)
                return true;
        }
        const passive = await applyHeroContactPassive(monster, {
            hit, defenderSurvived, attackType: AT_KICK,
            weapon: game.uarmf || game.u.uarmf || null,
        });
        if (passive.heroDied || !defenderSurvived)
            break;
    }
    return true;
}
//# sourceMappingURL=hero_form_kick.js.map