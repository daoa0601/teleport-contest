// hacklib.js — Utility functions.
// C ref: hacklib.c — nh_deterministic_qsort(), fuzzymatch(), swapbits(),
// and the string/number helpers.

import { game } from './gstate.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameState } from './game_state.js';

/*
 * Copyright (c) 1991, 1992, 1993 The Regents of the University of California.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. The name of the University nor the names of its contributors may be
 *    used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// C hacklib.c:nh_deterministic_qsort() sorts indices with Apple libc qsort.
// invent.c:sortloot_cmp() observes objects during comparison, so its traversal
// affects discoveries even when Array.sort would produce the same final order.
// Sources: apple-oss-distributions/Libc, stdlib/FreeBSD/{qsort,heapsort}.c.
export function recorderSort<T>(values: readonly T[], compare: (left: T, right: T) => number): T[] {
    const entries = values.map((value, index) => ({ value, index }));
    if (entries.length > 1)
        sortRange(0, entries.length, 2 * Math.floor(Math.log2(entries.length)));
    return entries.map(entry => entry.value);

    function sortRange(start: number, length: number, depth: number): void {
        if (depth <= 0) {
            heapSort(start, length);
            return;
        }
        if (length <= 7) {
            insertionSort(start, length, 0);
            return;
        }

        const end = start + length;
        let first = start, middle = start + Math.floor(length / 2), last = end - 1;
        if (length > 40) {
            const stride = Math.floor(length / 8);
            first = median(first, first + stride, first + 2 * stride);
            middle = median(middle - stride, middle, middle + stride);
            last = median(last - 2 * stride, last - stride, last);
        }
        swap(start, median(first, middle, last));

        // The recorder's original-index tie-breaker makes distinct entries
        // unequal, so libc's equal-pivot partitions are always empty here.
        let left = start + 1, right = end - 1;
        let swapped = false;
        for (;;) {
            while (left <= right && compareAt(left, start) < 0) left++;
            while (left <= right && compareAt(right, start) > 0) right--;
            if (left > right) break;
            swap(left++, right--);
            swapped = true;
        }
        if (left > start + 1) swap(start, left - 1);
        if (!swapped && insertionSort(start, length, 1 + Math.floor(length / 4))) return;

        const leftLength = left - start - 1, rightLength = end - 1 - right;
        const rightStart = end - rightLength;
        // Apple libc visits the smaller partition first.
        if (leftLength <= rightLength) {
            if (leftLength > 1) sortRange(start, leftLength, depth - 1);
            if (rightLength > 1) sortRange(rightStart, rightLength, depth - 1);
        } else {
            if (rightLength > 1) sortRange(rightStart, rightLength, depth - 1);
            if (leftLength > 1) sortRange(start, leftLength, depth - 1);
        }
    }

    function insertionSort(start: number, length: number, swapLimit: number): boolean {
        let swaps = 0;
        for (let current = start + 1; current < start + length; current++) {
            for (let position = current;
                position > start && compareAt(position - 1, position) > 0; position--) {
                swap(position, position - 1);
                if (swapLimit && ++swaps > swapLimit) return false;
            }
        }
        return true;
    }

    function median(first: number, middle: number, last: number): number {
        if (compareAt(first, middle) < 0) {
            if (compareAt(middle, last) < 0) return middle;
            return compareAt(first, last) < 0 ? last : first;
        }
        if (compareAt(middle, last) > 0) return middle;
        return compareAt(first, last) < 0 ? first : last;
    }

    function heapSort(start: number, length: number): void {
        // heapsort.c numbers heap positions from one, including its parent
        // and child calculations. Keep that convention at this boundary.
        const offset = start - 1;
        for (let root = Math.floor(length / 2); root > 0; root--) {
            let parent = root;
            for (let child = parent * 2; child <= length; child = parent * 2) {
                if (child < length && compareAt(offset + child, offset + child + 1) < 0) child++;
                if (compareAt(offset + child, offset + parent) <= 0) break;
                swap(offset + parent, offset + child);
                parent = child;
            }
        }
        for (let remaining = length - 1; remaining > 0; remaining--) {
            const displaced = entryAt(offset + remaining + 1);
            entries[offset + remaining + 1] = entryAt(start);
            let parent = 1;
            for (let child = parent * 2; child <= remaining; child = parent * 2) {
                if (child < remaining && compareAt(offset + child, offset + child + 1) < 0) child++;
                entries[offset + parent] = entryAt(offset + child);
                parent = child;
            }
            for (;;) {
                const child = parent;
                parent = Math.floor(child / 2);
                if (child === 1 || compareEntries(displaced, entryAt(offset + parent)) < 0) {
                    entries[offset + child] = displaced;
                    break;
                }
                entries[offset + child] = entryAt(offset + parent);
            }
        }
    }

    function compareAt(left: number, right: number): number {
        return compareEntries(entryAt(left), entryAt(right));
    }

    function compareEntries(left: { value: T; index: number }, right: { value: T; index: number }): number {
        return compare(left.value, right.value) || left.index - right.index;
    }

    function swap(left: number, right: number): void {
        const previous = entryAt(left);
        entries[left] = entryAt(right);
        entries[right] = previous;
    }

    function entryAt(index: number): { value: T; index: number } {
        const entry = entries[index];
        if (!entry) throw new RangeError(`Recorder sort index ${index} is outside ${entries.length} entries`);
        return entry;
    }
}

export function distmin(x1: number, y1: number, x2: number, y2: number) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function dist2(x1: number, y1: number, x2: number, y2: number) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}


// C ref: rn2(x) already in rng.js — re-export not needed

// C hacklib.c:ing_suffix(), including compound verbs such as "put on".
export function ingSuffix(verb: string): string {
    const particle = verb.match(/ (?:on|off|with)$/i)?.[0] || '';
    let stem = particle ? verb.slice(0, -particle.length) : verb;
    if (!/er$/i.test(stem)) {
        if (/[^aeiouwy][aeiouwy][^aeiouwy]$/.test(stem)) stem += stem.at(-1);
        else if (/ie$/i.test(stem)) stem = stem.slice(0, -2) + 'y';
        else if (stem.endsWith('e')) stem = stem.slice(0, -1);
    }
    return stem + 'ing' + particle;
}
// C hacklib.c:upstart(). Convert the first character to uppercase.
export function upstart(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// C hacklib.c:s_suffix(). The possessive of a name or noun phrase.
export function possessiveName(name: string): string {
    if (name.toLowerCase() === 'it') return name + 's';
    if (name.toLowerCase() === 'you') return name + 'r';
    return name + (name.endsWith('s') ? "'" : "'s");
}

// C hack.h:online2() via the onlineu() macro. Two squares are online when
// they share a row, a column, or a perfect diagonal.
export function pointsOnline(x0: number, y0: number, x1: number, y1: number) {
    const dx = x0 - x1;
    const dy = y0 - y1;
    return !dx || !dy || dy === dx || dy === -dx;
}

// C hacklib.c:ordin().
export function ordinalSuffix(number: number): string {
    const digit = number % 10;
    if (digit === 0 || digit > 3 || Math.trunc((number % 100) / 10) === 1) return 'th';
    return digit === 1 ? 'st' : digit === 2 ? 'nd' : 'rd';
}

// C hacklib.c:mungspaces(): tabs become spaces, runs of spaces collapse to
// one, and leading/trailing spaces vanish, all over the raw bytes. The
// config-statement parser in cfgfiles.ts and the interactive readers (the
// autopickup-exception pattern and zap.c:makewish()'s wish line) share it.
export function mungSpaces(bytes: Uint8Array): Uint8Array {
    const out: number[] = [];
    let pendingSpace = false;
    for (const byte of bytes) {
        if (byte === 32 || byte === 9) {
            pendingSpace = out.length > 0;
            continue;
        }
        if (pendingSpace && out.length) out.push(32);
        pendingSpace = false;
        out.push(byte);
    }
    return new Uint8Array(out);
}


// C hacklib.c:fuzzymatch(): compare while skipping ' ', '-', '_' and
// folding case.
export function fuzzyMatch(input: string, name: string): boolean {
    const skip = (character: string | undefined) =>
        character === ' ' || character === '-' || character === '_';
    let i = 0, j = 0;
    for (;;) {
        while (skip(input[i])) i++;
        while (skip(name[j])) j++;
        const a = input[i], b = name[j];
        if (a === undefined || b === undefined) break;
        if (a.toLowerCase() !== b.toLowerCase()) return false;
        i++;
        j++;
    }
    return input[i] === undefined && name[j] === undefined;
}

// C hacklib.c:swapbits(): swap a pair of bits.
export function swapDirectionBits(value: number, first: number, second: number): number {
    const different = ((value >> first) ^ (value >> second)) & 1;
    return value ^ ((different << first) | (different << second));
}
