import type { Monster } from './monster_types.js';
import type { MonsterAttack } from './data_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
// Death explosions, including a blast contained inside another monster.
// C mon.c:corpse_chance(), explode.c:mon_explodes().
import { EXPL_NOXIOUS, MON_EXPLODE, PHYS_EXPL_TYPE } from './const.js';
import { canSeeMonster, canSpotMonster, plineWithContinuation } from './display.js';
import { explode } from './explosion.js';
import { game } from './gstate.js';
import { formatHeardMessage } from './hero_speech.js';
import { AT_BOOM } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_LEVEL, monsterCanEngulf, monsterTypeName } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterName, possessiveName } from './monster_name.js';
import { heroStomachName } from './body_parts.js';
import { loseHeroHp } from './hero_damage.js';
import { d, rn2 } from './rng.js';

function rollAttackDamage(monster: Monster, attack: MonsterAttack, rollDice: typeof d) {
    const [, , dice = 0, sides = 0] = attack;
    if (dice > 0) return rollDice(dice, sides);
    if (sides > 0) {
        const level = monster.m_lev
            ?? MONSTER_LEVEL[monster.mnum]
            ?? 0;
        return rollDice(level + 1, sides);
    }
    return 0;
}

export function monsterHasDeathExplosion(monster: Monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(attack => attack[0] === AT_BOOM);
}

export function monsterDeathSwallower(state: GameState = game) {
    const swallower = state._monsterSwallower;
    if (swallower && 'kind' in swallower) return swallower;
    return swallower && monsterCanEngulf(swallower) ? swallower : null;
}

export interface MonsterDeathExplosion {
    swallower: Monster | { kind: 'hero' } | null;
    damage: number;
}

export interface MonsterExplosionOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    heroCaused?: boolean;
}

export function rollMonsterDeathExplosion(monster: Monster, {
    state = game, rollDice = d,
}: Pick<MonsterExplosionOptions, 'state' | 'rollDice'> = {}): MonsterDeathExplosion | null {
    const attack = (MONSTER_ATTACKS[monster.mnum] || [])
        .find(candidate => candidate[0] === AT_BOOM);
    if (!attack) return null;

    const swallower = monsterDeathSwallower(state);
    const damage = rollAttackDamage(monster, attack, rollDice);
    // A map explosion rolls again in mon_explodes(); a contained one uses
    // corpse_chance()'s first roll and never visits the map blast owner.
    return { swallower, damage: swallower
        ? damage : rollAttackDamage(monster, attack, rollDice) };
}

export async function resolveMonsterDeathExplosion(monster: Monster, x: number, y: number, explosion: MonsterDeathExplosion, {
    state = game, publish = plineWithContinuation, random = rn2,
    rollDice = d, heroCaused = !state.context.mon_moving,
}: MonsterExplosionOptions = {}): Promise<{ heroDied: boolean }> {
    const { swallower, damage } = explosion;
    if (!swallower) {
        return createPhysicalMonsterExplosion(monster, x, y, damage, {
            state, publish, random, heroCaused,
        });
    }
    if ('kind' in swallower) {
        await publish(`There is an explosion in your ${heroStomachName(state)}!`);
        const physicalDamage = state.u.halfPhysicalDamage
            ? Math.trunc((damage + 1) / 2) : damage;
        const killer = `${possessiveName(monsterTypeName(monster.mnum, !!monster.female))} explosion`;
        return { heroDied: await loseHeroHp(physicalDamage, killer, { state, publish }) };
    }
    const heard = formatHeardMessage('an explosion.', state);
    if (heard) await publish(heard);
    swallower.mhp -= damage;
    if (swallower.mhp <= 0) {
        const death = await finishEnvironmentalMonsterDeath(swallower, state, {
            publish, random, rollDice,
        });
        if (death.heroDied || state.program_state.gameover) return { heroDied: true };
    }
    if (swallower.mhp <= 0) {
        if (canSpotMonster(swallower))
            await publish(`${monsterName(swallower, { state, capitalized: true })} rips open!`);
    } else if (canSeeMonster(swallower)) {
        await publish(`${monsterName(swallower, { state, capitalized: true })} seems to have indigestion.`);
    }
    return { heroDied: false };
}

export function createPhysicalMonsterExplosion(sourceMonster: Monster, x: number, y: number, damage: number, options: MonsterExplosionOptions = {}) {
    const killer = `${possessiveName(monsterTypeName(sourceMonster.mnum, !!sourceMonster.female))} explosion`;
    return explode(x, y, PHYS_EXPL_TYPE, damage, MON_EXPLODE, EXPL_NOXIOUS, { ...options, killer });
}
