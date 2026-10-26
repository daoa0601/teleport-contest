// C questpgr.c: the quest-text % substitutions and the role-name helpers
// they draw from (ldrname(), neminame(), guardname(), intermed(),
// homebase()). Quest text from dat/quest.lua carries % codes; convert_line()
// expands each code and the optional letter that follows it (article,
// capitalization, pronoun, plural, or possessive form).

import { MIN_QUEST_LEVEL } from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { experienceRankIndex } from './exper.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { makePlural, makeSingular, withIndefiniteArticle } from './object_grammar.js';
import { heroIsBlind } from './senses.js';
import type { AlignmentName } from './roles.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { rn2 } from './rng.js';
import { QUEST_LUA_SOURCE } from './quest_data.js';
import { LuaTable } from './lua/runtime.js';
import { flushPendingTopline, plineWithContinuation, putMessageHistory } from './display.js';
import { showTextWindow, showTextMenuOverlay } from './windows.js';

const M2_PNAME = 0x00080000;

export interface QuestText {
    lines: readonly string[];
    raw: string;
    output: 'pline' | 'text' | 'menu';
    synopsis: string | null;
}

// C com_pager_core(): each attempted section opens its own Lua state,
// including nhlib's alignment shuffle, before resolving a fallback or choice.
async function prepareSection(section: string, messageId: string, state: GameState): Promise<QuestText | null> {
    if (state.program_state.wizkit_wishing) return null;
    const lua = currentLuaLifecycle().createSpecialState(state);
    try {
        lua.execute(QUEST_LUA_SOURCE, 'quest.lua');
        const quest = lua.getGlobal('questtext');
        if (!(quest instanceof LuaTable)) throw new Error('quest.lua has no questtext table');
        const messages = quest.get(section);
        if (!(messages instanceof LuaTable)) return null;
        let entry = messages.get(messageId);
        if (!(entry instanceof LuaTable)) {
            const fallbacks = quest.get('msg_fallbacks');
            const fallback = fallbacks instanceof LuaTable ? fallbacks.get(messageId) : null;
            if (typeof fallback === 'string') entry = messages.get(fallback);
        }
        if (!(entry instanceof LuaTable)) return null;
        let text = entry.get('text');
        if (typeof text !== 'string') {
            const count = entry.length();
            if (count < 2) throw new Error(`Quest message ${section}.${messageId} has no text or choices`);
            text = entry.get(rn2(count) + 1);
        }
        if (typeof text !== 'string') throw new Error(`Quest message ${section}.${messageId} is not text`);
        const how = entry.get('output');
        const output = how === 'menu' ? 'menu'
            : how === 'text' || how === 'window' ? 'text'
                : how === 'pline' ? 'pline'
                    : text.includes('\n') || text.length >= 255 ? 'text' : 'pline';
        const summary = entry.get('synopsis');
        const synopsis = typeof summary === 'string' ? summary
            : output === 'text' && (how === null || how === 'default')
                ? `[${text.slice(0, 253).replaceAll('\n', ' ')}]` : null;
        const lines = text.split('\n');
        if (text.endsWith('\n')) lines.pop();
        return {
            lines: lines.map(line => convertQuestLine(line, state)), output, raw: text,
            synopsis: synopsis === null ? null : convertQuestLine(synopsis, state),
        };
    } finally {
        await lua.destroy();
    }
}

export async function prepareQuestText(messageId: string, state: GameState = game, common = false): Promise<QuestText | null> {
    if (common) return prepareSection('common', messageId, state);
    return await prepareSection(state.urole?.filecode ?? '', messageId, state)
        ?? await prepareSection('common', messageId, state);
}

export async function displayQuestText(text: QuestText | null, state: GameState = game): Promise<boolean> {
    if (!text) return false;
    if (text.output === 'pline') {
        for (const line of text.lines) await plineWithContinuation(line);
    } else {
        if (state._pending_message && !state._pending_message.endsWith('--More--'))
            await flushPendingTopline();
        state._pending_message = '';
        state._retained_message = '';
        // C questpgr.c:451 deliver_by_window() fills the window with
        // putstr() even for menu-style output.
        if (text.output === 'menu') await showTextMenuOverlay(text.lines, { viaPutstr: true });
        else await showTextWindow(text.lines);
        state._pending_message = '';
        state._retained_message = '';
    }
    // C questpgr.c: putmsghistory(out_line, FALSE) remembers the synopsis
    // without displaying it.
    if (text.synopsis) putMessageHistory(text.synopsis);
    return true;
}

