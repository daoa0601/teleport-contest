// C uhitm.c:hmon_hitmon_weapon(), before artifact and damage-bonus handling.
import { artifactById } from './artifacts.js';
import { P_BOW, P_CROSSBOW, P_KNIFE, P_NONE, P_SKILLED, Upolyd } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { consumeInventoryItem } from './invent.js';
import {
    MONSTER_SYMBOL, monsterHatesSilver, monsterIsAmorphous, monsterIsNoncorporeal,
    monsterIsShade, monsterIsWhirly,
} from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { monsterWieldedWeapon, unwieldMonsterWeapon } from './monster_weapon.js';
import { BOOMERANG, KATANA, OBJECT_BIMANUAL, OBJECT_SUBTYPE } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { isFlimsyObject, isMissileObject, isWeaponTool } from './object_properties.js';
import { objectResistsDestruction } from './object_state.js';
import { objectQuantity } from './object_stack.js';
import { ownedObjectAction, ownedObjectName } from './objnam.js';
import { d, rn2, rnl, rnd } from './rng.js';
import { ensureHeroSkills } from './skills.js';
import { rollPhysicalWeaponDamage, shadeBlocksWeaponBaseDamage } from './weapon_damage.js';
import { losePrimaryWeapon } from './weapon_slots.js';
import { ammunitionMatchesLauncher, isAmmunition, isPolearm } from './weapon_type.js';
import type { MessagePublisher } from './display.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { HeroPhysicalAttackMode } from './hero_physical_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

interface HeroWeaponContactOptions {
    mode: HeroPhysicalAttackMode;
    dieRoll: number;
    state?: GameState;
    publish?: MessagePublisher;
}

export interface HeroWeaponContactResult {
    damage: number;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
    specialMessage: boolean;
    heroDied: boolean;
}

const WEAPON_CLASS = 2;
const GEM_CLASS = 13;
const SILVER = 14;
const S_BLOB = 2;
const S_EYE = 5;
const S_FUNGUS = 32;

export async function prepareHeroWeaponContact(
    monster: Monster, weapon: GameObject,
    { mode, dieRoll, state = game, publish = plineWithContinuation }: HeroWeaponContactOptions,
): Promise<HeroWeaponContactResult | null> {
    requirePlayingGame(state);
    if (weapon.oclass !== WEAPON_CLASS && weapon.oclass !== GEM_CLASS && !isWeaponTool(weapon))
        return null;
    if (isImprovisedContact(weapon, mode, state))
        return improvisedWeaponContact(monster, weapon, mode, state, publish);

    const result: HeroWeaponContactResult = {
        damage: rollPhysicalWeaponDamage(weapon, monster, { state }), useWeaponSkill: true,
        trainWeaponSkill: false, specialMessage: false, heroDied: false,
    };
    result.trainWeaponSkill = result.damage > 1;
    const handToHand = mode === 'melee'
        || (mode === 'applied' && isPolearm(state.uwep || state.u.uwep));
    if (state.urole.key === 'healer' && handToHand && weapon.oclass === WEAPON_CLASS
        && OBJECT_SUBTYPE[weapon.otyp] === P_KNIFE) {
        const vital = state.mvitals?.[monster.mnum];
        if (!vital) throw new Error(`Healer anatomy requires initialized vitals for species ${monster.mnum}.`);
        result.damage += Math.min(3, Math.trunc(vital.died / 6));
    }

    if (!result.trainWeaponSkill || monster === state.u.ustuck || state.u.twoweap
        || (handToHand && artifactById(weapon.oartifact, state)?.enumName === 'CLEAVER'))
        return result;
    if (state.urole.key === 'rogue' && !Upolyd(state.u) && handToHand && canBackstab(monster)) {
        await publish(`You strike ${monsterName(monster, { state })} from behind!`);
        result.damage += rnd(state.u.ulevel);
        result.specialMessage = true;
        return result;
    }
    const defenderWeapon = shatterCandidate(monster, weapon, dieRoll, state);
    if (!defenderWeapon) return result;
    const resistance = 50 + 15 * (greatestErosion(weapon) - greatestErosion(defenderWeapon));
    if (objectResistsDestruction(defenderWeapon, resistance, 100)) return result;

    await unwieldMonsterWeapon(monster, state, { weapon: defenderWeapon, publish });
    const subject = canSeeMonster(monster)
        ? ownedObjectAction(defenderWeapon, 'shatter', state)
        : `${possessiveName(monsterName(monster, { state, capitalized: true }))} weapon${
            objectQuantity(defenderWeapon) > 1 ? 's shatter' : ' shatters'}`;
    await publish(`${subject} from the force of your blow!`);
    await destroyObjectFromMonsterInventory(monster, defenderWeapon, state, { publish });
    if (state.program_state.gameover) return { ...result, heroDied: true };
    if (rn2(4)) {
        const flight = await makeMonsterFlee(monster, { state, turns: d(2, 3), first: true, publish });
        result.heroDied = flight.heroDied;
    }
    result.specialMessage = true;
    return result;
}

