// Monster-versus-monster status attacks from uhitm.c:mhitm_adtyping().
import { monsterResistsBlindingLight } from './blinding_attack.js';
import { M_ATTK_MISS, MSLOW, STRAT_WAITFORU, W_ARMH } from './const.js';
import { canSeeMonster, canSpotMonster, plineWithContinuation, shieldeff } from './display.js';
import { game } from './gstate.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { heroFormSticks } from './hero_species.js';
import { paralyzeMonster } from './mon.js';
import {
    AD_BLND, AD_CONF, AD_ENCH, AD_HALU, AD_HEAL, AD_LEGS, AD_PLYS, AD_SLEE,
    AD_SLOW, AD_STCK, AD_STUN, AD_WERE, AD_WRAP,
    AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE,
    AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import { monsterCombatDefense } from './monster_combat_defense.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { staggerVerb } from './monster_hurtle.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterIsHelpless, monsterResistsSleep, putMonsterToSleep } from './monster_sleep.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { OBJECT_DESCRIPTIONS } from './object_data.js';
import { d } from './rng.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { AttackTuple } from './monster_action_types.js';
import type { DamageType } from './monster_attack_types.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import type { Monster } from './monster_types.js';

const M1_NOEYES = 0x00001000;
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const STATUS_DAMAGE = [
    AD_BLND, AD_HALU, AD_PLYS, AD_SLEE, AD_SLOW, AD_CONF, AD_STUN,
    AD_LEGS, AD_WERE, AD_HEAL, AD_STCK, AD_WRAP, AD_ENCH,
] as const;

function isStatusDamage(type: DamageType): type is (typeof STATUS_DAMAGE)[number] {
    return STATUS_DAMAGE.some(candidate => candidate === type);
}

