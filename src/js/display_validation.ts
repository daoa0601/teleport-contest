import type { DisplayGlyph, GlyphMetadata } from './display.js';
import { GlyphOffset } from './glyph_numbers.js';
import { ismnum } from './const.js';

// Port only: type guard for decoded JSON records.
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Port only: type guard for integer fields of decoded records.
function isInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}

/** Save memory carries category-specific payloads, not only a printable symbol. */
// Port only: validates glyph metadata decoded from saved state.
export function validSavedGlyphMetadata(value: unknown): value is GlyphMetadata {
    if (!isRecord(value)) return false;
    if ('glyph' in value && (!isInteger(value.glyph)
        || value.glyph < 0 || value.glyph >= GlyphOffset.max)) return false;
    switch (value.kind) {
    case 'terrain':
        return typeof value.terrainName === 'string';
    case 'monster':
        return (!('mnum' in value) || isInteger(value.mnum))
            && (!('piletop' in value) || value.piletop === false);
    case 'object':
        return isInteger(value.otyp)
            && (!('corpsenm' in value) || ismnum(value.corpsenm))
            && (!('statueGlyph' in value) || typeof value.statueGlyph === 'boolean')
            && (!('piletop' in value) || typeof value.piletop === 'boolean');
    case 'trap':
        return isInteger(value.trapType);
    case 'nothing':
    case 'engraving':
    case 'invisible':
    case 'effect':
    case 'warning':
    case 'unexplored':
        return true;
    default:
        return false;
    }
}

// Port only: validates a saved display glyph at the storage boundary.
export function validSavedGlyph(value: unknown): value is DisplayGlyph {
    return isRecord(value)
        && typeof value.ch === 'string'
        && isInteger(value.color)
        && (!('dec' in value) || typeof value.dec === 'boolean')
        && (!('decgfx' in value) || typeof value.decgfx === 'boolean')
        && (!('attr' in value) || isInteger(value.attr))
        && validSavedGlyphMetadata(value);
}
