import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as objectData from '../js/object_data.js';
const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolDirectory, '..');
const sourcePath = path.join(projectDirectory, 'nethack-c', 'upstream', 'include', 'artilist.h');
const outputPath = path.join(projectDirectory, 'src', 'js', 'artifact_data.ts');
function field(values, index) {
    const value = values[index];
    if (value === undefined)
        throw new Error(`Missing artifact field ${index}`);
    return value;
}
function omitDisabledBlocks(source) {
    const kept = [];
    let disabledDepth = 0;
    for (const line of source.split('\n')) {
        if (/^\s*#if\s+0\b/.test(line)) {
            disabledDepth = 1;
            continue;
        }
        if (disabledDepth > 0) {
            if (/^\s*#if\b/.test(line))
                disabledDepth++;
            if (/^\s*#endif\b/.test(line))
                disabledDepth--;
            continue;
        }
        kept.push(line);
    }
    return kept.join('\n');
}
function artifactCalls(source) {
    const calls = [];
    const pattern = /^\s*A\(/gm;
    let match;
    while ((match = pattern.exec(source))) {
        const start = source.indexOf('(', match.index) + 1;
        let depth = 1;
        let quoted = false;
        let escaped = false;
        let end = start;
        for (; end < source.length && depth > 0; end++) {
            const character = source[end];
            if (quoted) {
                if (escaped)
                    escaped = false;
                else if (character === '\\')
                    escaped = true;
                else if (character === '"')
                    quoted = false;
                continue;
            }
            if (character === '"')
                quoted = true;
            else if (character === '(')
                depth++;
            else if (character === ')')
                depth--;
        }
        if (depth !== 0)
            throw new Error('Unclosed A() record in artilist.h');
        calls.push(source.slice(start, end - 1));
        pattern.lastIndex = end;
    }
    return calls;
}
function fields(call) {
    const result = [];
    let start = 0;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < call.length; index++) {
        const character = call[index];
        if (quoted) {
            if (escaped)
                escaped = false;
            else if (character === '\\')
                escaped = true;
            else if (character === '"')
                quoted = false;
            continue;
        }
        if (character === '"')
            quoted = true;
        else if (character === '(')
            depth++;
        else if (character === ')')
            depth--;
        else if (character === ',' && depth === 0) {
            result.push(call.slice(start, index).trim());
            start = index + 1;
        }
    }
    result.push(call.slice(start).trim());
    return result;
}
const attackNames = {
    PHYS: 'physical',
    DRLI: 'life-drain',
    COLD: 'cold',
    FIRE: 'fire',
    ELEC: 'shock',
    STUN: 'stun',
    POIS: 'poison',
};
const defenseNames = {
    AD_BLND: 'blindness',
    AD_COLD: 'cold',
    AD_DRLI: 'life-drain',
    AD_FIRE: 'fire',
    AD_MAGM: 'magic',
    AD_WERE: 'lycanthropy',
};
const invokeNames = {
    0: null,
    BANISH: 'banish',
    BLINDING_RAY: 'blinding-ray',
    CHARGE_OBJ: 'charge-object',
    CONFLICT: 'conflict',
    CREATE_AMMO: 'create-ammo',
    CREATE_PORTAL: 'create-portal',
    ENERGY_BOOST: 'energy-boost',
    ENLIGHTENING: 'enlightening',
    FIRESTORM: 'firestorm',
    FLING_POISON: 'fling-poison',
    HEALING: 'healing',
    INVIS: 'invisibility',
    LEVITATION: 'levitation',
    LEV_TELE: 'level-teleport',
    SNOWSTORM: 'snowstorm',
    TAMING: 'taming',
    UNTRAP: 'untrap',
};
function specialFlags(expression) {
    return expression.match(/SPFX_\w+/g) || [];
}
function damageType(expression, emptyName) {
    if (expression === emptyName)
        return null;
    const defense = /^(?:DFNS|CARY)\(\s*(AD_\w+)\s*\)$/.exec(expression);
    if (defense) {
        const name = field(defense, 1);
        return defenseNames[name] ?? name;
    }
    const attack = /^(\w+)\(/.exec(expression);
    const name = attack ? attackNames[field(attack, 1)] : undefined;
    if (name !== undefined)
        return name;
    throw new Error(`Cannot read artifact damage type: ${expression}`);
}
function targetFrom(flags, mtype) {
    let target = { kind: 'all' };
    if (flags.includes('SPFX_DMONS'))
        target = { kind: 'monster', value: mtype };
    else if (flags.includes('SPFX_DCLAS'))
        target = { kind: 'symbol', value: mtype };
    else if (flags.includes('SPFX_DFLAG1'))
        target = { kind: 'flag1', value: mtype };
    else if (flags.includes('SPFX_DFLAG2'))
        target = { kind: 'flag2', value: mtype };
    else if (flags.includes('SPFX_DALIGN'))
        target = { kind: 'alignment' };
    else if (flags.includes('SPFX_ATTK'))
        target = { kind: 'resistance' };
    return target;
}
function attackRecord(expression) {
    if (expression === 'NO_ATTK')
        return null;
    const attack = /^(\w+)\(\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(expression);
    const damageType = attack ? attackNames[field(attack, 1)] : undefined;
    if (!attack || damageType === undefined)
        throw new Error(`Cannot read artifact attack: ${expression}`);
    return {
        damageType,
        toHitDie: Number(attack[2]),
        damageDie: Number(attack[3]),
    };
}
function alignmentName(value) {
    const names = {
        A_LAWFUL: 1,
        A_NEUTRAL: 0,
        A_CHAOTIC: -1,
        A_NONE: null,
    };
    return names[value];
}
function creatureName(value, exceptions = {}) {
    if (value === 'NON_PM')
        return null;
    return exceptions[value]
        || value.replace(/^PM_/, '').replaceAll('_', '-').toLowerCase();
}
function integer(value) {
    const result = Number(value.replace(/L$/, ''));
    if (!Number.isInteger(result))
        throw new Error(`Invalid artifact integer: ${value}`);
    return result;
}
const objectConstants = new Map();
for (const [name, value] of Object.entries(objectData)) {
    if (typeof value === 'number' && Number.isInteger(value))
        objectConstants.set(name, value);
}
function objectType(sourceName) {
    const definedType = objectConstants.get(sourceName);
    if (definedType !== undefined)
        return definedType;
    const wanted = sourceName.replace(/[^A-Z0-9]/g, '').toLowerCase();
    return objectData.OBJECT_NAMES.findIndex(name => name?.replace(/[^A-Z0-9]/gi, '').toLowerCase() === wanted);
}
function artifactRecord(parts, id) {
    if (parts.length !== 17)
        throw new Error(`Expected 17 A() fields, found ${parts.length}`);
    if (!field(parts, 0).startsWith('"') || field(parts, 0) === '""')
        return null;
    const name = JSON.parse(field(parts, 0));
    if (typeof name !== 'string')
        throw new Error(`Expected artifact name at row ${id}`);
    const baseType = objectType(field(parts, 1));
    if (baseType < 0)
        throw new Error(`Unknown object type for ${name}: ${field(parts, 1)}`);
    const flags = specialFlags(field(parts, 2));
    const carriedFlags = specialFlags(field(parts, 3));
    const invokePower = invokeNames[field(parts, 8)];
    if (invokePower === undefined)
        throw new Error(`Unknown invoke power for ${name}: ${field(parts, 8)}`);
    const alignment = alignmentName(field(parts, 9));
    if (alignment === undefined)
        throw new Error(`Unknown alignment for ${name}: ${field(parts, 9)}`);
    return {
        id,
        name,
        enumName: field(parts, 16),
        baseType,
        flags,
        carriedFlags,
        target: targetFrom(flags, field(parts, 4)),
        attack: attackRecord(field(parts, 5)),
        defense: damageType(field(parts, 6), 'NO_DFNS'),
        carriedDefense: damageType(field(parts, 7), 'NO_CARY'),
        invokePower,
        alignment,
        role: creatureName(field(parts, 10), {
            PM_CAVE_DWELLER: 'caveman',
            PM_CLERIC: 'priest',
        }),
        race: creatureName(field(parts, 11)),
        generationEnchantment: integer(field(parts, 12)),
        giftValue: integer(field(parts, 13)),
        cost: integer(field(parts, 14)),
        color: field(parts, 15),
    };
}
function formatRecord(record) {
    return [
        '    {',
        `        id: ${record.id}, name: ${JSON.stringify(record.name)},`,
        `        enumName: ${JSON.stringify(record.enumName)}, baseType: ${record.baseType},`,
        `        flags: ${JSON.stringify(record.flags)},`,
        `        carriedFlags: ${JSON.stringify(record.carriedFlags)},`,
        `        target: ${JSON.stringify(record.target)},`,
        `        attack: ${JSON.stringify(record.attack)},`,
        `        defense: ${JSON.stringify(record.defense)}, carriedDefense: ${JSON.stringify(record.carriedDefense)},`,
        `        invokePower: ${JSON.stringify(record.invokePower)}, alignment: ${JSON.stringify(record.alignment)},`,
        `        role: ${JSON.stringify(record.role)}, race: ${JSON.stringify(record.race)},`,
        `        generationEnchantment: ${record.generationEnchantment}, giftValue: ${record.giftValue},`,
        `        cost: ${record.cost}, color: ${JSON.stringify(record.color)},`,
        '    },',
    ].join('\n');
}
const source = omitDisabledBlocks(fs.readFileSync(sourcePath, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const records = artifactCalls(source)
    .map((call, index) => artifactRecord(fields(call), index))
    .filter(record => record !== null);
if (records.length !== 33)
    throw new Error(`Expected 33 active artifacts, found ${records.length}`);
const output = `// Generated by tools/gen-artifacts.mjs.
// Source: nethack-c/upstream/include/artilist.h.

import type { ArtifactDefinition } from './data_types.js';

export const ARTIFACT_DATA: readonly ArtifactDefinition[] = [
${records.map(formatRecord).join('\n')}
];
`;
fs.writeFileSync(outputPath, output);
//# sourceMappingURL=gen-artifacts.mjs.map