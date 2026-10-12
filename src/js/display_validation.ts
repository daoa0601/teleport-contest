import type { DisplayGlyph, GlyphMetadata } from './display.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}

/** Save memory carries category-specific payloads, not only a printable symbol. */
export function validSavedGlyphMetadata(value: unknown): value is GlyphMetadata {
    if (!isRecord(value)) return false;
    switch (value.kind) {
    case 'terrain':
        return typeof value.terrainName === 'string'
            && (!('wallShape' in value) || isInteger(value.wallShape))
            && (!('horizontal' in value) || typeof value.horizontal === 'boolean');
    case 'monster':
        return (!('mnum' in value) || isInteger(value.mnum))
            && (!('female' in value) || typeof value.female === 'boolean')
            && (!('monsterState' in value) || value.monsterState === 'normal'
                || value.monsterState === 'pet' || value.monsterState === 'detected')
            && (!('piletop' in value) || value.piletop === false);
    case 'object':
        return isInteger(value.otyp)
            && (!('corpsenm' in value) || isInteger(value.corpsenm))
            && (!('female' in value) || typeof value.female === 'boolean')
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

export function validSavedGlyph(value: unknown): value is DisplayGlyph {
    return isRecord(value)
        && typeof value.ch === 'string'
        && isInteger(value.color)
        && (!('dec' in value) || typeof value.dec === 'boolean')
        && (!('decgfx' in value) || typeof value.decgfx === 'boolean')
        && (!('attr' in value) || isInteger(value.attr))
        && validSavedGlyphMetadata(value);
}
