// Saved coordinates and display flag of a mobile light source.
import type { LightSourcePosition } from './light.js';
import { boolean, closedFieldsMatch, integer } from './saved_validation.js';

// Port only: validate the cached light.c light_source fields at save boundaries.
export function validSavedLightSourcePosition(value: unknown): value is LightSourcePosition {
    return closedFieldsMatch<LightSourcePosition>(value, { x: integer, y: integer, show: boolean });
}
