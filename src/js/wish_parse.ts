// C objnam.c:readobjnam_preparse() and readobjnam_parse_charges().
// The remaining text is interpreted by object lookup after its modifiers
// have been collected. Wetness draws happen here, before object generation.
import { SPE_LIM } from './const.js';
import type { ObjectBlessing } from './object_types.js';
import { makeSingular } from './object_grammar.js';
import { rn2, rnd } from './rng.js';
import { nameToMonster, resolveMonsterNamePrefix } from './mondata.js';
import type { MonsterNameGender, MonsterNamePrefix } from './mondata.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, GRAY_DRAGON_SCALES,
    OBJECT_NAMES, YELLOW_DRAGON_SCALES, TIN,
} from './object_data.js';
import { parseTinPreparation } from './tin.js';

interface ParsedFruitWish {
    readonly name: string;
    readonly count: number | null;
    readonly buc: ObjectBlessing | null;
    readonly partlyEaten: boolean;
}

export interface ParsedWish {
    count: number;
    explicitCount: number | null;
    globSize: number;
    enchantment: number | null;
    buc: ObjectBlessing | null;
    recharged: number | null;
    charges: number | null;
    erodeproof: boolean;
    eroded: number | null;
    eroded2: number | null;
    greased: boolean;
    fruit: ParsedFruitWish;
    name: string;
    // Native origbp retains consumed prefixes while edits to the noun buffer
    // (singularization, suffix removal, and armor retry) remain visible.
    originalName: string;
    lit: boolean;
    wetness: number;
    unlabeled: boolean;
    poisoned: boolean;
    trapped: 'trapped' | 'untrapped' | null;
    lock: 'locked' | 'unlocked' | 'broken' | null;
    partlyEaten: boolean;
    historic: boolean;
    diluted: boolean;
    empty: boolean;
    heavy: boolean;
    fakeAmulet: boolean;
    personalName: string | null;
    callName: string | null;
    calledNoun: string | null;
    description: string | null;
    gender: MonsterNameGender | null;
    monsterSpecies: number | null;
    directType: number | null;
    tinVariety: number | null;
    spinach: boolean;
    zombifying: boolean;
    looted: boolean;
    door: 'open' | 'closed' | 'doorless' | null;
    undiggable: boolean;
    unphaseable: boolean;
}

