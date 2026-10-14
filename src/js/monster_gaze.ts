import type { Monster } from './monster_types.js';
import type { MonsterAttack } from './data_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { MonsterCallLog } from './monster_action_types.js';
import type { finishMonsterAttackDeath } from './monster_attack_death.js';
// Active monster gazes. Native mhitu.c gazemu() and mon.c m_respond_medusa().
import { heroResistsBlindingLight } from './blinding_attack.js';
import { BOLT_LIM, KILLED_BY, M_ATTK_MISS, M_ATTK_AGR_DIED, M_SEEN_FIRE, STONING } from './const.js';
import { canSeeMonster, plineWithContinuation, shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requirePlayingGame } from './gstate.js';
import { burnAwayHeroSlime } from './hack.js';
import { stopHeroOccupation } from './occupation.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { monsterHasLineOfSightToHero } from './monster_perception.js';
import { makeConfused, makeStunned } from './hero_mental_status.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroIsUnaware } from './hero_sleep.js';
import { igniteItems } from './light.js';
import { AD_BLND, AD_CONF, AD_FIRE, AD_STON, AD_STUN, AT_GAZE } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME, MONSTER_RESISTS, monsterTypeName } from './monster_data.js';
import { monsterName, monsterPossessive, possessiveName } from './monster_name.js';
import { monstersObserveHeroResistance, monstersForgetHeroResistance } from './monster_perception.js';
import { monsterPolymorphsWhenStoned } from './monster_stoning.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION } from './object_data.js';
import { applyHeroGolemEffects, polymonHero } from './polyself.js';
import { discoverHeroReflectionSource, heroReflectionSource, heroReflectsRay, monsterReflectionSource } from './ray.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { heroResistsStoning } from './stoning.js';
import { burnArmorByFire } from './trap.js';
import { couldsee } from './vision.js';
import { destroyInventoryByElement } from './zap.js';

const reactions = ['confused', 'stunned', 'puzzled', 'dazzled', 'irritated', 'inflamed', 'tired', 'dulled'];


function identifyGazeReflection(source: ReturnType<typeof heroReflectionSource>, state: GameState) {
    const object = source?.object;
    if (object && [SHIELD_OF_REFLECTION, AMULET_OF_REFLECTION].includes(object.otyp)) {
        discoverHeroReflectionSource(source, state);
    }
}

export interface MonsterGazeOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    calls?: MonsterCallLog;
    die?: typeof finishMonsterAttackDeath;
}

