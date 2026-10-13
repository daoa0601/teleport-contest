// The #monster gaze command for a polymorphed hero.
// C ref: polyself.c dogaze().

import type { MonsterAttack } from './data_types.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { DamageType } from './monster_attack_types.js';
import { heroIsHallucinating } from './senses.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { heroHasFreeAction } from './armor.js';
import {
    M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, STONING,
} from './const.js';
import {
    canSeeMonster, plineWithContinuation,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { igniteItems } from './light.js';
import { angerAttackedMonster } from './monster_anger.js';
import {
    AD_CONF, AD_FIRE, AT_GAZE,
} from './monster_attack_types.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, monsterTypeName,
} from './monster_data.js';
import { heroMonsterForm } from './polyself.js';
import { promptYesNo } from './query.js';
import { d, rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { couldsee } from './vision.js';
import {
    destroyFireMonsterInventory, monsterHasElementalResistance,
} from './zap.js';

const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;
const MR_FIRE = 0x01;
const PM_FLOATING_EYE = 28;
const PM_MEDUSA = 284;

export function heroGazeAttack(state = game) {
    const form = heroMonsterForm(state);
    if (form == null) return null;
    return (MONSTER_ATTACKS[form] || []).find(
        ([attackType]) => attackType === AT_GAZE,
    ) || null;
}



function heroCanSeeInvisible(state: GameState) {
    return !!(state.u?.seeInvisible
        || (state.u?.seeInvisibleTurns ?? 0) > 0);
}

function heroIsConfused(state: GameState) {
    return !!(state.u?.confused || (state.u?.confusionTurns ?? 0) > 0);
}

function monsterName(monster: Monster) {
    return monster.name
        || monsterTypeName(monster.mnum, !!monster.female);
}

function monsterSubject(monster: Monster) {
    const name = monsterName(monster);
    return monster.name ? name : `The ${name}`;
}

function monsterObject(monster: Monster) {
    const name = monsterName(monster);
    return monster.name ? name : `the ${name}`;
}

function monsterPossessive(monster: Monster) {
    const name = monsterObject(monster);
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function gazeCannotAffect(monster: Monster) {
    const helpless = monster.msleeping || monster.mcanmove === 0
        || monster.mcanmove === false
        || (monster.mfrozen ?? 0) > 0;
    const blind = !monster.mcansee;
    const eyeless = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES);
    return helpless || monster.mstun || blind || eyeless;
}

function floatingEyeFreezeDuration(monster: Monster, state: GameState, random: typeof rn2, rollDice: typeof d) {
    if ((state.u?.ulevel ?? 1) <= 6 && random(4) === 0) return 200;
    const attack = MONSTER_ATTACKS[monster.mnum]?.[0] || [];
    return rollDice((monster.m_lev ?? 0) + 1, attack[3] ?? 1);
}

async function applyGazePassive(
    monster: Monster, state: GameState, publish: MessagePublisher,
    random: typeof rn2, rollDice: typeof d, die: DeathHandler,
) {
    const name = monsterName(monster);
    if (monster.mnum === PM_FLOATING_EYE && !monster.mcan) {
        const owner = monsterPossessive(monster);
        if (heroHasFreeAction(state)) {
            await publish(`You stiffen momentarily under ${owner} gaze.`);
            return { heroDied: false };
        }
        await publish(`You are frozen by ${owner} gaze!`);
        state._occupation = null;
        endVoluntaryMultiTurn(state);
        state._helplessTurns = floatingEyeFreezeDuration(
            monster, state, random, rollDice,
        );
        state._helplessReason = "frozen by a monster's gaze";
        state._helplessDoneMessage = '';
        return { heroDied: false, stopped: true };
    }

    if (monster.mnum !== PM_MEDUSA || monster.mcan)
        return { heroDied: false };
    await publish(`Gazing at the awake ${name} is not a very good idea.`);
    await publish('You turn to stone...');
    const heroDied = await die({
        killer: "deliberately meeting Medusa's gaze",
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { heroDied, stopped: heroDied };
}

async function applyConfusingGaze(monster: Monster, publish: MessagePublisher) {
    if (!monster.mconf)
        await publish(`Your gaze confuses ${monsterObject(monster)}!`);
    else
        await publish(`${monsterSubject(monster)} is getting more and more confused.`);
    monster.mconf = 1;
}

type FinishGazeKill = (monster: Monster, x: number, y: number) => unknown;

async function applyFieryGaze({
    monster, state, publish, random, rollDice, finishMonsterKill,
}: {
    monster: Monster;
    state: GameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollDice: typeof d;
    finishMonsterKill: FinishGazeKill;
}) {
    const name = monsterObject(monster);
    const originalDamage = rollDice(2, 6);
    let damage = originalDamage;
    await publish(`You attack ${name} with a fiery gaze!`);
    if (monsterHasElementalResistance(monster, MR_FIRE)) {
        await publish(`The fire doesn't burn ${name}!`);
        damage = 0;
    }
    if ((state.u?.ulevel ?? 1) > random(20)) {
        damage += await destroyFireMonsterInventory(
            monster, originalDamage, {
                publish,
                random,
                visible: canSeeMonster(monster),
            },
        );
        await igniteItems(monster.minvent || monster.inventory, {
            carrier: monster,
            state,
            publish,
            random,
            visible: canSeeMonster(monster),
        });
    }
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp > 0) return false;
    await finishMonsterKill(monster, monster.mx, monster.my);
    return true;
}

async function confirmPeacefulGaze(monster: Monster, damageType: DamageType) {
    const action = damageType === AD_CONF ? 'confuse' : 'attack';
    return await promptYesNo(
        `Really ${action} ${monsterObject(monster)}?`,
    ) === 'y';
}

interface HeroGazeOptions {
    state?: GameState;
    attack?: MonsterAttack | null;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    finishMonsterKill?: FinishGazeKill;
    die?: DeathHandler;
}

export async function useHeroGaze({
    state = game,
    attack = heroGazeAttack(state),
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    finishMonsterKill = finishHeroMonsterKill,
    die = finishHeroDeath,
}: HeroGazeOptions = {}) {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-gaze' };
    const damageType = attack[1];
    if (damageType !== AD_CONF && damageType !== AD_FIRE)
        return { used: false, spentTime: false, reason: 'unsupported-gaze' };
    if (heroIsBlind(state)) {
        await publish("You can't see anything to gaze at.");
        return { used: false, spentTime: false, reason: 'blind' };
    }
    if (heroIsHallucinating(state)) {
        await publish("You can't gaze at anything you can see.");
        return { used: false, spentTime: false, reason: 'hallucinating' };
    }
    const energy = state.u.uen ?? 0;
    if (energy < 15) {
        await publish('You lack the energy to use your special gaze!');
        return { used: false, spentTime: false, reason: 'energy' };
    }
    state.u.uen = energy - 15;
    state.context.botl = true;

    let looked = 0;
    for (const monster of [...(state.level?.monsters || [])]) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
            || !canSeeMonster(monster)
            || !couldsee(monster.mx, monster.my)) continue;
        looked++;

        if (heroIsInvisible(state)
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS)) {
            await publish(`${monsterSubject(monster)} seems not to notice your gaze.`);
            continue;
        }
        if (monster.minvis && !heroCanSeeInvisible(state)) {
            await publish(`You can't see where to gaze at ${monsterObject(monster)}.`);
            continue;
        }
        if (M_AP_TYPE(monster) === M_AP_FURNITURE
            || M_AP_TYPE(monster) === M_AP_OBJECT) {
            looked--;
            continue;
        }
        if (state.flags?.safe_dog && monster.mtame && !heroIsConfused(state)) {
            const target = monster.name
                ? monster.name : `your ${monsterName(monster)}`;
            await publish(`You avoid gazing at ${target}.`);
            continue;
        }
        if (state.flags?.confirm && monster.mpeaceful
            && !heroIsConfused(state)
            && !await confirmPeacefulGaze(monster, damageType)) continue;

        await angerAttackedMonster(monster);
        if (gazeCannotAffect(monster)) {
            looked--;
            continue;
        }

        let killed = false;
        if (damageType === AD_CONF)
            await applyConfusingGaze(monster, publish);
        else {
            killed = await applyFieryGaze({
                monster, state, publish, random, rollDice,
                finishMonsterKill,
            });
        }
        if (killed) continue;

        const passive = await applyGazePassive(
            monster, state, publish, random, rollDice, die,
        );
        if (passive.stopped)
            return { used: true, spentTime: true, looked, ...passive };
    }
    if (!looked) await publish('You gaze at no place in particular.');
    return { used: true, spentTime: true, looked, heroDied: false };
}
