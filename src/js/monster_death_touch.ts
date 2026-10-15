// C uhitm.c:mhitm_ad_deth() and mcastu.c:touch_of_death().
import { formatFeltMessage } from './hero_speech.js';
import { KILLED_BY, Upolyd } from './const.js';
import type { MessagePublisher } from './display.js';
import { shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import type { PlayingGameState } from './game_state.js';
import { loseHeroHp } from './hero_damage.js';
import { heroSpecies } from './hero_species.js';
import type { HeroContactAttack } from './monster_action_types.js';
import { monsterIsUndead } from './monster_data.js';
import { monsterSpellDeathReason } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { returnHeroToHumanForm } from './polyself.js';
import { d, type rn2 } from './rng.js';

export async function resolveDeathTouchContact(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollDice: typeof d,
): Promise<void> {
    if (monsterIsUndead(heroSpecies(state))) {
        attack.damage = Math.trunc(((attack.damage ?? 0) + 1) / 2);
        await publish('Was that the touch of death?');
        return;
    }
    const outcome = random(20);
    if (outcome >= 17 && !state.u.antimagic) {
        attack.heroDied = await touchHeroWithDeath(monster, state, publish, rollDice);
        attack.damage = 0;
    } else if (outcome >= 5) {
        await publish(formatFeltMessage('your life force draining away...', state));
        attack.permanentDamage = true;
    } else {
        if (state.u.antimagic) await shieldeff(state.u.ux, state.u.uy, state);
        await publish("Lucky for you, it didn't work!");
        attack.damage = 0;
    }
}

// Spellcasting tests its own immunity and success gates before entering here.
// Death's natural touch uses the same effect without those spell gates.
export async function touchHeroWithDeath(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher, rollDice = d,
): Promise<boolean> {
    const damage = 50 + rollDice(8, 6);
    const drain = Math.trunc(damage / 2);
    await publish(formatFeltMessage('drained...', state));
    const killer = monsterSpellDeathReason(monster, 'the touch of death');
    const hero = state.u;
    if (Upolyd(hero)) {
        hero.mh = 0;
        return (await returnHeroToHumanForm(state, { publish })).died;
    }
    if (drain >= hero.uhpmax)
        return finishHeroDeath({ killer, killerFormat: KILLED_BY, deathLineShown: true });

    const oldHp = hero.uhp;
    hero.uhpmax = Math.max(hero.ulevel, 3, hero.uhpmax - drain);
    hero.uhp = Math.min(hero.uhp, hero.uhpmax);
    state.context.botl = true;
    const remainingDamage = Math.max(1, damage - (oldHp - hero.uhp));
    return loseHeroHp(remainingDamage, killer, { state, publish, killerFormat: KILLED_BY });
}
