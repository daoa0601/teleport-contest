import type { GameObject } from './object_types.js';
import type { Monster, SavedMonsterTraits } from './monster_types.js';
import type { Room } from './map_types.js';
import type { SavedEntityContext } from './saved_validation.js';
import { validSavedObject } from './object_validation.js';
import { validSavedMonster, validSavedMonsterTraits } from './monster_validation.js';
import { validSavedRoom } from './map_validation.js';

export function createSavedEntityChecks(): SavedEntityContext {
    const context: SavedEntityContext = {
        active: new WeakMap(),
        object: (value): value is GameObject => validSavedObject(value, context),
        monster: (value): value is Monster => validSavedMonster(value, context),
        savedMonster: (value): value is SavedMonsterTraits => validSavedMonsterTraits(value, context),
        room: (value): value is Room => validSavedRoom(value, context),
    };
    return context;
}
