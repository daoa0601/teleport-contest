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
export function makeCandidate(index, seeds, kinds, recipes) {
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
        spec.debug = session.segments.some(segment => /playmode:debug/.test(segment.nethackrc));
    }
    else {
        const lengthSlot = Math.floor(index / schedule.length) % 20;
        const ranges = lengthSlot < 7 ? [35, 59] : lengthSlot < 12 ? [60, 149]
            : lengthSlot < 17 ? [150, 399] : [400, 1800];
        spec.targetKeys = randomInt(ranges[0], ranges[1] + 1);
        const variants = ['!autopickup,runmode:teleport', 'autopickup,runmode:walk',
            '!autopickup,runmode:run', 'autopickup,showexp', '!autopickup,showexp'];
        spec.options = itemAt(variants, Math.floor(index / 10) % variants.length);
        const rc = `OPTIONS=name:Holdout,role:${character.role},race:${character.race},gender:${character.gender},align:${character.align},!legacy,!tutorial,!news,symset:DECgraphics,time,${spec.options}\n`;
        // 'deep' plays the narrow explore policy at a debug-mode depth;
        // 'deepwide' plays the wide policy over the same setup.
        const driver = { kind: kind === 'deep' ? 'explore' : kind === 'deepwide' ? 'wide' : kind,
            seed: randomInt(1, 0x7fffffff), maxSteps: spec.targetKeys,
            ...(kind === 'deepwide' ? { debug: true } : {}) };
        let nethackrc = rc;
        if (kind === 'deep' || kind === 'deepwide') {
            spec.debug = true;
            spec.targetDepth = itemAt([3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 35, 40, 45], index % 13);
            spec.targetKeys = itemAt([80, 120, 240, 400], Math.floor(index / 13) % 4);
            nethackrc += 'OPTIONS=playmode:debug,disclose:-i -a -v -g -c -o\n';
            driver.maxSteps = spec.targetKeys;
            // teleport.c sends the first cross-dungeon numeric teleport to
            // the Valley. A second request from Gehennom reaches the depth.
            const teleport = `\x16${spec.targetDepth}\r`;
            driver.setup = [{ type: 'keys', dismissMore: true,
                    value: `#levelchange\r20\r${teleport}${spec.targetDepth >= 30 ? teleport : ''}` }];
        }
        session = { version: 5, segments: [{ seed, datetime: date.datetime, nethackrc, driver }] };
    }
    for (const segment of session.segments) {
        if (!Number.isSafeInteger(segment.seed) || segment.seed < seed || segment.seed >= seed + 16) {
            throw new Error('recipe seed is outside the reserved fresh range');
        }
    }
    return { spec, session };
}
//# sourceMappingURL=candidates.mjs.map