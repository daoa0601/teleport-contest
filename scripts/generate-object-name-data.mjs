#!/usr/bin/env node

// Generate the runtime object-name and base-description tables from the same
// objects.h configuration used by the contest build.  MAIL_STRUCTURES matters:
// it inserts SCR_MAIL and therefore shifts every spellbook/wand/object id after
// the scroll class by one.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'nethack-c/upstream/include/objects.h');
const target = join(root, 'js/object_data.js');
const begin = '// BEGIN GENERATED OBJECT NAME DATA';
const end = '// END GENERATED OBJECT NAME DATA';

const compiler = process.env.CC || 'cc';
const includeDir = join(root, 'nethack-c/upstream/include');
const preprocessed = execFileSync(compiler, [
    '-E', '-P', '-DOBJECTS_DESCR_INIT', '-DMAIL_STRUCTURES', source,
], { encoding: 'utf8' });

const stringToken = String.raw`(?:"(?:\\.|[^"\\])*"\s*)+|\(char \*\) 0`;
const entryPattern = new RegExp(
    `\\{\\s*(${stringToken})\\s*,\\s*(${stringToken})\\s*\\}\\s*,?`, 'g',
);

function decodeCStringSequence(value) {
    if (value.includes('(char *) 0')) return null;
    return [...value.matchAll(/"(?:\\.|[^"\\])*"/g)]
        .map(match => JSON.parse(match[0]))
        .join('');
}

const entries = [];
let match;
while ((match = entryPattern.exec(preprocessed))) {
    entries.push([
        decodeCStringSequence(match[1]),
        decodeCStringSequence(match[2]),
    ]);
}

// objects.h ends its description initializer with a null/null sentinel which
// is not part of objects[].  The configured contest table has 481 objects.
if (entries.at(-1)?.[0] === null && entries.at(-1)?.[1] === null)
    entries.pop();
if (entries.length !== 481)
    throw new Error(`expected 481 configured objects, found ${entries.length}`);

const names = entries.map(([name]) => name);
const descriptions = entries.map(([, description]) => description);
const objectInitializers = execFileSync(compiler, [
    '-E', '-P', '-DOBJECTS_INIT', '-DMAIL_STRUCTURES',
    '-include', 'color.h', `-I${includeDir}`, source,
], { encoding: 'utf8' });
const colors = objectInitializers.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('},'))
    .map(line => {
        const fields = line.slice(1, -2).split(',').map(field => field.trim());
        if (fields.length !== 33)
            throw new Error(`expected 33 object initializer fields: ${line}`);
        return Number(fields[20]); // struct objclass.oc_color
    });
if (colors.length !== 481 || colors.some(color => !Number.isInteger(color)))
    throw new Error(`expected 481 configured object colors, found ${colors.length}`);
const initializerFields = objectInitializers.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('},'))
    .map(line => line.slice(1, -2).split(',').map(field => field.trim()));
function parseIntegerInitializer(value) {
    if (/^-?\d+$/.test(value)) return Number(value);
    const symbolic = {
        PIERCE: 1,
        SLASH: 2,
        WHACK: 4,
    }[value];
    if (Number.isInteger(symbolic)) return symbolic;
    let match = value.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
    if (match) return Number(match[1]) - Number(match[2]);
    match = value.match(/^(-?\d+)\s*\/\s*(-?\d+)\s*\+\s*(-?\d+)$/);
    if (match) return Math.trunc(Number(match[1]) / Number(match[2]))
        + Number(match[3]);
    match = value.match(/^(-?\d+)\s*\*\s*(-?\d+)$/);
    if (match) return Number(match[1]) * Number(match[2]);
    return NaN;
}

const numericField = (index, label) => {
    const values = initializerFields.map(fields =>
        parseIntegerInitializer(fields[index]));
    if (values.length !== 481 || values.some(value => !Number.isInteger(value)))
        throw new Error(`expected 481 configured ${label} values, found ${values.length}`);
    return values;
};
const spellCategories = initializerFields.map(fields => ({
    P_ATTACK_SPELL: 'attack',
    P_HEALING_SPELL: 'healing',
    P_DIVINATION_SPELL: 'divination',
    P_ENCHANTMENT_SPELL: 'enchantment',
    P_CLERIC_SPELL: 'clerical',
    P_ESCAPE_SPELL: 'escape',
    P_MATTER_SPELL: 'matter',
}[fields[16]] || null));
const usesKnown = numericField(5, 'oc_uses_known');
const merges = numericField(4, 'oc_merge');
const charged = numericField(8, 'oc_charged');
const bimanual = numericField(11, 'oc_bimanual');
const delays = numericField(19, 'oc_delay');
const spellLevels = numericField(27, 'oc_level');
const nutrition = numericField(28, 'oc_nutrition');
const weights = numericField(22, 'oc_weight');
const costs = numericField(23, 'oc_cost');
const smallDamage = numericField(24, 'oc_wsdam');
const largeDamage = numericField(25, 'oc_wldam');
const hitBonuses = numericField(26, 'oc_hitbon');
const generated = [
    begin,
    `export const OBJECT_NAMES = ${JSON.stringify(names)};`,
    `export const OBJECT_DESCRIPTIONS = ${JSON.stringify(descriptions)};`,
    `export const OBJECT_COLOR = ${JSON.stringify(colors)};`,
    `export const OBJECT_MERGE = ${JSON.stringify(merges)};`,
    `export const OBJECT_USES_KNOWN = ${JSON.stringify(usesKnown)};`,
    `export const OBJECT_CHARGED = ${JSON.stringify(charged)};`,
    `export const OBJECT_BIMANUAL = ${JSON.stringify(bimanual)};`,
    `export const OBJECT_DELAY = ${JSON.stringify(delays)};`,
    `export const OBJECT_SPELL_LEVEL = ${JSON.stringify(spellLevels)};`,
    `export const OBJECT_SPELL_CATEGORY = ${JSON.stringify(spellCategories)};`,
    `export const OBJECT_NUTRITION = ${JSON.stringify(nutrition)};`,
    `export const OBJECT_WEIGHT = ${JSON.stringify(weights)};`,
    `export const OBJECT_COST = ${JSON.stringify(costs)};`,
    `export const OBJECT_SMALL_DAMAGE = ${JSON.stringify(smallDamage)};`,
    `export const OBJECT_LARGE_DAMAGE = ${JSON.stringify(largeDamage)};`,
    `export const OBJECT_HIT_BONUS = ${JSON.stringify(hitBonuses)};`,
    end,
].join('\n');

const previous = readFileSync(target, 'utf8');
const start = previous.indexOf(begin);
const finish = previous.indexOf(end);
if (start < 0 || finish < start)
    throw new Error(`generated markers missing from ${target}`);
const updated = previous.slice(0, start)
    + generated
    + previous.slice(finish + end.length);
writeFileSync(target, updated);
