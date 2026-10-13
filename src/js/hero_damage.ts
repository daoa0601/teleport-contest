// C hack.c:losehp(). Damage belongs to the body the hero currently occupies.

import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { Monster } from './monster_types.js';
import type { DeathHandler } from './end.js';
import { Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { finishMonsterAttackDeath } from './monster_attack_death.js';
import { returnHeroToHumanForm } from './polyself.js';
import { formatHeardMessage } from './hero_speech.js';
import { hasPermanentIntrinsicProperty, propertyIsActive } from './properties.js';
import type { PropertyName } from './property_types.js';
import { stopRun } from './runmode.js';

interface HeroDamageOptions {
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
    deathCause?: string | null;
}

export async function loseHeroHp(amount: number, killer: string, {
    state = game,
    publish = plineWithContinuation,
    die = finishHeroDeath,
    deathCause = null,
}: HeroDamageOptions = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const current = polymorphed ? 'mh' : 'uhp';
    const maximum = polymorphed ? 'mhmax' : 'uhpmax';
    state.context.botl = true;
    stopRun(state);
    const hpBefore = hero[current];
    hero[current] -= amount;
    if (state.flags?.showdamage && amount)
        await publish(`[HP ${-amount}, ${hero[current]} left]`);
    hero[maximum] = Math.max(hero[maximum], hero[current]);
    if (hero[current] > 0) {
        if (amount > 0 && hero[current] * 10 < hero[maximum]
            && (!polymorphed || hero.unchanging || state.unchanging
                || propertyIsActive('unchanging', state))) await maybeWail(state, publish);
        return false;
    }
    if (polymorphed) {
        const result = await returnHeroToHumanForm(state, { publish, die });
        return result.died;
    }
    return die({ killer, deathCause,
        damage: { hpKey: current, hpBefore, damage: amount } });
}


// C hack.c:maybe_wail(): the cooldown advances even when sound is suppressed.
async function maybeWail(state: GameState, publish: MessagePublisher): Promise<void> {
    if (state.moves <= (state._wailMessageMove ?? 0) + 50) return;
    state._wailMessageMove = state.moves;
    const role = state.urole;
    const namedRole = role?.key === 'wizard' || role?.key === 'valkyrie';
    if (namedRole || state.urace?.name === 'elf') {
        const who = namedRole ? role.name.m : 'Elf';
        if (state.u.uhp === 1) {
            await publish(`${who} is about to die.`);
            return;
        }
        const powers: readonly PropertyName[] = [
            'teleportation', 'seeInvisible', 'poisonResistance', 'coldResistance',
            'shockResistance', 'fireResistance', 'sleepResistance', 'disintegrationResistance',
            'teleportControl', 'stealth', 'fast', 'invisible',
        ];
        const count = powers.filter(power => hasPermanentIntrinsicProperty(power, state)).length;
        await publish(count >= 4 ? `${who}, all your powers will be lost...`
            : `${who}, your life force is running out.`);
        return;
    }
    const warning = formatHeardMessage(state.u.uhp === 1
        ? 'the wailing of the Banshee...' : 'the howling of the CwnAnnwn...', state);
    if (warning) await publish(warning);
}

// C mhitu.c:mdamageu(). Unlike losehp(), this clamps current HP down to
// the existing maximum and does not stop running on zero-damage effects.
export async function damageHeroFromMonster(monster: Monster, amount: number, {
    state = game, publish = plineWithContinuation, die = finishMonsterAttackDeath,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    die?: typeof finishMonsterAttackDeath;
} = {}) {
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
    state.context.botl = true;
    hero[hpKey] -= amount;
    if (state.flags.showdamage && amount)
        await publish(`[HP ${-amount}, ${hero[hpKey]} left]`);
    hero[hpKey] = Math.min(hero[hpKey], hero[maximum]);
    if (hero[hpKey] > 0) return false;
    if (polymorphed)
        return (await returnHeroToHumanForm(state, { publish })).died;
    return die(monster);
}