export function parseWishText(text: string): ParsedWish {
    const original = text.trim().replace(/\s+/g, ' ');
    const parsed: ParsedWish = {
        count: 1, explicitCount: null, globSize: 0, enchantment: null,
        buc: null, recharged: null, charges: null, erodeproof: false,
        eroded: null, eroded2: null, greased: false, fruit: parseFruitWish(original), name: '',
        originalName: original,
        lit: false, wetness: 0, unlabeled: false, poisoned: false,
        trapped: null, lock: null, partlyEaten: false, historic: false,
        diluted: false, empty: false, heavy: false, fakeAmulet: false,
        personalName: null, callName: null, calledNoun: null, description: null,
        gender: null, monsterSpecies: null, directType: null,
        tinVariety: null, spinach: false, zombifying: false,
        looted: false, door: null, undiggable: false, unphaseable: false,
    };
    let remaining = original;
    let intensity = 0;
    for (;;) {
        const match = /^(\S+) +(.*)$/.exec(remaining);
        const word = match?.[1]?.toLowerCase();
        const rest = match?.[2];
        if (word === undefined || rest === undefined) break;
        if (word === 'a' || word === 'an') {
            parsed.count = 1;
            parsed.explicitCount = 1;
        } else if (word === 'the') {
            // The definite article does not set a count in C.
        } else if (/^\d+$/.test(word) && parsed.explicitCount === null) {
            parsed.count = Number(word) || 1;
            parsed.explicitCount = parsed.count;
        } else if (/^[+-]\d*$/.test(word)) {
            parsed.enchantment = Number(word.slice(1)) * (word.startsWith('-') ? -1 : 1);
        } else if (word === 'blessed' || word === 'holy') parsed.buc = 'blessed';
        else if (word === 'cursed' || word === 'unholy') parsed.buc = 'cursed';
        else if (word === 'uncursed') parsed.buc = 'uncursed';
        else if (['rustproof', 'erodeproof', 'corrodeproof', 'fixed', 'fireproof',
            'rotproof', 'tempered', 'crackproof'].includes(word)) parsed.erodeproof = true;
        else if (word === 'lit' || word === 'burning') parsed.lit = true;
        else if (word === 'unlit' || word === 'extinguished') parsed.lit = false;
        else if (word === 'wet') parsed.wetness = 3 + rn2(3);
        else if (word === 'moist') parsed.wetness = rnd(2);
        else if (['unlabeled', 'unlabelled', 'blank'].includes(word)) parsed.unlabeled = true;
        else if (word === 'poisoned') parsed.poisoned = true;
        else if (word === 'trapped' || word === 'untrapped') parsed.trapped = word;
        else if (word === 'locked' || word === 'unlocked' || word === 'broken') {
            parsed.lock = word;
            parsed.door = word === 'broken' ? null : 'closed';
        } else if (word === 'open' || word === 'closed' || word === 'doorless') {
            parsed.door = word;
            if (word === 'doorless' || parsed.lock !== 'unlocked') parsed.lock = null;
        } else if (word === 'looted' || word === 'disturbed') parsed.looted = true;
        else if (word === 'greased') parsed.greased = true;
        else if (word === 'male') parsed.gender = 0;
        else if (word === 'female') parsed.gender = 1;
        else if (word === 'neuter') parsed.gender = 2;
        else if (word === 'zombifying') parsed.zombifying = true;
        else if (word === 'very') intensity = 1;
        else if (word === 'thoroughly') intensity = 2;
        else if (['rusty', 'rusted', 'burnt', 'burned', 'cracked'].includes(word)) {
            parsed.eroded = intensity + 1;
            intensity = 0;
        } else if (word === 'corroded' || word === 'rotted') {
            parsed.eroded2 = intensity + 1;
            intensity = 0;
        } else if ((word === 'partly' || word === 'partially') && /^eaten /i.test(rest)) {
            parsed.partlyEaten = true;
            remaining = rest.slice(6);
            continue;
        } else if (word === 'historic') parsed.historic = true;
        else if (word === 'diluted') parsed.diluted = true;
        else if (word === 'empty') parsed.empty = true;
        else if (word === 'medium') parsed.globSize = 2;
        else if (word === 'small' || word === 'large') {
            if (!/^glob/i.test(rest) && !/ glob/i.test(rest)) break;
            parsed.globSize = word === 'small' ? 1 : intensity === 1 ? 4 : 3;
        } else if (word === 'fake') parsed.fakeAmulet = true;
        else if (word !== 'real') break;
        remaining = rest;
    }
    parsed.heavy = intensity > 0;
    const prefixes = original.slice(0, original.length - remaining.length);
    remaining = parseWishCharges(remaining, parsed);
    const named = remaining.search(/ named /i);
    if (named >= 0) {
        parsed.personalName = remaining.slice(named + 7);
        remaining = remaining.slice(0, named);
    }
    const called = remaining.search(/ called /i);
    if (called >= 0) {
        parsed.callName = remaining.slice(called + 8);
        remaining = remaining.slice(0, called);
        parsed.calledNoun = remaining;
    }
    const label = / label(?:l)?ed /i.exec(remaining);
    if (label) {
        parsed.description = remaining.slice(label.index + label[0].length);
        remaining = remaining.slice(0, label.index);
    }
    const spinach = remaining.search(/ of spinach/i);
    if (spinach >= 0) {
        parsed.spinach = true;
        parsed.empty = false;
        remaining = remaining.slice(0, spinach);
    }
    parsed.name = remaining;
    parsed.originalName = prefixes + remaining;
    return parsed;
}

// Called ranges and the Amulet rule skip this part of postparse1. The lookup
// owner decides when to advance here rather than parsing every noun eagerly.
export function parseWishNoun(parsed: ParsedWish): 'lookup' | 'direct' | 'glob' {
    let remaining = parsed.name;
    if (/^pair of /i.test(remaining)) {
        parsed.count *= 2;
        remaining = remaining.slice(8);
    } else if (/^pairs of /i.test(remaining)) {
        if (parsed.count > 1) parsed.count *= 2;
        remaining = remaining.slice(9);
    } else remaining = remaining.replace(/^sets? of /i, '');
    const glob = remaining.match(/^globs?(?: of (.+))?$/i)
        || remaining.match(/^(.+) globs?$/i);
    if (glob) {
        const species = nameToMonster(glob[1] ?? '');
        if (species < 0) {
            const type = GLOB_OF_GRAY_OOZE + rn2(GLOB_OF_BLACK_PUDDING - GLOB_OF_GRAY_OOZE);
            const name = OBJECT_NAMES[type];
            if (!name) throw new RangeError(`Missing glob name for object type ${type}`);
            parsed.name = name;
        } else parsed.name = `glob of ${MONSTER_NAME[species]}`;
        if (/\bglobs\b/i.test(glob[0]) && parsed.count < 2) parsed.count = 2;
        return 'glob';
    }
    remaining = parseWishSpecies(remaining, parsed);
    if (parsed.directType === TIN) {
        parsed.name = remaining;
        return 'direct';
    }
    const singular = ['tricks', 'clothes'].includes(remaining.toLowerCase())
        ? remaining : makeSingular(remaining);
    if (singular !== remaining && parsed.count === 1) parsed.count = 2;
    rewriteOriginalNoun(parsed, remaining, singular);
    parsed.name = singular;
    // C wall properties use the remaining name and match case sensitively.
    parsed.undiggable = remaining.includes('undiggable ') || remaining.includes('nondiggable ');
    parsed.unphaseable = remaining.includes('unphaseable ') || remaining.includes('nonpasswall ');
    return 'lookup';
}

