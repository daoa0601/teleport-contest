import type { GameState, MemorizedSpell } from './game_state.js';

interface SpellMenuOptions {
    state: GameState;
    order?: number[] | null;
    view?: boolean;
    preselected?: number | null;
}

// Native spell.c:getspell(), dovspell(), dospellmenu(), sortspells(), and
// spellretention(). Display sorting changes letters only when explicitly kept.
import {
    MENU_TRADITIONAL, NHW_MENU, PICK_NONE, PICK_ONE, P_BASIC, P_EXPERT, P_SKILLED,
} from './const.js';
import { flushPendingTopline, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { OBJECT_NAMES, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL, SPE_BLANK_PAPER, SPE_DIG } from './object_data.js';
import {
    currentSpellKnowledge, liveSpellSkill, percentSuccess, rejectCasting, spellSkillType,
} from './spell_casting_rules.js';
import { rememberCommandKey, takeRepeatCommand } from './command_repeat.js';
import { promptKey } from './tty_prompts.js';
import { showInventoryWindow } from './windows.js';
import {
    tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu,
    tty_select_menu, tty_destroy_nhwindow,
} from './tty_menu.js';

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

export async function selectSpellToCast(state: GameState = game): Promise<MemorizedSpell | null> {
    requireLiveGame(state);
    const spells = state.spells || [];
    if (!spells.length) {
        await plineWithContinuation("You don't know any spells right now.");
        return null;
    }
    if (await rejectCasting(state)) return null;
    const queued = takeRepeatCommand();
    if (queued) {
        if (queued.kind !== 'key') return null;
        const index = spellIndex(queued.key);
        return index >= 0 ? spells[index] ?? null : null;
    }
    if (state.flags.menu_style === MENU_TRADITIONAL) {
        const selection = await selectTraditionalSpell(spells);
        if (selection !== 'menu') return selection;
    }
    const selection = await showSpellMenu('Choose which spell to cast', { state });
    return typeof selection === 'number' ? spells[selection] ?? null : null;
}

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
        if ([32, 10, 13, 27].includes(key)) {
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
        const category = OBJECT_SPELL_CATEGORY[spell.otyp];
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

function compareSpells(first: number, second: number, mode: number, state: GameState) {
    if (mode === SORT_LETTER) return first - second;
    const firstSpell = spellAt(state, first);
    const firstType = firstSpell.otyp;
    const secondSpell = spellAt(state, second);
    const secondType = secondSpell.otyp;
    if (mode >= SORT_SKILL_ALPHA) {
        const difference = spellSkillType(firstType) - spellSkillType(secondType);
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

function spellIndex(key: number | null | undefined) {
    if (key == null) return -1;
    return key >= 97 && key <= 122 ? key - 97 : key >= 65 && key <= 90 ? key - 65 + 26 : -1;
}

function spellAt(state: GameState, index: number): MemorizedSpell {
    const spell = state.spells[index];
    if (!spell) throw new Error(`No memorized spell at index ${index}`);
    return spell;
}
