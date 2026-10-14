import type { ConditionText } from './status_conditions.js';

// Retain full field values so a time-only flush can restore or shorten the
// same fields again, without reading health or conditions from live state.
export interface StatusLine2Fields {
    location: string;
    gold: string;
    health: string;
    experience: string;
    moves: number | null;
    hunger: string;
    capacity: number;
    conditions: readonly ConditionText[];
    equipment: readonly string[];
    version: string;
}

export interface StatusLine2Layout {
    text: string;
    capacityBlank: boolean;
    levelPrefixChanged: boolean;
}

const capacityText: readonly (readonly string[])[] = [
    ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'],
    ['', 'Burden', 'Stress', 'Strain', 'Overtax', 'Overload'],
    ['', 'Brd', 'Strs', 'Strn', 'Ovtx', 'Ovld'],
];

// wintty.c:make_things_fit() tries all condition abbreviations, then both
// encumbrance abbreviations, then Dlvl -> Dl, before truncating at cols-1.
export function renderStatusLine2(
    fields: StatusLine2Fields,
    columns: number,
    capacityBlank = false,
    levelPrefixChanged = false,
): StatusLine2Layout {
    const attempts: readonly (readonly [0 | 1 | 2, 0 | 1 | 2, boolean])[] = [
        [0, 0, false], [1, 0, false], [2, 0, false],
        [2, 1, false], [2, 2, false], [2, 2, true],
    ];
    let line = '';
    let emptyCapacitySpace = fields.capacity === 0 && capacityBlank;
    // shrink_dlvl(0) restores Dlvl, even when the original label was Tutorial.
    const fullLocation = levelPrefixChanged
        ? fields.location.replace(/^[^:]+:/, 'Dlvl:') : fields.location;
    let prefixChanged = levelPrefixChanged;
    for (const [conditionSize, capacitySize, shortLevel] of attempts) {
        const location = shortLevel ? fullLocation.replace(/^[^:]+:/, 'Dl:') : fullLocation;
        if (location !== fullLocation) prefixChanged = true;
        line = `${location} ${fields.gold} ${fields.health} ${fields.experience}`;
        if (fields.moves !== null) line += ` T:${fields.moves}`;
        if (fields.hunger) line += ` ${fields.hunger}`;
        const load = capacityText[capacitySize]?.[fields.capacity] ?? '';
        // shrink_enc() leaves a blank even for an unencumbered hero.
        // Restoring the full label on later flushes preserves that blank.
        if (fields.capacity === 0 && capacitySize > 0) emptyCapacitySpace = true;
        if (load || emptyCapacitySpace) line += ` ${load}`;
        for (const condition of fields.conditions) line += ` ${condition[conditionSize]}`;
        for (const equipment of fields.equipment) line += ` ${equipment}`;
        if (fields.version) {
            // The last field is right justified, with its leading separator
            // still counted by make_things_fit().
            const gap = Math.max(1, columns - 1 - line.length - fields.version.length);
            line += ' '.repeat(gap) + fields.version;
        }
        if (line.length <= columns - 1)
            return { text: line, capacityBlank: emptyCapacitySpace, levelPrefixChanged: prefixChanged };
    }
    return {
        text: line.slice(0, Math.max(0, columns - 1)),
        capacityBlank: emptyCapacitySpace,
        levelPrefixChanged: prefixChanged,
    };
}
