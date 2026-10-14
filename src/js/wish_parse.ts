// C objnam.c:readobjnam_preparse() and readobjnam_parse_charges().
// The remaining text is interpreted by object lookup after its modifiers
// have been collected. Wetness draws happen here, before object generation.
import { SPE_LIM } from './const.js';
import type { ObjectBlessing } from './object_types.js';
import { makeSingular } from './object_grammar.js';
import { rn2, rnd } from './rng.js';
import { resolveMonsterNamePrefix } from './mondata.js';
import type { MonsterNameGender } from './mondata.js';
import { MONSTER_NAME } from './monster_data.js';
import { GRAY_DRAGON_SCALES, YELLOW_DRAGON_SCALES, TIN } from './object_data.js';
import { parseTinPreparation } from './tin.js';

export interface ParsedWish {
    count: number;
    countExplicit: boolean;
    globSize: number;
    enchantment: number | null;
    buc: ObjectBlessing | null;
    recharged: number | null;
    charges: number | null;
    erodeproof: boolean;
    eroded: number | null;
    eroded2: number | null;
    greased: boolean;
    fruitName: string;
    name: string;
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
    gender: MonsterNameGender | null;
    monsterSpecies: number | null;
    directType: number | null;
    tinVariety: number | null;
    spinach: boolean;
    zombifying: boolean;
}

export function parseWishText(text: string): ParsedWish {
    const original = text.trim().replace(/\s+/g, ' ');
    const parsed: ParsedWish = {
        count: 1, countExplicit: false, globSize: 0, enchantment: null,
        buc: null, recharged: null, charges: null, erodeproof: false,
        eroded: null, eroded2: null, greased: false, fruitName: '', name: '',
        lit: false, wetness: 0, unlabeled: false, poisoned: false,
        trapped: null, lock: null, partlyEaten: false, historic: false,
        diluted: false, empty: false, heavy: false, fakeAmulet: false,
        personalName: null,
        gender: null, monsterSpecies: null, directType: null,
        tinVariety: null, spinach: false, zombifying: false,
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
            parsed.countExplicit = true;
        } else if (word === 'the') {
            // The definite article does not set a count in C.
        } else if (/^\d+$/.test(word) && !parsed.countExplicit) {
            parsed.count = Number(word) || 1;
            parsed.countExplicit = true;
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
        else if (word === 'locked' || word === 'unlocked' || word === 'broken') parsed.lock = word;
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
    remaining = parseWishCharges(remaining, parsed);
    const named = remaining.search(/ named /i);
    if (named >= 0) {
        parsed.personalName = remaining.slice(named + 7);
        remaining = remaining.slice(0, named);
    }
    if (/^pair of /i.test(remaining)) {
        parsed.count *= 2;
        remaining = remaining.slice(8);
    } else if (/^pairs of /i.test(remaining)) {
        if (parsed.count > 1) parsed.count *= 2;
        remaining = remaining.slice(9);
    } else remaining = remaining.replace(/^sets? of /i, '');
    if (parsed.fakeAmulet && /amulet of yendor/i.test(remaining))
        remaining = 'cheap plastic imitation of the Amulet of Yendor';
    parsed.fruitName = original.replace(/^(?:(?:a|an|blessed|cursed|uncursed) |\d+ |part(?:ly|ially) eaten )+/i, '');
    remaining = parseWishSpecies(remaining, parsed);
    const requested = remaining.toLowerCase();
    parsed.name = ['tricks', 'clothes'].includes(requested) ? requested : makeSingular(requested);
    if (parsed.name !== requested && parsed.count === 1) parsed.count = 2;
    return parsed;
}

function parseWishSpecies(text: string, parsed: ParsedWish): string {
    const depicted = /^(corpse|statue|figurine) of (?:an? |the )?(male|female|neuter) (.+)$/i.exec(text);
    if (depicted) {
        parsed.gender = depicted[2]?.toLowerCase() === 'male' ? 0
            : depicted[2]?.toLowerCase() === 'female' ? 1 : 2;
        text = `${depicted[1]} of ${depicted[3]}`;
    }
    // Globs have their own canonicalization and are never corpse species.
    if (/\bglobs?\b/i.test(text)) return text;
    if (/ of spinach/i.test(text) || text.toLowerCase() === 'spinach') {
        parsed.spinach = true;
        parsed.directType = TIN;
        return 'tin';
    }
    if (!/(?:wand |spellbook |gauntlets |gloves |finger )/i.test(text)) {
        const tin = /tin of (.+)/i.exec(text);
        if (tin?.[1]) {
            const preparation = parseTinPreparation(tin[1]);
            parsed.tinVariety = preparation.variety;
            const match = resolveMonsterNamePrefix(preparation.remaining);
            if (match) recordWishSpecies(parsed, match.mnum, match.gender);
            parsed.directType = TIN;
            return 'tin';
        }
        const of = / of (.+)/i.exec(text);
        if (of?.[1]) {
            const match = resolveMonsterNamePrefix(of[1]);
            if (match) {
                recordWishSpecies(parsed, match.mnum, match.gender);
                return text.slice(0, of.index);
            }
        }
    }
    if (/^(?:samurai sword|wizard lock|death wand|master key|ninja-to|magenta)/i.test(text)) return text;
    const match = resolveMonsterNamePrefix(text);
    if (!match?.remainder) return text;
    recordWishSpecies(parsed, match.mnum, match.gender);
    const remaining = match.remainder.replace(/^(?:es |s |'s |' | )/i, '');
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    const lastDragon = MONSTER_NAME.indexOf('yellow dragon');
    if (remaining.toLowerCase() === 'scales' && match.mnum >= firstDragon && match.mnum <= lastDragon) {
        const type = GRAY_DRAGON_SCALES + match.mnum - firstDragon;
        if (type <= YELLOW_DRAGON_SCALES) {
            parsed.directType = type;
            parsed.monsterSpecies = null;
        }
    }
    return remaining;
}

function recordWishSpecies(parsed: ParsedWish, species: number, gender: MonsterNameGender): void {
    parsed.monsterSpecies = species;
    if (parsed.gender === null || gender !== 2) parsed.gender = gender;
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
