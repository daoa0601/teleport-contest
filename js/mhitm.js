// Monster-versus-monster melee combat.
// C refs: mhitm.c mattackm() and fightm(), with the counterattack gates
// fightm() applies to attacked monsters and dogmove.c grants to pet targets;
// mhitm.c noises(), pre_mm_attack(), missmm(), failed_grab(), hitmm(),
// gazemm(), engulf_target(), gulpmm(), explmm(), mdamagem(), passivemm() and
// xdrainenergym() are folded in below in native order.
import { setHeroGrip } from './hero_grip.js';
import { d, rn2, rnd } from './rng.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterDigests, monsterEnfolds, monsterHatesSilver, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsShade, monsterIsSlimeproof, monsterIsUnsolid, monsterIsVampireShifter, monsterIsWhirly, monsterTypeName, requireMonsterData, } from './monster_data.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, displayLiquidName, map_invisible, newsym, } from './display.js';
import { plineWithContinuation } from './pline.js';
import { artifactById } from './artifacts.js';
import { monsterResistsBlindingLight } from './blinding_attack.js';
import { M_AP_TYPE, PLNMSG_HIDE_UNDER, DOOR, D_CLOSED, D_LOCKED, IRONBARS, IS_OBSTRUCTED, IS_TREE, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, MM_IGNOREWATER, NEED_HTH_WEAPON, NEED_WEAPON, ismnum, NORMAL_SPEED, PIT, SPIKED_PIT, } from './const.js';
import { isZombieMaker, zombieForm } from './corpse_species.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { heroIsUnaware } from './hero_sleep.js';
import { formatHeardMessage } from './hero_speech.js';
import { heroIsDeaf } from './senses.js';
import { findMonsterArmorClass } from './monworn.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { cloneMonster, splitMonster } from './monster_clone.js';
import { finishEnvironmentalMonsterDeath, finishMonsterKilled, finishMonsterLiquidDeath } from './monster_death.js';
import { createElementalMonsterExplosion } from './explosion.js';
import { cansee } from './vision.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { grantMonsterCorpseIntrinsic } from './monster_corpse_intrinsic.js';
import { applyMonsterGolemEffects, healMonster, monstersInFmonOrder, paralyzeMonster, resistConflict, resolveMonsterLiquid, } from './mon.js';
import { staggerVerb } from './monster_hurtle.js';
import { exposeEngulfedDefenderForDeath, monsterAtPosition, placeMonsterOnMap, removeMonsterFromMapAt, } from './monster_location.js';
import { monsterName as canonicalMonsterName, possessiveName, monsterName, monsterObjectPronoun, monsterPossessive, namelessMonsterName, } from './monster_name.js';
import { monsterIsScaredAt, stopMonsterHeldByHero } from './monmove.js';
import { monsterWieldedWeapon, swingMonsterWeapon, updateMonsterWeaponAfterPolymorph, wieldMonsterWeapon, } from './monster_weapon.js';
import { weaponHitBonus } from './weapon_accuracy.js';
import { selectAttack } from './attack_selection.js';
import { resolveMonsterCombatBreath, resolveMonsterCombatSpit, resolveMonsterCombatThrow } from './mthrowu.js';
import { finishImmediateMonsterTrap, trapAt, triggerImmediateMonsterTrap } from './trap.js';
import { applyMonsterCombatBlindness, applyMonsterDigestionEffect, applyMonsterDrainEffect, applyMonsterElementEffect, applyMonsterStatusEffect, applyMonsterTheftEffect, applyMonsterTransformEffect, mhitmAdBlnd, mhitmAdDrli, mhitmAdEnch, mhitmAdLegs, mhitmAdStun, monsterCombatAttackNegated, passiveAttack, passiveDamage, poisonMonsterFromAttack, rejectMonsterShadeContact, resolveMonsterBrainAttack, resolveMonsterPhysicalDamage, tryKnockback, } from './uhitm.js';
import { monsterReflectionSource } from './ray.js';
import { contactIsProtected, touchPetrifies } from './stoning.js';
import { objectMaterial } from './object_material.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { minimalObjectName, objectCombatName, pluralizeObjectNoun } from './objnam.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { damageObjectWithAcid, erodeArmor } from './object_erosion.js';
import { drainObjectEnchantment } from './object_state.js';
import { snuffMonsterInventoryLights } from './monster_inventory_light.js';
import { petrifyMonsterAttacker, petrifyMonsterDefender, prepareMonsterPetrification } from './monster_stoning.js';
import { seductionCompatibility } from './seduction_compatibility.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_DRDX, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPC1, AD_SPC2, AD_SPEL, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { dist2, distmin } from './hacklib.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { goodPosition } from './teleport_rules.js';
import { finishMonsterGrowth, growMonster } from './makemon.js';
import { monsterHasAcidResistance, monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance, monsterHasStoneResistance, } from './mondata.js';
const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const G_UNIQ = 0x1000;
const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;
const M1_WALLWALK = 0x08;
const MZ_HUGE = 4;
const S_MIMIC = 13;
const S_TROLL = 46;
const IRON = 11;
const METAL = 12;
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_BLACK_PUDDING = MONSTER_NAME.indexOf('black pudding');
const PM_BROWN_PUDDING = MONSTER_NAME.indexOf('brown pudding');
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));
// C mhitm.c:noises(). Unseen combat still reaches the hero as sound.
export async function reportMonsterCombatNoise(aggressor, state, { explosion = false, publish = plineWithContinuation } = {}) {
    if (heroIsDeaf(state))
        return;
    const far = (aggressor.mx - state.u.ux) ** 2
        + (aggressor.my - state.u.uy) ** 2 > 15;
    const lastFar = state._farMonsterNoise ?? false;
    const lastMove = state._monsterNoiseTime ?? 0;
    if (far === lastFar && state.moves - lastMove <= 10)
        return;
    state._farMonsterNoise = far;
    state._monsterNoiseTime = state.moves;
    const message = formatHeardMessage(`${explosion ? 'an explosion' : 'some noises'}${far ? ' in the distance' : ''}.`, state);
    if (message)
        await publish(message);
}
// C mhitm.c:pre_mm_attack(). Unhiding or unmimicking happens even when the
// hero cannot see it, because the formerly concealed monster is now in
// action; only the redraw is guarded by visibility.
async function revealAttackingMonsters(aggressor, defender, visible) {
    let changed = false;
    for (const monster of [defender, aggressor]) {
        if (M_AP_TYPE(monster)) {
            await revealMonsterAppearance(monster);
            changed = true;
        }
        else if (monster.mundetected) {
            monster.mundetected = 0;
            changed = true;
        }
    }
    if (!visible)
        return;
    for (const monster of [aggressor, defender]) {
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
        else if (changed)
            await newsym(monster.mx, monster.my);
    }
}
// Feedback for when a monster-versus-monster attack misses.
// C mhitm.c:missmm().
export async function showMonsterCombatMiss(aggressor, defender, attack, { state = game, visible, publish = plineWithContinuation }) {
    await revealAttackingMonsters(aggressor, defender, visible);
    if (!visible) {
        await reportMonsterCombatNoise(aggressor, state, { publish });
        return;
    }
    const subject = monsterName(aggressor, { state, capitalized: true });
    const friendly = !aggressor.mcan && seductionCompatibility(aggressor, defender, attack, state);
    await publish(`${subject} ${friendly ? 'pretends to be friendly to' : 'misses'} ${combatTargetName(defender, aggressor, state)}.`);
}
// C mhitm.c:mattackm(): "Set up the visibility of action".
export function canSeeMonsterCombat(attacker, defender) {
    return (cansee(attacker.mx, attacker.my)
        && canSpotMonster(attacker))
        || (cansee(defender.mx, defender.my)
            && canSpotMonster(defender));
}
// Admission exposes a concealed defender before visibility and hit chances
// are finalized. A disguise is instead revealed by the individual hit/miss.
// C mhitm.c:mattackm(), the attacked-mundetected-monster block.
export async function revealMonsterCombatDefender(defender, state = game) {
    if (!defender.mundetected)
        return;
    defender.mundetected = 0;
    await newsym(defender.mx, defender.my);
    if (!canSeeMonster(defender) || canSenseMonster(defender))
        return;
    if (heroIsUnaware(state)) {
        const unique = !!((MONSTER_GENO[defender.mnum] ?? 0) & G_UNIQ);
        const species = namelessMonsterName(defender, { state, article: unique ? 'the' : 'none' });
        await plineWithContinuation(`You dream of ${unique ? species : makePlural(species)}.`);
    }
    else if (state.last_hider === defender.m_id) {
        if (state._lastPlineKind === PLNMSG_HIDE_UNDER) {
            const subject = monsterName(defender, { state, capitalized: true });
            await plineWithContinuation(`${subject} emerges from hiding.`);
        }
        else {
            await plineWithContinuation(`You notice ${monsterName(defender, { state })}.`);
        }
    }
    else {
        await plineWithContinuation(`Suddenly, you notice ${monsterName(defender, { state, article: 'a' })}.`);
    }
}
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
// Contact can finish with a native MISS (for example, after life saving).
// Unlike hero hits, this rule does not exclude missiles or require the
// weapon to remain wielded. The caller supplies the contact's saved weapon.
export async function tryMonsterPuddingSplit(aggressor, defender, weapon, { state = game, visible, publish = plineWithContinuation, random = rn2 }) {
    requirePlayingGame(state);
    if (!weapon || defender.mhp <= 1 || defender.mcan
        || (defender.mnum !== PM_BLACK_PUDDING && defender.mnum !== PM_BROWN_PUDDING))
        return { split: false, heroDied: false, aggressorDied: false };
    const material = objectMaterial(weapon, state);
    if (material !== IRON && material !== METAL)
        return { split: false, heroDied: false, aggressorDied: false };
    const clone = await cloneMonster(defender, state, { random });
    if (!clone)
        return { split: false, heroDied: false, aggressorDied: false };
    if (visible && canSpotMonster(defender)) {
        await publish(`${monsterName(defender, { state, capitalized: true })} divides as ${monsterName(aggressor, { state })} hits it!`);
    }
    const trap = await triggerImmediateMonsterTrap(clone, state, { random });
    await finishImmediateMonsterTrap(trap, state, { publish, random });
    return {
        split: true,
        heroDied: !!state.program_state.gameover,
        aggressorDied: aggressor.mhp <= 0,
    };
}
// C mhitm.c:failed_grab(). Unlike hitmm/missmm, a failed hold is silent
// when the defender cannot be spotted, even if the attacker can be seen.
export async function showMonsterGrabFailure(aggressor, defender, attack, target, visible, state = game) {
    if (!visible || !canSpotMonster(defender))
        return;
    const subject = possessiveName(monsterName(aggressor, { capitalized: true, state }));
    const name = monsterName(defender, { state });
    const object = target.notOnHead ? `${possessiveName(name)} tail` : name;
    const verb = attack.damageType === AD_DGST ? 'gulp'
        : attack.damageType === AD_STCK ? 'adhere' : 'grab';
    const failure = target.notOnHead ? 'fails to hold' : 'passes right through';
    await plineWithContinuation(`${subject} ${verb} attempt ${failure} ${object}!`);
}
// C mhitm.c:hitmm(), the message half; the damage half is mdamagem()
// (resolveMonsterCombatDamage below).
export async function prepareMonsterCombatContact(aggressor, defender, attack, weapon, { state = game, visible, publish = plineWithContinuation, rollOne = rnd, rollDice = d }) {
    await revealAttackingMonsters(aggressor, defender, visible);
    const compatibility = aggressor.mcan ? 0 : seductionCompatibility(aggressor, defender, attack, state);
    if (!compatibility && await rejectMonsterShadeContact(aggressor, defender, weapon, {
        state, visible, publish, rollOne, rollDice,
    }))
        return 'shade-miss';
    if (!visible) {
        await reportMonsterCombatNoise(aggressor, state, { publish });
        return 'contact';
    }
    const subject = monsterName(aggressor, { state, capitalized: true });
    if (compatibility) {
        const verb = defender.mcansee ? 'smiles at' : 'talks to';
        const target = monsterName(defender, { state });
        await publish(`${subject} ${verb} ${target} ${compatibility === 2 ? 'engagingly' : 'seductively'}.`);
        return 'contact';
    }
    const weaponHit = attack[0] === AT_WEAP || attack[0] === AT_CLAW && !!weapon;
    const action = contactAction(aggressor, attack, weaponHit && !!weapon?.oartifact, subject, state);
    if (action)
        await publish(`${action} ${combatTargetName(defender, aggressor, state)}.`);
    if (weaponHit && weapon && objectMaterial(weapon, state) === 14 && monsterHatesSilver(defender))
        await showSilverContact(aggressor, defender, weapon, subject, state, publish);
    return 'contact';
}
function contactAction(aggressor, attack, artifact, subject, state) {
    switch (attack[0]) {
        case AT_BITE: return `${subject} bites`;
        case AT_STNG: return `${subject} stings`;
        case AT_BUTT: return `${subject} butts`;
        case AT_TUCH: return `${subject} touches`;
        case AT_TENT: return `${possessiveName(subject)} tentacles suck`;
        case AT_HUGS:
            if (aggressor !== state.u.ustuck)
                return `${subject} squeezes`;
            return artifact ? '' : `${subject} hits`;
        case AT_NONE:
        case AT_CLAW:
        case AT_KICK:
        case AT_SPIT:
        case AT_ENGL:
        case AT_BREA:
        case AT_EXPL:
        case AT_BOOM:
        case AT_GAZE:
        case AT_WEAP:
        case AT_MAGC:
            return artifact ? '' : `${subject} hits`;
    }
}
function combatTargetName(defender, aggressor, state) {
    if (defender !== aggressor)
        return monsterName(defender, { state });
    switch (monsterObjectPronoun(defender, { state })) {
        case 'him': return 'himself';
        case 'her': return 'herself';
        case 'them': return 'themselves';
        default: return 'itself';
    }
}
async function showSilverContact(aggressor, defender, weapon, subject, state, publish) {
    let target = combatTargetName(defender, aggressor, state);
    if (!monsterIsNoncorporeal(defender) && !monsterIsAmorphous(defender)) {
        target = defender === aggressor
            ? target.replace('himself', 'his own').replace('herself', 'her own').replace('itself', 'its own')
            : possessiveName(target);
        target += ' flesh';
    }
    const noun = minimalObjectName(weapon, state);
    const simpleName = (weapon.quan ?? weapon.quantity ?? 1) === 1 ? noun : pluralizeObjectNoun(weapon, noun);
    await publish(`${possessiveName(subject)} ${simpleName} sears ${target}!`);
}
export async function showMonsterArtifactFallbackHit(aggressor, defender, { state = game, visible, publish = plineWithContinuation }) {
    if (!visible)
        return;
    const subject = monsterName(aggressor, { state, capitalized: true });
    await publish(`${subject} hits ${combatTargetName(defender, aggressor, state)}.`);
}
export async function resolveMonsterCombatGaze(attacker, defender, attack, { state = game, visible, random = rn2, rollDice = d, publish = plineWithContinuation, resolveDamage, }) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const archon = attacker.mnum === PM_ARCHON && attack[1] === AD_BLND;
    const blindedArchon = archon && !attacker.mcansee;
    if (MONSTER_SYMBOL[defender.mnum] === S_MIMIC && M_AP_TYPE(defender))
        await revealMonsterAppearance(defender);
    defender.mundetected = 0;
    if (visible) {
        const subject = monsterName(attacker, {
            state, capitalized: true, adjective: blindedArchon ? 'blinded' : '',
        });
        const target = canSpotMonster(defender) ? monsterName(defender, { state }) : 'something';
        await publish(`${subject} gazes ${blindedArchon ? 'toward' : 'at'} ${target}...`);
    }
    if (attacker.mcan || !defender.mcansee
        || (archon ? monsterResistsBlindingLight(defender, state) : !attacker.mcansee)
        || attacker.minvis && !perceivesInvisible(defender) || defender.msleeping) {
        if (visible && canSpotMonster(defender))
            await publish('but nothing happens.');
        return gazeResult(M_ATTK_MISS);
    }
    if (attacker.mnum === PM_MEDUSA && monsterReflectionSource(defender, state)) {
        await showGazeReflection(defender, state, publish);
        if (monsterReflectionSource(attacker, state)) {
            await showGazeReflection(attacker, state, publish);
            return gazeResult(M_ATTK_MISS);
        }
        if (defender.minvis && !perceivesInvisible(attacker)) {
            if (canSeeMonster(attacker)) {
                const subject = monsterName(attacker, { state, capitalized: true });
                const pronoun = monsterPossessive(attacker, { state, random });
                await publish(`${subject} doesn't seem to notice that ${pronoun} gaze was reflected.`);
            }
            return gazeResult(M_ATTK_MISS);
        }
        if (canSeeMonster(attacker))
            await publish(`${monsterName(attacker, { state, capitalized: true })} is turned to stone!`);
        const stone = await prepareMonsterPetrification(attacker, { publish });
        if (stone.heroDied)
            return gazeResult(M_ATTK_MISS, true);
        if (stone.survived)
            return gazeResult(M_ATTK_MISS);
        const death = await finishEnvironmentalMonsterDeath(attacker, state, {
            noCorpse: true, stoneRemains: stone.remains ?? null, publish, random, rollDice,
        });
        return gazeResult(attacker.mhp <= 0 ? M_ATTK_AGR_DIED : M_ATTK_MISS, !!death.heroDied);
    }
    if (archon) {
        await applyMonsterCombatBlindness(attacker, defender, attack, {
            state, visible, publish, rollDice,
        });
        if (random(2))
            defender.mstun = 1;
    }
    return resolveDamage(attacker, defender, attack);
}
function gazeResult(nativeResult, heroDied = false) {
    return { damage: 0, nativeResult, heroDied, skipBrainDrain: false };
}
function perceivesInvisible(monster) {
    return !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
}
// Native mon_reflects only identifies a worn shield or amulet when its
// reflection is optically visible. Detection alone does not reveal the item.
async function showGazeReflection(monster, state, publish) {
    if (!canSeeMonster(monster))
        return;
    const source = monsterReflectionSource(monster, state);
    if (!source)
        return;
    const owner = possessiveName(monsterName(monster, { state }));
    await publish(`The gaze is reflected away by ${owner} ${source.noun}.`);
    const object = source.object;
    if (object && (object.otyp === SHIELD_OF_REFLECTION || object.otyp === AMULET_OF_REFLECTION))
        learnObjectType(object.otyp, state);
}
// C mhitm.c:engulf_target(): return True if the attacker is allowed to
// swallow the defender.
export function monsterCanEngulfMonster(attacker, defender, state) {
    const defenderSize = requireMonsterData(MONSTER_SIZE, defender.mnum);
    if (defenderSize >= MZ_HUGE
        || (requireMonsterData(MONSTER_SIZE, attacker.mnum) < defenderSize && !monsterIsWhirly(attacker))
        || attacker.mtrapped || defender.mtrapped)
        return false;
    if (!(requireMonsterData(MONSTER_FLAGS1, defender.mnum) & M1_WALLWALK)
        && engulfSquareBlocked(state.level.at(defender.mx, defender.my), attacker))
        return false;
    return !!(requireMonsterData(MONSTER_FLAGS1, attacker.mnum) & M1_WALLWALK)
        || !engulfSquareBlocked(state.level.at(attacker.mx, attacker.my), defender);
}
function engulfSquareBlocked(square, other) {
    return !square || IS_OBSTRUCTED(square.typ) || IS_TREE(square.typ)
        || (square.typ === DOOR && !!(square.doormask & (D_CLOSED | D_LOCKED)))
        || (square.typ === IRONBARS && !monsterIsWhirly(other));
}
export async function resolveMonsterCombatEngulf(attacker, defender, attack, { state = game, visible, resolveDamage, publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, }) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const miss = {
        damage: 0, nativeResult: M_ATTK_MISS, heroDied: false, skipBrainDrain: false,
    };
    if (!monsterCanEngulfMonster(attacker, defender, state))
        return miss;
    if (visible) {
        const verb = monsterDigests(attacker) ? 'swallows' : monsterEnfolds(attacker) ? 'encloses' : 'engulfs';
        await publish(`${monsterName(attacker, { state, capitalized: true })} ${verb} ${monsterName(defender, { state })}.`);
    }
    if (!FLAMING_SPECIES.has(attacker.mnum))
        await snuffMonsterInventoryLights(defender, state, publish);
    if (monsterIsVampireShifter(defender)) {
        const change = await changeMonsterForm(defender, defender.cham, state, { publish });
        if (change?.heroDied)
            return { ...miss, heroDied: true };
        if (change) {
            if (visible) {
                await publish(`${monsterName(attacker, { state, capitalized: true })} expels ${canSpotMonster(defender) ? 'it' : 'something'}.`);
                if (canSpotMonster(defender)) {
                    await publish(`It turns into ${namelessMonsterName(defender, {
                        state, article: 'a', suppressIt: true, suppressInvisible: true,
                    })}.`);
                }
            }
            return { ...miss, nativeResult: M_ATTK_HIT };
        }
    }
    const origin = { x: attacker.mx, y: attacker.my };
    const target = { x: defender.mx, y: defender.my };
    const previousEngulf = state._monsterEngulf;
    const previousSwallower = state._monsterSwallower;
    removeMonsterFromMapAt(target.x, target.y, state);
    removeMonsterFromMapAt(origin.x, origin.y, state);
    state._monsterEngulf = { attacker, defender, defenderExposed: false };
    try {
        await placeMonsterOnMap(attacker, target.x, target.y, state);
        await newsym(origin.x, origin.y);
        await newsym(target.x, target.y);
        state._monsterSwallower = attacker;
        let result;
        try {
            result = await resolveDamage(attacker, defender, attack);
        }
        finally {
            state._monsterSwallower = previousSwallower;
        }
        const attackerDied = !!(result.nativeResult & M_ATTK_AGR_DIED);
        const defenderDied = !!(result.nativeResult & M_ATTK_DEF_DIED);
        if (result.heroDied || attackerDied && defenderDied)
            return result;
        if (defenderDied) {
            const destination = goodPosition(target.x, target.y, { kind: 'monster', monster: attacker }, {
                state, gpflags: MM_IGNOREWATER, random,
            }) ? target : origin;
            const alreadyPlaced = monsterAtPosition(state.level, destination.x, destination.y) === attacker;
            if (!alreadyPlaced)
                await placeMonsterOnMap(attacker, destination.x, destination.y, state);
            state._monsterEngulf = previousEngulf;
            if (destination !== target)
                await newsym(target.x, target.y);
            if (!alreadyPlaced)
                await newsym(destination.x, destination.y);
            const liquid = await resolveMonsterLiquid(attacker, state, {
                announce: publish, random, rollOne, rollDice,
                finishDeath: (monster, death) => finishMonsterLiquidDeath(monster, {
                    ...death, rollDice, publish,
                }),
            });
            if (liquid?.heroDied || state.program_state.gameover)
                return { ...result, heroDied: true };
            if (attacker.mhp > 0 && state.level.traps.some(trap => trap.tx === destination.x && trap.ty === destination.y)) {
                const trap = await triggerImmediateMonsterTrap(attacker, state, { random, rollOne, rollDice });
                await finishImmediateMonsterTrap(trap, state, { publish, random });
            }
            return { ...result,
                nativeResult: result.nativeResult | (attacker.mhp <= 0 ? M_ATTK_AGR_DIED : 0),
                heroDied: !!state.program_state.gameover };
        }
        if (attackerDied) {
            await placeMonsterOnMap(defender, target.x, target.y, state);
            state._monsterEngulf = previousEngulf;
            await newsym(target.x, target.y);
        }
        else {
            if (cansee(target.x, target.y)) {
                const verb = monsterDigests(attacker) ? 'regurgitated' : monsterEnfolds(attacker) ? 'released' : 'expelled';
                await publish(`${monsterName(defender, { state, capitalized: true })} is ${verb}!`);
            }
            removeMonsterFromMapAt(target.x, target.y, state);
            await placeMonsterOnMap(attacker, origin.x, origin.y, state);
            await placeMonsterOnMap(defender, target.x, target.y, state);
            state._monsterEngulf = previousEngulf;
            await newsym(origin.x, origin.y);
            await newsym(target.x, target.y);
        }
        return result;
    }
    finally {
        state._monsterSwallower = previousSwallower;
        state._monsterEngulf = previousEngulf;
    }
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
export async function resolveMonsterCombatExplosion(attacker, defender, attack, { state = game, visible, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, resolveDamage = (source, target, selected) => resolveMonsterCombatDamage(source, target, selected, { state, visible, publish, random, rollDice, rollOne }), }) {
    requirePlayingGame(state);
    if (attacker.mcan)
        return { mask: M_ATTK_MISS, heroDied: false, damage: 0 };
    const [, damageType, dice, sides] = attack;
    if (cansee(attacker.mx, attacker.my)) {
        await publish(`${monsterName(attacker, { state, capitalized: true })} explodes!`);
    }
    else {
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
        const blast = await createElementalMonsterExplosion(attacker.mx, attacker.my, damageType, damage, killer, { state, publish, random });
        // explmm keeps AGR_DIED even when life saving leaves the source alive.
        const mask = M_ATTK_AGR_DIED | (defender.mhp <= 0 ? M_ATTK_DEF_DIED : 0);
        if (blast.heroDied)
            return { mask, heroDied: true, damage };
        if (attacker.mtame)
            await publish('You have a melancholy feeling for a moment, then it passes.');
        return { mask, heroDied: false, damage };
    }
    const outcome = await resolveDamage(attacker, defender, attack);
    let mask = outcome.nativeResult;
    if (outcome.heroDied)
        return { mask, heroDied: true, damage: outcome.damage };
    if (!(mask & M_ATTK_AGR_DIED)) {
        const wasLeashed = !!attacker.mleashed;
        const death = await finishEnvironmentalMonsterDeath(attacker, state, {
            noCorpse: true, publish, random, rollDice,
        });
        if (death.heroDied)
            return { mask: mask | M_ATTK_AGR_DIED, heroDied: true, damage: outcome.damage };
        if (death.survived)
            return { mask, heroDied: false, damage: outcome.damage };
        mask |= M_ATTK_AGR_DIED;
        if (wasLeashed)
            await publish('Your leash falls slack.');
    }
    if (attacker.mtame)
        await publish('You have a melancholy feeling for a moment, then it passes.');
    return { mask, heroDied: false, damage: outcome.damage };
}
export async function resolveMonsterCombatDamage(attacker, defender, attack, { state = game, visible, weapon = null, dieRoll = 0, target = { x: defender.mx, y: defender.my }, notOnHead = state.notonhead, publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, calls = [], }) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const attackerSpecies = attacker.mnum;
    const defenderSpecies = defender.mnum;
    const damage = rollDice(attack[2], attack[3]);
    calls.push(`d(${attack[2]},${attack[3]})`);
    let death = null;
    function recordDeath(outcome) {
        death = { survived: outcome.survived, corpseCreated: !!outcome.corpse,
            corpse: outcome.corpse, growth: null, aggressor: attacker,
            ...(outcome.heroDied ? { heroDied: true } : {}) };
    }
    async function finishDeath(monster, options = {}) {
        const outcome = await finishEnvironmentalMonsterDeath(monster, state, {
            random, rollDice, publish, ...options,
        });
        if (monster === defender)
            recordDeath(outcome);
        return outcome;
    }
    async function growAttacker(victim) {
        const growth = growMonster(attacker, { victim, state, random, rollOne, calls });
        if (death)
            death.growth = growth;
        if (growth.changedSpecies) {
            if (canSpotMonster(attacker))
                await publish(growth.message);
            finishMonsterGrowth(attacker, growth);
            await newsym(attacker.mx, attacker.my);
            if (growth.genocided)
                await finishDeath(attacker);
        }
        return { survived: growth.alive && attacker.mhp > 0 && !attacker.dead,
            heroDied: !!state.program_state.gameover };
    }
    const context = {
        state, attack, damage, visible, notOnHead,
        dieRoll, weapon, random, rollOne, rollDice, publish, finishDeath, growAttacker,
        applyPhysical: () => physicalEffect(attacker, defender, context),
        killDefender: async (options = {}) => {
            const outcome = await finishMonsterKilled(defender, state, {
                damageType: options.damageType ?? attack[1], random, rollDice, publish,
                ...(options.cause === undefined ? {} : { cause: options.cause }),
            });
            recordDeath(outcome);
            if (outcome.heroDied)
                return { nativeResult: M_ATTK_DEF_DIED, heroDied: true };
            if (outcome.survived)
                return { nativeResult: M_ATTK_MISS, heroDied: false };
            const growth = await growAttacker(defender);
            return { nativeResult: M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED),
                heroDied: growth.heroDied };
        },
    };
    const result = (effect) => ({
        damage: effect.damage, nativeResult: effect.nativeResult,
        heroDied: effect.heroDied, skipBrainDrain: !!effect.skipBrainDrain, death,
    });
    if ((touchPetrifies(defenderSpecies) || attack[1] === AD_DGST && defenderSpecies === PM_MEDUSA)
        && !monsterHasStoneResistance(attacker)
        && !contactIsProtected(attack[0], attacker.misc_worn_check ?? 0, !!weapon)) {
        const stone = await petrifyMonsterAttacker(attacker, {
            state, visible: visible && canSpotMonster(attacker), publish, finishDeath,
        });
        if (stone.heroDied)
            return result(effectResult(0, M_ATTK_AGR_DIED, true));
        if (!stone.survived && attacker.mtame && !visible)
            await publish('You have a peculiarly sad feeling for a moment, then it passes.');
        return result(effectResult(0, stone.survived ? M_ATTK_HIT : M_ATTK_AGR_DIED));
    }
    const effect = await applyMonsterCombatEffect(attacker, defender, context);
    if (effect.heroDied)
        return result(effect);
    // Even an effect that set done or zero damage reaches native knockback.
    const knockback = await tryKnockback(attacker, defender, { attackType: attack[0], damageType: attack[1] }, {
        state, random, publish, weaponUsed: !!monsterWieldedWeapon(attacker),
        finishMonsterDeath: finishDeath,
        finishLiquidDeath: (monster, liquid) => finishDeath(monster, {
            noCorpse: !liquid.leaveCorpse, random: liquid.random,
        }),
    });
    if (knockback.heroDied)
        return result({ ...effect, heroDied: true });
    if (knockback.knocked) {
        return result({ ...effect, damage: 0,
            nativeResult: effect.nativeResult | M_ATTK_HIT
                | (knockback.defenderDied ? M_ATTK_DEF_DIED : 0)
                | (knockback.aggressorDied ? M_ATTK_AGR_DIED : 0) });
    }
    if (effect.done || !effect.damage)
        return result(effect);
    defender.mhp -= effect.damage;
    if (defender.mhp > 0)
        return result({ ...effect, nativeResult: effect.nativeResult === M_ATTK_AGR_DIED
                ? M_ATTK_AGR_DIED : M_ATTK_HIT });
    exposeEngulfedDefenderForDeath(attacker, defender, state);
    const outcome = await finishMonsterKilled(defender, state, {
        damageType: attack[1], random, rollDice, publish,
        noRevive: (attack[0] === AT_WEAP || attack[0] === AT_CLAW)
            && MONSTER_SYMBOL[defender.mnum] === S_TROLL
            && artifactById(weapon?.oartifact, state)?.enumName === 'TROLLSBANE',
        zombifyCorpse: !weapon && isZombieMaker(attacker.mnum, !!attacker.mcan)
            && (attack[0] === AT_CLAW || attack[0] === AT_BITE || attack[0] === AT_TUCH)
            && zombieForm(defender.mnum) != null,
    });
    recordDeath(outcome);
    if (outcome.heroDied)
        return result({ ...effect, heroDied: true });
    if (outcome.survived)
        return result(effect);
    if (effect.nativeResult === M_ATTK_AGR_DIED)
        return result({ ...effect, nativeResult: M_ATTK_DEF_DIED | M_ATTK_AGR_DIED });
    if (attack[1] === AD_DGST) {
        const digestion = await finishMonsterDigestion(attacker, {
            state, attackerSpecies, defenderSpecies, defenderShapechanger: defender.cham, publish, growAttacker,
        });
        if (digestion.heroDied || !digestion.growNormally)
            return result({ ...effect, nativeResult: M_ATTK_DEF_DIED
                    | (attacker.mhp <= 0 || attacker.dead ? M_ATTK_AGR_DIED : 0),
                heroDied: digestion.heroDied });
    }
    const growth = await growAttacker(defender);
    return result({ ...effect, nativeResult: M_ATTK_DEF_DIED
            | (growth.survived ? 0 : M_ATTK_AGR_DIED), heroDied: growth.heroDied });
}
// C uhitm.c:mhitm_adtyping(), the monster-versus-monster arm; native
// mdamagem() (mhitm.c:1059) calls it right after the attacker-petrify gate.
// The hero-attacker arm lives in hero_natural_damage.ts and the per-adtyp
// owners keep their mhitm_ad_* branches in uhitm.ts.
async function applyMonsterCombatEffect(attacker, defender, context) {
    switch (context.attack[1]) {
        case AD_PHYS: return context.applyPhysical();
        case AD_FIRE:
        case AD_COLD:
        case AD_ELEC:
        case AD_ACID:
        case AD_RUST:
        case AD_CORR:
        case AD_DCAY:
            return applyMonsterElementEffect(attacker, defender, context);
        case AD_HALU:
        case AD_PLYS:
        case AD_SLEE:
        case AD_SLOW:
        case AD_CONF:
        case AD_WERE:
        case AD_HEAL:
        case AD_STCK:
        case AD_WRAP:
            return applyMonsterStatusEffect(attacker, defender, context);
        // C uhitm.c:mhitm_ad_drli/blnd/ench/stun/legs() own their mhitm
        // branches in uhitm.ts.
        case AD_DRLI: return mhitmAdDrli({ attacker, defender, context });
        case AD_BLND: return mhitmAdBlnd({ attacker, defender, context });
        case AD_ENCH: return mhitmAdEnch({ attacker, defender, context });
        case AD_STUN: return mhitmAdStun({ attacker, defender, context });
        case AD_LEGS: return mhitmAdLegs({ attacker, defender, context });
        case AD_DREN:
        case AD_DETH:
        case AD_PEST:
        case AD_FAMN:
        case AD_DISE:
        case AD_CURS:
            return applyMonsterDrainEffect(attacker, defender, context);
        case AD_SEDU:
        case AD_SITM:
        case AD_SSEX:
        case AD_SGLD:
            return applyMonsterTheftEffect(attacker, defender, context);
        case AD_TLPT:
        case AD_POLY:
        case AD_SLIM:
            return applyMonsterTransformEffect(attacker, defender, context);
        case AD_DGST: return applyMonsterDigestionEffect(attacker, defender, context);
        case AD_DRIN: {
            const brain = await resolveMonsterBrainAttack(attacker, defender, context.damage, context);
            return { damage: brain.damage, nativeResult: brain.hitFlags, done: false,
                skipBrainDrain: brain.skipBrainDrain, heroDied: brain.heroDied };
        }
        case AD_STON: return petrifyingEffect(attacker, defender, context);
        case AD_DRST:
        case AD_DRDX:
        case AD_DRCO: {
            let damage = context.damage;
            if (!await monsterCombatAttackNegated(attacker, defender, { ...context, verbose: false })
                && context.random(8) === 0)
                damage = await poisonMonsterFromAttack(attacker, defender, context.attack[0], damage, context);
            return effectResult(damage);
        }
        case AD_SAMU:
        case AD_MAGM:
        case AD_DISN:
        case AD_SPC1:
        case AD_SPC2:
        case AD_CLRC:
        case AD_SPEL:
        case AD_RBRE:
            return effectResult(0);
    }
}
async function physicalEffect(attacker, defender, context) {
    let grew = false;
    const physical = await resolveMonsterPhysicalDamage(attacker, defender, { attackType: context.attack[0] }, context.damage, {
        ...context, hitOnHead: !context.notOnHead,
        finishDeath: async (monster, options) => {
            const outcome = await context.finishDeath(monster, options);
            if (!outcome.survived && !outcome.heroDied && monster === defender) {
                grew = true;
                return { ...outcome, heroDied: (await context.growAttacker(defender)).heroDied };
            }
            return outcome;
        },
    });
    let nativeResult = physical.hitFlags;
    let heroDied = physical.heroDied;
    if ((nativeResult & M_ATTK_DEF_DIED) && !heroDied && !grew) {
        const growth = await context.growAttacker(defender);
        heroDied = growth.heroDied;
        if (!growth.survived)
            nativeResult |= M_ATTK_AGR_DIED;
    }
    if (attacker.mhp <= 0 || attacker.dead)
        nativeResult |= M_ATTK_AGR_DIED;
    return { damage: physical.damage, done: physical.done, nativeResult, heroDied };
}
async function petrifyingEffect(attacker, defender, context) {
    if (attacker.mcan)
        return effectResult(context.damage);
    const stone = await petrifyMonsterDefender(defender, {
        ...context, visible: context.visible && canSeeMonster(defender),
    });
    if (stone.heroDied)
        return effectResult(0, M_ATTK_MISS, true);
    let nativeResult = M_ATTK_MISS;
    let heroDied = false;
    if (!stone.survived) {
        if (defender.mtame && !context.visible)
            await context.publish('You have a peculiarly sad feeling for a moment, then it passes.');
        const growth = await context.growAttacker(defender);
        nativeResult = M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED);
        heroDied = growth.heroDied;
    }
    return { damage: 0, nativeResult, done: stone.stopped, heroDied };
}
function effectResult(damage, nativeResult = M_ATTK_MISS, heroDied = false) {
    return { damage, nativeResult, heroDied, done: false };
}
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');
// Called only after monkilled() confirms that the meal died. Wraith growth
// replaces ordinary victim growth; every other meal permits it afterwards.
export async function finishMonsterDigestion(attacker, { state, attackerSpecies, defenderSpecies, defenderShapechanger, publish = plineWithContinuation, growAttacker, }) {
    requireLiveGame(state);
    if (defenderShapechanger !== undefined && ismnum(defenderShapechanger)) {
        const change = await changeMonsterForm(attacker, null, state, { showMessage: true, publish });
        if (change?.heroDied)
            return { growNormally: false, heroDied: true };
    }
    else if (defenderSpecies === PM_GREEN_SLIME
        && !monsterIsSlimeproof({ mnum: attackerSpecies })) {
        const change = await changeMonsterForm(attacker, PM_GREEN_SLIME, state, { showMessage: true, publish });
        if (change?.heroDied)
            return { growNormally: false, heroDied: true };
    }
    else if (defenderSpecies === PM_WRAITH) {
        const growth = await growAttacker(null);
        return { growNormally: false, heroDied: growth.heroDied };
    }
    else if (defenderSpecies === PM_NURSE) {
        healMonster(attacker, attacker.mhpmax, 0);
    }
    await grantMonsterCorpseIntrinsic(attacker, defenderSpecies, state);
    return { growNormally: true, heroDied: !!state.program_state.gameover };
}
export async function applyMonsterContactPassive(attacker, defender, { hit, weapon = null, state = game, random = rn2, rollDice = d, publish = plineWithContinuation, } = {}) {
    const passive = passiveAttack(defender);
    if (!passive)
        return { stopped: false, hit };
    const type = passive[1];
    let damage = passiveDamage(requireMonsterData(MONSTER_LEVEL, defender.mnum), passive, rollDice);
    const visible = canSeeMonster(attacker);
    if (type === AD_ACID) {
        if (hit && random(2) === 0) {
            const subject = monsterName(attacker, { state, capitalized: true });
            if (visible) {
                const owner = possessiveName(monsterName(defender, { state }));
                await publish(`${subject} is splashed by ${owner} ${displayLiquidName('acid', state)}!`);
            }
            if (monsterHasAcidResistance(attacker)) {
                if (visible)
                    await publish(`${monsterName(attacker, { state, capitalized: true })} is not affected.`);
                damage = 0;
            }
        }
        else
            damage = 0;
        if (random(30) === 0)
            await erodeArmor(attacker, 'corrosion', { state, random, publish });
        if (random(6) === 0)
            await damageObjectWithAcid(monsterWieldedWeapon(attacker), { state, random, publish });
    }
    else {
        if (type === AD_ENCH && hit && !defender.mcan && weapon)
            await drainObjectEnchantment(weapon, { random, state });
        if (defender.dead || defender.mhp <= 0 || defender.mcan || random(3) === 0)
            return { stopped: false, hit };
        // Other passive types have no surviving-defender damage effect.
        if (type !== AD_PLYS && type !== AD_COLD && type !== AD_FIRE
            && type !== AD_ELEC && type !== AD_STUN) {
            damage = 0;
        }
        else
            switch (type) {
                case AD_PLYS:
                    return paralyzeAttacker(attacker, defender, damage, { state, random, publish, visible, hit });
                case AD_COLD:
                case AD_FIRE:
                case AD_ELEC: {
                    const resists = type === AD_COLD ? monsterHasColdResistance
                        : type === AD_FIRE ? monsterHasFireResistance : monsterHasShockResistance;
                    if (resists(attacker)) {
                        if (visible) {
                            const feeling = type === AD_COLD ? 'chilly' : type === AD_FIRE ? 'warmed' : 'tingled';
                            await publish(`${monsterName(attacker, { state, capitalized: true })} is mildly ${feeling}.`);
                            await applyMonsterGolemEffects(attacker, type, damage, { state, publish });
                        }
                        damage = 0;
                    }
                    else {
                        if (visible) {
                            const feeling = type === AD_COLD ? 'suddenly very cold'
                                : type === AD_FIRE ? 'suddenly very hot' : 'jolted with electricity';
                            await publish(`${monsterName(attacker, { state, capitalized: true })} is ${feeling}!`);
                        }
                        if (type === AD_COLD) {
                            const healing = Math.trunc(damage / 2);
                            healMonster(defender, healing, healing);
                            if (defender.mhpmax > (defender.m_lev + 1) * 8) {
                                await splitMonster(defender, state, { monsterMoving: true, random, heatSource: attacker, publish });
                            }
                        }
                    }
                    break;
                }
                case AD_STUN:
                    if (!attacker.mstun) {
                        attacker.mstun = 1;
                        if (visible)
                            await publish(`${monsterName(attacker, { state, capitalized: true })} ${staggerVerb(attacker.mnum)}...`);
                    }
                    damage = 0;
                    break;
            }
    }
    attacker.mhp -= damage;
    if (attacker.mhp > 0)
        return { stopped: false, damage, hit };
    const death = await finishMonsterKilled(attacker, state, { damageType: type, random, publish });
    // C ends this attack sequence even when life saving revives the attacker.
    return { stopped: true, fatal: true, damage, hit,
        ...(death.heroDied ? { heroDied: true } : {}) };
}
async function paralyzeAttacker(attacker, defender, duration, { state, random, publish, visible, hit, }) {
    duration = Math.min(127, duration);
    if (defender.mnum === PM_FLOATING_EYE) {
        if (random(4) === 0)
            duration = 127;
        const flags = MONSTER_FLAGS1[attacker.mnum] ?? 0;
        if (!attacker.mcansee || (flags & M1_NOEYES) || !defender.mcansee
            || (defender.minvis && !(flags & M1_SEE_INVIS))) {
            // passivemm returns M_ATTK_HIT here even after a missed attack.
            return { stopped: false, hit: true };
        }
        // Native constructs this name even when there is no reflection.
        const gazeOwner = possessiveName(monsterName(defender, { state, capitalized: true }));
        const reflection = monsterReflectionSource(attacker, state);
        if (reflection) {
            if (visible) {
                await publish(`${gazeOwner} gaze is reflected by ${possessiveName(monsterName(attacker, { state }))} ${reflection.noun}.`);
                if (reflection.object && ['shield', 'amulet'].includes(reflection.noun))
                    learnObjectType(reflection.object.otyp, state);
            }
            return { stopped: false, hit };
        }
        const subject = monsterName(attacker, { state, capitalized: true });
        if (visible)
            await publish(`${subject} is frozen by ${possessiveName(monsterName(defender, { state }))} gaze!`);
    }
    else {
        const subject = monsterName(attacker, { state, capitalized: true });
        if (visible)
            await publish(`${subject} is frozen by ${monsterName(defender, { state })}.`);
    }
    paralyzeMonster(attacker, duration);
    return { stopped: true, hit };
}
// C mhitm.c:xdrainenergym(). The attack owner decides whether draining hits.
export async function drainMonsterEnergy(monster, { state = game, publish = plineWithContinuation, rollDice = d, giveMessage = true, } = {}) {
    if ((monster.mspec_used ?? 0) >= 20
        || !(MONSTER_ATTACKS[monster.mnum] ?? []).some(([method]) => method === AT_MAGC || method === AT_BREA))
        return;
    monster.mspec_used = (monster.mspec_used ?? 0) + rollDice(2, 2);
    if (giveMessage)
        await publish(`${monsterName(monster, { state, capitalized: true })} seems lethargic.`);
}
//# sourceMappingURL=mhitm.js.map