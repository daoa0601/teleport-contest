import { randomInt, randomUUID } from 'node:crypto';
import { LEGAL_CHARACTERS, acceptsCharacter, makeRecipe } from './recipes.mjs';
import { chooseDate } from './calendar.mjs';
import { itemAt } from '../lib/session-types.mjs';
/** Every candidate kind the generator can plan; --kinds entries are
 *  validated against this single list. */
export const GENERATOR_KINDS = ['recipe', 'fuzz', 'explore', 'deep', 'wide', 'deepwide'];
export function parseKind(value) {
    const kind = GENERATOR_KINDS.find(candidate => candidate === value);
    if (kind === undefined)
        throw new Error(`Unknown candidate kind: ${value}`);
    return kind;
}
function characterAt(index) {
    // Interleave roles so even small pilots do not contain just the first role.
    const byRole = new Map();
    for (const character of LEGAL_CHARACTERS) {
        const characters = byRole.get(character.role) ?? [];
        characters.push(character);
        byRole.set(character.role, characters);
    }
    const ordered = [];
    for (let round = 0; ordered.length < LEGAL_CHARACTERS.length; round++) {
        for (const characters of byRole.values())
            if (round < characters.length)
                ordered.push(itemAt(characters, round));
    }
    return itemAt(ordered, index % ordered.length);
}
function chance(percent) { return randomInt(100) < percent; }
function publicOptions(debug) {
    const options = [];
    if (chance(14))
        options.push('!legacy');
    // The debug setup types #levelchange at once, so it must not meet the tutorial question.
    if (debug || chance(27))
        options.push('!tutorial');
    if (chance(86))
        options.push('symset:DECgraphics');
    if (chance(80))
        options.push(`suppress_alert:${chance(12) ? '3.3.1' : '3.4.3'}`);
    const pickup = randomInt(100);
    if (pickup < 61)
        options.push('!autopickup');
    else if (pickup < 66)
        options.push('autopickup');
    for (const [option, percent] of [['time', 18], ['color', 18], ['showexp', 18], ['lit_corridor', 14],
        ['pushweapon', 14], ['msg_window:reversed', 9], ['pettype:none', 7], ['!splash_screen', 7],
        ['!verbose', 5], ['runmode:walk', 5], ['mention_walls', 3]]) {
        if (chance(percent))
            options.push(option);
    }
    if (!debug && chance(25))
        options.push('disclose:yi ya yv yg yc yo');
    return options.join(',');
}
// Each entry is drawn independently; a value list picks one setting.
const WIDE_OPTIONS = [
    [['number_pad:1', 'number_pad:2', 'number_pad:-1'], 8], [['menustyle:traditional', 'menustyle:combination', 'menustyle:partial'], 15],
    [['msg_window:single', 'msg_window:combination', 'msg_window:full'], 12], [['runmode:crawl', 'runmode:teleport', 'runmode:run'], 12],
    [['sortloot:full', 'sortloot:loot', 'sortloot:none'], 15], ['hilite_pet', 15], ['hilite_pile', 12], ['showscore', 12],
    ['!autoquiver', 8], ['autoquiver', 8], ['rest_on_space', 8], ['!sparkle', 10], ['standout', 8], ['!safe_pet', 6], ['!confirm', 6],
    ['autodig', 8], ['!autoopen', 8], [['fruit:kumquat', 'fruit:slime mold', 'fruit:lembas', 'fruit:crème brûlée', 'fruit:piña', 'fruit:jalapeño'], 10], ['packorder:")[%?+!=/(*`0_', 6],
    [['pickup_types:$?!/="+', 'pickup_types:$', 'pickup_types:all'], 12], [['pickup_burden:unencumbered', 'pickup_burden:overloaded'], 8],
    [['paranoid_confirmation:pray', 'paranoid_confirmation:attack quit', 'paranoid_confirmation:wand-break eat'], 10],
    [['sortpack', '!sortpack'], 8], ['!implicit_uncursed', 8], [['menu_headings:bold', 'menu_headings:underline'], 8],
    ['showrace', 8], ['force_invmenu', 6],
    [['dogname:Fido', 'dogname:Fidø', 'catname:Mïsty', 'catname:Tiger', 'horsename:Shadowfax', 'horsename:Épona'], 10], ['goldX', 6], ['lootabc', 8], ['hitpointbar', 10], ['!travel', 6], ['!mention_walls', 4],
];
// The recorder writes the nethackrc as UTF-8, so a non-ASCII name reaches
// NetHack as multi-byte text; the wide mix sometimes plays one.
const WIDE_NAMES = ['Zoë', 'Ångström', 'Renée', 'Søren', 'José'];
function characterName(optionMix) {
    return optionMix === 'wide' && chance(15) ? itemAt(WIDE_NAMES, randomInt(WIDE_NAMES.length)) : 'Holdout';
}
// Statements beyond OPTIONS, as in the public custom-binds session. The
// symbols avoid the glyphs the wide policy reads (hero, doors, corridors,
// items), and the bindings take keys it rarely sends.
const WIDE_SYMBOLS = ['S_pool:~', 'S_fountain:{', 'S_tree:#', 'S_sink:#', 'S_grave:|', 'S_altar:_'];
const WIDE_BINDS = ['BIND=v:inventory', 'BIND=V:attributes', 'BIND=^R:overview'];
function wideRcLines() {
    const lines = [];
    if (chance(15)) {
        const symbols = WIDE_SYMBOLS.filter(() => chance(40));
        lines.push(`SYMBOLS=${(symbols.length ? symbols : [itemAt(WIDE_SYMBOLS, randomInt(WIDE_SYMBOLS.length))]).join(',')}`);
    }
    if (chance(10))
        lines.push(itemAt(WIDE_BINDS, randomInt(WIDE_BINDS.length)));
    return lines;
}
// One setting per option family: a repeated option is a configuration
// error, so a wide draw replaces the public setting of the same option.
function optionFamily(setting) { return setting.replace(/^!/, '').replace(/:.*$/, ''); }
function wideOptions(debug) {
    const options = new Map(publicOptions(debug).split(',').filter(Boolean).map(setting => [optionFamily(setting), setting]));
    for (const [choice, percent] of WIDE_OPTIONS) {
        if (!chance(percent))
            continue;
        const setting = typeof choice === 'string' ? choice : itemAt(choice, randomInt(choice.length));
        options.delete(optionFamily(setting));
        options.set(optionFamily(setting), setting);
    }
    return [...options.values()].join(',');
}
function publicDisplayOptions() {
    const options = [];
    for (const [option, percent] of [['color', 18], ['lit_corridor', 14], ['msg_window:reversed', 9],
        ['showexp', 18], ['pushweapon', 14], ['suppress_alert:3.4.3', 68]]) {
        if (chance(percent))
            options.push(option);
    }
    return options.join(',');
}
export function makeCandidate(index, seeds, kinds, recipes, optionMix = 'fixed', long = false, meta = false, chain = false) {
    const rotation = ['recipe', 'fuzz', 'explore', 'fuzz', 'recipe', 'explore', 'fuzz',
        'explore', 'recipe', 'fuzz', 'explore', 'fuzz', 'recipe', 'explore', 'fuzz',
        'explore', 'recipe', 'fuzz', 'explore', 'fuzz', ...(kinds.includes('deep') ? ['deep'] : [])];
    if (kinds.includes('wide'))
        rotation.push('wide');
    if (kinds.includes('deepwide'))
        rotation.push('deepwide');
    const schedule = rotation.filter(kind => kinds.includes(kind));
    const kind = itemAt(schedule, index % schedule.length);
    let character = characterAt(index);
    // Rotate date slots between ten-session blocks so recipe index and date
    // category do not stay coupled in recipe-only batches.
    const date = chooseDate(index + Math.floor(index / 10), randomInt);
    let seed;
    // Reserve a small range for any fresh-game segments in a recipe.
    do {
        seed = randomInt(10000, 0x7fffffff - 16);
    } while (Array.from({ length: 16 }, (_, offset) => seed + offset).some(seed => seeds.has(seed)));
    for (let offset = 0; offset < 16; offset++)
        seeds.add(seed + offset);
    const spec = { id: randomUUID(), kind, character, date, seed, debug: false };
    let session;
    if (kind === 'recipe') {
        const recipeIndex = Math.floor(index / schedule.length) * schedule.filter(kind => kind === 'recipe').length
            + schedule.slice(0, index % schedule.length).filter(kind => kind === 'recipe').length;
        const recipe = itemAt(recipes, recipeIndex % recipes.length);
        spec.recipe = recipe;
        if (!acceptsCharacter(recipe, character)) {
            const eligible = LEGAL_CHARACTERS.filter(character => acceptsCharacter(recipe, character));
            character = itemAt(eligible, Math.floor(index / schedule.length) % eligible.length);
            spec.character = character;
        }
        session = makeRecipe(recipe, { seed, datetime: date.datetime, character, name: 'Holdout' });
        if (optionMix !== 'fixed') {
            // Recipes script their own keys and check their own messages, so
            // only display options join them: no intro, prompt or message changes.
            const display = publicDisplayOptions();
            spec.options = display;
            if (display)
                for (const segment of session.segments)
                    segment.nethackrc += `OPTIONS=${display}\n`;
        }
        spec.debug = session.segments.some(segment => /playmode:debug/.test(segment.nethackrc));
    }
    else {
        const lengthSlot = Math.floor(index / schedule.length) % 20;
        const ranges = long ? [600, 2000] : lengthSlot < 7 ? [35, 59] : lengthSlot < 12 ? [60, 149]
            : lengthSlot < 17 ? [150, 399] : [400, 1800];
        spec.targetKeys = randomInt(ranges[0], ranges[1] + 1);
        const variants = ['!autopickup,runmode:teleport', 'autopickup,runmode:walk',
            '!autopickup,runmode:run', 'autopickup,showexp', '!autopickup,showexp'];
        spec.options = optionMix === 'wide' ? wideOptions(kind === 'deep' || kind === 'deepwide')
            : optionMix === 'public' ? publicOptions(kind === 'deep' || kind === 'deepwide')
                : `!legacy,!tutorial,!news,symset:DECgraphics,time,${itemAt(variants, Math.floor(index / 10) % variants.length)}`;
        const rc = `OPTIONS=name:${characterName(optionMix)},role:${character.role},race:${character.race},gender:${character.gender},align:${character.align}${spec.options ? `,${spec.options}` : ''}\n`;
        // 'deep' plays the narrow explore policy at a debug-mode depth;
        // 'deepwide' plays the wide policy over the same setup.
        const driver = { kind: kind === 'deep' ? 'explore' : kind === 'deepwide' ? 'wide' : kind,
            seed: randomInt(1, 0x7fffffff), maxSteps: spec.targetKeys,
            ...(kind === 'deepwide' ? { debug: true } : {}), ...(meta ? { meta: true } : {}) };
        if (optionMix === 'wide') {
            const lines = wideRcLines();
            if (lines.length)
                spec.rcLines = lines;
        }
        let nethackrc = rc + (spec.rcLines ?? []).map(line => `${line}\n`).join('');
        if (kind === 'deep' || kind === 'deepwide') {
            spec.debug = true;
            spec.targetDepth = itemAt([3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 35, 40, 45], index % 13);
            spec.targetKeys = itemAt(long ? [800, 1200, 1600, 2000] : [80, 120, 240, 400], Math.floor(index / 13) % 4);
            nethackrc += 'OPTIONS=playmode:debug,disclose:-i -a -v -g -c -o\n';
            driver.maxSteps = spec.targetKeys;
            // teleport.c sends the first cross-dungeon numeric teleport to
            // the Valley. A second request from Gehennom reaches the depth.
            const teleport = `\x16${spec.targetDepth}\r`;
            driver.setup = [{ type: 'keys', dismissMore: true,
                    value: `#levelchange\r20\r${teleport}${spec.targetDepth >= 30 ? teleport : ''}` }];
        }
        if (chain && (kind === 'wide' || kind === 'deepwide')) {
            // A save/restore chain: each segment but the last saves and quits
            // once its share of keys is spent; the next restores that game.
            const count = index % 3 === 0 ? 3 : 2;
            const share = Math.max(30, Math.floor(driver.maxSteps / count));
            spec.segments = count;
            session = { version: 5, segments: Array.from({ length: count }, (_, part) => {
                    const { setup, ...policy } = driver;
                    const segmentDriver = { ...policy, seed: part === 0 ? driver.seed : randomInt(1, 0x7fffffff),
                        maxSteps: share, ...(part === 0 && setup ? { setup } : {}),
                        ...(part < count - 1 ? { finish: [{ type: 'keys', value: 'Sy', dismissMore: true, expectExit: true }] } : {}) };
                    return { seed, datetime: date.datetime, nethackrc, driver: segmentDriver };
                }) };
        }
        else {
            session = { version: 5, segments: [{ seed, datetime: date.datetime, nethackrc, driver }] };
        }
    }
    for (const segment of session.segments) {
        if (!Number.isSafeInteger(segment.seed) || segment.seed < seed || segment.seed >= seed + 16) {
            throw new Error('recipe seed is outside the reserved fresh range');
        }
    }
    return { spec, session };
}
//# sourceMappingURL=candidates.mjs.map