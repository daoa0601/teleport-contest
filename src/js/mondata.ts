// Monster-name and monster-class lookup.
// C ref: mondata.c name_to_mon() and name_to_monclass().

import {
    MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM, monsterTypeName,
} from './monster_data.js';
import { roles } from './roles.js';

// Native MALE, FEMALE, and NEUTRAL name indices.
export type MonsterNameGender = 0 | 1 | 2;

export interface MonsterNameMatch {
    readonly mnum: number;
    readonly gender: MonsterNameGender;
}

export interface MonsterNamePrefix extends MonsterNameMatch {
    readonly remainder: string;
}

export const MONSTER_CLASS_SYMBOLS: readonly string[] = [
    '', ...'abcdefghijklmnopqrstuvwxyz', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '@', ' ', "'", '&', ';', ':', '~', ']',
];

const MONSTER_CLASS_NAMES: readonly string[] = [
    '',
    'ant or other insect', 'blob', 'cockatrice', 'dog or other canine',
    'eye or sphere', 'cat or other feline', 'gremlin', 'humanoid',
    'imp or minor demon', 'jelly', 'kobold', 'leprechaun', 'mimic',
    'nymph', 'orc', 'piercer', 'quadruped', 'rodent',
    'arachnid or centipede', 'trapper or lurker above',
    'unicorn or horse', 'vortex', 'worm',
    'xan or other mythical/fantastic insect', 'light', 'zruty',
    'angelic being', 'bat or bird', 'centaur', 'dragon', 'elemental',
    'fungus or mold', 'gnome', 'giant humanoid', 'invisible monster',
    'jabberwock', 'Keystone Kop', 'lich', 'mummy', 'naga', 'ogre',
    'pudding or ooze', 'quantum mechanic',
    'rust monster or disenchanter', 'snake', 'troll', 'umber hulk',
    'vampire', 'wraith', 'xorn', 'apelike creature', 'zombie',
    'human or elf', 'ghost', 'golem', 'major demon', 'sea monster',
    'lizard', 'long worm tail', 'mimic',
];

function canonicalMonsterNumber(name: string) {
    return MONSTER_NAME.findIndex(candidate =>
        candidate?.toLowerCase() === name.toLowerCase());
}

const MONSTER_NAME_ALIAS_ENTRIES: readonly (readonly [string, string | number, MonsterNameGender?])[] = [
    ['grey dragon', 'gray dragon'],
    ['baby grey dragon', 'baby gray dragon'],
    ['grey unicorn', 'gray unicorn'],
    ['grey ooze', 'gray ooze'],
    ['gray-elf', 'Grey-elf'],
    ['mindflayer', 'mind flayer'],
    ['master mindflayer', 'master mind flayer'],
    ['master of thief', 'Master of Thieves'],
    ['master thief', 'Master of Thieves'],
    ['master of assassin', 'Master Assassin'],
    ['master-lich', 'master lich'],
    ['masterlich', 'master lich'],
    ['invisible stalker', 'stalker'],
    ['high-elf', 'elven monarch'],
    ['wood-elf', 'Woodland-elf'],
    ['wood elf', 'Woodland-elf'],
    ['woodland nymph', 'wood nymph'],
    ['halfling', 'hobbit'],
    ['genie', 'djinni'],
    ['human wererat', 261],
    ['human werejackal', 262],
    ['human werewolf', 263],
    ['rat wererat', 91],
    ['jackal werejackal', 15],
    ['wolf werewolf', 21],
    ['ki rin', 'ki-rin'],
    ['kirin', 'ki-rin'],
    ['uruk hai', 'Uruk-hai'],
    ['orc captain', 'orc-captain'],
    ['woodland elf', 'Woodland-elf'],
    ['green elf', 'Green-elf'],
    ['grey elf', 'Grey-elf'],
    ['gray elf', 'Grey-elf'],
    ['elf lady', 'elf-noble', 1],
    ['elf lord', 'elf-noble', 0],
    ['elf noble', 'elf-noble'],
    ['olog hai', 'Olog-hai'],
    ['arch lich', 'arch-lich'],
    ['archlich', 'arch-lich'],
    ['incubi', 'amorous demon', 0],
    ['succubi', 'amorous demon', 1],
    ['violet fungi', 'violet fungus'],
    ['homunculi', 'homunculus'],
    ['baluchitheria', 'baluchitherium'],
    ['lurkers above', 'lurker above'],
    ['cavemen', 'cave dweller', 0],
    ['cavewomen', 'cave dweller', 1],
    ['watchmen', 'watchman'],
    ['djinn', 'djinni'],
    ['mumakil', 'mumak'],
    ['erinyes', 'erinys'],
];

const MONSTER_NAME_ALIASES = new Map<string, MonsterNameMatch>(MONSTER_NAME_ALIAS_ENTRIES.map(([alias, target, gender = 2]) => [
    alias,
    { mnum: typeof target === 'number' ? target : canonicalMonsterNumber(target), gender },
]));