function isImprovisedContact(weapon: GameObject, mode: HeroPhysicalAttackMode, state: PlayingGameState): boolean {
    const skill = OBJECT_SUBTYPE[weapon.otyp] ?? P_NONE;
    const launcher = weapon.oclass === WEAPON_CLASS && skill >= P_BOW && skill <= P_CROSSBOW;
    return launcher
        || (mode === 'melee' && (isMissileObject(weapon) || isAmmunition(weapon)))
        || (mode === 'melee' && !state.u.usteed && isPolearm(weapon)
            && artifactById(weapon.oartifact, state)?.enumName !== 'SNICKERSNEE')
        || (isAmmunition(weapon) && (mode !== 'thrown'
            || !ammunitionMatchesLauncher(weapon, state.uwep || state.u.uwep)));
}

async function improvisedWeaponContact(
    monster: Monster, weapon: GameObject, mode: HeroPhysicalAttackMode,
    state: PlayingGameState, publish: MessagePublisher,
): Promise<HeroWeaponContactResult> {
    let damage = shadeBlocksWeaponBaseDamage(weapon, monster, state) ? 0 : rnd(2);
    if (objectMaterial(weapon, state) === SILVER && monsterHatesSilver(monster))
        damage += rnd(damage ? 20 : 10);
    let specialMessage = false;
    if (mode === 'melee' && weapon === (state.uwep || state.u.uwep)
        && weapon.otyp === BOOMERANG && rnl(4) === 3) {
        const stack = objectQuantity(weapon) > 1;
        await publish(`As you hit ${monsterName(monster, { state })}, ${stack ? 'one of ' : ''}${
            ownedObjectName(weapon, state, { capitalized: false })} breaks into splinters.`);
        if (!stack) await losePrimaryWeapon(state);
        await consumeInventoryItem(weapon, state);
        specialMessage = true;
        if (!monsterIsShade(monster)) damage++;
    }
    return {
        damage, useWeaponSkill: false, trainWeaponSkill: false, specialMessage,
        heroDied: !!state.program_state.gameover,
    };
}

function canBackstab(monster: Monster): boolean {
    return !monsterIsAmorphous(monster) && !monsterIsWhirly(monster)
        && !monsterIsNoncorporeal(monster)
        && ![S_BLOB, S_EYE, S_FUNGUS].includes(MONSTER_SYMBOL[monster.mnum] ?? -1)
        && canSeeMonster(monster) && (!!monster.mflee || monsterIsHelpless(monster));
}

function shatterCandidate(
    monster: Monster, weapon: GameObject, dieRoll: number, state: PlayingGameState,
): GameObject | null {
    if (dieRoll !== 2 || weapon !== (state.uwep || state.u.uwep) || weapon.oclass !== WEAPON_CLASS)
        return null;
    const samuraiKatana = state.urole.key === 'samurai' && weapon.otyp === KATANA
        && !(state.uarms || state.u.uarms);
    if (!OBJECT_BIMANUAL[weapon.otyp] && !samuraiKatana) return null;
    const skill = Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? P_NONE);
    if (skill === P_NONE) return null;
    const proficiency = ensureHeroSkills(state)?.[skill];
    if (!proficiency) throw new Error(`Weapon shattering requires initialized skill ${skill}.`);
    if (proficiency.skill < P_SKILLED) return null;
    const defenderWeapon = monsterWieldedWeapon(monster);
    return defenderWeapon && !isFlimsyObject(defenderWeapon, state) ? defenderWeapon : null;
}

function greatestErosion(weapon: GameObject): number {
    return Math.max(weapon.oeroded ?? 0, weapon.oeroded2 ?? 0);
}