export async function applyMonsterStatusEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, publish, visible, random, rollOne, attack } = context;
    const type = attack[1];
    if (!isStatusDamage(type))
        throw new RangeError(`Unsupported monster status damage type ${type}`);
    let damage = context.damage;
    switch (type) {
    case AD_BLND:
        await applyMonsterCombatBlindness(attacker, defender, attack, context);
        damage = 0;
        break;
    case AD_HALU:
        if (!attacker.mcan && hasEyes(defender) && defender.mcansee) {
            if (visible && canSeeMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} looks ${defender.mconf ? 'more ' : ''}confused.`);
            defender.mconf = 1;
            clearWaiting(defender);
        }
        damage = 0;
        break;
    case AD_PLYS:
        if (defender.mcanmove && random(3) === 0
            && !await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random, verbose: true })) {
            if (visible && canSpotMonster(defender)) {
                const name = monsterName(defender, { state, capitalized: true });
                await publish(`${name} is frozen by ${monsterName(attacker, { state })}.`);
            }
            paralyzeMonster(defender, rollOne(10));
        }
        break;
    case AD_SLEE:
        // The pinned branch tries sleep twice. The first timed sleep normally
        // immobilizes the defender, so the second call rejects it. Retain the
        // resulting absence of a message, wait reset, and released grip.
        if (!defender.msleeping
            && await sleepContact(defender, rollOne(10), context)
            && await sleepContact(defender, rollOne(10), context)) {
            if (visible && canSpotMonster(defender)) {
                const name = monsterName(defender, { state, capitalized: true });
                await publish(`${name} is put to sleep by ${monsterName(attacker, { state })}.`);
            }
            clearWaiting(defender);
            if (monsterIsHelpless(defender) && state.u.ustuck === defender
                && !heroFormSticks(state) && !state.u.uswallow) {
                await publish(`${possessiveName(monsterName(defender, { state, capitalized: true }))} grip relaxes.`);
                await releaseHeroFromMonster(defender, { state, publish, rollOne });
            }
        }
        break;
    case AD_SLOW: {
        const blocked = await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random, verbose: false });
        if (!monsterCombatDefense(defender, AD_SLOW, state) && !blocked && defender.mspeed !== MSLOW) {
            const speed = adjustMonsterSpeed(defender, -1);
            // mon_adjust_speed() announces the change before mhitm_ad_slow() does.
            const message = canSeeMonster(defender)
                ? monsterSpeedMessage(speed, monsterName(defender, { state, capitalized: true }), state)
                : null;
            if (message) await publish(message);
            clearWaiting(defender);
            if (speed.changed && visible && canSpotMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} slows down.`);
        }
        break;
    }
    case AD_CONF:
        if (!attacker.mcan && !defender.mconf && !attacker.mspec_used) {
            if (visible && canSeeMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} looks confused.`);
            defender.mconf = 1;
            clearWaiting(defender);
        }
        break;
    case AD_STUN:
        if (attacker.mcan) break;
        if (canSeeMonster(defender))
            await publish(`${monsterName(defender, { state, capitalized: true })} ${staggerVerb(defender.mnum)} for a moment.`);
        defender.mstun = 1;
        return context.applyPhysical();
    case AD_LEGS:
        if (attacker.mcan) {
            damage = 0;
            break;
        }
        return context.applyPhysical();
    case AD_WERE:
    case AD_HEAL:
        return context.applyPhysical();
    case AD_STCK:
        if (await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random, verbose: false })) damage = 0;
        break;
    case AD_WRAP:
        if (attacker.mcan) damage = 0;
        if (!damage && (canSeeMonster(attacker) || canSeeMonster(defender))) {
            const name = monsterName(attacker, { state, capitalized: true, augmentIt: true });
            await publish(`${name} brushes against ${monsterName(defender, { state, augmentIt: true })}.`);
        }
        break;
    case AD_ENCH:
        break; // Native has no monster armor selection for this attack.
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

interface MonsterCombatBlindnessOptions {
    state?: GameState;
    visible: boolean;
    publish?: MessagePublisher;
    rollDice?: typeof d;
}

export async function applyMonsterCombatBlindness(
    attacker: Monster, defender: Monster, attack: AttackTuple,
    { state = game, visible, publish = plineWithContinuation, rollDice = d }: MonsterCombatBlindnessOptions,
): Promise<void> {
    if (!canBlindThroughContact(attacker, defender, attack, state)) return;
    if (visible && defender.mcansee && canSpotMonster(defender)) {
        let message = `${monsterName(defender, { state, capitalized: true })} is blinded`;
        if (defender.mnum === PM_ARCHON && canSeeMonster(defender))
            message += ` by ${possessiveName(monsterName(attacker, { state }))} radiance`;
        await publish(`${message}.`);
    }
    defender.mblinded = Math.min(127, (defender.mblinded ?? 0) + rollDice(attack[2], attack[3]));
    defender.mcansee = 0;
    clearWaiting(defender);
}

// C can_blnd() with no object: claws can extend temporary blindness, while
// light attacks are resisted by a defender which is already blind.
function canBlindThroughContact(attacker: Monster, defender: Monster, attack: AttackTuple, state: GameState): boolean {
    if (!hasEyes(defender) || (!defender.mcansee && !defender.mblinded)) return false;
    if (attacker.mnum === PM_RAVEN && defender.mnum === PM_RAVEN) return false;
    switch (attack[0]) {
    case AT_EXPL: case AT_BOOM: case AT_GAZE: case AT_MAGC: case AT_BREA:
        return !attacker.mcan && !monsterResistsBlindingLight(defender, state);
    case AT_WEAP: case AT_SPIT: case AT_NONE:
        return false;
    case AT_ENGL:
        return !defender.msleeping;
    case AT_CLAW:
        return !(defender.minvent ?? []).some(object =>
            ((object.owornmask ?? 0) & W_ARMH)
            && (state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
    case AT_TUCH: case AT_STNG:
        return !attacker.mcan;
    case AT_BITE: case AT_KICK: case AT_BUTT: case AT_HUGS: case AT_TENT:
        return true;
    }
}

function hasEyes(monster: Monster): boolean {
    return !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES);
}

function clearWaiting(monster: Monster): void {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
}

async function sleepContact(defender: Monster, duration: number, context: MonsterCombatEffectContext): Promise<boolean> {
    if (monsterResistsSleep(defender) || monsterCombatDefense(defender, AD_SLEE, context.state)) {
        await shieldeff(defender.mx, defender.my, context.state);
        return false;
    }
    return putMonsterToSleep(defender, duration);
}

