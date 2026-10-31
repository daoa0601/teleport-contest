/*
 * Copyright (c) 1991, 1992, 1993 The Regents of the University of California.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of the University nor the names of its contributors may
 *    be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// C hacklib.c:nh_deterministic_qsort() sorts indices with Apple libc qsort.
// invent.c:sortloot_cmp() observes objects during comparison, so its traversal
// affects discoveries even when Array.sort would produce the same final order.
// Sources: apple-oss-distributions/Libc, stdlib/FreeBSD/{qsort,heapsort}.c.
export function recorderSort(values, compare) {
    const entries = values.map((value, index) => ({ value, index }));
    if (entries.length > 1)
        sortRange(0, entries.length, 2 * Math.floor(Math.log2(entries.length)));
    return entries.map(entry => entry.value);
    function sortRange(start, length, depth) {
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
            while (left <= right && compareAt(left, start) < 0)
                left++;
            while (left <= right && compareAt(right, start) > 0)
                right--;
            if (left > right)
                break;
            swap(left++, right--);
            swapped = true;
        }
        if (left > start + 1)
            swap(start, left - 1);
        if (!swapped && insertionSort(start, length, 1 + Math.floor(length / 4)))
            return;
        const leftLength = left - start - 1, rightLength = end - 1 - right;
        const rightStart = end - rightLength;
        // Apple libc visits the smaller partition first.
        if (leftLength <= rightLength) {
            if (leftLength > 1)
                sortRange(start, leftLength, depth - 1);
            if (rightLength > 1)
                sortRange(rightStart, rightLength, depth - 1);
        }
        else {
            if (rightLength > 1)
                sortRange(rightStart, rightLength, depth - 1);
            if (leftLength > 1)
                sortRange(start, leftLength, depth - 1);
        }
    }
    function insertionSort(start, length, swapLimit) {
        let swaps = 0;
        for (let current = start + 1; current < start + length; current++) {
            for (let position = current; position > start && compareAt(position - 1, position) > 0; position--) {
                swap(position, position - 1);
                if (swapLimit && ++swaps > swapLimit)
                    return false;
            }
        }
        return true;
    }
    function median(first, middle, last) {
        if (compareAt(first, middle) < 0) {
            if (compareAt(middle, last) < 0)
                return middle;
            return compareAt(first, last) < 0 ? last : first;
        }
        if (compareAt(middle, last) > 0)
            return middle;
        return compareAt(first, last) < 0 ? first : last;
    }
    function heapSort(start, length) {
        // heapsort.c numbers heap positions from one, including its parent
        // and child calculations. Keep that convention at this boundary.
        const offset = start - 1;
        for (let root = Math.floor(length / 2); root > 0; root--) {
            let parent = root;
            for (let child = parent * 2; child <= length; child = parent * 2) {
                if (child < length && compareAt(offset + child, offset + child + 1) < 0)
                    child++;
                if (compareAt(offset + child, offset + parent) <= 0)
                    break;
                swap(offset + parent, offset + child);
                parent = child;
            }
        }
        for (let remaining = length - 1; remaining > 0; remaining--) {
            const displaced = entryAt(offset + remaining + 1);
            entries[offset + remaining + 1] = entryAt(start);
            let parent = 1;
            for (let child = parent * 2; child <= remaining; child = parent * 2) {
                if (child < remaining && compareAt(offset + child, offset + child + 1) < 0)
                    child++;
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
    function compareAt(left, right) {
        return compareEntries(entryAt(left), entryAt(right));
    }
    function compareEntries(left, right) {
        return compare(left.value, right.value) || left.index - right.index;
    }
    function swap(left, right) {
        const previous = entryAt(left);
        entries[left] = entryAt(right);
        entries[right] = previous;
    }
    function entryAt(index) {
        const entry = entries[index];
        if (!entry)
            throw new RangeError(`Recorder sort index ${index} is outside ${entries.length} entries`);
        return entry;
    }
}
//# sourceMappingURL=recorder_sort.js.map