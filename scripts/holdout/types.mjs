import { arrayValue, booleanValue, numberValue, objectValue, stringValue } from '../lib/session-types.mjs';
export function decodeGeneratorKind(value) {
    if (value === 'recipe' || value === 'fuzz' || value === 'explore' || value === 'deep')
        return value;
    throw new Error('generator kind must be recipe, fuzz, explore, or deep');
}
function decodeDateCategory(value) {
    if (value === 'ordinary' || value === 'fullMoon' || value === 'newMoon' || value === 'friday13' || value === 'night')
        return value;
    throw new Error('invalid calendar category');
}
function decodeCandidate(value) {
    const data = objectValue(value, 'candidate');
    const character = objectValue(data.character, 'character');
    const date = objectValue(data.date, 'date');
    const spec = { id: stringValue(data.id, 'id'), kind: decodeGeneratorKind(data.kind),
        character: { role: stringValue(character.role, 'role'), race: stringValue(character.race, 'race'), gender: stringValue(character.gender, 'gender'), align: stringValue(character.align, 'align') },
        date: { datetime: stringValue(date.datetime, 'datetime'), category: decodeDateCategory(date.category), moon: numberValue(date.moon, 'moon'),
            friday13: booleanValue(date.friday13, 'friday13'), night: booleanValue(date.night, 'night'), midnight: booleanValue(date.midnight, 'midnight') },
        seed: numberValue(data.seed, 'seed'), debug: booleanValue(data.debug, 'debug') };
    if (data.recipe !== undefined)
        spec.recipe = stringValue(data.recipe, 'recipe');
    if (data.targetKeys !== undefined)
        spec.targetKeys = numberValue(data.targetKeys, 'targetKeys');
    if (data.targetDepth !== undefined)
        spec.targetDepth = numberValue(data.targetDepth, 'targetDepth');
    if (data.options !== undefined)
        spec.options = stringValue(data.options, 'options');
    if (spec.kind === 'recipe' && !spec.recipe)
        throw new Error('recipe candidate needs a recipe name');
    if (spec.kind === 'deep' && spec.targetDepth === undefined)
        throw new Error('deep candidate needs a target depth');
    return spec;
}
function strings(value, label) { return arrayValue(value, label).map(item => stringValue(item, label)); }
function decodeMetrics(value) {
    const data = objectValue(value, 'metrics');
    const promptKinds = {};
    for (const [kind, count] of Object.entries(objectValue(data.promptKinds, 'prompt kinds')))
        promptKinds[kind] = numberValue(count, kind);
    return { segments: numberValue(data.segments, 'segments'), steps: numberValue(data.steps, 'steps'), keys: numberValue(data.keys, 'keys'), rngCalls: numberValue(data.rngCalls, 'rngCalls'),
        gameplayScreens: numberValue(data.gameplayScreens, 'gameplayScreens'), maxDepth: numberValue(data.maxDepth, 'maxDepth'), maxTurn: numberValue(data.maxTurn, 'maxTurn'),
        maxExperienceLevel: numberValue(data.maxExperienceLevel, 'maxExperienceLevel'), promptKinds, endings: strings(data.endings, 'endings'), levels: strings(data.levels, 'levels'),
        animationFrames: numberValue(data.animationFrames, 'animationFrames'), ...(data.recipeChecks === undefined ? {} : { recipeChecks: strings(data.recipeChecks, 'recipeChecks') }) };
}
function decodePending(value) {
    const data = objectValue(value, 'pending recording');
    return { spec: decodeCandidate(data.spec), file: stringValue(data.file, 'file') };
}
export function decodeManifest(value) {
    const data = objectValue(value, 'holdout manifest');
    if (data.version !== 1 || data.tier !== 'dev-private' || data.sealed !== false)
        throw new Error('expected a version-1 development holdout manifest');
    const configuration = objectValue(data.configuration, 'configuration');
    return { version: 1, tier: 'dev-private', sealed: false, created: stringValue(data.created, 'created'),
        ...(data.updated === undefined ? {} : { updated: stringValue(data.updated, 'updated') }),
        attempts: numberValue(data.attempts, 'attempts'), configuration: {
            kinds: arrayValue(configuration.kinds, 'kinds').map(decodeGeneratorKind),
            ...(configuration.recipes === undefined ? {} : { recipes: strings(configuration.recipes, 'recipes') }),
        },
        pending: arrayValue(data.pending, 'pending').map(decodePending),
        accepted: arrayValue(data.accepted, 'accepted').map(value => { const row = objectValue(value, 'accepted recording'); return { ...decodePending(row), metrics: decodeMetrics(row.metrics) }; }),
        rejected: arrayValue(data.rejected, 'rejected').map(value => { const row = objectValue(value, 'rejected recording'); return { spec: decodeCandidate(row.spec), reason: stringValue(row.reason, 'reason'), ...(row.diagnostic === undefined ? {} : { diagnostic: stringValue(row.diagnostic, 'diagnostic') }) }; }) };
}
//# sourceMappingURL=types.mjs.map