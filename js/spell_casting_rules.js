import { requirePlayingGame } from './gstate.js';
// Native spell.c:rejectcasting(), spelleffects_check(), spell_backfire(),
// percent_success(), and spell_skilltype(). The caller owns successful casting.
import { currentAttribute } from './attrib.js';
import { A_INT, A_STR, A_WIS, P_CLERIC_SPELL, P_ISRESTRICTED, P_UNSKILLED, } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { makeConfused, makeStunned } from './hero_mental_status.js';
import { heroCanChant, formatFeltMessage } from './hero_speech.js';
import { spendHeroNutrition } from './hunger.js';
import { OBJECT_NAMES, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL, OBJECT_SUBTYPE, OBJECT_WEIGHT, QUARTERSTAFF, ROBE, SMALL_SHIELD, SPE_CURE_BLINDNESS, SPE_CURE_SICKNESS, SPE_DETECT_FOOD, SPE_EXTRA_HEALING, SPE_HEALING, SPE_REMOVE_CURSE, SPE_RESTORE_ABILITY, } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { propertyIsActive } from './properties.js';
import { rn2, rnd } from './rng.js';
import { ensureHeroSkills } from './skills.js';
import { heroHasFreeHand } from './weapon_type.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';
const HEALING_BONUS_SPELLS = new Set([
    SPE_HEALING, SPE_EXTRA_HEALING, SPE_CURE_BLINDNESS,
    SPE_CURE_SICKNESS, SPE_RESTORE_ABILITY, SPE_REMOVE_CURSE,
]);
// Only a memorized entry can reach ordinary casting. Forced effects bypass
// this admission owner and create their pseudo-object in the caller.
export async function checkSpellCast(spell, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const memorized = state.spells?.find(known => known.otyp === spell?.otyp);
    if (!memorized || !OBJECT_SPELL_CATEGORY[memorized.otyp]
        || await rejectCasting(state))
        return { allowed: false, spentTime: false, energy: 0 };
    const hero = state.u;
    const energy = 5 * nativeSpellLevel(memorized.otyp);
    const confused = !!hero.confused || (hero.confusionTurns ?? 0) > 0;
    const knowledge = currentSpellKnowledge(memorized, state);
    if (!knowledge) {
        await plineWithContinuation('Your knowledge of this spell is twisted.');
        await plineWithContinuation('It invokes nightmarish images in your mind...');
        await backfireForgottenSpell(memorized, state);
        hero.uen = Math.max(0, hero.uen - rnd(energy));
        state.context.botl = true;
        return { allowed: false, spentTime: true, energy };
    }
    await warnAboutFadingKnowledge(knowledge);
    if (hero.uhunger <= 10 && memorized.otyp !== SPE_DETECT_FOOD) {
        await plineWithContinuation('You are too hungry to cast that spell.');
        return { allowed: false, spentTime: false, energy };
    }
    if (currentAttribute(A_STR, state) < 4 && memorized.otyp !== SPE_RESTORE_ABILITY) {
        await plineWithContinuation('You lack the strength to cast spells.');
        return { allowed: false, spentTime: false, energy };
    }
    if (exceedsActionCapacity(state)) {
        await plineWithContinuation('Your concentration falters while carrying so much stuff.');
        return { allowed: false, spentTime: true, energy };
    }
    const amuletDrains = hero.uhave.amulet && hero.uen >= energy;
    if (amuletDrains) {
        await plineWithContinuation(formatFeltMessage('the amulet draining your energy away.', state));
        hero.uen = Math.max(0, hero.uen - rnd(2 * energy));
        state.context.botl = true;
    }
    if (energy > hero.uen) {
        const suffix = hero.uen < hero.uenmax ? ''
            : energy > hero.uenpeak ? ' yet' : ' anymore';
        await plineWithContinuation(`You don't have enough energy to cast that spell${suffix}.`);
        return { allowed: false, spentTime: !!amuletDrains, energy };
    }
    if (memorized.otyp !== SPE_DETECT_FOOD)
        await spendHeroNutrition(castingNutritionCost(energy, state), { state });
    if (state.program_state.gameover)
        return { allowed: false, spentTime: true, energy };
    const chance = percentSuccess(memorized, state);
    if (confused || rnd(100) > chance) {
        await plineWithContinuation('You fail to cast the spell correctly.');
        hero.uen -= Math.trunc(energy / 2);
        state.context.botl = true;
        return { allowed: false, spentTime: true, energy };
    }
    return { allowed: true, spentTime: true, energy };
}
export async function rejectCasting(state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.stunned || (state.u.stunnedTurns ?? 0) > 0 || propertyIsActive('stunned', state)) {
        await plineWithContinuation('You are too impaired to cast a spell.');
    }
    else if (!heroCanChant(state)) {
        await plineWithContinuation('You are unable to chant the incantation.');
    }
    else if (!heroHasFreeHand(state) && wornObject('uwep', state)?.otyp !== QUARTERSTAFF) {
        await plineWithContinuation('Your arms are not free to cast!');
    }
    else
        return false;
    return true;
}
// The port stores knowledge as the turn on which it expires. Casting does
// not refresh it; every elapsed global turn ages all memorized spells.
export function currentSpellKnowledge(spell, state = game) {
    if (!spell || !Number.isInteger(spell.know))
        return 0;
    return Math.max(0, spell.know - Math.max(0, state.moves - 1));
}
export function spellSkillType(otyp) {
    const subtype = OBJECT_SUBTYPE[otyp];
    if (subtype === undefined)
        throw new RangeError(`Unknown spell object type ${otyp}`);
    return subtype;
}
export function liveSpellSkill(otyp, state = game) {
    const skills = ensureHeroSkills(state);
    return skills?.[spellSkillType(otyp)]?.skill ?? P_ISRESTRICTED;
}
export function percentSuccess(spell, state = game) {
    requirePlayingGame(state);
    const type = spell.otyp;
    const level = nativeSpellLevel(type);
    const role = state.urole.spellcasting;
    const stat = role.stat === 'wisdom' ? A_WIS : A_INT;
    const castingPenalty = innateCastingPenalty(type, state);
    const skill = Math.max(liveSpellSkill(type, state), P_UNSKILLED) - 1;
    const difficulty = (level - 1) * 4
        - (skill * 6 + Math.trunc(state.u.ulevel / 3) + 1);
    let chance = Math.trunc(11 * currentAttribute(stat, state) / 2);
    if (difficulty > 0)
        chance -= Math.floor(Math.sqrt(900 * difficulty + 2000));
    else
        chance += Math.min(20, Math.trunc(15 * -difficulty / level));
    chance = Math.max(0, Math.min(120, chance));
    const shield = wornObject('uarms', state);
    if (shield && objectWeight(shield) > (OBJECT_WEIGHT[SMALL_SHIELD] ?? 0))
        chance = Math.trunc(chance / (OBJECT_NAMES[type] === role.special ? 2 : 4));
    chance = Math.trunc(chance * (20 - castingPenalty) / 15) - castingPenalty;
    return Math.max(0, Math.min(100, chance));
}
function innateCastingPenalty(type, state) {
    const role = state.urole.spellcasting;
    const paladin = state.urole.key === 'knight' && spellSkillType(type) === P_CLERIC_SPELL;
    const suit = wornObject('uarm', state);
    const robe = wornObject('uarmc', state)?.otyp === ROBE;
    let penalty = role.base;
    if (suit && metallic(suit, state) && !paladin)
        penalty += robe ? Math.trunc(role.armor / 2) : role.armor;
    else if (robe)
        penalty -= role.armor;
    if (wornObject('uarms', state))
        penalty += role.shield;
    if (wornObject('uwep', state)?.otyp === QUARTERSTAFF)
        penalty -= 3;
    if (!paladin) {
        for (const [slot, amount] of [['uarmh', 4], ['uarmg', 6], ['uarmf', 2]]) {
            if (metallic(wornObject(slot, state), state))
                penalty += amount;
        }
    }
    if (OBJECT_NAMES[type] === role.special)
        penalty += role.specialBonus;
    if (HEALING_BONUS_SPELLS.has(type))
        penalty += role.healing;
    return Math.min(20, penalty);
}
function wornObject(slot, state) {
    return state[slot] || state.u[slot];
}
function metallic(object, state) {
    const material = objectMaterial(object, state);
    return material >= 11 && material <= 17;
}
function castingNutritionCost(energy, state) {
    let cost = energy * 2;
    const intelligence = state.urole.key === 'wizard' ? currentAttribute(A_INT, state) : 10;
    if (intelligence >= 17)
        cost = 0;
    else if (intelligence === 16)
        cost = Math.trunc(cost / 4);
    else if (intelligence === 15)
        cost = Math.trunc(cost / 2);
    return Math.min(cost, state.u.uhunger - 3);
}
async function warnAboutFadingKnowledge(knowledge) {
    if (knowledge <= 100)
        await plineWithContinuation('You strain to recall the spell.');
    else if (knowledge <= 500)
        await plineWithContinuation('You have difficulty remembering the spell.');
    else if (knowledge <= 1000)
        await plineWithContinuation('Your knowledge of this spell is growing faint.');
    else if (knowledge <= 2000)
        await plineWithContinuation('Your recall of this spell is gradually fading.');
}
async function backfireForgottenSpell(spell, state) {
    const duration = (nativeSpellLevel(spell.otyp) + 1) * 3;
    const confused = state.u.confusionTurns || 0;
    const stunned = state.u.stunnedTurns || 0;
    const outcome = rn2(10);
    const quiet = { state, talk: false };
    if (outcome <= 3)
        await makeConfused(confused + duration, quiet);
    else if (outcome <= 6) {
        await makeConfused(confused + Math.trunc(2 * duration / 3), quiet);
        await makeStunned(stunned + Math.trunc(duration / 3), quiet);
    }
    else if (outcome <= 8) {
        await makeStunned(stunned + Math.trunc(2 * duration / 3), quiet);
        await makeConfused(confused + Math.trunc(duration / 3), quiet);
    }
    else
        await makeStunned(stunned + duration, quiet);
}
function nativeSpellLevel(type) {
    const level = OBJECT_SPELL_LEVEL[type];
    if (level === undefined)
        throw new RangeError(`Unknown spell object type ${type}`);
    return level;
}
//# sourceMappingURL=spell_casting_rules.js.map