export async function qtPager(messageId: string, state: GameState = game): Promise<boolean> {
    return displayQuestText(await prepareQuestText(messageId, state), state);
}

export async function comPager(messageId: string, state: GameState = game): Promise<boolean> {
    return displayQuestText(await prepareQuestText(messageId, state, true), state);
}

// C questpgr.c:com_pager_core(). Each insult opens a fresh quest.lua state,
// so nhlib's initialization precedes selection and message delivery.
export async function deliverCommonQuestInsult(
    messageId: 'angel_cuss' | 'demon_cuss', state: GameState = game,
): Promise<void> {
    await comPager(messageId, state);
}

// C questpgr.c:ldrname()/neminame() use the role's named species directly
// when its name is a proper name, and with a "the" prefix otherwise.
function roleMonsterName(mnum: number | undefined): string {
    if (mnum === undefined || !Number.isInteger(mnum)) return '';
    const name = MONSTER_NAME[mnum];
    if (name === undefined) return '';
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME) !== 0 ? name : `the ${name}`;
}

export function questLeaderName(g: GameState = game): string {
    return roleMonsterName(g.urole?.ldrnum);
}

export function questNemesisName(g: GameState = game): string {
    return roleMonsterName(g.urole?.neminum);
}

// C questpgr.c:guardname() returns the species name without an article.
export function questGuardianName(g: GameState = game): string {
    const mnum = g.urole?.guardnum;
    if (mnum === undefined || !Number.isInteger(mnum)) return '';
    return MONSTER_NAME[mnum] ?? '';
}

export function questHomebase(g: GameState = game): string {
    return g.urole?.homebase ?? '';
}

export function questIntermed(g: GameState = game): string {
    return g.urole?.intermediate ?? '';
}

// C botl.c:rank_of(). The level picks the rank slot; a female hero reads
// the female title when the table has one.
export function rankOf(level: number, g: GameState): string {
    const titles = g.urole?.title ?? [];
    for (let index = experienceRankIndex(level); index >= 0; index--) {
        const title = titles[index];
        if (!title) continue;
        if (g.flags?.female && title.f) return title.f;
        if (title.m) return title.m;
    }
    if (g.flags?.female && g.urole?.name.f) return g.urole.name.f;
    return g.urole?.name.m ?? 'Player';
}

function alignmentName(alignment: number | undefined): AlignmentName {
    if (alignment === undefined) return 'neutral';
    return alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
}

// C pray.c:align_gname(). Role data stores names without the goddess marker.
function godNameOf(alignment: AlignmentName, g: GameState): string {
    return g.urole?.gods?.[alignment] ?? '';
}

