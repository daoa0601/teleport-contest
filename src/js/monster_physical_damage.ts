// Native uhitm.c:mhitm_ad_phys(), monster against monster.
import { applyArtifactHitToMonster } from './artifact_hit.js';
import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { AT_CLAW, AT_KICK, AT_WEAP } from './monster_attack_types.js';
import {
    rejectMonsterShadeContact, showMonsterArtifactFallbackHit,
} from './monster_combat_messages.js';
import { MONSTER_NAME, monsterIsThickSkinned } from './monster_data.js';
import { poisonMonsterFromAttack } from './monster_poison.js';
import { petrifyMonsterDefender } from './monster_stoning.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { CORPSE } from './object_data.js';
import { erodeAttackingWeapon } from './object_erosion.js';
import { isPermanentlyPoisonedObject } from './object_properties.js';
import { d, rn2, rnd } from './rng.js';
import { touchPetrifies } from './stoning.js';
import { monsterWeaponStrengthBonus, rollPhysicalWeaponDamage } from './weapon_damage.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { MonsterMeleeAttack } from './monster_action_types.js';
import type { PetrificationDeathHandler } from './monster_stoning.js';
import type { Monster } from './monster_types.js';

interface PhysicalDamageOptions {
    state?: GameState;
    visible: boolean;
    dieRoll: number;
    hitOnHead: boolean;
    finishDeath: PetrificationDeathHandler;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

export interface MonsterPhysicalDamage {
    damage: number;
    done: boolean;
    hitFlags: number;
    heroDied: boolean;
}

const PM_PURPLE_WORM = MONSTER_NAME.indexOf('purple worm');
const PM_SHRIEKER = MONSTER_NAME.indexOf('shrieker');

export async function resolveMonsterPhysicalDamage(
    aggressor: Monster, defender: Monster, attack: Pick<MonsterMeleeAttack, 'attackType'>, damage: number,
    { state = game, visible, dieRoll, hitOnHead, finishDeath,
        publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d,
    }: PhysicalDamageOptions,
): Promise<MonsterPhysicalDamage> {
    // hitmm's contact weapon is null for a claw. This later physical-damage
    // phase deliberately rereads the held weapon, as mhitm_ad_phys does.
    const weapon = attack.attackType === AT_WEAP || attack.attackType === AT_CLAW
        ? monsterWieldedWeapon(aggressor) ?? null : null;
    if (await rejectMonsterShadeContact(aggressor, defender, weapon, {
        state, visible: canSeeMonster(aggressor) && canSeeMonster(defender),
        publish, rollOne, rollDice,
    })) return { damage: 0, done: false, hitFlags: M_ATTK_MISS, heroDied: false };
    if (attack.attackType === AT_KICK && monsterIsThickSkinned(defender))
        return { damage: 0, done: false, hitFlags: M_ATTK_MISS, heroDied: false };

    if (!weapon) {
        if (aggressor.mnum === PM_PURPLE_WORM && defender.mnum === PM_SHRIEKER
            && damage >= defender.mhp && defender.mhp > 1) damage = defender.mhp - 1;
        return { damage, done: false, hitFlags: M_ATTK_MISS, heroDied: false };
    }

    if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)) {
        const stone = await petrifyMonsterDefender(defender, {
            state, visible: visible && canSeeMonster(defender), publish, rollOne, finishDeath,
        });
        if (stone.heroDied)
            return { damage: 0, done: true, hitFlags: M_ATTK_MISS, heroDied: true };
        if (stone.stopped) {
            if (!stone.survived && defender.mtame && !visible)
                await publish('You have a peculiarly sad feeling for a moment, then it passes.');
            return { damage: 0, done: true,
                hitFlags: stone.survived ? M_ATTK_MISS : M_ATTK_DEF_DIED, heroDied: false };
        }
        damage = stone.damage;
    }
    damage += rollPhysicalWeaponDamage(weapon, defender, { state, rollOne, rollDice });
    damage = Math.max(1, damage + monsterWeaponStrengthBonus(aggressor, random));
    let hitFlags = M_ATTK_MISS;
    if (weapon.oartifact) {
        const artifact = await applyArtifactHitToMonster(weapon, defender, damage, {
            attacker: aggressor, state,
            publish, random, rollOne, dieRoll, hitOnHead,
        });
        if (artifact.heroDied)
            return { damage: 0, done: true, hitFlags, heroDied: true };
        damage = artifact.damage;
        if (!artifact.specialMessage) {
            await showMonsterArtifactFallbackHit(aggressor, defender, { state, visible, publish });
            hitFlags |= M_ATTK_HIT;
        }
        if (defender.dead || defender.mhp <= 0)
            return { damage, done: true, hitFlags: M_ATTK_DEF_DIED, heroDied: false };
    }
    if (damage) await erodeAttackingWeapon(defender, weapon, { state, random, publish });
    if ((weapon.opoisoned || isPermanentlyPoisonedObject(weapon)) && random(4) === 0) {
        damage = await poisonMonsterFromAttack(aggressor, defender, attack.attackType, damage, {
            state, visible, random, publish,
        });
    }
    return { damage, done: false, hitFlags, heroDied: false };
}
