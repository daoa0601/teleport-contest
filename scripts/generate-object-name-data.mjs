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

// objects.h ends with a null/null sentinel which is not part of objects[].
if (entries.at(-1)?.[0] === null && entries.at(-1)?.[1] === null)
    entries.pop();
if (!entries.length) throw new Error('objects.h produced no object descriptions');

const names = entries.map(([name]) => name);
const descriptions = entries.map(([, description]) => description);
const objectInitializers = execFileSync(compiler, [
    '-E', '-P', '-DOBJECTS_INIT', '-DMAIL_STRUCTURES',
    '-include', 'color.h', `-I${includeDir}`, source,
], { encoding: 'utf8' });
const initializerFields = objectInitializers.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('},'))
    .map(line => {
        const fields = line.slice(1, -2).split(',').map(field => field.trim());
        if (fields.length !== 33)
            throw new Error(`expected 33 object initializer fields: ${line}`);
        return fields;
    });
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
    match = value.match(/^\(\s*(-?\d+)\s*>=\s*(-?\d+)\s*\)$/);
    if (match) return Number(Number(match[1]) >= Number(match[2]));
    return NaN;
}

const numericField = (index, label) => {
    const values = initializerFields.map(fields =>
        parseIntegerInitializer(fields[index]));
    if (values.length !== entries.length)
        throw new Error(`expected ${entries.length} ${label} values, found ${values.length}`);
    const invalid = values.findIndex(value => !Number.isInteger(value));
    if (invalid >= 0)
        throw new Error(`invalid ${label} for ${names[invalid]}: ${initializerFields[invalid][index]}`);
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
const propertyNames = {
    ACID_RES: 'acidResistance',
    ADORNED: 'adorned',
    AGGRAVATE_MONSTER: 'aggravateMonster',
    ANTIMAGIC: 'antimagic',
    BLINDED: 'blinded',
    CLAIRVOYANT: 'clairvoyant',
    COLD_RES: 'coldResistance',
    CONFLICT: 'conflict',
    CONFUSION: 'confusion',
    DISINT_RES: 'disintegrationResistance',
    DISPLACED: 'displaced',
    DRAIN_RES: 'drainResistance',
    FAST: 'fast',
    FIRE_RES: 'fireResistance',
    FIXED_ABIL: 'sustainAbility',
    FLYING: 'flying',
    FREE_ACTION: 'freeAction',
    FUMBLING: 'fumbling',
    HALLUC: 'hallucination',
    HUNGER: 'hunger',
    INVIS: 'invisible',
    JUMPING: 'jumping',
    LEVITATION: 'levitation',
    LIFESAVED: 'lifeSaving',
    MAGICAL_BREATHING: 'magicalBreathing',
    POISON_RES: 'poisonResistance',
    POLYMORPH: 'polymorph',
    POLYMORPH_CONTROL: 'polymorphControl',
    PROTECTION: 'protection',
    PROT_FROM_SHAPE_CHANGERS: 'protectionFromShapeChangers',
    REFLECTING: 'reflection',
    REGENERATION: 'regeneration',
    SEARCHING: 'searching',
    SEE_INVIS: 'seeInvisible',
    SHOCK_RES: 'shockResistance',
    SLEEPY: 'sleepy',
    SLEEP_RES: 'sleepResistance',
    SLOW_DIGESTION: 'slowDigestion',
    STEALTH: 'stealth',
    STRANGLED: 'strangled',
    TELEPAT: 'telepathy',
    TELEPORT: 'teleportation',
    TELEPORT_CONTROL: 'teleportControl',
    UNCHANGING: 'unchanging',
    WARNING: 'warning',
    WWALKING: 'waterWalking',
};
const objectProperties = initializerFields.map(fields => {
    const property = fields[17];
    if (property === '0') return null;
    if (!propertyNames[property])
        throw new Error(`unknown object property ${property}`);
    return propertyNames[property];
});
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
const initialKnown = numericField(3, 'oc_name_known');
const colors = numericField(20, 'oc_color');
const magic = numericField(7, 'oc_magic');
const unique = numericField(9, 'oc_unique');
const nowish = numericField(10, 'oc_nowish');
const tough = numericField(12, 'oc_tough');
const propertyIds = new Map([...readFileSync(join(includeDir, 'prop.h'), 'utf8')
    .matchAll(/^\s*(\w+)\s*=\s*(\d+)\s*,/gm)]
    .map(([, name, value]) => [name, Number(value)]));
const objectPropertyIds = initializerFields.map(fields => {
    if (fields[17] === '0') return 0;
    const id = propertyIds.get(fields[17]);
    if (id === undefined) throw new Error(`unknown property id ${fields[17]}`);
    return id;
});
const materials = readFileSync(join(root, 'nethack-c/upstream/src/decl.c'), 'utf8')
    .match(/const char \*materialnm\[\]\s*=\s*\{([\s\S]*?)\};/)[1];
const materialNames = [...materials.matchAll(/"(?:\\.|[^"\\])*"/g)]
    .map(match => JSON.parse(match[0]));
const generated = [
    begin,
    `export const OBJECT_NAMES = ${JSON.stringify(names)};`,
    `export const OBJECT_DESCRIPTIONS = ${JSON.stringify(descriptions)};`,
    `export const OBJECT_COLOR = ${JSON.stringify(colors)};`,
    `export const OBJECT_MERGE = ${JSON.stringify(merges)};`,
    `export const OBJECT_USES_KNOWN = ${JSON.stringify(usesKnown)};`,
    `export const OBJECT_INITIAL_KNOWN = ${JSON.stringify(initialKnown)};`,
    `export const OBJECT_MAGIC = ${JSON.stringify(magic)};`,
    `export const OBJECT_UNIQUE = ${JSON.stringify(unique)};`,
    `export const OBJECT_NOWISH = ${JSON.stringify(nowish)};`,
    `export const OBJECT_TOUGH = ${JSON.stringify(tough)};`,
    `export const OBJECT_CHARGED = ${JSON.stringify(charged)};`,
    `export const OBJECT_BIMANUAL = ${JSON.stringify(bimanual)};`,
    `export const OBJECT_DELAY = ${JSON.stringify(delays)};`,
    `export const OBJECT_SPELL_LEVEL = ${JSON.stringify(spellLevels)};`,
    `export const OBJECT_SPELL_CATEGORY = ${JSON.stringify(spellCategories)};`,
    `export const OBJECT_PROPERTY = ${JSON.stringify(objectProperties)};`,
    `export const OBJECT_PROPERTY_ID = ${JSON.stringify(objectPropertyIds)};`,
    `export const OBJECT_MATERIAL_NAMES = ${JSON.stringify(materialNames)};`,
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
