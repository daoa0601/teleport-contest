// Monster-name and monster-class lookup.
// C ref: mondata.c name_to_mon() and name_to_monclass().
import { MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM, monsterTypeName, } from './monster_data.js';
import { roles } from './roles.js';
export const MONSTER_CLASS_SYMBOLS = [
    '', ...'abcdefghijklmnopqrstuvwxyz', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '@', ' ', "'", '&', ';', ':', '~', ']',
];
const MONSTER_CLASS_NAMES = [
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
function canonicalMonsterNumber(name) {
    return MONSTER_NAME.findIndex(candidate => candidate?.toLowerCase() === name.toLowerCase());
}
const MONSTER_NAME_ALIASES = new Map([
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
    ['elf lady', 'elf-noble'],
    ['elf lord', 'elf-noble'],
    ['elf noble', 'elf-noble'],
    ['olog hai', 'Olog-hai'],
    ['arch lich', 'arch-lich'],
    ['archlich', 'arch-lich'],
    ['incubi', 'amorous demon'],
    ['succubi', 'amorous demon'],
    ['violet fungi', 'violet fungus'],
    ['homunculi', 'homunculus'],
    ['baluchitheria', 'baluchitherium'],
    ['lurkers above', 'lurker above'],
    ['cavemen', 'cave dweller'],
    ['cavewomen', 'cave dweller'],
    ['watchmen', 'watchman'],
    ['djinn', 'djinni'],
    ['mumakil', 'mumak'],
    ['erinyes', 'erinys'],
].map(([alias, target]) => [
    alias,
    typeof target === 'number' ? target : canonicalMonsterNumber(target),
]));
function normalizeMonsterName(value) {
    let name = String(value || '').trim().toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^(?:a|an|the) /, '');
    name = name.replace(/vortices/g, 'vortex');
    if (name.endsWith('ies') && !name.endsWith('zombies'))
        name = `${name.slice(0, -3)}y`;
    else if (name.endsWith('ves'))
        name = `${name.slice(0, -3)}f`;
    return name;
}
function acceptedNameRemainder(remainder) {
    return !remainder || remainder.startsWith(' ')
        || /^(?:s|es|'|'s)(?: |$)/.test(remainder);
}
function monsterNames(mnum) {
    return new Set([
        MONSTER_NAME[mnum],
        monsterTypeName(mnum, false),
        monsterTypeName(mnum, true),
    ].filter((name) => typeof name === 'string' && name.length > 0).map(name => name.toLowerCase()));
}
function roleTitleMonster(name) {
    let best = null;
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
    return best?.mnum ?? -1;
}
export function nameToMonster(value) {
    const requested = normalizeMonsterName(value);
    if (!requested)
        return -1;
    for (const [alias, mnum] of MONSTER_NAME_ALIASES) {
        if (requested.startsWith(alias)
            && acceptedNameRemainder(requested.slice(alias.length))) {
            return mnum;
        }
    }
    let best = null;
    for (let mnum = 0; mnum < MONSTER_NAME.length; mnum++) {
        for (const name of monsterNames(mnum)) {
            if (!requested.startsWith(name)
                || !acceptedNameRemainder(requested.slice(name.length))) {
                continue;
            }
            if (!best || name.length > best.length)
                best = { length: name.length, mnum };
        }
    }
    return best?.mnum ?? roleTitleMonster(requested);
}
function singularClassName(value) {
    const name = normalizeMonsterName(value);
    const irregular = new Map([
        ['fungi', 'fungus'], ['mice', 'mouse'],
    ]).get(name);
    if (irregular)
        return irregular;
    if (name.endsWith('ies'))
        return `${name.slice(0, -3)}y`;
    if (name.endsWith('es'))
        return name.slice(0, -2);
    if (name.endsWith('s'))
        return name.slice(0, -1);
    return name;
}
function classDescriptionMatches(description, wanted) {
    const start = description.toLowerCase().indexOf(wanted);
    if (start < 0 || (start > 0 && description[start - 1] !== ' '))
        return false;
    const end = start + wanted.length;
    return end === description.length || description[end] === ' ';
}
export function nameToMonsterClass(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return 0;
    if (raw.length === 1) {
        const found = MONSTER_CLASS_SYMBOLS.indexOf(raw);
        if (found === 60)
            return 13;
        if (found === 59)
            return 23;
        return found < 0 ? 0 : found;
    }
    const wanted = singularClassName(raw);
    if (wanted === 'long')
        return 0;
    if (['an', 'the', 'or', 'other', 'or other'].includes(wanted))
        return 0;
    const special = new Map([
        ['long worm', 23], ['demon', 56], ['devil', 56],
        ['bug', 24], ['fish', 57],
    ]).get(wanted);
    if (special)
        return special;
    for (let monsterClass = 1; monsterClass < MONSTER_CLASS_NAMES.length; monsterClass++) {
        if (classDescriptionMatches(MONSTER_CLASS_NAMES[monsterClass] ?? '', wanted))
            return monsterClass;
    }
    const mnum = nameToMonster(wanted);
    return mnum < 0 ? 0 : (MONSTER_SYMBOL[mnum] ?? 0);
}
//# sourceMappingURL=mondata.js.map