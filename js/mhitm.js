// Monster-versus-monster melee combat.
// C refs: mhitm.c mattackm() and fightm(), with the counterattack gates
// fightm() applies to attacked monsters and dogmove.c grants to pet targets.
import { setHeroGrip } from './hero_grip.js';
import { d, rn2, rnd } from './rng.js';
import { requireLiveGame } from './gstate.js';
import { MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, monsterIsShade, monsterIsUnsolid, } from './monster_data.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { findMonsterArmorClass } from './monworn.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName as canonicalMonsterName, possessiveName } from './monster_name.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterWieldedWeapon, swingMonsterWeapon, updateMonsterWeaponAfterPolymorph, wieldMonsterWeapon, } from './monster_weapon.js';
import { weaponHitBonus } from './weapon_accuracy.js';
import { selectAttack } from './attack_selection.js';
import { resolveMonsterCombatThrow } from './monster_combat_throw.js';
import { resolveMonsterCombatBreath } from './monster_combat_breath.js';
import { resolveMonsterCombatSpit } from './monster_spit.js';
import { resolveMonsterCombatGaze } from './monster_combat_gaze.js';
import { resolveMonsterCombatExplosion } from './monster_combat_explosion.js';
import { resolveMonsterCombatEngulf } from './monster_combat_engulf.js';
import { resolveMonsterCombatDamage } from './monster_combat_damage.js';
import { tryMonsterPuddingSplit } from './monster_pudding_split.js';
import { applyMonsterContactPassive } from './monster_contact_passive.js';
import { canSeeMonsterCombat, prepareMonsterCombatContact, revealMonsterCombatDefender, showMonsterCombatMiss, showMonsterGrabFailure, } from './monster_combat_messages.js';
import { plineWithContinuation } from './pline.js';
import { AD_DGST, AD_DRIN, AD_STCK, AD_WRAP, AT_BREA, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_SPIT, AT_TENT, AT_WEAP, } from './monster_attack_types.js';
import { M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, NEED_HTH_WEAPON, NEED_WEAPON, NORMAL_SPEED, PIT, SPIKED_PIT, } from './const.js';
import { dist2, distmin } from './hacklib.js';
import { DISCARDED_CALL_LOG, recordRandom, } from './monster_action_types.js';
import { monstersInFmonOrder, resistConflict } from './mon.js';
import { stopMonsterHeldByHero } from './monmove.js';
import { trapAt } from './trap.js';
const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
// C mhitm.c:mattackm() handles an AT_WEAP slot before its to-hit roll.
// An unarmed weapon attacker first calls mon_wield_item(); selecting a new
// carried weapon consumes the complete counterattack action.
async function monsterVersusMonsterWieldAction(aggressor, defender, attack, state) {
    if (attack?.attackType !== AT_WEAP)
        return null;
    const currentWeapon = monsterWieldedWeapon(aggressor);
    if (aggressor.weaponCheck !== NEED_WEAPON && currentWeapon)
        return null;
    aggressor.weaponCheck = NEED_HTH_WEAPON;
    return await wieldMonsterWeapon(aggressor, state)
        ? { kind: 'monster-wield', aggressor, defender }
        : null;
}
// C mhitm.c:mattackm(). Callers establish bhitpos independently of notonhead;
// subsequent slots read the live values left by rays and projectile flight.
export async function attackMonsterWithMonster(aggressor, defender, { state, random = rn2, rollDice = d, rollOne = rnd, calls = DISCARDED_CALL_LOG, target: initialTarget = { x: defender.mx, y: defender.my, notOnHead: false }, }) {
    requireLiveGame(state);
    state.bhitpos = { x: initialTarget.x, y: initialTarget.y };
    state.notonhead = initialTarget.notOnHead;
    if (monsterIsHelpless(aggressor) ||
        (aggressor.mnum === PM_GRID_BUG &&
            aggressor.mx !== defender.mx &&
            aggressor.my !== defender.my)) {
        return { kind: 'monster-attack', aggressor, defender, results: [], struck: false };
    }
    let threshold = findMonsterArmorClass(defender) + (aggressor?.m_lev ?? MONSTER_LEVEL[aggressor?.mnum] ?? 0);
    if (defender.mconf || monsterIsHelpless(defender)) {
        threshold += 4;
        defender.msleeping = 0;
    }
    await revealMonsterCombatDefender(defender, state);
    if (((MONSTER_FLAGS2[aggressor.mnum] ?? 0) & M2_ELF)
        && ((MONSTER_FLAGS2[defender.mnum] ?? 0) & M2_ORC))
        threshold++;
    const visible = canSeeMonsterCombat(aggressor, defender);
    // An out-of-sequence attack counts as this monster's action, but the
    // defender's discovery message completes before the action is stamped.
    aggressor.mlstmv = state.moves;
    const results = [];
    const nativeResults = [];
    let struck = false;
    let death = null;
    let fatalPassive = false;
    let skipBrainDrain = false;
    const report = (nativeResult, heroDied = false) => ({
        kind: 'monster-attack', aggressor, defender, results, nativeResult,
        struck: !!(nativeResult & M_ATTK_HIT), fatalPassive, death,
        aggressorDied: !!aggressor.dead || aggressor.mhp <= 0,
        defenderDied: !!defender.dead || defender.mhp <= 0,
        ...(heroDied ? { heroDied: true } : {}),
    });
    for (let attackIndex = 0; attackIndex < 6; attackIndex++) {
        nativeResults[attackIndex] = M_ATTK_MISS;
        if (aggressor.dead || aggressor.mhp <= 0 || defender.dead || defender.mhp <= 0)
            break;
        if (attackIndex > 0 && monsterAtPosition(state.level, state.bhitpos.x, state.bhitpos.y) !== defender)
            continue;
        const target = { ...state.bhitpos, notOnHead: state.notonhead };
        const damageOptions = { state, visible, random, rollDice, rollOne, calls, target, notOnHead: target.notOnHead };
        const resolveDamage = (attacker, targetMonster, attack) => resolveMonsterCombatDamage(attacker, targetMonster, attack, damageOptions);
        const selected = selectAttack(aggressor, defender, attackIndex, nativeResults, state);
        if (skipBrainDrain && selected[0] === AT_TENT && selected[1] === AD_DRIN)
            continue;
        let slotResult = M_ATTK_MISS;
        let hit = false;
        let weapon = null;
        let attempted = true;
        let slot;
        const distant = distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1;
        if ((selected[0] === AT_WEAP && distant) || selected[0] === AT_BREA || selected[0] === AT_SPIT) {
            if (!distant)
                continue;
            const options = { state, random, rollOne, rollDice };
            const ranged = selected[0] === AT_WEAP
                ? await resolveMonsterCombatThrow(aggressor, defender, options)
                : selected[0] === AT_BREA
                    ? await resolveMonsterCombatBreath(aggressor, defender, selected, options)
                    : await resolveMonsterCombatSpit(aggressor, defender, selected, options);
            hit = ranged.nativeResult !== M_ATTK_MISS;
            slotResult = hit ? M_ATTK_HIT : M_ATTK_MISS;
            if (defender.dead || defender.mhp <= 0)
                slotResult = M_ATTK_DEF_DIED;
            if (aggressor.dead || aggressor.mhp <= 0)
                slotResult |= M_ATTK_AGR_DIED;
            const details = { damageType: selected[1], attackIndex, hit, nativeResult: slotResult };
            slot = selected[0] === AT_WEAP ? { ...details, type: 'ranged-weapon', attackType: AT_WEAP }
                : selected[0] === AT_BREA ? { ...details, type: 'breath', attackType: AT_BREA }
                    : { ...details, type: 'spit', attackType: AT_SPIT };
            if (ranged.heroDied) {
                results.push(slot);
                return report(slotResult, true);
            }
        }
        else if (selected[0] === AT_GAZE) {
            const gaze = await resolveMonsterCombatGaze(aggressor, defender, selected, {
                state, visible, random, rollDice, resolveDamage,
            });
            slotResult = gaze.nativeResult;
            death = gaze.death ?? death;
            skipBrainDrain ||= gaze.skipBrainDrain;
            slot = { type: 'gaze', attackType: AT_GAZE, damageType: selected[1], attackIndex,
                hit: !!(slotResult & M_ATTK_HIT), damage: gaze.damage, nativeResult: slotResult };
            if (gaze.heroDied) {
                results.push(slot);
                return report(slotResult, true);
            }
            // Gaze never makes contact, even when mdamagem reports HIT.
        }
        else if (selected[0] === AT_EXPL) {
            if (distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1)
                continue;
            const explosion = await resolveMonsterCombatExplosion(aggressor, defender, selected, {
                state, visible, random, rollDice, resolveDamage,
            });
            slotResult = explosion.mask;
            hit = slotResult !== M_ATTK_MISS;
            attempted = hit;
            slot = { type: 'explosion', attackType: AT_EXPL, damageType: selected[1], attackIndex,
                hit, damage: explosion.damage, nativeResult: slotResult };
            if (explosion.heroDied) {
                results.push(slot);
                return report(slotResult, true);
            }
        }
        else if (selected[0] === AT_ENGL) {
            let damage = 0;
            if (monsterIsShade(defender)) {
                if (visible)
                    await plineWithContinuation(`${possessiveName(canonicalMonsterName(aggressor, { state, capitalized: true }))} attempt to engulf ${canonicalMonsterName(defender, { state })} is futile.`);
            }
            else if (defender !== state.u.usteed) {
                if (distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1)
                    continue;
                if (!(state.u.uswallow && state.u.ustuck === aggressor)) {
                    const die = 20 + attackIndex;
                    hit = threshold > rollOne(die);
                    calls.push(`rnd(${die})`);
                    if (hit && (monsterIsUnsolid(defender) || target.notOnHead)
                        && [AD_WRAP, AD_STCK, AD_DGST].includes(selected[1])) {
                        await showMonsterGrabFailure(aggressor, defender, { attackType: selected[0], damageType: selected[1] }, target, visible, state);
                        hit = false;
                    }
                    else if (hit) {
                        const engulf = await resolveMonsterCombatEngulf(aggressor, defender, selected, {
                            state, visible, random, rollOne, rollDice, resolveDamage,
                        });
                        slotResult = engulf.nativeResult;
                        damage = engulf.damage;
                        death = engulf.death ?? death;
                        if (engulf.heroDied)
                            return report(slotResult, true);
                    }
                    else
                        await showMonsterCombatMiss(aggressor, defender, selected, { state, visible });
                }
            }
            slot = { type: 'engulf', attackType: AT_ENGL, damageType: selected[1], attackIndex,
                hit, damage, nativeResult: slotResult };
        }
        else {
            const attack = monsterMeleeAttackSlot(selected, attackIndex);
            if (!attack)
                continue;
            if (attack.attackType === AT_KICK && aggressor.mtrapped) {
                const trap = trapAt(state, aggressor.mx, aggressor.my);
                if (trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT)
                    continue;
            }
            const isHug = attack.attackType === AT_HUGS;
            if (!isHug && distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1)
                continue;
            const wield = await monsterVersusMonsterWieldAction(aggressor, defender, attack, state);
            if (wield)
                return wield;
            if (attack.attackType === AT_WEAP)
                await updateMonsterWeaponAfterPolymorph(aggressor, state);
            weapon = attack.attackType === AT_WEAP ? monsterWieldedWeapon(aggressor) ?? null : null;
            if (weapon) {
                if (visible)
                    await swingMonsterWeapon(aggressor, weapon, state, { defender, random });
                threshold += weaponHitBonus(weapon, defender, { state, random, rollOne });
            }
            const attackThreshold = threshold;
            let roll = 0;
            if (isHug) {
                hit = attackIndex >= 2 && nativeResults[attackIndex - 1] === M_ATTK_HIT
                    && nativeResults[attackIndex - 2] === M_ATTK_HIT;
            }
            else {
                const die = 20 + attackIndex;
                roll = rollOne(die);
                calls.push(`rnd(${die})`);
                hit = threshold > roll;
            }
            // Native hitval is evaluated again, including its artifact rolls.
            if (weapon)
                threshold -= weaponHitBonus(weapon, defender, { state, random, rollOne });
            const unsolid = monsterIsUnsolid(defender);
            const failedGrab = hit && (isHug ? unsolid || target.notOnHead
                : unsolid && [AD_WRAP, AD_STCK, AD_DGST].includes(attack.damageType));
            if (failedGrab) {
                await showMonsterGrabFailure(aggressor, defender, attack, target, visible, state);
                hit = false;
            }
            let damage = 0;
            if (hit) {
                const contact = await prepareMonsterCombatContact(aggressor, defender, selected, weapon, { state, visible, rollOne, rollDice });
                if (contact === 'contact') {
                    const outcome = await resolveMonsterCombatDamage(aggressor, defender, selected, { ...damageOptions, weapon, dieRoll: roll });
                    slotResult = outcome.nativeResult;
                    damage = outcome.damage;
                    death = outcome.death ?? death;
                    skipBrainDrain ||= outcome.skipBrainDrain;
                    if (outcome.heroDied)
                        return report(slotResult, true);
                }
                // Native pudding division follows hitmm, including a native
                // MISS after life saving. Hugs use a separate dispatch branch.
                if (!isHug) {
                    const split = await tryMonsterPuddingSplit(aggressor, defender, weapon, { state, visible, random });
                    if (split.heroDied)
                        return report(slotResult, true);
                    if (split.aggressorDied)
                        slotResult |= M_ATTK_AGR_DIED;
                }
            }
            else if (!failedGrab && !isHug)
                await showMonsterCombatMiss(aggressor, defender, selected, { state, visible });
            slot = { ...attack, roll, threshold: attackThreshold, hit, damage };
        }
        results.push(slot);
        // passivemm replaces the slot mask using the original contact strike.
        // It runs after a gaze too, with strike=false, when still adjacent.
        if (attempted && !(slotResult & M_ATTK_AGR_DIED)
            && distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) <= 1) {
            const passive = await applyMonsterContactPassive(aggressor, defender, { hit, weapon, state, random, rollDice });
            if (passive.heroDied)
                return report(slotResult, true);
            slotResult = (slotResult & M_ATTK_DEF_DIED) | (passive.hit ? M_ATTK_HIT : M_ATTK_MISS);
            fatalPassive = !!passive.fatal;
            if (fatalPassive)
                slotResult |= M_ATTK_AGR_DIED;
        }
        nativeResults[attackIndex] = slotResult;
        if ((slotResult & (M_ATTK_DEF_DIED | M_ATTK_AGR_DIED | M_ATTK_AGR_DONE))
            || monsterIsHelpless(aggressor) || !state.level.monsters.includes(defender))
            return report(slotResult);
        if (slotResult & M_ATTK_HIT)
            struck = true;
    }
    return report(struck ? M_ATTK_HIT : M_ATTK_MISS);
}
function monsterMeleeAttackSlot(attack, attackIndex) {
    const attackNames = {
        1: 'claw',
        2: 'bite',
        3: 'kick',
        4: 'butt',
        5: 'touch',
        6: 'sting',
        7: 'hug',
        [AT_TENT]: 'tentacle',
        [AT_WEAP]: 'weapon',
    };
    const [attackType, damageType, damn, damd] = attack;
    const type = attackNames[attackType];
    return type ? { type, attackType, damageType, damn, damd, attackIndex } : null;
}
function defenderCanAnswerPetAttack(aggressor, defender, state, random, calls) {
    return (recordRandom(random, calls, 4) !== 0 &&
        defender.mlstmv !== (state.moves ?? 1) &&
        !monsterIsScaredAt(defender, state, aggressor.mx, aggressor.my) &&
        distmin(defender.mx, defender.my, aggressor.mx, aggressor.my) <= 1);
}
function defenderCanAnswerMovementAttack(defender, random, calls) {
    if (recordRandom(random, calls, 4) === 0)
        return false;
    if ((defender.movement ?? 0) <= recordRandom(random, calls, NORMAL_SPEED))
        return false;
    const remaining = defender.movement ?? 0;
    defender.movement = remaining > NORMAL_SPEED ? remaining - NORMAL_SPEED : 0;
    return true;
}
function defenderCanCounterattack(attack, state, random, calls) {
    if (!attack.struck || attack.defenderDied || monsterAttackStopsAggressor(attack))
        return false;
    if (attack.retaliationRule === 'movement') {
        return defenderCanAnswerMovementAttack(attack.defender, random, calls);
    }
    return (attack.retaliationRule === 'pet' &&
        defenderCanAnswerPetAttack(attack.aggressor, attack.defender, state, random, calls));
}
export function monsterAttackStopsAggressor(attack) {
    // Native explosion and passive results can stop an attacker which was
    // life-saved. Preserve that result independently of its current health.
    return !!(attack.aggressorDied || attack.fatalPassive
        || (attack.kind === 'monster-attack' && ((attack.nativeResult ?? 0) & M_ATTK_AGR_DIED)));
}
export async function beginMonsterMeleeAttack(aggressor, defender, state, random, rollDice, rollOne, calls, retaliationRule, selected = { x: defender.mx, y: defender.my }) {
    const target = {
        x: selected.x,
        y: selected.y,
        notOnHead: selected.x !== defender.mx || selected.y !== defender.my,
    };
    const result = await attackMonsterWithMonster(aggressor, defender, { state, random, rollDice, rollOne, calls, target });
    if (result.heroDied || result.kind !== 'monster-attack')
        return result;
    result.retaliationRule = retaliationRule;
    if (defenderCanCounterattack(result, state, random, calls)) {
        result.counterattack = await attackMonsterWithMonster(defender, aggressor, { state, random, rollDice, rollOne, calls });
        if (result.counterattack.heroDied) {
            result.heroDied = true;
            return result;
        }
        result.aggressorDied = !!aggressor.dead || aggressor.mhp <= 0;
        result.defenderDied = !!defender.dead || defender.mhp <= 0;
    }
    return result;
}
// C mhitm.c:fightm(). A hit replaces dochug; a miss lets the actor continue.
export async function fightNearbyMonster(monster, state, random, rollDice, rollOne, calls) {
    if (resistConflict(monster, state, rollOne, calls))
        return null;
    const hero = state.u;
    if (await stopMonsterHeldByHero(monster, state))
        return null;
    const swallowed = !!(hero.uswallow && hero.ustuck === monster);
    for (const target of monstersInFmonOrder(state.level.monsters)) {
        if (target === monster || target.dead || target.mhp <= 0)
            continue;
        const distance = dist2(monster.mx, monster.my, target.mx, target.my);
        if (distance >= 3 || (distance === 2 && monster.mnum === PM_GRID_BUG))
            continue;
        if (!hero.uswallow && hero.ustuck === monster) {
            if (recordRandom(random, calls, 4) !== 0)
                break;
            // C mhitm.c:fightm() releases without unstuck()'s cooldown.
            setHeroGrip(null, state);
            await plineWithContinuation(`${canonicalMonsterName(monster, {
                state,
                capitalized: true,
            })} releases you!`);
        }
        const attack = await beginMonsterMeleeAttack(monster, target, state, random, rollDice, rollOne, calls, swallowed ? null : 'movement');
        if (attack.heroDied)
            return { attack, heroDied: true };
        if (monsterAttackStopsAggressor(attack))
            return { attack, consumed: true };
        return { attack, consumed: !swallowed && !!attack.struck };
    }
    return null;
}
//# sourceMappingURL=mhitm.js.map