export async function resolveMonsterGaze(monster: Monster, attack: MonsterAttack, {
    state = game, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd,
    calls = [], die,
}: MonsterGazeOptions = {}) {
    requirePlayingGame(state);
    const [, damageType, dice, sides] = attack;
    if (damageType === AD_FIRE && ((monster.seen_resistance ?? 0) & M_SEEN_FIRE))
        return { mask: M_ATTK_MISS, heroDied: false };
    const visible = () => canSeeMonster(monster);
    const name = (capitalized = true) => monsterName(monster, { state, capitalized });
    const mutualGaze = visible() && couldsee(monster.mx, monster.my) && monster.mcansee;
    const medusa = MONSTER_NAME[monster.mnum] === 'Medusa';
    const reflectable = heroReflectsRay(state) && couldsee(monster.mx, monster.my) && medusa;
    let cancelled = !!monster.mcan;
    if ((heroIsHallucinating(state) && random(4)) || (heroIsUnaware(state) && !reflectable))
        cancelled = true;
    // Native gazemu has effects only for these gaze damage types.
    if (damageType !== AD_STON && damageType !== AD_CONF && damageType !== AD_STUN
        && damageType !== AD_BLND && damageType !== AD_FIRE)
        return { mask: M_ATTK_MISS, heroDied: !!state.program_state.gameover };
    let reaction = -1;
    let already = false;
    switch (damageType) {
    case AD_STON:
        if (cancelled || !monster.mcansee) {
            if (!visible()) break;
            if (heroIsUnaware(state)) { reaction = medusa ? 4 : 2; break; }
            if (medusa && heroIsHallucinating(state) && random(3) === 0)
                await publish('Someone seems overdue for a serpent cut.');
            else await publish(`${name()} gazes ineffectually.`);
            break;
        }
        if (reflectable) {
            const seen = visible();
            const reflection = heroReflectionSource(state);
            if (seen && reflection) {
                await publish(`${possessiveName(name())} gaze is reflected by your ${reflection.noun}.`);
                identifyGazeReflection(reflection, state);
            }
            const reflectedBack = monsterReflectionSource(monster, state);
            if (reflectedBack) {
                if (seen) {
                    await publish(`The gaze is reflected away by ${possessiveName(name(false))} ${reflectedBack.noun}!`);
                    identifyGazeReflection(reflectedBack, state);
                }
                break;
            }
            if (!monsterHasLineOfSightToHero(monster, state)) {
                if (seen) await publish(`${name()} doesn't seem to notice that ${monsterPossessive(monster, { state, random })} gaze was reflected.`);
                break;
            }
            if (seen) await publish(`${name()} is turned to stone!`);
            const death = await finishHeroMonsterKillOutcome(
                monster, monster.mx, monster.my, { petrified: true, publish },
            );
            return { mask: death.killed ? M_ATTK_AGR_DIED : M_ATTK_MISS,
                heroDied: !!death.heroDied || !!state.program_state?.gameover };
        }
        if (visible() && couldsee(monster.mx, monster.my)
            && !heroResistsStoning(state) && !heroIsUnaware(state)) {
            await publish(`You meet ${possessiveName(name(false))} gaze.`);
            await stopHeroOccupation(state, publish);
            if (monsterPolymorphsWhenStoned({ mnum: state.u.umonnum })) {
                const change = await polymonHero(MONSTER_NAME.indexOf('stone golem'));
                if (change.transformed) break;
            }
            await publish('You turn to stone...', { urgent: true });
            await finishHeroDeath({ killer: monsterTypeName(monster.mnum, !!monster.female),
                killerFormat: KILLED_BY, deathVerb: 'turned to stone',
                deathLineShown: true, deathType: STONING });
        }
        break;
    case AD_CONF:
    case AD_STUN:
        if (!mutualGaze || monster.mspec_used || !random(5)) break;
        if (cancelled) {
            reaction = damageType === AD_CONF ? 0 : 1;
            already = !!(damageType === AD_CONF ? monster.mconf : monster.mstun);
            break;
        }
        {
            const duration = damageType === AD_CONF ? rollDice(3, 4) : rollDice(2, 6);
            monster.mspec_used = (monster.mspec_used || 0) + duration + random(6);
            if (damageType === AD_CONF) {
                await publish(state.u.confusionTurns ? 'You are getting more and more confused.'
                    : `${possessiveName(name())} gaze confuses you!`);
                await makeConfused((state.u.confusionTurns || 0) + duration, { state, talk: false, publish });
            } else {
                await publish(`${name()} stares piercingly at you!`);
                await makeStunned((state.u.stunnedTurns || 0) + duration, { state, talk: true, publish });
            }
            await stopHeroOccupation(state, publish);
        }
        break;
    case AD_BLND:
        if (!visible() || heroResistsBlindingLight(state)
            || (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 > BOLT_LIM ** 2) break;
        if (cancelled) {
            reaction = random(2) + 2;
            already = !monster.mcansee;
            if (monster.mcan && MONSTER_NAME[monster.mnum] === 'Archon' && random(5)) reaction = -1;
            break;
        }
        {
            const duration = rollDice(dice, sides);
            await publish(`You are blinded by ${possessiveName(name(false))} radiance!`);
            await makeBlinded(duration, { state, talk: false, publish });
            await stopHeroOccupation(state, publish);
            if (!heroIsBlind(state)) await publish('Your vision clears.');
            else await makeStunned(Math.max(state.u.stunnedTurns || 0, rollOne(3)), { state, talk: true, publish });
        }
        break;
    case AD_FIRE:
        if (!mutualGaze || monster.mspec_used || !random(5)) break;
        if (cancelled) { reaction = random(2) + 4; break; }
        {
            const originalDamage = rollDice(2, 6);
            let damage = originalDamage;
            const level = monster.m_lev;
            await publish(`${name()} attacks you with a fiery gaze!`);
            await stopHeroOccupation(state, publish);
            const observers = (target: Monster) => monsterHasLineOfSightToHero(target, state);
            if (state.u.fireResistance || ((MONSTER_RESISTS[state.u.umonnum] ?? 0) & 0x01)) {
                await shieldeff(state.u.ux, state.u.uy);
                await publish("The fire doesn't feel hot!");
                monstersObserveHeroResistance(M_SEEN_FIRE, state, observers);
                await applyHeroGolemEffects(AD_FIRE, rollDice(12, 6), { state, publish });
                damage = 0;
            } else monstersForgetHeroResistance(M_SEEN_FIRE, state, observers);
            await burnAwayHeroSlime(state, publish);
            if (level > random(20)) await burnArmorByFire(state.u, state, publish, calls, random);
            if (level > random(20)) {
                const items = await destroyInventoryByElement('fire', originalDamage, { state, publish, random, rollOne });
                if (items.heroDied || state.program_state?.gameover)
                    return { mask: M_ATTK_MISS, heroDied: true };
                await igniteItems(state.inventory, { state, publish, random });
            }
            if (damage) await damageHeroFromMonster(monster, damage, { state, publish, ...(die ? { die } : {}) });
        }
        break;
    }
    if (reaction >= 0 && !state.program_state?.gameover) {
        if (heroIsHallucinating(state) && random(3)) reaction = random(reactions.length);
        const modifier = random(3) ? already ? 'quite ' : random(2) ? 'somewhat ' : 'a bit ' : '';
        await publish(`${name()} looks ${modifier}${reactions[reaction]}.`);
    }
    return { mask: M_ATTK_MISS, heroDied: !!state.program_state?.gameover };
}

export async function respondMedusa(monster: Monster, options: MonsterGazeOptions = {}) {
    if (MONSTER_NAME[monster.mnum] !== 'Medusa' || !couldsee(monster.mx, monster.my)) return undefined;
    const gaze = (MONSTER_ATTACKS[monster.mnum] || []).find(([method]) => method === AT_GAZE);
    return gaze ? resolveMonsterGaze(monster, gaze, options) : undefined;
}
