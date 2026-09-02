// Object ownership inside containers.
// C ref: mkobj.c:add_to_container().

import { game } from './gstate.js';
import { mergable, mergeObjectStacks } from './object_merge.js';

export function addObjectToContainer(container, object, state = game) {
    if (!container || !object) return object;
    container.contents ||= [];
    const existing = container.contents.find(candidate =>
        mergable(candidate, object, state));
    if (existing) return mergeObjectStacks(existing, object, state);

    object.where = 'contained';
    object.container = container;
    object.ox = 0;
    object.oy = 0;
    container.contents.unshift(object);
    return object;
}
