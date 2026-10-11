#!/usr/bin/env node
// Keep JavaScript monster attack and damage identifiers aligned with the
// pinned NetHack header. Numeric values are part of the monster data format.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, 'nethack-c/upstream/include/monattk.h');
const targetPath = join(root, 'src/js/monster_attack_types.ts');
function readDefinitions(source) {
    const definitions = [];
    const pattern = /^#define\s+((?:AT|AD)_[A-Z0-9_]+)\s+(?:\((-?\d+)\)|(-?\d+))(?=\s|$)/gm;
    for (const match of source.matchAll(pattern)) {
        const name = match[1];
        if (name === undefined)
            throw new Error(`Missing attack name: ${match[0]}`);
        definitions.push({
            name,
            value: Number(match[2] ?? match[3]),
        });
    }
    return definitions;
}
function generateModule(definitions) {
    const attackTypes = definitions.filter(({ name }) => name.startsWith('AT_'));
    const damageTypes = definitions.filter(({ name }) => name.startsWith('AD_'));
    if (!attackTypes.length || !damageTypes.length)
        throw new Error('monattk.h contains no attack or damage definitions');
    const lines = [
        '// Generated from nethack-c/upstream/include/monattk.h.',
        '// Run npm run generate:monster-attacks after updating the pinned C source.',
        '',
        ...attackTypes.map(({ name, value }) => `export const ${name} = ${value};`),
        '',
        ...damageTypes.map(({ name, value }) => `export const ${name} = ${value};`),
        '',
        unionType('AttackMethod', attackTypes),
        '',
        unionType('DamageType', damageTypes),
        '',
    ];
    return lines.join('\n');
}
function unionType(name, definitions) {
    const members = definitions.filter(definition => !definition.name.endsWith('_ANY'))
        .map(definition => `typeof ${definition.name}`);
    return `export type ${name} =\n    ${members.join('\n    | ')};`;
}
const source = readFileSync(sourcePath, 'utf8');
writeFileSync(targetPath, generateModule(readDefinitions(source)));
//# sourceMappingURL=generate-monster-attack-types.mjs.map