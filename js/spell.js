import { requirePlayingGame } from './gstate.js';
// Spell learning and the native spell.c:spelleffects() transaction.
import { game, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { promptDirection } from './tty_prompts.js';
import { P_SKILLED } from './const.js';
import { exerciseWisdom } from './attrib.js';
import { heroHeadName } from './body_parts.js';
import { impossible } from './diagnostics.js';
import { makeFamiliar } from './familiar.js';
import { loseHeroHp } from './hero_damage.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { jumpHero } from './jumping.js';
import { mapVicinity } from './magic_detection.js';
import { mksobj } from './mklev.js';
import { deleteObject } from './object_delete.js';
import { useHeroSkill } from './skills.js';
import { castChainLightning, castSkilledElementalSpell } from './spell_attack_effects.js';
import { checkSpellCast, currentSpellKnowledge, liveSpellSkill, spellSkillType } from './spell_casting_rules.js';
import { selectSpellToCast, viewKnownSpells } from './spell_menu.js';
import { castCureBlindness, castCureSickness, castProtection } from './spell_misc_effects.js';
import { applyPotionSpell } from './spell_potion_effects.js';
import { applyScrollEffects } from './scroll_effects.js';
import { applyWandEffect } from './wand_effects.js';
import { CORNUTHAUM, OBJECT_DIR, OBJECT_NAMES, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CANCELLATION, SPE_CAUSE_FEAR, SPE_CHAIN_LIGHTNING, SPE_CHARM_MONSTER, SPE_CLAIRVOYANCE, SPE_CONE_OF_COLD, SPE_CONFUSE_MONSTER, SPE_CREATE_FAMILIAR, SPE_CREATE_MONSTER, SPE_CURE_BLINDNESS, SPE_CURE_SICKNESS, SPE_DETECT_FOOD, SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE, SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE, SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FIREBALL, SPE_FORCE_BOLT, SPE_HASTE_SELF, SPE_HEALING, SPE_IDENTIFY, SPE_INVISIBILITY, SPE_JUMPING, SPE_KNOCK, SPE_LEVITATION, SPE_LIGHT, SPE_MAGIC_MAPPING, SPE_MAGIC_MISSILE, SPE_POLYMORPH, SPE_PROTECTION, SPE_REMOVE_CURSE, SPE_RESTORE_ABILITY, SPE_SLEEP, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_TURN_UNDEAD, SPE_WIZARD_LOCK, } from './object_data.js';
export function knownSpell(otyp, state = game) {
    const spell = (state.spells || []).find(spell => spell.otyp === otyp);
    if (!spell)
        return 'unknown';
    const remaining = currentSpellKnowledge(spell, state);
    return remaining > 2000 ? 'fresh' : remaining > 0 ? 'stale' : 'forgotten';
}
// C spell.c:force_learn_spell(). Divine teaching skips book study and conduct.
export function forceLearnSpell(otyp, state = game) {
    if ([SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD].includes(otyp)
        || knownSpell(otyp, state) === 'fresh')
        return null;
    const spells = state.spells ||= [];
    let index = spells.findIndex(spell => spell.otyp === otyp);
    if (index < 0)
        index = spells.length;
    if (index >= 52)
        return null;
    const existing = spells[index];
    if (existing) {
        existing.level = spellLevel(otyp);
        existing.know = 20000 + Math.max(0, (state.moves || 1) - 1);
    }
    else
        spells[index] = createMemorizedSpell(otyp, 20000, state);
    return String.fromCharCode(index < 26 ? 97 + index : 65 + index - 26);
}
export function createMemorizedSpell(otyp, knowledge, state) {
    const category = OBJECT_SPELL_CATEGORY[otyp];
    const name = OBJECT_NAMES[otyp];
    if (category == null || name == null)
        throw new RangeError(`Object type ${otyp} is not a spellbook.`);
    return {
        name, level: spellLevel(otyp), category,
        know: knowledge + Math.max(0, (state.moves || 1) - 1),
        otyp,
    };
}
export async function learnInitialSpell(book, state = game) {
    const spells = state.spells;
    if (spells.length >= 52)
        await impossible('Too many spells memorized!', { state });
    else if (spells.some(spell => spell.otyp === book.otyp))
        await impossible(`Spell ${OBJECT_NAMES[book.otyp]} already known.`, { state });
    else
        spells.push(createMemorizedSpell(book.otyp, 20000, state));
}
// Every successful cast creates the same real temporary object as C.
// Its class/BUC/quantity control shared effects; it never enters inventory.
export async function castSpell(otyp, { atSelf = false, force = false, state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const admission = force ? { allowed: true, energy: 0, spentTime: false }
        : await checkSpellCast({ otyp }, { state });
    if (!admission.allowed) {
        state.context.move = Number(admission.spentTime);
        return { spentTime: admission.spentTime, heroDied: !!state.program_state.gameover };
    }
    state.u.uen -= admission.energy;
    state.context.botl = true;
    exerciseWisdom(true, state);
    const source = await mksobj(otyp, false, false);
    source.blessed = source.cursed = false;
    source.quan = source.quantity = 20;
    const skill = liveSpellSkill(otyp, state);
    const handled = await applySpellEffect(source, skill, atSelf, state);
    if (state.program_state.gameover)
        return { spentTime: true, heroDied: true };
    if (handled && !force)
        await useHeroSkill(spellSkillType(otyp), spellLevel(otyp), { state });
    await deleteObject(source, state);
    state.context.move = Number(handled);
    return { spentTime: handled, heroDied: false };
}
async function applySpellEffect(source, skill, atSelf, state) {
    const skilled = skill >= P_SKILLED;
    switch (source.otyp) {
        case SPE_FIREBALL:
        case SPE_CONE_OF_COLD:
            if (skilled) {
                await castSkilledElementalSpell(source, { state });
                break;
            }
            await applyDirectedSpell(source, atSelf, state);
            break;
        case SPE_FORCE_BOLT:
        case SPE_SLEEP:
        case SPE_MAGIC_MISSILE:
        case SPE_KNOCK:
        case SPE_SLOW_MONSTER:
        case SPE_WIZARD_LOCK:
        case SPE_DIG:
        case SPE_TURN_UNDEAD:
        case SPE_POLYMORPH:
        case SPE_TELEPORT_AWAY:
        case SPE_CANCELLATION:
        case SPE_FINGER_OF_DEATH:
        case SPE_LIGHT:
        case SPE_DETECT_UNSEEN:
        case SPE_HEALING:
        case SPE_EXTRA_HEALING:
        case SPE_DRAIN_LIFE:
        case SPE_STONE_TO_FLESH:
            if (skilled && [SPE_HEALING, SPE_EXTRA_HEALING].includes(source.otyp))
                source.blessed = true;
            await applyDirectedSpell(source, atSelf, state);
            break;
        case SPE_REMOVE_CURSE:
        case SPE_CONFUSE_MONSTER:
        case SPE_DETECT_FOOD:
        case SPE_CAUSE_FEAR:
        case SPE_IDENTIFY:
        case SPE_CHARM_MONSTER:
            source.blessed = skilled;
            await applyScrollEffects(source, { state });
            break;
        case SPE_MAGIC_MAPPING:
        case SPE_CREATE_MONSTER:
            await applyScrollEffects(source, { state });
            break;
        case SPE_HASTE_SELF:
        case SPE_DETECT_TREASURE:
        case SPE_DETECT_MONSTERS:
        case SPE_LEVITATION:
        case SPE_RESTORE_ABILITY:
            source.blessed = skilled;
            await applyPotionSpell(source, { state });
            break;
        case SPE_INVISIBILITY:
            await applyPotionSpell(source, { state });
            break;
        case SPE_CURE_BLINDNESS:
            await castCureBlindness({ state });
            break;
        case SPE_CURE_SICKNESS:
            await castCureSickness({ state });
            break;
        case SPE_CREATE_FAMILIAR:
            await makeFamiliar(null, state.u.ux, state.u.uy, false, { state });
            break;
        case SPE_CLAIRVOYANCE:
            if (state.uarmh?.otyp === CORNUTHAUM && state.urole.key !== 'wizard')
                await plineWithContinuation(`You sense a pointy hat on top of your ${heroHeadName(state)}.`);
            else {
                source.blessed = skilled;
                await mapVicinity(source, { state });
            }
            break;
        case SPE_PROTECTION:
            await castProtection({ state });
            break;
        case SPE_JUMPING:
            if (!(await jumpHero(Math.max(skill, 1), { state })).spentTime
                && !state.program_state.gameover)
                await plineWithContinuation('Nothing happens.');
            break;
        case SPE_CHAIN_LIGHTNING:
            await castChainLightning({ state });
            break;
        default:
            await impossible(`Unknown spell ${source.otyp} attempted.`, { state });
            return false;
    }
    return true;
}
async function applyDirectedSpell(source, atSelf, state) {
    const hero = state.u;
    if (OBJECT_DIR[source.otyp] !== 1) {
        if (atSelf)
            hero.dx = hero.dy = hero.dz = 0;
        else if (!await promptDirection()) {
            // Native cancellation releases the spell in the retained direction.
            await plineWithContinuation('The magical energy is released!');
        }
        if (!hero.dx && !hero.dy && !hero.dz) {
            const effect = await zapHeroWithObject(source, { state });
            if (effect.heroDied || !effect.damage)
                return;
            const damage = source.otyp === SPE_FORCE_BOLT && hero.halfPhysicalDamage
                ? Math.ceil(effect.damage / 2) : effect.damage;
            const cause = `zapped ${state.flags.female ? 'herself' : 'himself'} with a spell`;
            await loseHeroHp(damage, cause, { state, deathCause: cause });
            return;
        }
    }
    await applyWandEffect(source, { state });
}
export async function docast() {
    const spell = await selectSpellToCast(game);
    if (!spell) {
        game.context.move = 0;
        return;
    }
    await castSpell(spell.otyp);
}
export async function dovspell() {
    await viewKnownSpells(game);
    game.context.move = 0;
}
function spellLevel(type) {
    const level = OBJECT_SPELL_LEVEL[type];
    if (level === undefined)
        throw new RangeError(`Object type ${type} has no spell level.`);
    return level;
}
//# sourceMappingURL=spell.js.map