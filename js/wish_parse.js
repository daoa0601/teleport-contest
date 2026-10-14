// C objnam.c:readobjnam_preparse() and readobjnam_parse_charges().
// The remaining text is interpreted by object lookup after its modifiers
// have been collected. Wetness draws happen here, before object generation.
import { SPE_LIM } from './const.js';
import { makeSingular } from './object_grammar.js';
import { rn2, rnd } from './rng.js';
export function parseWishText(text) {
    const original = text.trim().replace(/\s+/g, ' ');
    const parsed = {
        count: 1, countExplicit: false, globSize: 0, enchantment: null,
        buc: null, recharged: null, charges: null, erodeproof: false,
        eroded: null, eroded2: null, greased: false, fruitName: '', name: '',
        lit: false, wetness: 0, unlabeled: false, poisoned: false,
        trapped: null, lock: null, partlyEaten: false, historic: false,
        diluted: false, empty: false, heavy: false, fakeAmulet: false,
        personalName: null,
    };
    let remaining = original;
    let intensity = 0;
    for (;;) {
        const match = /^(\S+) +(.*)$/.exec(remaining);
        const word = match?.[1]?.toLowerCase();
        const rest = match?.[2];
        if (word === undefined || rest === undefined)
            break;
        if (word === 'a' || word === 'an') {
            parsed.count = 1;
            parsed.countExplicit = true;
        }
        else if (word === 'the') {
            // The definite article does not set a count in C.
        }
        else if (/^\d+$/.test(word) && !parsed.countExplicit) {
            parsed.count = Number(word) || 1;
            parsed.countExplicit = true;
        }
        else if (/^[+-]\d*$/.test(word)) {
            parsed.enchantment = Number(word.slice(1)) * (word.startsWith('-') ? -1 : 1);
        }
        else if (word === 'blessed' || word === 'holy')
            parsed.buc = 'blessed';
        else if (word === 'cursed' || word === 'unholy')
            parsed.buc = 'cursed';
        else if (word === 'uncursed')
            parsed.buc = 'uncursed';
        else if (['rustproof', 'erodeproof', 'corrodeproof', 'fixed', 'fireproof',
            'rotproof', 'tempered', 'crackproof'].includes(word))
            parsed.erodeproof = true;
        else if (word === 'lit' || word === 'burning')
            parsed.lit = true;
        else if (word === 'unlit' || word === 'extinguished')
            parsed.lit = false;
        else if (word === 'wet')
            parsed.wetness = 3 + rn2(3);
        else if (word === 'moist')
            parsed.wetness = rnd(2);
        else if (['unlabeled', 'unlabelled', 'blank'].includes(word))
            parsed.unlabeled = true;
        else if (word === 'poisoned')
            parsed.poisoned = true;
        else if (word === 'trapped' || word === 'untrapped')
            parsed.trapped = word;
        else if (word === 'locked' || word === 'unlocked' || word === 'broken')
            parsed.lock = word;
        else if (word === 'greased')
            parsed.greased = true;
        else if (word === 'very')
            intensity = 1;
        else if (word === 'thoroughly')
            intensity = 2;
        else if (['rusty', 'rusted', 'burnt', 'burned', 'cracked'].includes(word)) {
            parsed.eroded = intensity + 1;
            intensity = 0;
        }
        else if (word === 'corroded' || word === 'rotted') {
            parsed.eroded2 = intensity + 1;
            intensity = 0;
        }
        else if ((word === 'partly' || word === 'partially') && /^eaten /i.test(rest)) {
            parsed.partlyEaten = true;
            remaining = rest.slice(6);
            continue;
        }
        else if (word === 'historic')
            parsed.historic = true;
        else if (word === 'diluted')
            parsed.diluted = true;
        else if (word === 'empty')
            parsed.empty = true;
        else if (word === 'medium')
            parsed.globSize = 2;
        else if (word === 'small' || word === 'large') {
            if (!/^glob/i.test(rest) && !/ glob/i.test(rest))
                break;
            parsed.globSize = word === 'small' ? 1 : intensity === 1 ? 4 : 3;
        }
        else if (word === 'fake')
            parsed.fakeAmulet = true;
        else if (word !== 'real')
            break;
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
    }
    else if (/^pairs of /i.test(remaining)) {
        if (parsed.count > 1)
            parsed.count *= 2;
        remaining = remaining.slice(9);
    }
    else
        remaining = remaining.replace(/^sets? of /i, '');
    if (parsed.fakeAmulet && /amulet of yendor/i.test(remaining))
        remaining = 'cheap plastic imitation of the Amulet of Yendor';
    parsed.fruitName = original.replace(/^(?:(?:a|an|blessed|cursed|uncursed) |\d+ |part(?:ly|ially) eaten )+/i, '');
    const requested = remaining.toLowerCase();
    parsed.name = ['tricks', 'clothes'].includes(requested) ? requested : makeSingular(requested);
    if (parsed.name !== requested && parsed.count === 1)
        parsed.count = 2;
    return parsed;
}
function parseWishCharges(text, parsed) {
    const index = text.lastIndexOf('(');
    if (text.length <= 1 || index < 0)
        return text;
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
//# sourceMappingURL=wish_parse.js.map