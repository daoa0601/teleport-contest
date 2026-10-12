// C monmove.c:mind_blast(). Psychic attacks precede ordinary movement.
import { BOLT_LIM, M_AP_MONSTER, M_AP_NOTHING } from './const.js';
import { canSeeMonster, canSenseMonster, newsym, plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { dist2 } from './hacklib.js';
import { heroHasConflict } from './hero_conflict.js';
import { loseHeroHp } from './hero_damage.js';
import { wakeMonster } from './monster_anger.js';
import { AD_DRIN } from './monster_attack_types.js';
import { monsterIsMindless, monsterIsTelepathic } from './monster_data.js';
import { finishMonsterKilled } from './monster_death.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { propertyIsActive } from './properties.js';
import { rn2, rnd } from './rng.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { cansee } from './vision.js';

export async function useMonsterMindBlast(
    monster: Monster, state: PlayingGameState, {
        resistsConflict, random = rn2, rollOne = rnd, publish = plineWithContinuation,
    }: {
        resistsConflict: () => boolean;
        random?: typeof rn2;
        rollOne?: typeof rnd;
        publish?: MessagePublisher;
    },
): Promise<boolean> {
    if (canSeeMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} concentrates.`);
    if (dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > BOLT_LIM * BOLT_LIM) {
        await publish('You sense a faint wave of psychic energy.');
        return false;
    }
    await publish('A wave of psychic energy pours over you!');
    if (monster.mpeaceful && (!heroHasConflict(state) || resistsConflict())) {
        await publish('It feels quite soothing.');
    } else if (!state.u.invulnerable) {
        const sensed = canSenseMonster(monster);
        const telepathic = !!state.u.telepathy || propertyIsActive('telepathy', state);
        if (sensed || (telepathic && random(2) !== 0) || random(10) === 0) {
            revealHeroToPsychicBlast(state);
            await publish(`It locks on to your ${sensed ? 'telepathy' : telepathic ? 'latent telepathy' : 'mind'}!`);
            let damage = rollOne(15);
            if (heroHasHalfSpellDamage(state)) damage = Math.trunc((damage + 1) / 2);
            if (await loseHeroHp(damage, 'psychic blast', { state, publish })) return true;
        }
    }
    for (const target of Array.from(state.level.monsters)) {
        if (target.dead || target.mhp <= 0 || target === monster
            || !!target.mpeaceful === !!monster.mpeaceful || monsterIsMindless(target.mnum)) continue;
        if (!((monsterIsTelepathic(target.mnum) && (random(2) !== 0 || target.mblinded))
            || random(10) === 0)) continue;
        await wakeMonster(target);
        if (cansee(target.mx, target.my))
            await publish(`It locks on to ${monsterName(target, { state })}.`);
        target.mhp -= rollOne(15);
        if (target.mhp <= 0) {
            const death = await finishMonsterKilled(target, state, { damageType: AD_DRIN, publish, random });
            if (death.heroDied) return true;
        }
    }
    return false;
}

function revealHeroToPsychicBlast(state: PlayingGameState): void {
    if (state.u.uundetected) {
        state.u.uundetected = false;
        newsym(state.u.ux, state.u.uy);
    } else if (state.u.m_ap_type && state.u.m_ap_type !== M_AP_MONSTER) {
        state.u.m_ap_type = M_AP_NOTHING;
        state.u.mappearance = 0;
        newsym(state.u.ux, state.u.uy);
    }
}
