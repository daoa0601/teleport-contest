// Named fruit identities. C options.c:fruitadd()/optfn_fruit(),
// objnam.c:fruit_from_name()/fruit_from_indx()/fruitname().
import { game } from './gstate.js';
import { nameToMonster } from './mondata.js';
import { OBJECT_NAMES, getObjectClassBounds } from './object_data.js';
import { makePlural, makeSingular } from './object_grammar.js';
import { rnd } from './rng.js';
const FRUIT_NAME_BYTES = 31; // PL_FSIZ includes the trailing NUL.
export function initializeFruitRegistry(name = 'slime mold', state = game) {
    state.fruits = [];
    state.fruitName = normalizePreferredFruitName(name, state);
    addFruit(state.fruitName, { preferred: true, initial: true, state });
}
export function normalizePreferredFruitName(name, state = game) {
    const firstLine = String(name).split('\n', 1)[0] ?? '';
    const spaced = firstLine.replace(/\t/g, ' ')
        .replace(/ +/g, ' ').replace(/^ | $/g, '');
    return sanitizedFruitName(spaced.split(',', 1)[0] ?? '', state) || 'slime mold';
}
// Runtime option changes can rename an unused current entry. Once an object
// or mimic represents it, its existing identity remains part of the history.
export function changePreferredFruit(name, state = game) {
    const value = (String(name).split('\n', 1)[0] ?? '').replace(/\t/g, ' ')
        .replace(/ +/g, ' ').replace(/^ | $/g, '');
    const existing = fruitFromName(value, { state });
    const replacement = !existing && !state.flags.made_fruit
        ? fruitFromName(preferredFruitName(state), { state }) : null;
    if (!existing && !replacement && highestFruitId(state) >= 100)
        return { changed: false, message: "Doing that so many times isn't very fruitful." };
    state.fruitName = normalizePreferredFruitName(value, state);
    addFruit(state.fruitName, { preferred: true, replacement, state });
    return { changed: true, message: `Fruit is now "${state.fruitName}".` };
}
// External names (bones and orc loot) already have their singular identity;
// adding one never changes the player's preferred fruit.
export function addFruit(name, { preferred = false, initial = false, replacement = null, state = game } = {}) {
    let value;
    if (preferred) {
        value = sanitizeUserFruit(name, initial);
        state.fruitName = value;
        state.flags.made_fruit = false;
        if (replacement) {
            replacement.fname = value;
            state.context.current_fruit = replacement.fid;
            return replacement.fid;
        }
    }
    else {
        value = sanitizedFruitName(name, state);
        state.flags.made_fruit = true;
    }
    const existing = fruitFromName(value, { state });
    if (existing) {
        if (preferred)
            state.context.current_fruit = existing.fid;
        return existing.fid;
    }
    const highest = highestFruitId(state);
    if (highest >= 127)
        return rnd(127);
    const fruit = { fid: highest + 1, fname: value };
    fruitRegistry(state).unshift(fruit);
    if (preferred)
        state.context.current_fruit = fruit.fid;
    return fruit.fid;
}
export function fruitFromIndex(id, state = game) {
    return fruitRegistry(state).find(fruit => fruit.fid === id) || null;
}
export function fruitFromName(name, { exact = false, state = game } = {}) {
    const found = fruitRegistry(state).find(fruit => fruit.fname === name);
    if (found)
        return found;
    if (!exact) {
        const prefix = longestFruitPrefix(name, state);
        if (prefix)
            return prefix;
    }
    const singular = makeSingular(name);
    const singularMatch = fruitRegistry(state).find(fruit => fruit.fname === singular);
    if (singularMatch || exact)
        return singularMatch || null;
    let result = null;
    for (const fruit of fruitRegistry(state)) {
        const afterName = name.indexOf(' ', fruit.fname.length);
        if (name.length < fruit.fname.length || afterName < 0)
            continue;
        const prefix = makeSingular(name.slice(0, afterName));
        if (prefix === fruit.fname && (!result || prefix.length > result.fname.length))
            result = fruit;
    }
    return result;
}
export function fruitName(juice = false, state = game) {
    const preferred = preferredFruitName(state);
    const of = preferred.toLowerCase().indexOf(' of ');
    const name = makeSingular(of >= 0 ? preferred.slice(of + 4) : preferred);
    return name + (juice ? ' juice' : '');
}
// readobjnam_postparse3 has a distinct, case-sensitive fruit namespace.
// Already plural external fruit labels are valid, so compare both forms.
export function matchWishedFruit(name, state = game) {
    for (const fruit of fruitRegistry(state)) {
        if (name === fruit.fname)
            return { fruit, count: 0 };
        if (name === makeSingular(fruit.fname))
            return { fruit, count: 1 };
        if (name === makePlural(fruit.fname))
            return { fruit, count: 2 };
    }
    return null;
}
function longestFruitPrefix(name, state) {
    let result = null;
    for (const fruit of fruitRegistry(state)) {
        if (name.startsWith(fruit.fname)
            && (name.length === fruit.fname.length || name[fruit.fname.length] === ' ')
            && (!result || fruit.fname.length > result.fname.length))
            result = fruit;
    }
    return result;
}
function highestFruitId(state) {
    return fruitRegistry(state).reduce((highest, fruit) => Math.max(highest, fruit.fid), 0);
}
function sanitizedFruitName(name, state) {
    const bytes = new TextEncoder().encode(String(name)).slice(0, FRUIT_NAME_BYTES);
    return [...bytes].map(byte => {
        const low = byte & 127;
        if (low < 32 || low === 127)
            return '.';
        return byte > 127 && !state.iflags?.wc_eight_bit_input ? '_' : String.fromCharCode(byte);
    }).join('');
}
function sanitizeUserFruit(name, initial) {
    let value = (makeSingular(name).split(',', 1)[0] ?? '').slice(0, FRUIT_NAME_BYTES);
    const size = value.startsWith('small ') || value.startsWith('large ') ? 6
        : value.startsWith('medium ') ? 7 : value.startsWith('very large ') ? 11 : 0;
    const { first, last } = getObjectClassBounds(7);
    const foodNames = OBJECT_NAMES.slice(first, last + 1);
    // initoptions_finish precedes init_objects: C's food-class bases are
    // still zero, so the food-name conflict check starts at runtime.
    const food = !initial && foodNames.some(foodName => {
        const actual = foodName === 'slime mold' ? 'fruit' : foodName;
        return actual === value || size && actual === value.slice(size);
    });
    const numeric = /^\d*(?:$|\s)/.test(value);
    const monsterTin = value.startsWith('tin of ')
        && (value.slice(7) === 'spinach' || nameToMonster(value.slice(7)) >= 0);
    const monsterProduct = /(?: corpse| egg)$/.test(value) && nameToMonster(value) >= 0;
    if (food || numeric || /^(?:cursed |uncursed |blessed |partly eaten )/.test(value)
        || monsterTin || value === 'empty tin' || value === 'glob'
        || size && value.slice(size) === 'glob' || monsterProduct)
        value = `candied ${value}`.slice(0, FRUIT_NAME_BYTES);
    return value;
}
function fruitRegistry(state) {
    if (!state.fruits)
        throw new Error('Fruit registry has not been initialized');
    return state.fruits;
}
function preferredFruitName(state) {
    if (state.fruitName === undefined)
        throw new Error('Preferred fruit has not been initialized');
    return state.fruitName;
}
//# sourceMappingURL=fruit.js.map