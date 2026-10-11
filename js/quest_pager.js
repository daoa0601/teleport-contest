// C questpgr.c: the quest-text % substitutions and the role-name helpers
// they draw from (ldrname(), neminame(), guardname(), intermed(),
// homebase()). Quest text from dat/quest.lua carries % codes; convert_line()
// expands each code and the optional letter that follows it (article,
// capitalization, pronoun, plural, or possessive form).
import { MIN_QUEST_LEVEL } from './const.js';
import { game } from './gstate.js';
import { experienceRankIndex } from './exper.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { makePlural, makeSingular, withIndefiniteArticle } from './object_grammar.js';
import { heroIsBlind } from './senses.js';
const M2_PNAME = 0x00080000;
// C questpgr.c:ldrname()/neminame()/guardname() share one rule: the role's
// named species is used directly when its name is a proper name, and with a
// "the" prefix otherwise.
function roleMonsterName(mnum) {
    if (mnum === undefined || !Number.isInteger(mnum))
        return '';
    const name = MONSTER_NAME[mnum];
    if (name === undefined)
        return '';
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME) !== 0 ? name : `the ${name}`;
}
export function questLeaderName(g = game) {
    return roleMonsterName(g.urole?.ldrnum);
}
export function questNemesisName(g = game) {
    return roleMonsterName(g.urole?.neminum);
}
export function questGuardianName(g = game) {
    return roleMonsterName(g.urole?.guardnum);
}
export function questHomebase(g = game) {
    return g.urole?.homebase ?? '';
}
export function questIntermed(g = game) {
    return g.urole?.intermediate ?? '';
}
// C botl.c:rank_of(). The level picks the rank slot; a female hero reads
// the female title when the table has one.
function rankOf(level, g) {
    const titles = g.urole?.title ?? [];
    for (let index = experienceRankIndex(level); index >= 0; index--) {
        const title = titles[index];
        if (!title)
            continue;
        if (g.flags?.female && title.f)
            return title.f;
        if (title.m)
            return title.m;
    }
    if (g.flags?.female && g.urole?.name.f)
        return g.urole.name.f;
    return g.urole?.name.m ?? 'Player';
}
function alignmentName(alignment) {
    if (alignment === undefined)
        return 'neutral';
    return alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
}
// C pray.c:align_gname(): the god of the given alignment, with the goddess
// marker underscore stripped from the role's table entry.
function godNameOf(alignment, g) {
    const name = g.urole?.gods?.[alignment];
    return name !== undefined ? name.replace(/^_/, '') : '';
}
// C pray.c:align_gtitle(): "goddess" when the original alignment's god is
// marked with the underscore prefix, "god" otherwise.
function godTitleOf(alignment, g) {
    const marked = g.urole?.gods?.[alignment];
    return marked !== undefined && marked.startsWith('_') ? 'goddess' : 'god';
}
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
// C hacklib.c:s_suffix().
function possessive(text) {
    if (text.toLowerCase() === 'it')
        return `${text}s`;
    if (text.toLowerCase() === 'you')
        return `${text}r`;
    return text.endsWith('s') ? `${text}'` : `${text}'s`;
}
// The original alignment recorded at game start drives %a, %d, and %G.
function originalAlignment(g) {
    return g.u?.ualignbase?.[1] ?? g.u?.ualign?.type ?? 0;
}
// C questpgr.c:qtext_pronoun(). The leader, nemesis, and deity read the
// gender recorded in quest_status; artifacts are read as plural or neuter.
function questPronoun(who, which, artifactName, g) {
    const kind = which.toLowerCase();
    let pronoun;
    if (who === 'o' && (artifactName.includes('Eyes ')
        || artifactName.toLowerCase()
            !== makeSingular(artifactName)?.toLowerCase())) {
        pronoun = kind === 'h' ? 'they' : kind === 'i' ? 'them' : 'their';
    }
    else {
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
function questTextArgument(code, g) {
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
export function convertQuestLine(line, g = game) {
    let out = '';
    for (let i = 0; i < line.length; i++) {
        const ch = line[i] ?? '';
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
            case 'h':
            case 'H':
            case 'i':
            case 'I':
            case 'j':
            case 'J':
                if ('dlno'.includes(code)) {
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
//# sourceMappingURL=quest_pager.js.map