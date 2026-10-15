// C uhitm.c:hmonas(). Each slot observes changes made by the preceding hit.
import { formatFeltMessage } from './hero_speech.js';
import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, TT_PIT, Upolyd, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMU, W_RINGL, W_RINGR, } from './const.js';
import { selectAttack } from './attack_selection.js';
import { specialContactDamage } from './contact_damage.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { findHeroMeleeHitThreshold, maybeUnparalyzeMeleeDefender, showHeroMeleeMiss } from './hero_attack_accuracy.js';
import { resolveHeroCombatEngulf } from './hero_combat_engulf.js';
import { resolveHeroCombatExplosion } from './hero_combat_explosion.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { releaseHeroGrip } from './hero_expulsion.js';
import { heroGrabMisses, heroSeductionCompatibility, monsterCanBeStrangled, showHeroSilverContact } from './hero_form_contact.js';
import { finishHeroLiquidMonsterDeath, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { resolveHeroNaturalDamage } from './hero_natural_damage.js';
import { heroSpecies } from './hero_species.js';
import { resolveHeroWeaponHit } from './hero_weapon_hit.js';
import { tryKnockback } from './knockback.js';
import { AD_DRIN, AD_PHYS, AD_SPEL, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterHasHead, monsterIsMindless, monsterIsShade, monsterSpeciesHatesSilver, monsterSpeciesSticks, } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { applyHeroContactPassive } from './monster_passive.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { isWeaponTool } from './object_properties.js';
import { heroHasNoHands, heroIsVerySmall, returnHeroToHumanForm } from './polyself.js';
import { rn2, rnd } from './rng.js';
import { dropSecondaryWeapon } from './two_weapon.js';
import { isTwoWeaponObject } from './weapon_type.js';
const S_KOBOLD = 11;
const S_ORC = 15;
const S_GNOME = 33;
const S_LICH = 38;
const S_MUMMY = 39;
const S_ZOMBIE = 52;
const M1_NOEYES = 0x00001000;
const M1_HUMANOID = 0x00020000;
const PM_ROPE_GOLEM = MONSTER_NAME.indexOf('rope golem');
export async function attackHeroInMonsterForm(monster, x, y, { confirmationOverridden = false, } = {}) {
    requirePlayingGame(game);
    const results = Array(6).fill(M_ATTK_MISS);
    let weaponCount = 0;
    let handCount = 0;
    for (let index = 0; index < results.length; index++) {
        const [method] = selectAttack(game.u, monster, index, results, game);
        if (method === AT_WEAP)
            weaponCount++;
        if (method === AT_WEAP || method === AT_CLAW || method === AT_TUCH)
            handCount++;
    }
    const sequence = {
        state: game, monster, target: { x, y }, results, attempts: 0,
        multipleWeapons: weaponCount > 1, multipleHands: handCount > 1,
        twoHits: 0, oddClaw: true, weaponUsed: false,
        alternateWeapon: false, skipBrainDrain: false, confirmationOverridden,
    };
    for (let index = 0; index < results.length; index++) {
        if (index > 0 && (monster.mhp <= 0
            || monsterAtPosition(game.level, x, y) !== monster))
            continue;
        const attack = selectAttack(game.u, monster, index, results, game);
        if (sequence.skipBrainDrain && attack[0] === AT_TENT && attack[1] === AD_DRIN)
            continue;
        const strike = await performFormAttack(sequence, attack, index);
        if (strike.kind === 'skip')
            continue;
        if (strike.kind === 'interrupted') {
            await dropCursedFormWeapon(strike.weapon, game);
            break;
        }
        results[index] = strike.result;
        if (strike.heroDied)
            return;
        if (strike.exploded) {
            game.u.mh = -1;
            if ((await returnHeroToHumanForm(game)).died)
                return;
        }
        const passive = await applyHeroContactPassive(monster, {
            hit: strike.result !== M_ATTK_MISS,
            defenderSurvived: strike.result !== M_ATTK_DEF_DIED,
            weapon: strike.weapon, attackType: attack[0], weaponWasDestroyed: false,
        });
        if (passive.heroDied)
            return;
        // Native knockback samples its chance even for an ineligible or missed
        // attack. Its owner, rather than this loop, decides whether it applies.
        const knockback = await tryKnockback(game.u, monster, {
            attackType: attack[0], damageType: attack[1],
        }, {
            weaponUsed: sequence.weaponUsed, hit: !!(strike.result & M_ATTK_HIT),
            nameMonster: target => monsterName(target),
            wakeDefender: () => wakeAttackedMonster(monster),
            finishMonsterDeath: (target, options) => finishHeroMonsterKillOutcome(target, target.mx, target.my, options),
            finishLiquidDeath: (target, options) => finishHeroLiquidMonsterDeath(target, options),
        });
        if (knockback.heroDied || knockback.knocked)
            break;
        if (await dropCursedFormWeapon(strike.weapon, game))
            break;
        if (monster.mhp <= 0 || !Upolyd(game.u) || game.multi < 0
            || (game._helplessTurns ?? 0) > 0)
            break;
    }
}
async function performFormAttack(sequence, attack, index) {
    const { state, monster } = sequence;
    const method = attack[0];
    const species = heroSpecies(state);
    const symbol = MONSTER_SYMBOL[species];
    const primary = state.uwep || state.u.uwep;
    const clawUsesWeapon = method === AT_CLAW && primary
        && !heroHasNoHands(state) && !heroIsVerySmall(state) && !sequence.weaponUsed;
    const lichUsesWeapon = method === AT_TUCH && primary && symbol === S_LICH && !sequence.weaponUsed;
    const casterUsesWeapon = method === AT_MAGC
        && [S_KOBOLD, S_ORC, S_GNOME].includes(symbol ?? -1) && !sequence.weaponUsed;
    if (method === AT_WEAP || clawUsesWeapon || lichUsesWeapon || casterUsesWeapon)
        return performFormWeaponAttack(sequence, attack, index);
    switch (method) {
        case AT_CLAW:
        case AT_TUCH:
        case AT_KICK:
        case AT_BITE:
        case AT_STNG:
        case AT_BUTT:
        case AT_TENT:
            if (method === AT_KICK && state.u.utrap && state.u.utraptype === TT_PIT)
                return { kind: 'skip' };
            return performNaturalContact(sequence, attack);
        case AT_HUGS:
            return performHeroHug(sequence, attack, index);
        case AT_EXPL: {
            if ((await wakeAttackedMonster(monster)).heroDied)
                return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
            await plineWithContinuation('You explode!');
            const effect = await resolveHeroCombatExplosion(monster, attack);
            return { kind: 'processed', result: effect.nativeResult, weapon: null, heroDied: effect.heroDied, exploded: true };
        }
        case AT_ENGL:
            return performHeroEngulf(sequence, attack, index);
        case AT_MAGC:
        case AT_NONE:
        case AT_BOOM:
            return { kind: 'skip' };
        case AT_BREA:
        case AT_SPIT:
        case AT_GAZE:
            return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
    }
}
async function performFormWeaponAttack(sequence, attack, index) {
    const { state, monster, target } = sequence;
    sequence.oddClaw = !sequence.oddClaw;
    const primary = state.uwep || state.u.uwep;
    if (sequence.weaponUsed && (sequence.results[index - 1] ?? M_ATTK_MISS) > M_ATTK_MISS
        && primary && OBJECT_BIMANUAL[primary.otyp])
        return { kind: 'skip' };
    sequence.weaponUsed = true;
    const secondary = state.uswapwep || state.u.uswapwep;
    let slot = sequence.alternateWeapon && secondary ? 'uswapwep' : 'uwep';
    if (canAlternateFormWeapon(primary, secondary, state))
        sequence.alternateWeapon = !sequence.alternateWeapon;
    const weapon = state[slot] || state.u[slot] || null;
    if (!weapon)
        slot = 'uarmg';
    const chance = await findHeroMeleeHitThreshold(monster, AT_WEAP, weapon, { firstAttack: sequence.attempts++ === 0, state });
    maybeUnparalyzeMeleeDefender(monster);
    const dieRoll = rnd(20);
    if (sequence.multipleWeapons)
        sequence.twoHits++;
    const strike = await resolveHeroWeaponHit(monster, target.x, target.y, weapon, {
        attack, hit: chance.threshold > dieRoll || !!state.u.uswallow,
        threshold: chance.threshold, armorPenalty: chance.armorPenalty, dieRoll, twoHits: sequence.twoHits,
        confirmationOverridden: sequence.confirmationOverridden,
    });
    const passiveWeapon = state[slot] || state.u[slot] || null;
    if (strike.heroDied || !strike.survived)
        return { kind: 'processed', result: M_ATTK_DEF_DIED, weapon: passiveWeapon, heroDied: strike.heroDied };
    const forwardX = state.u.ux + (state.u.dx ?? target.x - state.u.ux);
    const forwardY = state.u.uy + (state.u.dy ?? target.y - state.u.uy);
    if (monsterAtPosition(state.level, forwardX, forwardY) !== monster)
        return { kind: 'interrupted', weapon: passiveWeapon };
    if (strike.hit && attack[1] !== AD_SPEL && attack[1] !== AD_PHYS)
        return applyNaturalDamage(sequence, attack, 0, passiveWeapon);
    return { kind: 'processed', result: strike.hit ? M_ATTK_HIT : M_ATTK_MISS, weapon: passiveWeapon, heroDied: false };
}
function canAlternateFormWeapon(primary, secondary, state) {
    return !!(primary && secondary && (primary.oclass === 2 || isWeaponTool(primary))
        && !OBJECT_BIMANUAL[primary.otyp] && !(state.uarms || state.u.uarms)
        && !secondary.oartifact && isTwoWeaponObject(secondary) && !OBJECT_BIMANUAL[secondary.otyp]
        && !(objectMaterial(secondary, state) === 14 && monsterSpeciesHatesSilver(heroSpecies(state))));
}
async function performNaturalContact(sequence, attack) {
    const { state, monster, target } = sequence;
    const chance = await findHeroMeleeHitThreshold(monster, attack[0], null, { firstAttack: sequence.attempts++ === 0, state });
    maybeUnparalyzeMeleeDefender(monster);
    const dieRoll = rnd(20);
    if (chance.threshold <= dieRoll && !state.u.uswallow) {
        const miss = await showHeroMeleeMiss(monster, attack, chance.threshold + chance.armorPenalty > dieRoll, { state });
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: miss.heroDied };
    }
    const compatibility = state.u.uswallow ? 0 : heroSeductionCompatibility(monster, attack, state);
    if (compatibility) {
        const sees = monster.mcansee && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES);
        await plineWithContinuation(`You ${sees ? 'smile at' : 'talk to'} ${monsterName(monster)} ${compatibility === 2 ? 'engagingly' : 'seductively'}.`);
        return applyNaturalDamage(sequence, attack, 0);
    }
    if ((await wakeAttackedMonster(monster)).heroDied)
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
    const contact = naturalContactDamage(sequence, attack);
    if (monsterIsShade(monster) && contact.damage === 0) {
        let verb = naturalContactVerb(attack[0]);
        if (verb === 'hit' || (attack[0] === AT_CLAW && ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID)))
            verb = 'attack';
        await plineWithContinuation(`Your ${verb} ${verb === 'claws' || verb === 'tentacles' ? 'pass' : 'passes'} harmlessly through ${monsterName(monster)}.`);
    }
    else if (!await heroGrabMisses(monster, attack, target, { state })) {
        const name = monsterName(monster);
        await plineWithContinuation(attack[0] === AT_TENT ? `Your tentacles suck ${name}.`
            : `You ${attack[0] === AT_CLAW ? 'hit' : naturalContactVerb(attack[0])} ${name}.`);
        if (attack[0] !== AT_TENT && contact.silverMask && state.flags.verbose)
            await showHeroSilverContact(monster, contact.silverMask, { state });
        return applyNaturalDamage(sequence, attack, contact.damage);
    }
    return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
}
function naturalContactDamage(sequence, attack) {
    let mask = 0;
    if (attack[0] === AT_CLAW || attack[0] === AT_TUCH) {
        sequence.oddClaw = !sequence.oddClaw;
        mask = W_ARMG | (sequence.oddClaw || !sequence.multipleHands ? W_RINGL : 0)
            | (!sequence.oddClaw || !sequence.multipleHands ? W_RINGR : 0);
    }
    else if (attack[0] === AT_KICK)
        mask = W_ARMF;
    else if (attack[0] === AT_BUTT)
        mask = W_ARMH;
    return mask ? specialContactDamage(sequence.state.u, sequence.monster, mask, { state: sequence.state })
        : { damage: 0, silverMask: 0 };
}
function naturalContactVerb(method) {
    switch (method) {
        case AT_CLAW: return 'claws';
        case AT_TUCH: return 'touch';
        case AT_TENT: return 'tentacles';
        case AT_KICK: return 'kick';
        case AT_BUTT: return 'head butt';
        case AT_BITE: return 'bite';
        case AT_STNG: return 'sting';
        case AT_NONE:
        case AT_HUGS:
        case AT_SPIT:
        case AT_ENGL:
        case AT_BREA:
        case AT_EXPL:
        case AT_BOOM:
        case AT_GAZE:
        case AT_WEAP:
        case AT_MAGC:
            return 'hit';
    }
}
async function performHeroHug(sequence, originalAttack, index) {
    const { state, monster, target } = sequence;
    const byHand = heroSpecies(state) === PM_ROPE_GOLEM;
    const primary = state.uwep || state.u.uwep;
    const tail = monster.mx !== target.x || monster.my !== target.y;
    if (monsterSpeciesSticks(monster.mnum) || state.u.uswallow || tail
        || (byHand && (primary || !monsterHasHead(monster)))) {
        if (byHand && primary && state.u.ustuck && !state.u.uswallow
            && !monsterSpeciesSticks(state.u.ustuck.mnum))
            await releaseHeroGrip(state);
        return { kind: 'skip' };
    }
    if ((await wakeAttackedMonster(monster)).heroDied)
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
    const contact = specialContactDamage(state.u, monster, byHand ? W_ARMG | W_RINGL | W_RINGR : W_ARMC | W_ARM | W_ARMU, { state });
    let attack = originalAttack;
    let unconcerned = byHand && !monsterCanBeStrangled(monster);
    if (unconcerned) {
        attack = [attack[0], attack[1], 1, 1];
        if (contact.damage || monsterIsMindless(monster.mnum)
            || monster.mhp <= 1 + Math.max(state.u.udaminc ?? 0, 1))
            unconcerned = false;
    }
    let applies = false;
    if (monsterIsShade(monster)) {
        const verb = byHand ? 'grasp' : 'hug';
        if (contact.damage) {
            await plineWithContinuation(`You ${verb} ${monsterName(monster)}${contact.damage > 4 ? '!' : '.'}`);
            applies = true;
        }
        else
            await plineWithContinuation(`Your ${verb} passes harmlessly through ${monsterName(monster)}.`);
    }
    else if (!await heroGrabMisses(monster, attack, target, { state })) {
        if (state.u.ustuck === monster) {
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} is being ${byHand ? 'throttled' : 'crushed'}${unconcerned ? " but doesn't seem concerned" : ''}.`);
            applies = true;
        }
        else if (index >= 2 && (sequence.results[index - 1] ?? M_ATTK_MISS) > M_ATTK_MISS
            && (sequence.results[index - 2] ?? M_ATTK_MISS) > M_ATTK_MISS) {
            if (state.u.ustuck)
                await releaseHeroGrip(state);
            await plineWithContinuation(`You grab ${monsterName(monster)}!`);
            state.u.ustuck = monster;
            state.context.botl = true;
            applies = true;
        }
    }
    if (applies) {
        if (contact.silverMask && state.flags.verbose)
            await showHeroSilverContact(monster, contact.silverMask, { state });
        return applyNaturalDamage(sequence, attack, contact.damage);
    }
    return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
}
async function performHeroEngulf(sequence, attack, index) {
    const { state, monster, target } = sequence;
    const chance = await findHeroMeleeHitThreshold(monster, attack[0], null, { firstAttack: sequence.attempts++ === 0, state });
    maybeUnparalyzeMeleeDefender(monster);
    if (chance.threshold <= rnd(20 + index)) {
        const miss = await showHeroMeleeMiss(monster, attack, false, { state });
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: miss.heroDied };
    }
    if ((await wakeAttackedMonster(monster)).heroDied)
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
    if (monsterIsShade(monster)) {
        await plineWithContinuation(`Your attempt to surround ${monsterName(monster)} is harmless.`);
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
    }
    if (await heroGrabMisses(monster, attack, target, { state }))
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
    const effect = await resolveHeroCombatEngulf(monster, attack, { state });
    if (!effect.heroDied && effect.nativeResult === M_ATTK_DEF_DIED
        && [S_ZOMBIE, S_MUMMY].includes(MONSTER_SYMBOL[monster.mnum] ?? -1)
        && rn2(5) !== 0 && !state.u.sicknessResistance) {
        await plineWithContinuation(formatFeltMessage(`${state.u.sick ? 'very ' : ''}sick.`, state));
        effect.heroDied = await damageHeroFromMonster(monster, rnd(8), { state });
    }
    return { kind: 'processed', result: effect.nativeResult, weapon: null, heroDied: effect.heroDied };
}
async function applyNaturalDamage(sequence, attack, specialDamage, weapon = null) {
    const effect = await resolveHeroNaturalDamage(sequence.monster, attack, specialDamage, {
        state: sequence.state, target: sequence.target,
    });
    sequence.skipBrainDrain ||= !!effect.skipBrainDrain;
    return { kind: 'processed', result: effect.nativeResult, weapon, heroDied: effect.heroDied };
}
async function dropCursedFormWeapon(weapon, state) {
    if (!weapon || !weapon.cursed || weapon !== (state.uswapwep || state.u.uswapwep))
        return false;
    await dropSecondaryWeapon(state);
    return true;
}
//# sourceMappingURL=hero_form_combat.js.map