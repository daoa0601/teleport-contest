#!/usr/bin/env node
// Project the pinned TTY command metadata, without linking command handlers.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const upstream = readFileSync(join(root, 'nethack-c/upstream/src/cmd.c'), 'utf8');
const header = readFileSync(join(root, 'nethack-c/upstream/include/func_tab.h'), 'utf8');
const movementHeader = readFileSync(join(root, 'nethack-c/upstream/include/hack.h'), 'utf8');
const compiler = process.env.CC || 'cc';
const includes = [`-I${join(root, 'nethack-c/upstream/include')}`];

function runCompiler(args: readonly string[], input: string): string {
    try {
        return execFileSync(compiler, [...args, ...includes], { input, encoding: 'utf8' });
    } catch (error) {
        throw new Error('Failed to compile the pinned command projection', { cause: error });
    }
}

function declaration(marker: string, ending: string, source = upstream): string {
    const start = source.indexOf(marker);
    const end = source.indexOf(ending, start);
    if (start < 0 || end < start) throw new Error(`Missing pinned declaration: ${marker}`);
    return source.slice(start, end + ending.length);
}

// Split preprocessed C lists without mistaking quoted commas or C(...) for
// field separators. The compiler, not this scanner, evaluates C expressions.
function fields(text: string): string[] {
    const result: string[] = [];
    let quote: string | null = null;
    let escaped = false, depth = 0, start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charAt(i);
        if (quote) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if ('({['.includes(c)) depth++;
        else if (')}]'.includes(c)) depth--;
        else if (c === ',' && depth === 0) {
            result.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    if (quote || depth) throw new Error('Unbalanced preprocessed C initializer');
    const last = text.slice(start).trim();
    if (last) result.push(last);
    return result;
}

function requiredField(values: readonly string[], index: number, label: string): string {
    const value = values[index];
    if (value === undefined) throw new Error(`Missing ${label} at field ${index}`);
    return value;
}

const directionCount = movementHeader.match(/^#define N_DIRS .+$/m)?.[0];
if (directionCount === undefined) throw new Error('Missing pinned N_DIRS declaration');
const movementDeclarations = declaration('enum movementdirs {', '\n};', movementHeader)
    + '\n' + directionCount;
const pieces = {
    COMMANDS: declaration('struct ext_func_tab extcmdlist[] = {', '\n};'),
    DIRECTIONS: declaration('static int (*move_funcs[', '\n};'),
    BINDINGS: declaration('\ncommands_init(void)\n{', '\n}'),
    SPECIAL_KEYS: declaration('} const spkeys_binds[] = {', '\n};'),
};
const source = `
#include "config.h"
#include "global.h"
#include "objclass.h"
#include "func_tab.h"
#if !defined(DEBUG) || !defined(CRASHREPORT) || NH_DEVEL_STATUS != NH_STATUS_RELEASED
#error Expected the pinned released TTY headers with DEBUG and CRASHREPORT
#endif
${Object.entries(pieces).map(([name, text]) =>
    `CONTEST_${name}_BEGIN\n${text}\nCONTEST_${name}_END`).join('\n')}
`;
const preprocessed = runCompiler(['-E', '-P', '-x', 'c', '-'], source);
function section(name: string): string {
    const begin = `CONTEST_${name}_BEGIN`, end = `CONTEST_${name}_END`;
    if (preprocessed.split(begin).length !== 2 || preprocessed.split(end).length !== 2)
        throw new Error(`Lost projection markers for ${name}`);
    const start = preprocessed.indexOf(begin) + begin.length;
    return preprocessed.slice(start, preprocessed.indexOf(end, start)).trim();
}
function rows(name: string): string[][] {
    const text = section(name);
    return fields(text.slice(text.indexOf('{') + 1, text.lastIndexOf('}')))
        .map(row => {
            if (!row.startsWith('{') || !row.endsWith('}'))
                throw new Error(`Expected ${name} initializer row`);
            return fields(row.slice(1, -1));
        });
}
const commandRows = rows('COMMANDS');
const directions = rows('DIRECTIONS');
const specialKeys = rows('SPECIAL_KEYS');
const bindings = [...section('BINDINGS').matchAll(/\bbind_key\(([^;]+)\);/g)]
    .map(match => fields(requiredField(match, 1, 'binding')));
if (!commandRows.length || !bindings.length || directions.some(row => row.length !== 3))
    throw new Error('Incomplete pinned command projection');
for (const row of commandRows) {
    if (row.length !== 6 || !/^[A-Za-z_]\w*$/.test(requiredField(row, 3, 'handler')))
        throw new Error(`Unexpected command handler: ${row.join(', ')}`);
}
const flagHeader = requiredField(header.split('/* flags for extcmds_match() */'), 0, 'flags header');
const flagNames = [...flagHeader.matchAll(/^#define[ \t]+([A-Za-z_]\w*)[ \t]+\S/gm)]
    .map(match => requiredField(match, 1, 'flag name'));
const projection = String.raw`
#include <stdio.h>
#include <limits.h>
#include "config.h"
#include "global.h"
#include "objclass.h"
#include "func_tab.h"
${movementDeclarations}
struct command_projection {
    unsigned char key;
    const char *name, *description, *handler;
    unsigned flags;
    const char *occupation;
};
static const struct command_projection commands[] = {
${commandRows.map(row => `{${row.map((field, i) => i === 3 ? JSON.stringify(field) : field).join(',')}}`).join(',\n')}
};
static const struct { unsigned char key; const char *name; } bindings[] = {
${bindings.map(row => `{${requiredField(row, 0, 'binding key')},${requiredField(row, 1, 'binding name')}}`).join(',\n')}
};
static const struct { unsigned char key; const char *name; } special_keys[] = {
${specialKeys.map(row => `{${requiredField(row, 1, 'special key')},${requiredField(row, 2, 'special key name')}}`).join(',\n')}
};
static void json_string(const char *text) {
    const unsigned char *p = (const unsigned char *) text;
    if (!p) { fputs("null", stdout); return; }
    putchar('"');
    for (; *p; ++p) {
        if (*p == '"' || *p == '\\') putchar('\\');
        if (*p < 0x20) printf("\\u%04x", (unsigned) *p);
        else putchar(*p);
    }
    putchar('"');
}
int main(void) {
    unsigned i;
    printf("{\"profile\":{\"debug\":true,\"crashreport\":true,\"develStatus\":%d,\"signedChar\":%s},",
           NH_DEVEL_STATUS, CHAR_MIN < 0 ? "true" : "false");
    fputs("\"commands\":[", stdout);
    for (i = 0; i < sizeof commands / sizeof commands[0]; i++) {
        if (i) putchar(',');
        printf("{\"key\":%u,\"name\":", commands[i].key);
        json_string(commands[i].name);
        fputs(",\"handler\":", stdout);
        json_string(commands[i].handler);
        printf(",\"flags\":%u,\"occupation\":", commands[i].flags);
        json_string(commands[i].occupation);
        putchar('}');
    }
    fputs("],\"bindings\":[", stdout);
    for (i = 0; i < sizeof bindings / sizeof bindings[0]; i++) {
        if (i) putchar(',');
        printf("{\"key\":%u,\"name\":", bindings[i].key);
        json_string(bindings[i].name);
        putchar('}');
    }
    fputs("],\"specialKeys\":[", stdout);
    for (i = 0; i < sizeof special_keys / sizeof special_keys[0]; i++) {
        if (i) putchar(',');
        printf("{\"key\":%u,\"name\":", special_keys[i].key);
        json_string(special_keys[i].name);
        putchar('}');
    }
    printf("],\"constants\":{\"N_DIRS\":%d,\"N_DIRS_Z\":%d,\"LARGEST_INT\":%d},",
           N_DIRS, N_DIRS_Z, LARGEST_INT);
    fputs("\"flags\":{", stdout);
${flagNames.map((name, i) => `    printf("${i ? ',' : ''}\\"${name}\\":%u", (unsigned) ${name});`).join('\n')}
    puts("}}");
    return 0;
}
`;

interface CommandRow {
    key: number;
    name: string | null;
    handler: string;
    flags: number;
    occupation: string | null;
}

interface CommandBinding {
    key: number;
    name: string;
}

interface CommandProjection {
    profile: { debug: boolean; crashreport: boolean; develStatus: number; signedChar: boolean };
    constants: { N_DIRS: number; N_DIRS_Z: number; LARGEST_INT: number };
    flags: Record<string, number>;
    commands: CommandRow[];
    bindings: CommandBinding[];
    specialKeys: { key: number; name: string | null }[];
}

function record(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error(`Expected ${label} object`);
    return Object.fromEntries(Object.entries(value));
}

function integer(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value))
        throw new Error(`Expected integer ${label}`);
    return value;
}

function text(value: unknown, label: string): string {
    if (typeof value !== 'string') throw new Error(`Expected string ${label}`);
    return value;
}

function nullableText(value: unknown, label: string): string | null {
    return value === null ? null : text(value, label);
}

function boolean(value: unknown, label: string): boolean {
    if (typeof value !== 'boolean') throw new Error(`Expected boolean ${label}`);
    return value;
}

function array(value: unknown, label: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`Expected ${label} array`);
    return value;
}

function bindingsFrom(value: unknown, label: string): CommandBinding[] {
    return array(value, label).map((entry, index) => {
        const row = record(entry, `${label}[${index}]`);
        return { key: integer(row.key, 'key'), name: text(row.name, 'name') };
    });
}

function commandProjection(value: unknown): CommandProjection {
    const data = record(value, 'command projection');
    const profile = record(data.profile, 'profile');
    const constants = record(data.constants, 'constants');
    return {
        profile: {
            debug: boolean(profile.debug, 'debug'),
            crashreport: boolean(profile.crashreport, 'crashreport'),
            develStatus: integer(profile.develStatus, 'develStatus'),
            signedChar: boolean(profile.signedChar, 'signedChar'),
        },
        constants: {
            N_DIRS: integer(constants.N_DIRS, 'N_DIRS'),
            N_DIRS_Z: integer(constants.N_DIRS_Z, 'N_DIRS_Z'),
            LARGEST_INT: integer(constants.LARGEST_INT, 'LARGEST_INT'),
        },
        flags: Object.fromEntries(Object.entries(record(data.flags, 'flags'))
            .map(([name, value]) => [name, integer(value, `flag ${name}`)])),
        commands: array(data.commands, 'commands').map((entry, index) => {
            const row = record(entry, `commands[${index}]`);
            return {
                key: integer(row.key, 'key'), name: nullableText(row.name, 'name'),
                handler: text(row.handler, 'handler'), flags: integer(row.flags, 'flags'),
                occupation: nullableText(row.occupation, 'occupation'),
            };
        }),
        bindings: bindingsFrom(data.bindings, 'bindings'),
        specialKeys: array(data.specialKeys, 'special keys').map((entry, index) => {
            const row = record(entry, `specialKeys[${index}]`);
            return { key: integer(row.key, 'key'), name: nullableText(row.name, 'name') };
        }),
    };
}

const temporary = mkdtempSync(join(tmpdir(), 'contest-command-data-'));
try {
    const binary = join(temporary, 'project-commands');
    runCompiler(['-x', 'c', '-', '-o', binary], projection);
    const data = commandProjection(JSON.parse(execFileSync(binary, [], { encoding: 'utf8' })));
    const sentinel = data.commands.at(-1);
    if (sentinel?.name !== null || sentinel.key !== 0)
        throw new Error('The command sentinel is missing');
    if (directions.length !== data.constants.N_DIRS_Z)
        throw new Error('Incomplete native direction handler projection');
    const output = "import type { CommandBinding, DirectionHandlers, NativeCommand, SpecialKey } from './data_types.js';\n\n"
        + '// Generated by scripts/generate-command-data.mjs.\n'
        + '// Source: pinned cmd.c and configured released TTY headers.\n\n'
        + `export const NATIVE_COMMAND_PROFILE = ${JSON.stringify(data.profile)};\n\n`
        + `export const NATIVE_COMMAND_CONSTANTS = ${JSON.stringify(data.constants)};\n\n`
        + `export const NATIVE_COMMAND_FLAGS = ${JSON.stringify(data.flags, null, 4)};\n\n`
        + 'export const NATIVE_COMMANDS = [\n'
        + data.commands.map(command => `    ${JSON.stringify(command)},`).join('\n')
        + '\n] as const satisfies readonly NativeCommand[];\n\n'
        + "export type CommandName = NonNullable<(typeof NATIVE_COMMANDS)[number]['name']>;\n"
        + "export type CommandHandlerName = (typeof NATIVE_COMMANDS)[number]['handler'];\n\n"
        + 'export interface CommandDefinition {\n'
        + '    readonly key: number;\n'
        + '    readonly name: CommandName | null;\n'
        + '    readonly handler: CommandHandlerName;\n'
        + '    readonly flags: number;\n'
        + "    readonly occupation: 'searching' | 'waiting' | null;\n"
        + '}\n\nexport const INITIAL_COMMAND_BINDINGS: readonly CommandBinding[] = [\n'
        + data.bindings.map(binding => `    ${JSON.stringify(binding)},`).join('\n')
        + '\n];\n\nexport const NATIVE_SPECIAL_KEYS: readonly SpecialKey[] = [\n'
        + data.specialKeys.map(binding => `    ${JSON.stringify(binding)},`).join('\n')
        + '\n];\n\nexport const DIRECTION_HANDLERS: readonly DirectionHandlers[] = '
        + JSON.stringify(directions, null, 4) + ';\n';
    writeFileSync(join(root, 'src/js/command_data.ts'), output);
    console.log(`Projected ${data.commands.length} native command rows and ${data.bindings.length} startup bindings.`);
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
