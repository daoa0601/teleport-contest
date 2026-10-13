// Native data lookup. C pager.c:checkfile(), strutil.c:pmatch().
import { ENCYCLOPEDIA_ENTRIES } from './encyclopedia_data.js';
import type { EncyclopediaEntry } from './encyclopedia_data.js';
import type { GameState } from './game_state.js';
import { game } from './gstate.js';
import { fruitFromName } from './fruit.js';
import { makeSingular } from './object_grammar.js';

export function encyclopediaEntries(name: string, state: GameState = game): readonly EncyclopediaEntry[] {
    const { base, alternate } = lookupNames(name, state);
    const names = alternate === base ? [base] : [alternate, base];
    const found = new Set<EncyclopediaEntry>();
    for (const candidate of names) {
        if (!candidate) continue;
        const entry = ENCYCLOPEDIA_ENTRIES.find(entry => entryMatches(entry, candidate));
        if (entry) found.add(entry);
    }
    return [...found];
}

function lookupNames(name: string, state: GameState) {
    let base = name.toLowerCase();
    base = base.replace(/^interior of /, '').replace(/^(?:a |an |the |some |\d+ ?)/, '')
        .replace(/^pair of /, '').replace(/^(?:tame |peaceful )/, '')
        .replace(/^invisible /, '').replace(/^saddled /, '')
        .replace(/^(?:blessed |uncursed |cursed )/, '').replace(/^empty /, '')
        .replace(/^(?:partly used |partly eaten )/, '');
    if (base.startsWith('statue of ')) base = 'statue';
    else if (base.startsWith('figurine of ')) base = 'figurine';
    base = base.replace(/^[+-]\d+ ?/, '').replace(/^moist towel/, 'wet towel');

    const named = base.indexOf(' named ');
    const called = base.indexOf(' called ');
    let alternate: string | null = null;
    if (named >= 0) {
        alternate = base.slice(named + 7);
        base = base.slice(0, called >= 0 && called < named ? called : named);
    } else if (called >= 0) {
        alternate = base.slice(called + 8);
        base = base.slice(0, called);
    } else {
        base = base.split(', ', 1)[0] ?? '';
    }
    alternate = alternate?.replace(/^(?:a |an |the )/, '').split(' (', 1)[0] ?? null;
    base = base.split(' (', 1)[0] ?? '';
    alternate ??= fruitFromName(base, { exact: true, state }) ? 'slime mold' : makeSingular(base);
    return { base, alternate };
}

function entryMatches(entry: EncyclopediaEntry, name: string): boolean {
    // Exclusions apply only until the next native entry. The first matching
    // positive key wins, even if a later key would have excluded that name.
    for (const key of entry.keys) {
        const excluded = key.startsWith('~');
        if (patternMatches(excluded ? key.slice(1) : key, name)) return !excluded;
    }
    return false;
}

function patternMatches(pattern: string, name: string): boolean {
    let patternIndex = 0;
    let nameIndex = 0;
    let starIndex = -1;
    let starNameIndex = 0;
    while (nameIndex < name.length) {
        const character = pattern.charAt(patternIndex);
        if (character === '?' || character === name.charAt(nameIndex)) {
            patternIndex++;
            nameIndex++;
        } else if (character === '*') {
            starIndex = patternIndex++;
            starNameIndex = nameIndex;
        } else if (starIndex >= 0) {
            patternIndex = starIndex + 1;
            nameIndex = ++starNameIndex;
        } else {
            return false;
        }
    }
    while (pattern.charAt(patternIndex) === '*') patternIndex++;
    return patternIndex === pattern.length;
}
