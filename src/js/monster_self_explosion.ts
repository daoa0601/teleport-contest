import type { Monster } from './monster_types.js';
import type { MonsterAttack } from './data_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import type { DamageType } from './monster_attack_types.js';
// Active monster self-explosions. Native mhitu.c:explmu(), explode.c:mon_explodes().
import { monsterHasArtifactDefense } from './artifacts.js';
import type { ArtifactDefenseQuery } from './artifacts.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { M_ATTK_AGR_DIED, M_ATTK_MISS, WATER } from './const.js';
import { canSeeMonster, canSpotMonster, plineWithContinuation } from './display.js';
import { impossible } from './diagnostics.js';
import { createElementalMonsterExplosion } from './explosion.js';
import { game, requirePlayingGame } from './gstate.js';
import { makeHallucinated } from './hero_mental_status.js';
import { AD_BLND, AD_COLD, AD_ELEC, AD_FIRE, AD_HALU, AD_STUN } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_LEVEL, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterName, possessiveName } from './monster_name.js';
import { wakeMonstersNear } from './monster_wake.js';
import { applyHeroGolemEffects } from './polyself.js';
import { d, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { cansee } from './vision.js';

const defense = new Map<DamageType, ArtifactDefenseQuery>([
    [AD_FIRE, 'fire'], [AD_COLD, 'cold'], [AD_ELEC, 'shock'],
    [AD_BLND, 'blindness'], [AD_HALU, 'hallucination'],
]);

async function removeExploder(monster: Monster, state: GameState, publish: MessagePublisher) {
    return finishEnvironmentalMonsterDeath(monster, state, {
        noCorpse: true, publish,
    });
}

export interface MonsterSelfExplosionOptions {
    foundHero: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
}

export async function resolveMonsterSelfExplosion(monster: Monster, attack: MonsterAttack, {
    foundHero, state = game, publish = plineWithContinuation, die,
}: MonsterSelfExplosionOptions) {
    requirePlayingGame(state);
    if (monster.mcan) return { mask: M_ATTK_MISS, heroDied: false };
    const [, damageType, dice, sides] = attack;
    let damage = d(dice, sides);
    let unaffected = monsterHasArtifactDefense(monster, defense.get(damageType), state);
    let killSource = true;
    if (foundHero) {
        await publish(`${monsterName(monster, { state, capitalized: true })} explodes!`);
    } else {
        const subject = canSeeMonster(monster)
            ? monsterName(monster, { state, capitalized: true }) : 'It';
        const water = state.level.at(monster.mux ?? state.u.ux, monster.muy ?? state.u.uy)?.typ === WATER;
        await publish(`${subject} explodes at a spot in ${water ? 'empty water' : 'thin air'}!`);
    }
    if (damageType !== AD_FIRE && damageType !== AD_COLD && damageType !== AD_ELEC
        && damageType !== AD_BLND && damageType !== AD_HALU) {
        await impossible(`unknown exploder damage type ${damageType}`);
    } else switch (damageType) {
    case AD_FIRE:
    case AD_COLD:
    case AD_ELEC: {
        const blastDamage = dice ? d(dice, sides)
            : sides ? d((MONSTER_LEVEL[monster.mnum] ?? 0) + 1, sides) : 0;
        if (monster.mhp > 0) {
            const death = await removeExploder(monster, state, publish);
            if (death.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
        }
        // Recovery can change the source's form. Fatal identity stays real,
        // while the area owner draws fresh hallucinated names for its targets.
        const killer = `${possessiveName(monsterTypeName(monster.mnum, !!monster.female))} explosion`;
        const blast = await createElementalMonsterExplosion(
            monster.mx, monster.my, damageType, blastDamage, killer, { state, publish, ...(die ? { die } : {}) },
        );
        if (blast.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
        if (monster.mhp > 0) killSource = false;
        break;
    }
    case AD_BLND:
        unaffected = heroResistsBlindingLight(state);
        if (foundHero && !unaffected) {
            // mon_visible() ignores the square's visibility, unlike canseemon().
            const visible = !monster.mundetected
                && (!monster.minvis || state.u.seeInvisible);
            if (!visible) damage = Math.trunc(damage / 2);
            if (visible || rnd(damage) > state.u.ulevel) {
                await publish('You are blinded by a blast of light!');
                await makeBlinded(damage, { state, talk: false, publish });
                if (!heroIsBlind(state)) await publish('Your vision quickly clears.');
            } else if (state.flags.verbose) {
                await publish('You get the impression it was not terribly bright.');
            }
        }
        break;
    case AD_HALU:
        unaffected ||= heroIsBlind(state)
            || ['black light', 'violet fungus'].includes(MONSTER_NAME[state.u.umonnum] || '')
            || (MONSTER_ATTACKS[state.u.umonnum] || []).some(([, kind]) => kind === AD_STUN);
        if (foundHero && !unaffected) {
            if (!heroIsHallucinating(state))
                await publish('You are caught in a blast of kaleidoscopic light!');
            const death = await removeExploder(monster, state, publish);
            if (death.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
            killSource = false;
            const changed = await makeHallucinated((state.u.hallucinationTurns || 0) + damage, {
                state, talk: false, publish,
            });
            await publish(changed ? 'You are freaked out.' : 'You seem unaffected.');
        }
        break;
    }
    if (unaffected) {
        await publish('You seem unaffected by it.');
        await applyHeroGolemEffects(damageType, damage, { state, publish });
    }
    if (killSource && monster.mhp > 0) {
        const death = await removeExploder(monster, state, publish);
        if (death.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
    }
    wakeMonstersNear(monster.mx, monster.my, 49, state);
    return { mask: monster.mhp > 0 ? M_ATTK_MISS : M_ATTK_AGR_DIED, heroDied: false };
}