// C pray.c:align_gtitle(). goddessAlignments preserves role.c's '_' marker.
function godTitleOf(alignment: AlignmentName, g: GameState): string {
    return g.urole?.goddessAlignments?.includes(alignment) ? 'goddess' : 'god';
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// C hacklib.c:s_suffix().
function possessive(text: string): string {
    if (text.toLowerCase() === 'it') return `${text}s`;
    if (text.toLowerCase() === 'you') return `${text}r`;
    return text.endsWith('s') ? `${text}'` : `${text}'s`;
}

// The original alignment recorded at game start drives %a, %d, and %G.
function originalAlignment(g: GameState): number {
    return g.u?.ualignbase?.[1] ?? g.u?.ualign?.type ?? 0;
}

// C questpgr.c:qtext_pronoun(). The leader, nemesis, and deity read the
// gender recorded in quest_status; artifacts are read as plural or neuter.
function questPronoun(
    who: string, which: string, artifactName: string, g: GameState,
): string {
    const kind = which.toLowerCase();
    let pronoun: string;
    if (who === 'o' && (artifactName.includes('Eyes ')
        || artifactName.toLowerCase()
            !== makeSingular(artifactName)?.toLowerCase())) {
        pronoun = kind === 'h' ? 'they' : kind === 'i' ? 'them' : 'their';
    } else {
        const status = g.quest_status;
        const gender = who === 'd' ? status?.godgend
            : who === 'l' ? status?.ldrgend
            : who === 'n' ? status?.nemgend : 2;
        pronoun = gender === 0
            ? (kind === 'h' ? 'he' : kind === 'i' ? 'him' : 'his')
            : gender === 1
                ? (kind === 'h' ? 'she' : kind === 'i' ? 'her' : 'her')
                : (kind === 'h' ? 'it' : kind === 'i' ? 'it' : 'its');
    }
    return which !== kind ? capitalize(pronoun) : pronoun;
}

// C questpgr.c:convert_arg().
function questTextArgument(code: string, g: GameState): string {
    switch (code) {
    case 'p': return g.plname;
    case 'c': return g.flags?.female && g.urole?.name.f
        ? g.urole.name.f : (g.urole?.name.m ?? '');
    case 'r': return rankOf(g.u?.ulevel ?? 1, g);
    case 'R': return rankOf(MIN_QUEST_LEVEL, g);
    case 's': return g.flags?.female ? 'sister' : 'brother';
    case 'S': return g.flags?.female ? 'daughter' : 'son';
    case 'l': return questLeaderName(g);
    case 'i': return questIntermed(g);
    case 'O': {
        const name = g.urole?.artifactName ?? '';
        const cut = name.indexOf(' of ');
        return cut >= 0 ? name.slice(0, cut) : name;
    }
    case 'o': return g.urole?.artifactName ?? '';
    case 'n': return questNemesisName(g);
    case 'g': return questGuardianName(g);
    case 'G': return godTitleOf(alignmentName(originalAlignment(g)), g);
    case 'H': return questHomebase(g);
    case 'a': return alignmentName(originalAlignment(g));
    case 'A': return alignmentName(g.u?.ualign?.type);
    case 'd': return godNameOf(alignmentName(originalAlignment(g)), g);
    case 'D': return godNameOf('lawful', g);
    case 'C': return 'chaotic';
    case 'N': return 'neutral';
    case 'L': return 'lawful';
    case 'x': return heroIsBlind(g) ? 'sense' : 'see';
    case 'Z': return g.dungeons?.[0]?.dname ?? '';
    case '%': return '%';
    default: return '';
    }
}

// C questpgr.c:convert_line(). Expands each % code and consumes the letter
// after it when that letter selects an article, capitalization, pronoun,
// plural, or possessive form of the expanded value.
export function convertQuestLine(line: string, g: GameState = game): string {
    let out = '';
    for (let i = 0; i < line.length; i++) {
        const ch = line[i] ?? '';
        if (ch === '\r' || ch === '\n') return out;
        if (ch !== '%' || i + 1 >= line.length) {
            out += ch;
            continue;
        }
        const code = line[++i] ?? '';
        let value = questTextArgument(code, g);
        const modifier = i + 1 < line.length ? line[i + 1] ?? '' : '';
        switch (modifier) {
        case 'A':
            out += capitalize(withIndefiniteArticle(value));
            i++;
            continue;
        case 'a':
            out += withIndefiniteArticle(value);
            i++;
            continue;
        case 'C':
            value = capitalize(value);
            i++;
            break;
        case 'h': case 'H': case 'i': case 'I': case 'j': case 'J':
            if ('dlno'.includes(code.toLowerCase())) {
                value = questPronoun(code, modifier, value, g);
                i++;
                break;
            }
            out += value;
            continue;
        case 'P':
            value = capitalize(makePlural(value));
            i++;
            break;
        case 'p':
            value = makePlural(value);
            i++;
            break;
        case 'S':
            value = capitalize(possessive(value));
            i++;
            break;
        case 's':
            value = possessive(value);
            i++;
            break;
        case 't':
            i++;
            if (value.toLowerCase().startsWith('the ')) {
                out += value.slice(4);
                continue;
            }
            break;
        default:
            out += value;
            continue;
        }
        out += value;
    }
    return out;
}
