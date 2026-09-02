import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as objectData from '../js/object_data.js';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolDirectory, '..');
const sourcePath = path.join(
    projectDirectory, 'nethack-c', 'upstream', 'include', 'artilist.h',
);
const outputPath = path.join(
    projectDirectory, 'js', 'artifact_data.js',
);

function omitDisabledBlocks(source) {
    const kept = [];
    let disabledDepth = 0;
    for (const line of source.split('\n')) {
        if (/^\s*#if\s+0\b/.test(line)) {
            disabledDepth = 1;
            continue;
        }
        if (disabledDepth > 0) {
            if (/^\s*#if\b/.test(line)) disabledDepth++;
            if (/^\s*#endif\b/.test(line)) disabledDepth--;
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
                if (escaped) escaped = false;
                else if (character === '\\') escaped = true;
                else if (character === '"') quoted = false;
                continue;
            }
            if (character === '"') quoted = true;
            else if (character === '(') depth++;
            else if (character === ')') depth--;
        }
        if (depth !== 0) throw new Error('Unclosed A() record in artilist.h');
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
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') quoted = false;
            continue;
        }
        if (character === '"') quoted = true;
        else if (character === '(') depth++;
        else if (character === ')') depth--;
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
    if (expression === emptyName) return null;
    const defense = /^(?:DFNS|CARY)\(\s*(AD_\w+)\s*\)$/.exec(expression);
    if (defense) return defenseNames[defense[1]] || defense[1];
    const attack = /^(\w+)\(/.exec(expression);
    if (attack && attackNames[attack[1]]) return attackNames[attack[1]];
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

function attackRecord(expression, flags, mtype) {
    if (expression === 'NO_ATTK') return null;
    const attack = /^(\w+)\(\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(expression);
    if (!attack || !attackNames[attack[1]])
        throw new Error(`Cannot read artifact attack: ${expression}`);

    return {
        damageType: attackNames[attack[1]],
        toHitDie: Number(attack[2]),
        damageDie: Number(attack[3]),
        target: targetFrom(flags, mtype),
    };
}

function alignmentName(value) {
    return {
        A_LAWFUL: 1,
        A_NEUTRAL: 0,
        A_CHAOTIC: -1,
        A_NONE: null,
    }[value];
}

function creatureName(value, exceptions = {}) {
    if (value === 'NON_PM') return null;
    return exceptions[value]
        || value.replace(/^PM_/, '').replaceAll('_', '-').toLowerCase();
}

function integer(value) {
    return Number(value.replace(/L$/, ''));
}

function objectType(sourceName) {
    if (Number.isInteger(objectData[sourceName])) return objectData[sourceName];
    const wanted = sourceName.replace(/[^A-Z0-9]/g, '').toLowerCase();
    return objectData.OBJECT_NAMES.findIndex(name =>
        name?.replace(/[^A-Z0-9]/gi, '').toLowerCase() === wanted);
}

function artifactRecord(parts, id) {
    if (parts.length !== 17)
        throw new Error(`Expected 17 A() fields, found ${parts.length}`);
    if (!parts[0].startsWith('"') || parts[0] === '""') return null;

    const name = JSON.parse(parts[0]);
    const baseType = objectType(parts[1]);
    if (baseType < 0)
        throw new Error(`Unknown object type for ${name}: ${parts[1]}`);
    const flags = specialFlags(parts[2]);
    const carriedFlags = specialFlags(parts[3]);
    const invokePower = invokeNames[parts[8]];
    if (invokePower === undefined)
        throw new Error(`Unknown invoke power for ${name}: ${parts[8]}`);
    const alignment = alignmentName(parts[9]);
    if (alignment === undefined)
        throw new Error(`Unknown alignment for ${name}: ${parts[9]}`);

    return {
        id,
        name,
        enumName: parts[16],
        baseType,
        flags,
        carriedFlags,
        attack: attackRecord(parts[5], flags, parts[4]),
        defense: damageType(parts[6], 'NO_DFNS'),
        carriedDefense: damageType(parts[7], 'NO_CARY'),
        invokePower,
        alignment,
        role: creatureName(parts[10], {
            PM_CAVE_DWELLER: 'caveman',
            PM_CLERIC: 'priest',
        }),
        race: creatureName(parts[11]),
        generationEnchantment: integer(parts[12]),
        giftValue: integer(parts[13]),
        cost: integer(parts[14]),
        color: parts[15],
    };
}

function formatRecord(record) {
    return [
        '    {',
        `        id: ${record.id}, name: ${JSON.stringify(record.name)},`,
        `        enumName: ${JSON.stringify(record.enumName)}, baseType: ${record.baseType},`,
        `        flags: ${JSON.stringify(record.flags)},`,
        `        carriedFlags: ${JSON.stringify(record.carriedFlags)},`,
        `        attack: ${JSON.stringify(record.attack)},`,
        `        defense: ${JSON.stringify(record.defense)}, carriedDefense: ${JSON.stringify(record.carriedDefense)},`,
        `        invokePower: ${JSON.stringify(record.invokePower)}, alignment: ${JSON.stringify(record.alignment)},`,
        `        role: ${JSON.stringify(record.role)}, race: ${JSON.stringify(record.race)},`,
        `        generationEnchantment: ${record.generationEnchantment}, giftValue: ${record.giftValue},`,
        `        cost: ${record.cost}, color: ${JSON.stringify(record.color)},`,
        '    },',
    ].join('\n');
}

const source = omitDisabledBlocks(
    fs.readFileSync(sourcePath, 'utf8'),
).replace(/\/\*[\s\S]*?\*\//g, '');
const records = artifactCalls(source)
    .map((call, index) => artifactRecord(fields(call), index))
    .filter(Boolean);

if (records.length !== 33)
    throw new Error(`Expected 33 active artifacts, found ${records.length}`);

const output = `// Generated by tools/gen-artifacts.mjs.
// Source: nethack-c/upstream/include/artilist.h.

export const ARTIFACT_DATA = [
${records.map(formatRecord).join('\n')}
];
`;

fs.writeFileSync(outputPath, output);
