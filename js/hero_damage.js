// C hack.c:losehp(). Damage belongs to the body the hero currently occupies.
import { Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { finishMonsterAttackDeath } from './monster_attack_death.js';
import { returnHeroToHumanForm } from './polyself.js';
import { stopRun } from './runmode.js';
export async function loseHeroHp(amount, killer, { state = game, publish = plineWithContinuation, die = finishHeroDeath, deathCause = null, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const current = polymorphed ? 'mh' : 'uhp';
    const maximum = polymorphed ? 'mhmax' : 'uhpmax';
    stopRun(state);
    const hpBefore = hero[current];
    hero[current] -= amount;
    if (state.flags?.showdamage && amount)
        await publish(`[HP ${-amount}, ${hero[current]} left]`);
    hero[maximum] = Math.max(hero[maximum], hero[current]);
    if (hero[current] > 0)
        return false;
    if (polymorphed) {
        const result = await returnHeroToHumanForm(state, { publish, die });
        return result.died;
    }
    return die({ killer, deathCause,
        damage: { hpKey: current, hpBefore, damage: amount } });
}
// C mhitu.c:mdamageu(). Unlike losehp(), this clamps current HP down to
// the existing maximum and does not stop running on zero-damage effects.
export async function damageHeroFromMonster(monster, amount, { state = game, publish = plineWithContinuation, die = finishMonsterAttackDeath, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (amount < 0) {
        await impossible(`mdamageu for negative damage? (${amount})`);
        amount = 0;
    }
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const hpKey = polymorphed ? 'mh' : 'uhp';
    const maximum = polymorphed ? 'mhmax' : 'uhpmax';
    const hpBefore = hero[hpKey];
    hero[hpKey] -= amount;
    if (state.flags.showdamage && amount)
        await publish(`[HP ${-amount}, ${hero[hpKey]} left]`);
    hero[hpKey] = Math.min(hero[hpKey], hero[maximum]);
    if (hero[hpKey] > 0)
        return false;
    if (polymorphed)
        return (await returnHeroToHumanForm(state, { publish })).died;
    return die(monster, { damage: { hpKey, hpBefore, damage: amount } });
}
//# sourceMappingURL=hero_damage.js.map