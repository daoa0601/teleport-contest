import type { GameState } from '../../js/game_state.js';
import type { InputGate } from '../../js/input.js';
import { game, requirePlayingGame } from '../../js/gstate.js';
import { P_BASIC } from '../../js/const.js';
import { forceLearnSpell } from '../../js/spell.js';
import { spellSkillType } from '../../js/spell_casting_rules.js';
import { flushPendingTopline } from '../../js/display.js';
import { resetInputState } from '../../js/input.js';
import {
    adjustWeaponSkillSlots, advanceHeroSkill, ensureHeroSkills, practiceNeededToAdvance, useHeroSkill,
} from '../../js/skills.js';

export interface SpellTrainingOptions { state?: GameState; input?: InputGate }


// Divine teaching creates the same memorized entry as play. Practice and
// advancement establish live proficiency without replacing spell metadata.
export async function learnSpell(type: number, { skill = P_BASIC, state = game }: { skill?: number; state?: GameState } = {}) {
    forceLearnSpell(type, state);
    await trainSpellSkill(type, skill, { state });
}

export async function trainSpellSkill(type: number, skill: number, { state = game, input }: SpellTrainingOptions = {}) {
    requirePlayingGame(state);
    const proficiency = spellSkillType(type);
    if (proficiency === undefined) throw new RangeError(`Object ${type} is not a spell`);
    const skills = ensureHeroSkills(state);
    if (!skills) throw new Error('Spell training requires initialized hero skills');
    const current = skills[proficiency];
    if (!current) throw new RangeError(`Unknown spell proficiency: ${proficiency}`);
    if (current.maxSkill < skill)
        throw new RangeError(`Role cannot reach spell skill ${skill} for ${type}`);
    if (current.skill >= skill) return;
    const gate = input || resetInputState();
    const beforeRead = gate.beforeRead;
    gate.beforeRead = () => {
        if (!state.nhDisplay) throw new Error('Spell training needs a display');
        const screen = state.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (!screen.includes('--More--')) throw new Error('Unexpected input during spell skill training');
        gate.feed(' ');
    };
    try {
        while (current.skill < skill) {
            const slots = Math.trunc((current.skill + 1) / 2);
            await adjustWeaponSkillSlots(Math.max(0, slots - (state.u.weapon_slots || 0)), state);
            const practice = Math.max(0, practiceNeededToAdvance(current.skill) - current.advance);
            await useHeroSkill(proficiency, practice, { state });
            if (!await advanceHeroSkill(state, proficiency))
                throw new Error(`Spell skill ${proficiency} cannot advance`);
        }
        await flushPendingTopline();
    } finally {
        gate.beforeRead = beforeRead;
    }
}