// Fruit names can contain ordinary object modifiers. C reparses only food
// prefixes and restores these values after a case-sensitive fruit match.
function parseFruitWish(text: string): ParsedFruitWish {
    let name = text;
    let count = 0;
    let blessed = false;
    let cursed = false;
    let uncursed = false;
    let partlyEaten = false;
    for (;;) {
        const lower = name.toLowerCase();
        const number = /^\d+/.exec(name);
        let prefixLength: number;
        if (lower.startsWith('a ') || lower.startsWith('an ')) {
            count = 1;
            prefixLength = lower.startsWith('an ') ? 3 : 2;
        } else if (!count && number) {
            count = Number(number[0]);
            name = name.slice(number[0].length).trimStart();
            continue;
        } else if (lower.startsWith('blessed ')) {
            blessed = true;
            prefixLength = 8;
        } else if (lower.startsWith('cursed ')) {
            cursed = true;
            prefixLength = 7;
        } else if (lower.startsWith('uncursed ')) {
            uncursed = true;
            prefixLength = 9;
        } else if (lower.startsWith('partly eaten ') || lower.startsWith('partially eaten ')) {
            partlyEaten = true;
            prefixLength = lower.startsWith('partly eaten ') ? 13 : 16;
        } else break;
        name = name.slice(prefixLength);
    }
    return { name, count: count || null, partlyEaten,
        buc: cursed ? 'cursed' : uncursed ? 'uncursed' : blessed ? 'blessed' : null };
}

function parseWishSpecies(text: string, parsed: ParsedWish): string {
    const depicted = /^(corpse|statue|figurine) of (?:an? |the )?(male|female|neuter) (.+)$/i.exec(text);
    if (depicted) {
        parsed.gender = depicted[2]?.toLowerCase() === 'male' ? 0
            : depicted[2]?.toLowerCase() === 'female' ? 1 : 2;
        const noun = `${depicted[1]} of ${depicted[3]}`;
        rewriteOriginalNoun(parsed, text, noun);
        text = noun;
    }
    // Globs have their own canonicalization and are never corpse species.
    if (/\bglobs?\b/i.test(text)) return text;
    if (!/(?:wand |spellbook |gauntlets |gloves |finger )/i.test(text)) {
        const tin = /tin of (.+)/i.exec(text);
        if (tin?.[1]) {
            const preparation = parseTinPreparation(tin[1]);
            parsed.tinVariety = preparation.variety;
            const match = resolveMonsterNamePrefix(preparation.remaining);
            if (match) recordWishSpecies(parsed, match);
            parsed.directType = TIN;
            return 'tin';
        }
        const of = / of (.+)/i.exec(text);
        if (of?.[1]) {
            const match = resolveMonsterNamePrefix(of[1]);
            if (match) {
                recordWishSpecies(parsed, match);
                const noun = text.slice(0, of.index);
                rewriteOriginalNoun(parsed, text, noun);
                text = noun;
            }
        }
    }
    if (parsed.monsterSpecies === null
        && !/^(?:samurai sword|wizard lock|death wand|master key|ninja-to|magenta)/i.test(text)) {
        const match = resolveMonsterNamePrefix(text);
        if (match?.remainder) {
            recordWishSpecies(parsed, match);
            text = match.remainder.replace(/^(?:es |s |'s |' | )/i, '');
        }
    }
    const species = parsed.monsterSpecies;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    const lastDragon = MONSTER_NAME.indexOf('yellow dragon');
    if (text.toLowerCase() === 'scales' && species !== null && species >= firstDragon && species <= lastDragon) {
        const type = GRAY_DRAGON_SCALES + species - firstDragon;
        if (type <= YELLOW_DRAGON_SCALES) {
            parsed.directType = type;
            parsed.monsterSpecies = null;
        }
    }
    return text;
}

function rewriteOriginalNoun(parsed: ParsedWish, before: string, after: string): void {
    if (before === after) return;
    parsed.originalName = parsed.originalName.slice(0, -before.length) + after;
}

function recordWishSpecies(parsed: ParsedWish, match: MonsterNamePrefix): void {
    parsed.monsterSpecies = match.mnum;
    // C aliases always replace the hint; canonical neutral names preserve it.
    if (match.overridesGender || parsed.gender === null || match.gender !== 2)
        parsed.gender = match.gender;
}

function parseWishCharges(text: string, parsed: ParsedWish): string {
    const index = text.lastIndexOf('(');
    if (text.length <= 1 || index < 0) return text;
    const before = text.slice(0, index).trimEnd();
    const suffix = text.slice(index + 1);
    if (/^lit\)/i.test(suffix)) {
        parsed.lit = true;
        return before + suffix.slice(4);
    }
    const match = /^(?:(\d*):)?(\d*)\)(.*)$/.exec(suffix);
    if (!match) {
        parsed.recharged = 0;
        if (parsed.enchantment !== null)
            parsed.charges = parsed.enchantment < 0 || Object.is(parsed.enchantment, -0) ? -0 : 0;
        return before;
    }
    parsed.recharged = Math.min(7, Number(match[1] ?? 0));
    parsed.charges = Math.min(SPE_LIM, Number(match[2] ?? 0));
    return before + (match[3] ?? '');
}