function normalizeMonsterName(value: string) {
    let name = String(value || '').trim().toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^(?:a|an|the) /, '');
    name = name.replace(/vortices/g, 'vortex');
    if (name.endsWith('ies') && !name.endsWith('zombies'))
        name = `${name.slice(0, -3)}y`;
    else if (name.endsWith('ves')) name = `${name.slice(0, -3)}f`;
    return name;
}

function acceptedNameRemainder(remainder: string) {
    return !remainder || remainder.startsWith(' ')
        || /^(?:s|es|'|'s)(?: |$)/.test(remainder);
}

function monsterNames(mnum: number) {
    const neutral = MONSTER_NAME[mnum]?.toLowerCase() ?? '';
    const male = monsterTypeName(mnum, false).toLowerCase();
    const female = monsterTypeName(mnum, true).toLowerCase();
    const names: { name: string; gender: MonsterNameGender }[] = [
        { name: neutral, gender: 2 },
    ];
    if (male !== female) {
        names.push({ name: male, gender: 0 }, { name: female, gender: 1 });
    }
    return names.filter(candidate => candidate.name.length > 0);
}

function roleTitleMonster(name: string) {
    let best: { length: number; mnum: number } | null = null;
    for (const role of roles) {
        for (const title of role.title || []) {
            for (const value of [title.m, title.f]) {
                const candidate = value?.toLowerCase();
                if (!candidate || !name.startsWith(candidate)
                    || !acceptedNameRemainder(name.slice(candidate.length))) {
                    continue;
                }
                if (!best || candidate.length > best.length) {
                    best = {
                        length: candidate.length,
                        mnum: SPECIAL_PM + 1 + role.mnum,
                    };
                }
            }
        }
    }
    return best;
}

export function nameToMonster(value: string) {
    return resolveMonsterName(value)?.mnum ?? -1;
}

export function resolveMonsterName(value: string): MonsterNameMatch | null {
    const match = resolveMonsterNamePrefix(value);
    return match ? { mnum: match.mnum, gender: match.gender } : null;
}

// name_to_monplus() lets wishes retain the object noun after a monster name.
export function resolveMonsterNamePrefix(value: string): MonsterNamePrefix | null {
    const requested = normalizeMonsterName(value);
    if (!requested) return null;
    const source = value.trim().replace(/\s+/g, ' ').replace(/^(?:a|an|the) /i, '');
    for (const [alias, match] of MONSTER_NAME_ALIASES) {
        if (requested.startsWith(alias)
            && acceptedNameRemainder(requested.slice(alias.length))) {
            return { ...match, remainder: source.slice(alias.length) };
        }
    }

    let best: (MonsterNameMatch & { length: number }) | null = null;
    for (let mnum = 0; mnum < MONSTER_NAME.length; mnum++) {
        for (const { name, gender } of monsterNames(mnum)) {
            if (!requested.startsWith(name)
                || !acceptedNameRemainder(requested.slice(name.length))) {
                continue;
            }
            if (!best || name.length > best.length)
                best = { length: name.length, mnum, gender };
        }
    }
    if (best) return { mnum: best.mnum, gender: best.gender, remainder: source.slice(best.length) };
    const title = roleTitleMonster(requested);
    return title ? { mnum: title.mnum, gender: 2, remainder: source.slice(title.length) } : null;
}

function singularClassName(value: string) {
    const name = normalizeMonsterName(value);
    const irregular = new Map([
        ['fungi', 'fungus'], ['mice', 'mouse'],
    ]).get(name);
    if (irregular) return irregular;
    if (name.endsWith('ies')) return `${name.slice(0, -3)}y`;
    if (name.endsWith('es')) return name.slice(0, -2);
    if (name.endsWith('s')) return name.slice(0, -1);
    return name;
}

function classDescriptionMatches(description: string, wanted: string) {
    const start = description.toLowerCase().indexOf(wanted);
    if (start < 0 || (start > 0 && description[start - 1] !== ' '))
        return false;
    const end = start + wanted.length;
    return end === description.length || description[end] === ' ';
}

export function nameToMonsterClass(value: string) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    if (raw.length === 1) {
        const found = MONSTER_CLASS_SYMBOLS.indexOf(raw);
        if (found === 60) return 13;
        if (found === 59) return 23;
        return found < 0 ? 0 : found;
    }

    const wanted = singularClassName(raw);
    if (wanted === 'long') return 0;
    if (['an', 'the', 'or', 'other', 'or other'].includes(wanted)) return 0;
    const special = new Map([
        ['long worm', 23], ['demon', 56], ['devil', 56],
        ['bug', 24], ['fish', 57],
    ]).get(wanted);
    if (special) return special;
    for (let monsterClass = 1;
        monsterClass < MONSTER_CLASS_NAMES.length;
        monsterClass++) {
        if (classDescriptionMatches(
            MONSTER_CLASS_NAMES[monsterClass] ?? '', wanted,
        )) return monsterClass;
    }
    const mnum = nameToMonster(wanted);
    return mnum < 0 ? 0 : (MONSTER_SYMBOL[mnum] ?? 0);
}
