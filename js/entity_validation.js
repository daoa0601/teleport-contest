import { validSavedObject } from './object_validation.js';
import { validSavedMonster, validSavedMonsterTraits } from './restore.js';
import { validSavedRoom } from './map_validation.js';
// Port only: builds the recursive saved-entity validation context.
export function createSavedEntityChecks() {
    const context = {
        active: new WeakMap(),
        object: (value) => validSavedObject(value, context),
        monster: (value) => validSavedMonster(value, context),
        savedMonster: (value) => validSavedMonsterTraits(value, context),
        room: (value) => validSavedRoom(value, context),
    };
    return context;
}
//# sourceMappingURL=entity_validation.js.map