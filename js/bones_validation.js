import { decodeSavedGraph, isSavedRecord } from './saved_graph.js';
import { createSavedEntityChecks } from './entity_validation.js';
import { arrayOf, closedFieldsMatch as fieldsMatch, integer, string } from './saved_validation.js';
import { restoreSavedMap, validSavedPosition, validSavedStairways } from './map_validation.js';
function validFruit(value) {
    return fieldsMatch(value, { fid: integer, fname: string });
}
export function decodeBonesPayload(encoded, expectedVersion) {
    const value = decodeSavedGraph(encoded);
    if (!isSavedRecord(value) || value.version !== expectedVersion)
        throw new TypeError('Bones use an unsupported save version');
    for (const key of Object.keys(value)) {
        if (key !== 'version' && key !== 'level' && key !== 'stairs'
            && key !== 'heroTrack' && key !== 'fruits' && key !== 'savedAt')
            throw new TypeError(`Bones contain unsupported field ${key.slice(0, 80)}`);
    }
    if (!integer(value.savedAt))
        throw new TypeError('Bones contain an invalid save time');
    if (!validSavedStairways(value.stairs))
        throw new TypeError('Bones contain invalid stairways');
    if (!arrayOf(validSavedPosition)(value.heroTrack))
        throw new TypeError('Bones contain an invalid hero trail');
    if (!arrayOf(validFruit)(value.fruits))
        throw new TypeError('Bones contain invalid fruit definitions');
    return {
        version: expectedVersion,
        savedAt: value.savedAt,
        level: restoreSavedMap(value.level, createSavedEntityChecks()),
        stairs: value.stairs,
        heroTrack: value.heroTrack,
        fruits: value.fruits,
    };
}
//# sourceMappingURL=bones_validation.js.map