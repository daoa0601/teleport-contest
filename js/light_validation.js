import { boolean, closedFieldsMatch, integer } from './saved_validation.js';
// Port only: validate the cached light.c light_source fields at save boundaries.
export function validSavedLightSourcePosition(value) {
    return closedFieldsMatch(value, { x: integer, y: integer, show: boolean });
}
//# sourceMappingURL=light_validation.js.map