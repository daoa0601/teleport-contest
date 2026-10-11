#!/usr/bin/env node
// Project the configured shop table and names from pinned shknam.c.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const upstream = readFileSync(join(root, 'nethack-c/upstream/src/shknam.c'), 'utf8');
const start = upstream.indexOf('static const char *const shkliquors[]');
const table = upstream.indexOf('const struct shclass shtypes[]');
const end = upstream.indexOf('\n};', table);
if (start < 0 || table < start || end < table)
    throw new Error('Cannot locate shop names and shtypes in pinned shknam.c');
const vegetarianClass = upstream.match(/^#define VEGETARIAN_CLASS .+$/m)?.[0];
if (!vegetarianClass) throw new Error('Cannot locate VEGETARIAN_CLASS');
const declarations = `${vegetarianClass}\n${upstream.slice(start, end + 3)}`;

interface ProjectedShop {
    name: string;
    annotation: string | null;
    symbol: number;
    probability: number;
    items: [probability: number, itemType: number][];
    nameSource: number;
    names: string[];
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

function shopProjection(value: unknown): ProjectedShop[] {
    if (!Array.isArray(value) || !value.length)
        throw new Error('The configured shop table is empty');
    return value.map((entry: unknown, index): ProjectedShop => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
            throw new Error(`Invalid shop at index ${index}`);
        const shop: Record<string, unknown> = Object.fromEntries(Object.entries(entry));
        if (!Array.isArray(shop.names) || !shop.names.length
            || !Array.isArray(shop.items) || !shop.items.length)
            throw new Error(`Shop ${index} has an empty name or stock list`);
        return {
            name: text(shop.name, `shop ${index} name`),
            annotation: shop.annotation === null ? null : text(shop.annotation, 'annotation'),
            symbol: integer(shop.symbol, 'symbol'),
            probability: integer(shop.probability, 'probability'),
            nameSource: integer(shop.nameSource, 'nameSource'),
            names: shop.names.map((name: unknown) => text(name, `shop ${index} owner name`)),
            items: shop.items.map((item: unknown): [number, number] => {
                if (!Array.isArray(item) || item.length !== 2)
                    throw new Error(`Invalid stock entry for shop ${index}`);
                return [integer(item[0], 'stock probability'), integer(item[1], 'stock item type')];
            }),
        };
    });
}

const source = String.raw`
#include <stdio.h>
#include "config.h"
#include "objclass.h"
#include "mkroom.h"
${declarations}

static void json_string(const char *text) {
    const unsigned char *p = (const unsigned char *) text;
    if (!text) { fputs("null", stdout); return; }
    putchar('"');
    for (; *p; ++p) {
        if (*p == '"' || *p == '\\') putchar('\\');
        if (*p < 0x20) printf("\\u%04x", (unsigned) *p);
        else putchar(*p);
    }
    putchar('"');
}

int main(void) {
    int i, j;
    putchar('[');
    for (i = 0; shtypes[i].name; ++i) {
        const struct shclass *shop = &shtypes[i];
        if (i) putchar(',');
        fputs("{\"name\":", stdout);
        json_string(shop->name);
        fputs(",\"annotation\":", stdout);
        json_string(shop->annotation);
        printf(",\"symbol\":%d,\"probability\":%d,\"items\":[", shop->symb, shop->prob);
        for (j = 0; j < SIZE(shop->iprobs) && shop->iprobs[j].iprob; ++j) {
            if (j) putchar(',');
            printf("[%d,%d]", shop->iprobs[j].iprob, shop->iprobs[j].itype);
        }
        for (j = 0; j < i && shtypes[j].shknms != shop->shknms; ++j) {}
        printf("],\"nameSource\":%d,\"names\":[", j);
        for (j = 0; shop->shknms[j]; ++j) {
            if (j) putchar(',');
            json_string(shop->shknms[j]);
        }
        fputs("]}", stdout);
    }
    puts("]");
    return 0;
}
`;
const temporary = mkdtempSync(join(tmpdir(), 'contest-shop-data-'));
try {
    const binary = join(temporary, 'project-shops');
    execFileSync(process.env.CC || 'cc', [
        '-x', 'c', '-', '-o', binary,
        `-I${join(root, 'nethack-c/upstream/include')}`,
    ], { input: source, encoding: 'utf8' });
    const shops = shopProjection(JSON.parse(execFileSync(binary, [], { encoding: 'utf8' })));
    for (const [index, shop] of shops.entries()) {
        const nameSource = shops[shop.nameSource];
        if (nameSource === undefined || shop.nameSource > index
            || nameSource.nameSource !== shop.nameSource)
            throw new Error(`Invalid name source ${shop.nameSource} for shop ${index}`);
    }
    const names = Object.fromEntries(shops.flatMap((shop, index) =>
        shop.nameSource === index ? [[index, shop.names]] : []));
    const definitions = shops.map(({ nameSource, names: _names, ...shop }) =>
        JSON.stringify({ ...shop, names: null }, null, 4)
            .replace('"names": null', `"names": SHOP_NAMES[${nameSource}]`));
    const output = "import type { ShopType } from './data_types.js';\n\n"
        + '// Generated by scripts/generate-shop-data.mjs.\n'
        + '// Source: nethack-c/upstream/src/shknam.c, using the configured C headers.\n\n'
        + `const SHOP_NAMES = ${JSON.stringify(names, null, 4)};\n\n`
        + `export const SHOP_TYPES: readonly ShopType[] = [\n${definitions.join(',\n')}\n];\n\n`
        + 'export const RANDOM_SHOP_TYPES = SHOP_TYPES.slice(\n'
        + '    0, SHOP_TYPES.findIndex(shop => shop.probability === 0),\n'
        + ');\n';
    writeFileSync(join(root, 'src/js/shop_data.ts'), output);
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
