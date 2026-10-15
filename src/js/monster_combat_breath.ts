// C mthrowu.c:breamm(), with a monster target.

import { publishHeardMessage } from './hero_speech.js';
import { breatheFromMonster, breathWeaponName } from './breath_ray.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { rayDamageType } from './magic_types.js';
import { AD_MAGM, AD_RBRE, AD_SPC1, AD_SPC2 } from './monster_attack_types.js';
import { monsterName } from './monster_name.js';
import { monsterLinedUpWithMonster } from './monster_ranged_alignment.js';
import { displayRayName } from './ray_name.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { AttackTuple } from './monster_action_types.js';
import type { Monster } from './monster_types.js';

interface MonsterCombatBreathOptions {
    state: PlayingGameState;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
    publish?: MessagePublisher;
}

export interface MonsterCombatBreathResult {
    nativeResult: number;
    heroDied: boolean;
}

export async function resolveMonsterCombatBreath(
    source: Monster, target: Monster, attack: AttackTuple, {
        state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation,
    }: MonsterCombatBreathOptions,
): Promise<MonsterCombatBreathResult> {
    const damageType = attack[1] === AD_RBRE ? rayDamageType(random(8)) : attack[1];
    if (!monsterLinedUpWithMonster(source, target, state))
        return { nativeResult: M_ATTK_HIT, heroDied: false };
    if (source.mcan) {
        if (!heroIsDeaf(state)) {
            if (canSeeMonster(source))
                await publish(`${monsterName(source, { state, capitalized: true })} coughs.`);
            else await publishHeardMessage('a cough.', publish, state);
        }
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    if (source.mspec_used || !random(3)) return { nativeResult: M_ATTK_MISS, heroDied: false };
    if (damageType < AD_MAGM || damageType > AD_SPC2) {
        await impossible(`Breath weapon ${damageType - 1} used`, { state });
        return { nativeResult: M_ATTK_HIT, heroDied: !!state.program_state.gameover };
    }
    if (canSeeMonster(source)) {
        const name = monsterName(source, { state, capitalized: true });
        const weapon = heroIsHallucinating(state)
            ? displayRayName(damageType, 'breath', { state, random }).replace(/^blast of /, '')
            : damageType >= AD_SPC1 ? `strange breath #${damageType - 1}` : breathWeaponName(damageType);
        await publish(`${name} breathes ${weapon}!`);
    }
    const ray = await breatheFromMonster(source, target, {
        state, random, rollOne, rollDice, publish,
        attack: [attack[0], damageType, attack[2], attack[3]],
    });
    if (ray.heroDied) return { nativeResult: M_ATTK_HIT, heroDied: true };
    endVoluntaryMultiTurn(state);
    source.mspec_used = 8 + random(18);
    if (source.mtame && !source.isminion) {
        const pet = source.edog || source.mextra?.edog;
        if (!pet) throw new Error(`Breathing pet ${source.m_id} has no feeding state`);
        if (pet.hungrytime >= 10) pet.hungrytime -= 10;
    }
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}
