// C mhitm.c:explmm(), uhitm.c:mhitm_ad_blnd()/mhitm_ad_halu(),
// and explode.c:mon_explodes().

import { M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_MISS } from './const.js';
import { plineWithContinuation } from './display.js';
import { createElementalMonsterExplosion } from './explosion.js';
import { game, requirePlayingGame } from './gstate.js';
import { AD_COLD, AD_ELEC, AD_FIRE } from './monster_attack_types.js';
import { resolveMonsterCombatDamage } from './monster_combat_damage.js';
import type { ResolveMonsterCombatDamage } from './monster_combat_effect_types.js';
import { reportMonsterCombatNoise } from './monster_combat_messages.js';
import { MONSTER_LEVEL, monsterTypeName } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterName, possessiveName } from './monster_name.js';
import { d, rn2, rnd } from './rng.js';
import { cansee } from './vision.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { AttackTuple, RandomBelow, RollDice } from './monster_action_types.js';
import type { Monster } from './monster_types.js';

interface CombatExplosionOptions {
    state?: GameState;
    visible: boolean;
    publish?: MessagePublisher;
    random?: RandomBelow;
    rollDice?: RollDice;
    rollOne?: typeof rnd;
    resolveDamage?: ResolveMonsterCombatDamage;
}

export interface MonsterCombatExplosionResult {
    mask: number;
    heroDied: boolean;
    damage: number;
}

export async function resolveMonsterCombatExplosion(
    attacker: Monster, defender: Monster, attack: AttackTuple,
    { state = game, visible, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd,
        resolveDamage = (source, target, selected) => resolveMonsterCombatDamage(source, target, selected,
            { state, visible, publish, random, rollDice, rollOne }),
    }: CombatExplosionOptions,
): Promise<MonsterCombatExplosionResult> {
    requirePlayingGame(state);
    if (attacker.mcan) return { mask: M_ATTK_MISS, heroDied: false, damage: 0 };
    const [, damageType, dice, sides] = attack;
    if (cansee(attacker.mx, attacker.my)) {
        await publish(`${monsterName(attacker, { state, capitalized: true })} explodes!`);
    } else {
        await reportMonsterCombatNoise(attacker, state, { explosion: true, publish });
    }

    if (damageType === AD_FIRE || damageType === AD_COLD || damageType === AD_ELEC) {
        const damage = dice ? rollDice(dice, sides)
            : sides ? rollDice((MONSTER_LEVEL[attacker.mnum] ?? 0) + 1, sides) : 0;
        if (attacker.mhp > 0) {
            const death = await finishEnvironmentalMonsterDeath(attacker, state, {
                noCorpse: true, publish, random, rollDice,
            });
            if (death.heroDied)
                return { mask: M_ATTK_AGR_DIED, heroDied: true, damage };
        }
        // Death recovery may change the source's form before the blast.
        const killer = `${possessiveName(monsterTypeName(attacker.mnum, !!attacker.female))} explosion`;
        const blast = await createElementalMonsterExplosion(
            attacker.mx, attacker.my, damageType, damage, killer, { state, publish, random },
        );
        // explmm keeps AGR_DIED even when life saving leaves the source alive.
        const mask = M_ATTK_AGR_DIED | (defender.mhp <= 0 ? M_ATTK_DEF_DIED : 0);
        if (blast.heroDied) return { mask, heroDied: true, damage };
        if (attacker.mtame)
            await publish('You have a melancholy feeling for a moment, then it passes.');
        return { mask, heroDied: false, damage };
    }

    const outcome = await resolveDamage(attacker, defender, attack);
    let mask = outcome.nativeResult;
    if (outcome.heroDied) return { mask, heroDied: true, damage: outcome.damage };
    if (!(mask & M_ATTK_AGR_DIED)) {
        const wasLeashed = !!attacker.mleashed;
        const death = await finishEnvironmentalMonsterDeath(attacker, state, {
            noCorpse: true, publish, random, rollDice,
        });
        if (death.heroDied) return { mask: mask | M_ATTK_AGR_DIED, heroDied: true, damage: outcome.damage };
        if (death.survived) return { mask, heroDied: false, damage: outcome.damage };
        mask |= M_ATTK_AGR_DIED;
        if (wasLeashed) await publish('Your leash falls slack.');
    }
    if (attacker.mtame)
        await publish('You have a melancholy feeling for a moment, then it passes.');
    return { mask, heroDied: false, damage: outcome.damage };
}
