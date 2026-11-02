import type { GameState, PlayingGameState, MemorizedSpell } from './game_state.js';
import type { GameObject } from './object_types.js';
import { requirePlayingGame } from './gstate.js';

export interface SpellCastOptions { atSelf?: boolean; force?: boolean; state?: GameState; }
export interface SpellCastResult { spentTime: boolean; heroDied: boolean; }

// Spell learning and the native spell.c:spelleffects() transaction.
import { commandResultFailed } from './cmd.js';
import { game, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { promptDirection, promptKey } from './tty_prompts.js';
import {
    A_INT, A_STR, A_WIS, CLOUD, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, DRAWBRIDGE_UP,
    EXPL_FIERY, EXPL_FROSTY, IS_STWALL, IS_TREE, Is_waterlevel, LAVAPOOL,
    MENU_TRADITIONAL, MOAT, NHW_MENU, PICK_NONE, PICK_ONE, P_ATTACK_SPELL, P_BASIC,
    P_CLERIC_SPELL, P_DIVINATION_SPELL, P_ENCHANTMENT_SPELL, P_ESCAPE_SPELL, P_EXPERT,
    P_HEALING_SPELL, P_ISRESTRICTED, P_MATTER_SPELL, P_SKILLED, P_UNSKILLED, POOL,
    SPACE_POS, ZAP_POS, isok, xdir, ydir,
} from './const.js';
import { exerciseWisdom, currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHeadName } from './body_parts.js';
import { impossible } from './diagnostics.js';
import { makeFamiliar } from './familiar.js';
import { loseHeroHp } from './hero_damage.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { jumpHero } from './jumping.js';
import { mapVicinity } from './detect.js';
import { mksobj } from './mkobj.js';
import { deleteObject } from './shk.js';
import { useHeroSkill, ensureHeroSkills } from './skills.js';
import { findArmorClass } from './armor.js';
import { rememberCommandKey, takeRepeatCommand } from './cmd.js';
import { restoreCannedCommandTail } from './cmd.js';
import {
    canSeeMonster, canSpotMonster, displayColorName, displayLiquidName, flush_screen,
    map_invisible, zapdir_to_glyph,
} from './display.js';
import { monsterName } from './do_name.js';
import { explode } from './explosion.js';
import {
    prepareMapPositionHighlights, selectMapPosition, shouldShowGetposTip, showGetposInstructions,
    showGetposTip,
} from './getpos.js';
import { healHero } from './hero_healing.js';
import { heroIsSick } from './hero_illness.js';
import { makeConfused, makeStunned } from './hero_mental_status.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { formatFeltMessage, heroCanChant } from './hero_speech.js';
import { spendHeroNutrition } from './hunger.js';
import { takeCommandResponse } from './input.js';
import { wakeMonster } from './mon.js';
import { monsterHasShockResistance } from './mondata.js';
import {
    MONSTER_NAME, monsterEnfolds, monsterIsAnimal, monsterIsWhirly,
} from './monster_data.js';
import { withIndefiniteArticle } from './objnam.js';

import { objectMaterial } from './o_init.js';
import { walkPathCells } from './path_walk.js';
import { applyPotionEffect } from './potion.js';
import { propertyIsActive } from './properties.js';
import { paintRayCell } from './ray.js';
import { rn2, rnd, rnl, rn2Display } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { heroIsSliming, setHeroSlimingTimeout } from './slime.js';
import { roleInitClericLightSchool } from './startup.js';
import { monsterAtPosition } from './steed.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
import {
    tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu,
    tty_select_menu, tty_destroy_nhwindow,
} from './tty_menu.js';
import { clearMessageWindow, flushPendingTopline } from './tty_topline.js';
import { cansee } from './vision.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';
import { showInventoryWindow } from './windows.js';
import { hitMonsterWithRay, adjustSpellDamage } from './zap.js';
import { heroHasFreeHand } from './engrave.js';
import type { SpellCategory } from './data_types.js';
import type { Position } from './map_types.js';
import { applyScrollEffects } from './read.js';
import { applyWandEffect } from './zap.js';
import {
    CORNUTHAUM, OBJECT_DIR, OBJECT_NAMES, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL,
    OBJECT_SUBTYPE, OBJECT_WEIGHT, QUARTERSTAFF, ROBE, SMALL_SHIELD,
    SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CANCELLATION, SPE_CAUSE_FEAR,
    SPE_CHAIN_LIGHTNING, SPE_CHARM_MONSTER, SPE_CLAIRVOYANCE, SPE_CONE_OF_COLD,
    SPE_CONFUSE_MONSTER, SPE_CREATE_FAMILIAR, SPE_CREATE_MONSTER,
    SPE_CURE_BLINDNESS, SPE_CURE_SICKNESS, SPE_DETECT_FOOD, SPE_DETECT_MONSTERS,
    SPE_DETECT_TREASURE, SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE, SPE_EXTRA_HEALING,
    SPE_FINGER_OF_DEATH, SPE_FIREBALL, SPE_FORCE_BOLT, SPE_HASTE_SELF, SPE_HEALING,
    SPE_IDENTIFY, SPE_INVISIBILITY, SPE_JUMPING, SPE_KNOCK, SPE_LEVITATION, SPE_LIGHT,
    SPE_MAGIC_MAPPING, SPE_MAGIC_MISSILE, SPE_POLYMORPH, SPE_PROTECTION, SPE_REMOVE_CURSE,
    SPE_RESTORE_ABILITY, SPE_SLEEP, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH,
    SPE_TELEPORT_AWAY, SPE_TURN_UNDEAD, SPE_WIZARD_LOCK,
} from './object_data.js';

export function knownSpell(otyp: number, state: GameState = game): 'unknown' | 'fresh' | 'stale' | 'forgotten' {
    const spell = (state.spells || []).find(spell => spell.otyp === otyp);
    if (!spell) return 'unknown';
    const remaining = currentSpellKnowledge(spell, state);
    return remaining > 2000 ? 'fresh' : remaining > 0 ? 'stale' : 'forgotten';
}

// C spell.c:force_learn_spell(). Divine teaching skips book study and conduct.
// C spell.c:spell_idx().
export function forceLearnSpell(otyp: number, state: GameState = game): string | null {
    if ([SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD].includes(otyp)
        || knownSpell(otyp, state) === 'fresh') return null;
    const spells = state.spells ||= [];
    let index = spells.findIndex(spell => spell.otyp === otyp);
    if (index < 0) index = spells.length;
    if (index >= 52) return null;
    const existing = spells[index];
    if (existing) {
        existing.level = spellLevel(otyp);
        existing.know = 20000 + Math.max(0, (state.moves || 1) - 1);
    } else spells[index] = createMemorizedSpell(otyp, 20000, state);
    return String.fromCharCode(index < 26 ? 97 + index : 65 + index - 26);
}

export function createMemorizedSpell(otyp: number, knowledge: number, state: GameState): MemorizedSpell {
    const category = spellCategory(otyp, state);
    const name = OBJECT_NAMES[otyp];
    if (category == null || name == null) throw new RangeError(`Object type ${otyp} is not a spellbook.`);
    return {
        name, level: spellLevel(otyp), category,
        know: knowledge + Math.max(0, (state.moves || 1) - 1),
        otyp,
    };
}

export async function learnInitialSpell(book: GameObject, state: GameState = game) {
    const spells = state.spells;
    if (spells.length >= 52)
        await impossible('Too many spells memorized!', { state });
    else if (spells.some(spell => spell.otyp === book.otyp))
        await impossible(`Spell ${OBJECT_NAMES[book.otyp]} already known.`, { state });
    else spells.push(createMemorizedSpell(book.otyp, 20000, state));
}

// Every successful cast creates the same real temporary object as C.
// Its class/BUC/quantity control shared effects; it never enters inventory.
export async function castSpell(otyp: number, { atSelf = false, force = false, state = game }: SpellCastOptions = {}): Promise<SpellCastResult> {
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
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    if (handled && !force)
        await useHeroSkill(spellSkillType(otyp, state), spellLevel(otyp), { state });
    await deleteObject(source, state);
    state.context.move = Number(handled);
    return { spentTime: handled, heroDied: false };
}

async function applySpellEffect(source: GameObject, skill: number, atSelf: boolean, state: PlayingGameState): Promise<boolean> {
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

async function applyDirectedSpell(source: GameObject, atSelf: boolean, state: PlayingGameState) {
    const hero = state.u;
    if (OBJECT_DIR[source.otyp] !== 1) {
        if (atSelf) hero.dx = hero.dy = hero.dz = 0;
        else if (!await promptDirection()) {
            // Native cancellation releases the spell in the retained direction.
            await plineWithContinuation('The magical energy is released!');
        }
        if (!hero.dx && !hero.dy && !hero.dz) {
            const effect = await zapHeroWithObject(source, { state });
            if (effect.heroDied || !effect.damage) return;
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
        // spell.c:docast() returns ECMD_FAIL when getspell() finds nothing
        // or the spell menu is dismissed.
        commandResultFailed();
        return;
    }
    const index = (game.spells ?? []).indexOf(spell);
    const letter = index < 26 ? 97 + index : 65 + index - 26;
    // C docast() appends the selected letter even during do_repeat().
    game._repeatCommands ??= [];
    game._repeatCommands.push({ kind: 'key', key: letter });
    await castSpell(spell.otyp);
}

export async function dowizcast() {
    const spell = await selectWizardSpell();
    if (spell === null) {
        game.context.move = 0;
        return;
    }
    await castSpell(spell, { force: true });
}

export async function dovspell() {
    await viewKnownSpells(game);
    game.context.move = 0;
}

function spellLevel(type: number): number {
    const level = OBJECT_SPELL_LEVEL[type];
    if (level === undefined) throw new RangeError(`Object type ${type} has no spell level.`);
    return level;
}

// ── spell.c admission: rejectcasting(), spelleffects_check(), spell_backfire(),
//    percent_success() ──
type SpellReference = Pick<MemorizedSpell, 'otyp'>;
type CastingSlot = 'uwep' | 'uarm' | 'uarmc' | 'uarms' | 'uarmh' | 'uarmg' | 'uarmf';
export interface SpellAdmission { allowed: boolean; spentTime: boolean; energy: number; }

const HEALING_BONUS_SPELLS = new Set([
    SPE_HEALING, SPE_EXTRA_HEALING, SPE_CURE_BLINDNESS,
    SPE_CURE_SICKNESS, SPE_RESTORE_ABILITY, SPE_REMOVE_CURSE,
]);

// Only a memorized entry can reach ordinary casting. Forced effects bypass
// this admission owner and create their pseudo-object in the caller.
export async function checkSpellCast(spell: SpellReference | null, { state = game }: { state?: GameState } = {}): Promise<SpellAdmission> {
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

export async function rejectCasting(state: GameState = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.stunned || (state.u.stunnedTurns ?? 0) > 0 || propertyIsActive('stunned', state)) {
        await plineWithContinuation('You are too impaired to cast a spell.');
    } else if (!heroCanChant(state)) {
        await plineWithContinuation('You are unable to chant the incantation.');
    } else if (!heroHasFreeHand(state) && wornObject('uwep', state)?.otyp !== QUARTERSTAFF) {
        await plineWithContinuation('Your arms are not free to cast!');
    } else return false;
    return true;
}

// The port stores knowledge as the turn on which it expires. Casting does
// not refresh it; every elapsed global turn ages all memorized spells.
export function currentSpellKnowledge(spell: Pick<MemorizedSpell, 'know'> | null | undefined, state: GameState = game) {
    if (!spell || !Number.isInteger(spell.know)) return 0;
    return Math.max(0, spell.know - Math.max(0, state.moves - 1));
}

export function liveSpellSkill(otyp: number, state: GameState = game): number {
    const skills = ensureHeroSkills(state);
    return skills?.[spellSkillType(otyp, state)]?.skill ?? P_ISRESTRICTED;
}

export function percentSuccess(spell: SpellReference, state: GameState = game): number {
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
    if (difficulty > 0) chance -= Math.floor(Math.sqrt(900 * difficulty + 2000));
    else chance += Math.min(20, Math.trunc(15 * -difficulty / level));
    chance = Math.max(0, Math.min(120, chance));
    const shield = wornObject('uarms', state);
    if (shield && objectWeight(shield) > (OBJECT_WEIGHT[SMALL_SHIELD] ?? 0))
        chance = Math.trunc(chance / (OBJECT_NAMES[type] === role.special ? 2 : 4));
    chance = Math.trunc(chance * (20 - castingPenalty) / 15) - castingPenalty;
    return Math.max(0, Math.min(100, chance));
}

function innateCastingPenalty(type: number, state: PlayingGameState) {
    const role = state.urole.spellcasting;
    const paladin = state.urole.key === 'knight' && spellSkillType(type, state) === P_CLERIC_SPELL;
    const suit = wornObject('uarm', state);
    const robe = wornObject('uarmc', state)?.otyp === ROBE;
    let penalty = role.base;
    if (suit && metallic(suit, state) && !paladin)
        penalty += robe ? Math.trunc(role.armor / 2) : role.armor;
    else if (robe) penalty -= role.armor;
    if (wornObject('uarms', state)) penalty += role.shield;
    if (wornObject('uwep', state)?.otyp === QUARTERSTAFF) penalty -= 3;
    if (!paladin) {
        for (const [slot, amount] of [['uarmh', 4], ['uarmg', 6], ['uarmf', 2]] as const) {
            if (metallic(wornObject(slot, state), state)) penalty += amount;
        }
    }
    if (OBJECT_NAMES[type] === role.special) penalty += role.specialBonus;
    if (HEALING_BONUS_SPELLS.has(type)) penalty += role.healing;
    return Math.min(20, penalty);
}

function wornObject(slot: CastingSlot, state: GameState) {
    return state[slot] || state.u[slot];
}

function metallic(object: GameObject | null | undefined, state: GameState) {
    const material = objectMaterial(object, state);
    return material >= 11 && material <= 17;
}

function castingNutritionCost(energy: number, state: PlayingGameState) {
    let cost = energy * 2;
    const intelligence = state.urole.key === 'wizard' ? currentAttribute(A_INT, state) : 10;
    if (intelligence >= 17) cost = 0;
    else if (intelligence === 16) cost = Math.trunc(cost / 4);
    else if (intelligence === 15) cost = Math.trunc(cost / 2);
    return Math.min(cost, state.u.uhunger - 3);
}

async function warnAboutFadingKnowledge(knowledge: number) {
    if (knowledge <= 100) await plineWithContinuation('You strain to recall the spell.');
    else if (knowledge <= 500) await plineWithContinuation('You have difficulty remembering the spell.');
    else if (knowledge <= 1000) await plineWithContinuation('Your knowledge of this spell is growing faint.');
    else if (knowledge <= 2000) await plineWithContinuation('Your recall of this spell is gradually fading.');
}

// C spell.c:spell_backfire().
async function backfireForgottenSpell(spell: SpellReference, state: GameState) {
    const duration = (nativeSpellLevel(spell.otyp) + 1) * 3;
    const confused = state.u.confusionTurns || 0;
    const stunned = state.u.stunnedTurns || 0;
    const outcome = rn2(10);
    const quiet = { state, talk: false };
    if (outcome <= 3) await makeConfused(confused + duration, quiet);
    else if (outcome <= 6) {
        await makeConfused(confused + Math.trunc(2 * duration / 3), quiet);
        await makeStunned(stunned + Math.trunc(duration / 3), quiet);
    } else if (outcome <= 8) {
        await makeStunned(stunned + Math.trunc(2 * duration / 3), quiet);
        await makeConfused(confused + Math.trunc(duration / 3), quiet);
    } else await makeStunned(stunned + duration, quiet);
}

function nativeSpellLevel(type: number): number {
    const level = OBJECT_SPELL_LEVEL[type];
    if (level === undefined) throw new RangeError(`Unknown spell object type ${type}`);
    return level;
}

// ── spell.c:getspell(), dovspell(), dospellmenu(), sortspells(), spellretention() ──
interface SpellMenuOptions {
    state: GameState;
    order?: number[] | null;
    view?: boolean;
    preselected?: number | null;
}
const SORT_LETTER = 0;
const SORT_LEVEL_LOW = 2;
const SORT_LEVEL_HIGH = 3;
const SORT_SKILL_ALPHA = 4;
const SORT_SKILL_LOW = 5;
const SORT_SKILL_HIGH = 6;
const SORT_CURRENT = 7;
const RETAIN_ORDER = 8;
const SORT_CHOICES = [
    'by casting letter',
    'alphabetically',
    'by level, low to high',
    'by level, high to low',
    'by skill group, alphabetized within each group',
    'by skill group, low to high level within group',
    'by skill group, high to low level within group',
    'maintain current ordering',
    'reassign casting letters to retain current order',
];

// C spell.c:dowizcast() lets tty assign page-local selectors to every spell.
export async function selectWizardSpell(): Promise<number | null> {
    const window = tty_create_nhwindow<number>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (let otyp = SPE_DIG; otyp < SPE_BLANK_PAPER; otyp++) {
            const name = OBJECT_NAMES[otyp];
            if (name == null) throw new Error(`Missing spell name for object ${otyp}`);
            tty_add_menu(window, { identifier: otyp, text: name });
        }
        tty_end_menu(window, 'Cast which spell?');
        const result = await tty_select_menu(window, PICK_ONE);
        return result.selections[0]?.identifier ?? null;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

// C spell.c:getspell().
// C spell.c:num_spells().
export async function selectSpellToCast(state: GameState = game): Promise<MemorizedSpell | null> {
    requireLiveGame(state);
    const spells = state.spells || [];
    if (!spells.length) {
        await plineWithContinuation("You don't know any spells right now.");
        return null;
    }
    if (await rejectCasting(state)) return null;
    const queued = state._inDoAgain ? takeRepeatCommand() : takeCommandResponse();
    if (queued !== undefined) {
        const key = typeof queued === 'number' ? queued
            : typeof queued === 'object' && 'kind' in queued && queued.kind === 'key'
                ? queued.key : null;
        if (key === null) return null;
        const index = spellIndex(key);
        return index >= 0 ? spells[index] ?? null : null;
    }
    if (!state._inDoAgain) {
        const command = state._cannedCommands?.shift();
        if (command) {
            restoreCannedCommandTail(command);
            return null;
        }
    }
    if (state.flags.menu_style === MENU_TRADITIONAL) {
        const selection = await selectTraditionalSpell(spells);
        if (selection !== 'menu') return selection;
    }
    const selection = await showSpellMenu('Choose which spell to cast', { state });
    return typeof selection === 'number' ? spells[selection] ?? null : null;
}

// C spell.c:sortspells().
export async function viewKnownSpells(state: GameState = game) {
    requireLiveGame(state);
    if (!state.spells?.length) {
        await plineWithContinuation("You don't know any spells right now.");
        return;
    }
    let order: number[] | null = null;
    let sortMode = SORT_LETTER;
    for (;;) {
        const first = await showSpellMenu('Currently known spells', { state, order, view: true });
        if (first === null) return;
        if (first === 'sort') {
            const choice = await selectSpellSort(sortMode);
            if (choice === null) continue;
            sortMode = choice;
            if (choice === RETAIN_ORDER) {
                if (!order) continue;
                const reordered = order.map(index => spellAt(state, index));
                state.spells.splice(0, reordered.length, ...reordered);
                order = state.spells.map((_spell, index) => index);
                sortMode = SORT_LETTER;
            } else if (choice !== SORT_CURRENT) {
                if (!order && choice === SORT_LETTER) continue;
                order ||= state.spells.map((_spell, index) => index);
                order.sort((first, second) => compareSpells(first, second, choice, state));
            }
            continue;
        }
        const second = await showSpellMenu(`Reordering spells; swap '${spellLetter(first)}' with`, {
            state, order, preselected: first,
        });
        if (second === null || second === 'sort') return;
        [state.spells[first], state.spells[second]] = [spellAt(state, second), spellAt(state, first)];
    }
}

async function selectTraditionalSpell(spells: readonly MemorizedSpell[]): Promise<MemorizedSpell | 'menu' | null> {
    const count = spells.length;
    const letters = count === 1 ? 'a' : count < 27 ? `a-${spellLetter(count - 1)}`
        : count === 27 ? 'a-zA' : `a-zA-${spellLetter(count - 1)}`;
    for (let tries = 0; tries < 10; tries++) {
        // yn_function() acknowledges unread prose before replacing it with
        // an unrestricted, case-sensitive single-key question.
        await flushPendingTopline();
        const key = await promptKey(`Cast which spell? [${letters} *?] `);
        rememberCommandKey(key);
        if (key === 42 || key === 63) return 'menu';
        // C strchr(quitchars, ilet) also matches a literal fuzzer NUL.
        if ([0, 32, 10, 13, 27].includes(key)) {
            await plineWithContinuation('Never mind.');
            return null;
        }
        const index = spellIndex(key);
        if (index >= 0 && index < count) return spells[index] ?? null;
        await plineWithContinuation("You don't know that spell.");
    }
    await plineWithContinuation("That's enough tries.");
    return null;
}

async function showSpellMenu(title: string, {
    state, order = null, view = false, preselected = null,
}: SpellMenuOptions): Promise<number | 'sort' | null> {
    const tabSeparated = !!state.iflags.menu_tab_sep;
    const debug = !!state.flags.debug;
    const separator = tabSeparated ? '\t' : ' ';
    let heading = tabSeparated ? 'Name\tLevel\tCategory\tFail\tRetention'
        : `    ${'Name'.padEnd(20)} Level ${'Category'.padEnd(12)} Fail Retention`;
    if (debug) heading += `${separator}${'turns'.padStart(6)}`;
    const displayOrder = order || state.spells.map((_spell, index) => index);
    const items = displayOrder.map((index, position) => {
        const spell = spellAt(state, index);
        const name = OBJECT_NAMES[spell.otyp];
        const level = OBJECT_SPELL_LEVEL[spell.otyp];
        const category = spellCategory(spell.otyp, state);
        if (name == null || level === undefined || category == null)
            throw new Error(`Missing spell metadata for object ${spell.otyp}`);
        const failure = 100 - percentSuccess(spell, state);
        const retention = spellRetention(spell, state);
        let text = tabSeparated ? `${name}\t${level}\t${category}\t${failure}%\t${retention}`
            : `${name.padEnd(20)}  ${String(level).padStart(2)}   ${category.padEnd(12)} ${String(failure).padStart(3)}% ${retention.padStart(9)}`;
        // The pinned debug column uses the unsorted slot, unlike the other
        // columns. It exposes the same remaining-turn counter as native.
        if (debug) text += `${separator}${String(currentSpellKnowledge(spellAt(state, position), state)).padStart(6)}`;
        const key = spellLetter(index);
        return { key, text };
    });
    if (view && items.length > 1) items.push({ key: '+', text: '[sort spells]' });
    const selection = await showInventoryWindow([{ heading, items }], {
        title,
        pickMode: view && items.length === 1 ? PICK_NONE : PICK_ONE,
        preselectedKey: preselected === null ? null : spellLetter(preselected),
    });
    if (selection.key === 43) return 'sort';
    const index = spellIndex(selection.key);
    if (index >= 0 && index < state.spells.length)
        return index === preselected ? null : index;
    // Escape or explicit deselection in the second menu leaves the spell in
    // place and returns to the viewing menu; accepting the preset exits it.
    return preselected;
}

// C spell.c:spellsortmenu().
async function selectSpellSort(sortMode: number) {
    const items = SORT_CHOICES.flatMap((text, index) => {
        const key = index === RETAIN_ORDER ? 'z' : spellLetter(index);
        const row = { key, text };
        return index === RETAIN_ORDER ? [{ text: '' }, row] : [row];
    });
    const selection = await showInventoryWindow([{ items }], {
        title: 'View known spells list sorted', pickMode: PICK_ONE,
        preselectedKey: sortMode === RETAIN_ORDER ? 'z' : spellLetter(sortMode),
    });
    if (selection.key === 122) return RETAIN_ORDER;
    const index = spellIndex(selection.key);
    return index >= SORT_LETTER && index <= SORT_CURRENT ? index : null;
}

// C spell.c:spell_cmp().
function compareSpells(first: number, second: number, mode: number, state: GameState) {
    if (mode === SORT_LETTER) return first - second;
    const firstSpell = spellAt(state, first);
    const firstType = firstSpell.otyp;
    const secondSpell = spellAt(state, second);
    const secondType = secondSpell.otyp;
    if (mode >= SORT_SKILL_ALPHA) {
        const difference = spellSkillType(firstType, state) - spellSkillType(secondType, state);
        if (difference) return difference;
    }
    if ([SORT_LEVEL_LOW, SORT_LEVEL_HIGH, SORT_SKILL_LOW, SORT_SKILL_HIGH].includes(mode)) {
        const firstLevel = OBJECT_SPELL_LEVEL[firstType];
        const secondLevel = OBJECT_SPELL_LEVEL[secondType];
        if (firstLevel === undefined || secondLevel === undefined)
            throw new Error('A memorized spell has no native spell level.');
        const difference = firstLevel - secondLevel;
        if (difference) return [SORT_LEVEL_HIGH, SORT_SKILL_HIGH].includes(mode) ? -difference : difference;
    }
    const firstLabel = OBJECT_NAMES[firstType], secondLabel = OBJECT_NAMES[secondType];
    if (firstLabel == null || secondLabel == null)
        throw new Error('A memorized spell has no native spell name.');
    const firstName = firstLabel.toLowerCase();
    const secondName = secondLabel.toLowerCase();
    return firstName < secondName ? -1 : firstName > secondName ? 1 : 0;
}

function spellRetention(spell: MemorizedSpell, state: GameState) {
    const knowledge = currentSpellKnowledge(spell, state);
    if (knowledge < 1) return '(gone)';
    if (knowledge >= 20000) return '100%';
    const skill = liveSpellSkill(spell.otyp, state);
    const accuracy = skill === P_EXPERT ? 2 : skill === P_SKILLED ? 5 : skill === P_BASIC ? 10 : 25;
    const percent = Math.ceil(knowledge / 200);
    const upper = accuracy * Math.ceil(percent / accuracy);
    return `${upper - accuracy + 1}%-${upper}%`;
}

function spellLetter(index: number) {
    return String.fromCharCode(index < 26 ? 97 + index : 65 + index - 26);
}

// C spell.c:spell_let_to_idx().
function spellIndex(key: number | null | undefined) {
    if (key == null) return -1;
    return key >= 97 && key <= 122 ? key - 97 : key >= 65 && key <= 90 ? key - 65 + 26 : -1;
}

function spellAt(state: GameState, index: number): MemorizedSpell {
    const spell = state.spells[index];
    if (!spell) throw new Error(`No memorized spell at index ${index}`);
    return spell;
}

// ── spell.c:throwspell(), skilled elemental spells, cast_chain_lightning() ──
interface LightningStep extends Position { direction: number; strength: number; }
const CHAIN_LIGHTNING_LIMIT = 100;
const LIGHTNING_SPELL_TYPE = 15;

export async function castSkilledElementalSpell(pseudo: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!await chooseSpellCenter(state)) return { targeted: false, heroDied: false };
    const center = { x: state.u.dx ?? 0, y: state.u.dy ?? 0 };
    const count = rnd(8) + 1;
    for (let blast = 0; blast < count; blast++) {
        if (!state.u.dx && !state.u.dy && !state.u.dz) {
            const effect = await zapHeroWithObject(pseudo, { ordinary: true, state });
            if (effect.heroDied) return { targeted: true, heroDied: true };
            if (effect.damage) {
                const cause = `zapped ${state.flags.female ? 'herself' : 'himself'} with a spell`;
                if (await loseHeroHp(effect.damage, cause, { state, deathCause: cause }))
                    return { targeted: true, heroDied: true };
            }
        } else {
            const damage = adjustSpellDamage(Math.trunc(state.u.ulevel / 2) + 1, state);
            await explode(state.u.dx ?? 0, state.u.dy ?? 0, pseudo.otyp - SPE_MAGIC_MISSILE + 10,
                damage, 0, pseudo.otyp === SPE_CONE_OF_COLD ? EXPL_FROSTY : EXPL_FIERY, { state });
        }
        if (state.program_state.gameover) return { targeted: true, heroDied: true };
        state.u.dx = center.x + rnd(3) - 2;
        state.u.dy = center.y + rnd(3) - 2;
        if (!isok(state.u.dx, state.u.dy) || !cansee(state.u.dx, state.u.dy)
            || IS_STWALL(state.level.at(state.u.dx, state.u.dy)?.typ ?? 0) || state.u.uswallow) {
            state.u.dx = center.x;
            state.u.dy = center.y;
        }
    }
    return { targeted: true, heroDied: false };
}

// C spell.c:throwspell().
// C spell.c:spell_aim_step().
// C spell.c:can_center_spell_location().
async function chooseSpellCenter(state: PlayingGameState) {
    if (state.u.uinwater) {
        await plineWithContinuation("You're joking!  In this weather?");
        return false;
    }
    if (Is_waterlevel(state.u.uz)) {
        await plineWithContinuation('You had better wait for the sun to come out.');
        return false;
    }
    const question = 'Where do you want to cast the spell?';
    await plineWithContinuation(question);
    const valid = (x: number, y: number) =>
        Math.max(Math.abs(x - state.u.ux), Math.abs(y - state.u.uy)) <= 10
        && isok(x, y) && cansee(x, y) && !IS_STWALL(state.level.at(x, y)?.typ ?? 0);
    await prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip(state);
    if (firstUse) await showGetposTip(state);
    await showGetposInstructions(state);
    if (firstUse) await plineWithContinuation('Move cursor to the desired position:');
    const selected = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: state._pending_message,
        goal: 'the desired position',
        isValidLocation: valid,
        highlightHero: false,
    });
    if (!selected) return false;
    clearMessageWindow();
    if (Math.max(Math.abs(selected.x - state.u.ux), Math.abs(selected.y - state.u.uy)) > 10) {
        await plineWithContinuation('The spell dissipates over the distance!');
        return false;
    }
    if (state.u.uswallow) {
        await plineWithContinuation('The spell is cut short!');
        await exerciseAttribute(A_WIS, false, state);
        state.u.dx = state.u.dy = 0;
        return true;
    }
    const monster = monsterAtPosition(state.level, selected.x, selected.y);
    const atHero = selected.x === state.u.ux && selected.y === state.u.uy;
    if ((!atHero && !cansee(selected.x, selected.y) && (!monster || !canSpotMonster(monster)))
        || IS_STWALL(state.level.at(selected.x, selected.y)?.typ ?? 0)) {
        await plineWithContinuation('Your mind fails to lock onto that location!');
        return false;
    }
    const center = { x: state.u.ux, y: state.u.uy };
    for (const step of walkPathCells(center.x, center.y, selected.x, selected.y)) {
        if (!isok(step.x, step.y)) break;
        const location = state.level.at(step.x, step.y);
        if (!location || !ZAP_POS(location.typ)
            && !(location.typ === DOOR && (location.doormask & D_ISOPEN))) break;
        center.x = step.x;
        center.y = step.y;
    }
    state.u.dx = center.x;
    state.u.dy = center.y;
    return true;
}

export async function castChainLightning({ state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const displayedBeam = heroIsHallucinating(state) ? rn2Display(6) : 5;
    // The pinned source deliberately leaves this branch without damage.
    if (state.u.uswallow) return { heroDied: false };
    const queue: LightningStep[] = [];
    const painted = new TemporaryMapEffect('beam', zapdir_to_glyph(0, 1, displayedBeam));
    await painted.start();
    try {
        for (let direction = 0; direction < 8; direction++)
            await propagateLightning(queue, painted, {
                direction, x: state.u.ux, y: state.u.uy, strength: 2,
            }, displayedBeam, state);
        await state.animationFrame?.();
        let head = 0;
        while (head < queue.length) {
            const layerEnd = queue.length;
            while (head < layerEnd) {
                const zap = queue[head++];
                if (!zap) throw new Error('A pending lightning step is missing.');
                const monster = monsterAtPosition(state.level, zap.x, zap.y);
                if (monster) {
                    // Native uses the previous zap owner's bhitpos here,
                    // rather than this queue entry's coordinates.
                    state.notonhead = monster.mx !== state.bhitpos.x || monster.my !== state.bhitpos.y;
                    const damage = await hitMonsterWithRay(monster, LIGHTNING_SPELL_TYPE, 2, { state });
                    if (damage) {
                        if (monster.mhp <= 0) {
                            const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my);
                            if (death.heroDied || state.program_state.gameover) return { heroDied: true };
                        } else {
                            await plineWithContinuation(`You shock ${monsterName(monster, { state })}${damage > 4 ? '!' : '.'}`);
                            if (!canSeeMonster(monster) && !state.notonhead) await map_invisible(zap.x, zap.y);
                        }
                    } else if (canSeeMonster(monster)) {
                        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} resists.`);
                    }
                    if (monster.mhp > 0) {
                        const previousForcefight = state.context.forcefight ?? false;
                        state.context.forcefight = Number(previousForcefight) + 1;
                        try {
                            await wakeMonster(monster, { attacked: false });
                        } finally {
                            state.context.forcefight = previousForcefight;
                        }
                    }
                }
                if (!zap.strength) continue;
                const strength = zap.strength - 1;
                await propagateLightning(queue, painted, { ...zap, strength }, displayedBeam, state);
                const diagonalStrength = strength < 2 ? 0 : strength;
                if (strength >= 2 && state.u.uen > 0) state.u.uen--;
                await propagateLightning(queue, painted, {
                    ...zap, strength: diagonalStrength, direction: (zap.direction + 7) % 8,
                }, displayedBeam, state);
                await propagateLightning(queue, painted, {
                    ...zap, strength: diagonalStrength, direction: (zap.direction + 1) % 8,
                }, displayedBeam, state);
            }
            await state.animationFrame?.();
        }
        await state.animationFrame?.();
        await state.animationFrame?.();
    } finally {
        if (!state.program_state.gameover) await painted.clear();
    }
    return { heroDied: false };
}

// C spell.c:propagate_chain_lightning().
async function propagateLightning(queue: LightningStep[], painted: TemporaryMapEffect, zap: LightningStep, displayedBeam: number, state: PlayingGameState) {
    const dx = xdir[zap.direction], dy = ydir[zap.direction];
    if (dx === undefined || dy === undefined) throw new RangeError(`Invalid lightning direction ${zap.direction}`);
    const x = zap.x + dx;
    const y = zap.y + dy;
    if (queue.length >= CHAIN_LIGHTNING_LIMIT || !isok(x, y)) return;
    const location = state.level.at(x, y);
    const open = location && (SPACE_POS(location.typ)
        || [POOL, MOAT, DRAWBRIDGE_UP, LAVAPOOL].includes(location.typ)
        || location.typ === DOOR && !(location.doormask & (D_CLOSED | D_LOCKED)));
    if (!open) return;
    const monster = monsterAtPosition(state.level, x, y);
    if (monster?.mpeaceful) return;
    const strength = monster ? monsterHasShockResistance(monster) ? 0 : 3 : zap.strength;
    if (!monster && !strength) return;
    if (queue.some(queued => queued.x === x && queued.y === y)) return;
    queue.push({ direction: zap.direction, x, y, strength });
    if (cansee(x, y)) {
        await paintRayCell(painted, x, y, dx, dy, displayedBeam);
        await flush_screen(0);
    }
}

// ── spell.c:cast_protection() and the direct healing spell effects ──
export async function castProtection({ state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    let level = hero.ulevel, logarithm = 0;
    while (level) {
        logarithm++;
        level = Math.trunc(level / 2);
    }
    const protection = hero.uspellprot || 0;
    const naturalArmor = Math.trunc((10 - (hero.uac + protection)) / 10);
    const gain = logarithm - Math.trunc(protection / (4 - Math.min(3, naturalArmor)));
    if (gain <= 0) {
        await plineWithContinuation('Your skin feels warm for a moment.');
        return;
    }
    if (!heroIsBlind(state)) {
        const color = displayColorName('golden', state);
        await plineWithContinuation(protection
            ? `The ${color} haze around you becomes more dense.`
            : `The ${protectionAtmosphere(state)} around you begins to shimmer with ${withIndefiniteArticle(color)} haze.`);
    }
    hero.uspellprot = protection + gain;
    hero.uspmtime = liveSpellSkill(SPE_PROTECTION, state) === P_EXPERT ? 20 : 10;
    if (!hero.usptime) hero.usptime = hero.uspmtime;
    findArmorClass(state);
}

function protectionAtmosphere(state: PlayingGameState) {
    const hero = state.u;
    if (hero.uswallow && hero.ustuck) {
        const monster = hero.ustuck;
        if (MONSTER_NAME[monster.mnum] === 'fog cloud') return 'mist';
        if (monsterIsWhirly(monster)) return 'maelstrom';
        if (monsterEnfolds(monster)) return 'folds';
        return monsterIsAnimal(monster) ? 'maw' : 'ooze';
    }
    if (hero.uinwater) return displayLiquidName('water', state);
    const location = state.level.at(hero.ux, hero.uy);
    if (!location) throw new Error('Protection requires the hero to stand on the map.');
    const terrain = location.typ;
    if (terrain === CLOUD) return 'cloud';
    if (IS_TREE(terrain)) return 'vegetation';
    return IS_STWALL(terrain) ? 'stone' : 'air';
}

// Native nh_timeout() commits the updated AC before its fading message.
export async function advanceSpellProtection(state: GameState = game) {
    const hero = state.u;
    if (!hero.usptime || --hero.usptime || !hero.uspellprot) return;
    if (hero.uspmtime === undefined) throw new Error('Spell protection has no decay interval.');
    hero.usptime = hero.uspmtime;
    hero.uspellprot--;
    findArmorClass(state);
    if (!heroIsBlind(state)) {
        await plineWithContinuation(`The ${displayColorName('golden', state)} haze around you ${hero.uspellprot
            ? 'becomes less dense' : 'disappears'}.`, { noRepeat: true });
    }
}

export async function castCureBlindness({ state = game }: { state?: GameState } = {}) {
    await healHero(0, 0, { state, cureBlindness: true });
}

export async function castCureSickness({ state = game }: { state?: GameState } = {}) {
    const wasSick = heroIsSick(state), wasSlimed = heroIsSliming(state);
    await healHero(0, 0, { state, cureSickness: true });
    if (wasSick || !wasSlimed)
        await plineWithContinuation(`You are ${wasSick ? 'no longer' : 'not'} ill.`);
    if (wasSlimed) {
        await setHeroSlimingTimeout(0, { state, message: 'The slime disappears!' });
    }
}

// ── spell.c potion group: casting owns the pseudo-object and its disposal ──
export async function applyPotionSpell(source: GameObject, { state = game }: { state?: GameState } = {}): Promise<{ result: 0 | 1; heroDied: boolean }> {
    const effect = await applyPotionEffect(source, { state });
    return { result: effect.result > 0 ? 1 : 0, heroDied: effect.heroDied };
}

// ── spell.c:spell_skilltype() and spelltypemnemonic() ──
// C spell.c:spell_skilltype(). The Priest light-school override is
// role.c:role_init() (role.c:2088), carried by startup.ts.
export function spellSkillType(otyp: number, state: GameState = game): number {
    if (roleInitClericLightSchool(otyp, state)) return P_CLERIC_SPELL;
    const subtype = OBJECT_SUBTYPE[otyp];
    if (subtype === undefined) throw new RangeError(`Unknown spell object type ${otyp}`);
    return subtype;
}

const SPELL_CATEGORIES: Readonly<Partial<Record<number, SpellCategory>>> = {
    [P_ATTACK_SPELL]: 'attack',
    [P_HEALING_SPELL]: 'healing',
    [P_DIVINATION_SPELL]: 'divination',
    [P_ENCHANTMENT_SPELL]: 'enchantment',
    [P_CLERIC_SPELL]: 'clerical',
    [P_ESCAPE_SPELL]: 'escape',
    [P_MATTER_SPELL]: 'matter',
};

// C spell.c:spelltypemnemonic().
export function spellCategory(otyp: number, state: GameState = game): SpellCategory | undefined {
    return SPELL_CATEGORIES[spellSkillType(otyp, state)];
}

// ── spell.c:losespells() ──
// C spell.c:losespells().
export function loseHeroSpellMemory({ state = game }: { state?: GameState } = {}) {
    if (state.context.spbook) {
        state.context.spbook.book = null;
        state.context.spbook.o_id = 0;
    }
    if (state._occupation?.key === 'study-book') state._occupation = null;
    const spells = state.spells || [];
    let forgotten = rn2(spells.length + 1);
    if ((state.u.confusionTurns ?? 0) > 0)
        forgotten = Math.max(forgotten, rn2(spells.length + 1));
    if (forgotten > 1 && !rnl(7)) forgotten = rnd(forgotten);
    for (let index = 0; forgotten > 0; index++) {
        if (rn2(spells.length - index) < forgotten) {
            const spell = spells[index];
            if (!spell) throw new Error(`No memorized spell at index ${index}`);
            spell.know = 0;
            exerciseWisdom(false, state);
            forgotten--;
        }
    }
}
