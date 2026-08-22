import assert from 'node:assert/strict';

const RNG_CALL = /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/;

export function expectedRngSlice(step) {
    return (step?.rng || [])
        .filter(call => typeof call === 'string' && RNG_CALL.test(call))
        .map(call => call.replace(/\s+@.*$/, ''));
}

export function assertRngSliceExact(actual, expected, label = 'RNG') {
    const actualSlice = Array.isArray(actual) ? actual : [];
    const expectedSlice = Array.isArray(expected) ? expected : [];
    const limit = Math.max(actualSlice.length, expectedSlice.length);
    let firstMismatch = 0;
    while (firstMismatch < limit
        && actualSlice[firstMismatch] === expectedSlice[firstMismatch]) {
        firstMismatch++;
    }
    if (firstMismatch === limit) return;

    const start = Math.max(0, firstMismatch - 3);
    const end = firstMismatch + 4;
    assert.fail(
        `${label}: first call ${firstMismatch}; `
        + `actual ${actualSlice.length}, expected ${expectedSlice.length}; `
        + `actual neighborhood ${JSON.stringify(actualSlice.slice(start, end))}; `
        + `expected neighborhood ${JSON.stringify(expectedSlice.slice(start, end))}`,
    );
}

export function assertRngThrough(
    result,
    segment,
    lastStep = segment.steps.length - 1,
    label = 'RNG',
) {
    const actualSlices = result.getRngSlices();
    for (let step = 0; step <= lastStep; step++) {
        assertRngSliceExact(
            actualSlices[step],
            expectedRngSlice(segment.steps[step]),
            `${label} input ${step}`,
        );
    }
}

function screenRowText(row = []) {
    return row.map(cell => cell?.ch ?? ' ').join('').replace(/\s+$/, '');
}

// Keep parity failures bounded.  node:assert's recursive formatter expands a
// complete 80x24 matrix and can retain enormous transcripts when this helper
// is used inside a long replay.
export function assertScreenExact(actual, expected, label = 'screen') {
    const actualRows = Array.isArray(actual) ? actual : [];
    const expectedRows = Array.isArray(expected) ? expected : [];
    const rowCount = Math.max(actualRows.length, expectedRows.length);
    for (let row = 0; row < rowCount; row++) {
        const actualRow = actualRows[row] || [];
        const expectedRow = expectedRows[row] || [];
        const colCount = Math.max(actualRow.length, expectedRow.length);
        for (let col = 0; col < colCount; col++) {
            const actualCell = actualRow[col];
            const expectedCell = expectedRow[col];
            if (actualCell?.ch === expectedCell?.ch
                && actualCell?.color === expectedCell?.color
                && actualCell?.attr === expectedCell?.attr
                && actualCell?.decgfx === expectedCell?.decgfx) continue;
            assert.fail(
                `${label}: first cell (${col},${row}); `
                + `actual ${JSON.stringify(actualCell)}, `
                + `expected ${JSON.stringify(expectedCell)}; `
                + `actual row ${JSON.stringify(screenRowText(actualRow))}; `
                + `expected row ${JSON.stringify(screenRowText(expectedRow))}`,
            );
        }
    }
}
