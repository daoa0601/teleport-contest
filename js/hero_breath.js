// Hero effects of breath weapons and spell rays.
// C refs: polyself.c dobreathe() and zap.c ubreatheu()/zhitu().
import { heroHasArtifactDefense } from './artifacts.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { disintegrateWornArmor } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_DEX, A_STR, M_SEEN_MAGR, NON_PM, } from './const.js';
import { plineWithContinuation, shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import { loseHeroHp } from './hero_damage.js';
import { monsterSpellDeathReason } from './monster_name.js';
import { monsterHasLineOfSightToHero, seenResistanceForDamage } from './monster_perception.js';
import { game, requirePlayingGame } from './gstate.js';
import { erodeArmor, damageObjectWithAcid } from './object_erosion.js';
import { putHeroToSleep } from './hero_sleep.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { igniteItems } from './light.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, monsterIsNonliving, } from './monster_data.js';
import { AD_ACID, AD_COLD, AD_DISN, AD_DRST, AD_ELEC, AD_FIRE, AD_MAGM, AD_RBRE, AD_SLEE, AT_BREA, } from './monster_attack_types.js';
import { hasWornProperty, propertyIsActive } from './properties.js';
import { applyHeroGolemEffects, heroMonsterForm } from './polyself.js';
import { poisonHero } from './poison.js';
import { d, rn2, rnd } from './rng.js';
import { clearHeroSliming } from './slime.js';
import { burnHeroArmorByFire } from './trap.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, } from './zap.js';
export function heroBreathAttack(state = game, damageType = null) {
    const form = heroMonsterForm(state);
    if (form == null)
        return null;
    return (MONSTER_ATTACKS[form] || []).find(([attackType, attackDamage]) => attackType === AT_BREA
        && (damageType == null || attackDamage === damageType)) || null;
}
export function heroAcidBreathAttack(state = game) {
    return heroBreathAttack(state, AD_ACID);
}
export async function hitHeroWithRay({ state = game, attack = heroBreathAttack(state), publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, die = finishHeroDeath, source = 'hero-breath', sourceMonster = null, name = null, nativeType = null, sourceObject = null, } = {}) {
    if (!attack)
        return { hit: false, damage: 0, heroDied: false };
    requirePlayingGame(state);
    const damageType = effectiveBreathDamage(attack[1]);
    const context = {
        state, attack, damageType, publish, random, rollDice, rollOne, die,
        source, sourceMonster, sourceObject, nativeType, name,
    };
    let result;
    if (damageType === AD_MAGM)
        result = await hitWithMagic(context);
    else if (damageType === AD_FIRE)
        result = await hitWithFire(context);
    else if (damageType === AD_COLD)
        result = await hitWithCold(context);
    else if (damageType === AD_SLEE)
        result = await hitWithSleep(context);
    else if (damageType === AD_DISN)
        result = await hitWithDisintegration(context);
    else if (damageType === AD_ELEC)
        result = await hitWithLightning(context);
    else if (damageType === AD_DRST)
        result = await hitWithPoison(context);
    else if (damageType === AD_ACID)
        result = await hitWithAcid(context);
    else
        result = await applyRayDamage(context, 0, '');
    return { hit: true, damageType, ...result };
}
async function hitWithMagic(context) {
    const { state, attack, publish, rollDice } = context;
    if (heroResistsRay(state, 'antimagic', 'magic')) {
        await shieldHero(state);
        await publish('The missiles bounce off!');
        noteRayResistance(context, true);
        return applyRayDamage(context, 0, 'blast of missiles', true);
    }
    const damage = rollDice(attack[2], 6);
    await exerciseAttribute(A_STR, false, state);
    noteRayResistance(context, false);
    return applyRayDamage(context, damage, 'blast of missiles');
}
async function hitWithFire(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const sourceDamage = rollDice(attack[2], 6);
    const resisted = heroResistsRay(state, 'fireResistance', 'fire');
    if (resisted) {
        await shieldHero(state);
        await publish("You don't feel hot!");
        noteRayResistance(context, true);
        await applyHeroGolemEffects(AD_FIRE, sourceDamage, { state, publish });
    }
    if (!resisted)
        noteRayResistance(context, false);
    if (clearHeroSliming(state))
        await publish('The slime that covers you is burned away!');
    const bodyHit = await burnHeroArmorByFire(state, publish, [], random);
    if (bodyHit && random(3) === 0) {
        const items = await destroyFireInventory(sourceDamage, {
            state, publish, random, rollOne, die: context.die,
        });
        if (items.heroDied)
            return { resisted, heroDied: true };
    }
    if (bodyHit && random(3) === 0) {
        await igniteItems(state.inventory, {
            state, publish, random,
        });
    }
    return applyRayDamage(context, resisted ? 0 : sourceDamage, 'blast of fire', resisted);
}
async function hitWithCold(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const sourceDamage = rollDice(attack[2], 6);
    const resisted = heroResistsRay(state, 'coldResistance', 'cold');
    if (resisted) {
        await shieldHero(state);
        await publish("You don't feel cold.");
        noteRayResistance(context, true);
        await applyHeroGolemEffects(AD_COLD, sourceDamage, { state, publish });
    }
    else {
        noteRayResistance(context, false);
    }
    if (random(3) === 0) {
        const items = await destroyColdInventory(sourceDamage, {
            state, publish, random, rollOne, die: context.die,
        });
        if (items.heroDied)
            return { resisted, heroDied: true };
    }
    return applyRayDamage(context, resisted ? 0 : sourceDamage, 'blast of frost', resisted);
}
async function hitWithSleep(context) {
    const { state, attack, publish, rollDice } = context;
    const resisted = heroResistsRay(state, 'sleepResistance', 'sleep');
    if (resisted) {
        await shieldHero(state);
        await publish("You don't feel sleepy.");
        noteRayResistance(context, true);
    }
    else {
        noteRayResistance(context, false);
        putHeroToSleep(rollDice(attack[2], 25), { state });
    }
    return { resisted, damage: 0, heroDied: false };
}
async function hitWithDisintegration(context) {
    const { state, publish, random, die } = context;
    if (context.nativeType != null ? Math.abs(context.nativeType) !== 24
        : !context.source.endsWith('breath')) {
        const form = state.u.umonnum;
        if (monsterIsNonliving(form) || ((MONSTER_FLAGS2[form] ?? 0) & 0x00000100)) {
            await shieldHero(state);
            await publish('You seem unaffected.');
            return { resisted: true, damage: 0, heroDied: false };
        }
        if (heroResistsRay(state, 'antimagic', 'magic')) {
            await shieldHero(state);
            noteRayResistance(context, true);
            await publish("You aren't affected.");
            return { resisted: true, damage: 0, heroDied: false };
        }
        noteRayResistance(context, false);
        state.u.ugrave_arise = NON_PM;
        // C zhitu() calls done() directly, without an ordinary HP-death line.
        const heroDied = await die({ killer: context.name || 'finger of death', deathLineShown: true });
        return { resisted: false, damage: 0, heroDied };
    }
    // Native rolls inventory protection before checking the hero's resistance.
    const protectedItems = hasWornProperty('disintegrationResistance', state)
        && random(100) < 99;
    if (state.u.disintegrationResistance) {
        await publish('You are not disintegrated.');
        noteRayResistance(context, true);
        return { resisted: true, damage: 0, heroDied: false };
    }
    if (protectedItems) {
        return { resisted: true, damage: 0, heroDied: false };
    }
    noteRayResistance(context, false);
    const shield = wornObject(state, 'uarms');
    if (shield) {
        await disintegrateWornArmor(shield, { state, publish });
        return { resisted: false, damage: 0, heroDied: false };
    }
    const suit = wornObject(state, 'uarm');
    if (suit) {
        const cloak = wornObject(state, 'uarmc');
        if (cloak) {
            await disintegrateWornArmor(cloak, { state, publish });
        }
        await disintegrateWornArmor(suit, { state, publish });
        return { resisted: false, damage: 0, heroDied: false };
    }
    const cloak = wornObject(state, 'uarmc');
    if (cloak) {
        await disintegrateWornArmor(cloak, { state, publish });
    }
    const shirt = wornObject(state, 'uarmu');
    if (shirt) {
        await disintegrateWornArmor(shirt, { state, publish });
    }
    state.u.ugrave_arise = context.nativeType === -24 ? -3 : NON_PM;
    monstersForgetHeroResistance(M_SEEN_MAGR, state, monster => monsterHasLineOfSightToHero(monster, state));
    // zhitu() calls done(DIED) directly; only losehp() prints "You die...".
    const heroDied = await die({ killer: context.name || 'blast of disintegration', deathLineShown: true });
    return { resisted: false, damage: 0, heroDied };
}
async function hitWithLightning(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const sourceDamage = rollDice(attack[2], 6);
    const resisted = heroResistsRay(state, 'shockResistance', 'shock');
    if (resisted) {
        await shieldHero(state);
        await publish("You aren't affected.");
        noteRayResistance(context, true);
        await applyHeroGolemEffects(AD_ELEC, sourceDamage, { state, publish });
    }
    else {
        await exerciseAttribute(A_CON, false, state);
        noteRayResistance(context, false);
    }
    if (random(3) === 0) {
        const items = await destroyElectricInventory(sourceDamage, {
            state, publish, random, rollOne, die: context.die,
        });
        if (items.heroDied)
            return { resisted, heroDied: true };
    }
    return applyRayDamage(context, resisted ? 0 : sourceDamage, 'blast of lightning', resisted);
}
async function hitWithPoison(context) {
    const { state, random, rollDice, publish, die } = context;
    const poison = await poisonHero({
        reason: 'blast',
        killer: 'poisoned blast',
        attribute: A_DEX,
        fatal: 15,
        state,
        random,
        rollDice,
        publish,
        die,
    });
    return {
        resisted: !!poison.resisted,
        damage: poison.damage ?? 0,
        heroDied: poison.died,
    };
}
async function hitWithAcid(context) {
    const { state, attack, publish, random, rollDice } = context;
    const resisted = heroResistsRay(state, 'acidResistance', 'acid');
    let damage = 0;
    if (resisted) {
        await publish("The acid doesn't hurt.");
        noteRayResistance(context, true);
    }
    else {
        await publish('The acid burns!');
        damage = rollDice(attack[2], 6);
        await exerciseAttribute(A_STR, false, state);
        noteRayResistance(context, false);
    }
    const hero = state.u;
    const twoWeapons = !!hero.twoweap;
    if (random(twoWeapons ? 3 : 6) === 0) {
        await damageObjectWithAcid(state.uwep || hero.uwep, { state, publish, random });
    }
    if (twoWeapons && random(3) === 0) {
        await damageObjectWithAcid(state.uswapwep || hero.uswapwep, { state, publish, random });
    }
    if (random(6) === 0)
        await erodeArmor(state.u, 'corrosion', { state, publish, random });
    return applyRayDamage(context, damage, 'blast of acid', resisted);
}
function heroResistsRay(state, property, element) {
    return !!state.u[property] || propertyIsActive(property, state)
        || heroHasArtifactDefense(element, state);
}
function noteRayResistance(context, resisted) {
    const observe = resisted ? monstersObserveHeroResistance : monstersForgetHeroResistance;
    const damageType = !context.source.endsWith('breath') && context.damageType === AD_DISN
        ? AD_MAGM : context.damageType;
    observe(seenResistanceForDamage(damageType), context.state, (monster) => monsterHasLineOfSightToHero(monster, context.state));
}
async function applyRayDamage(context, damage, name, resisted = false) {
    const { state, publish, die, source, sourceMonster } = context;
    const breath = source.endsWith('breath');
    if (!breath && heroHasHalfSpellDamage(state))
        damage = Math.trunc((damage + 1) / 2);
    const rayName = context.name || name;
    const verb = breath ? 'exhaled' : source.endsWith('spell') ? 'cast'
        : context.sourceObject?.oclass === 6 ? 'played' : 'zapped';
    const reflexive = state.flags?.female ? 'herself' : 'himself';
    const killer = sourceMonster
        ? monsterSpellDeathReason(sourceMonster, rayName).replace('inflicted', verb)
        : source.startsWith('monster-') ? rayName : `${rayName} ${verb} by ${reflexive}`;
    const heroDied = await loseHeroHp(damage, killer, { state, publish, die });
    return { resisted, damage, heroDied };
}
export function effectiveBreathDamage(damageType) {
    // BZ_OFS_AD(AD_RBRE) maps the Chromatic Dragon's hero breath to fire.
    return damageType === AD_RBRE ? AD_FIRE : damageType;
}
function wornObject(state, slot) {
    return state[slot] || state.u?.[slot] || null;
}
function shieldHero(state) {
    return shieldeff(state.u.ux, state.u.uy, state);
}
//# sourceMappingURL=hero_breath.js.map