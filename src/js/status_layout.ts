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
}

const capacityText: readonly (readonly string[])[] = [
    ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'],
    ['', 'Burden', 'Stress', 'Strain', 'Overtax', 'Overload'],
    ['', 'Brd', 'Strs', 'Strn', 'Ovtx', 'Ovld'],
];

export function capacityIndex(label: string | undefined): number {
    return Math.max(0, capacityText[0]?.indexOf(label ?? '') ?? 0);
}

// wintty.c:make_things_fit() tries all condition abbreviations, then both
// encumbrance abbreviations, then Dlvl -> Dl, before truncating at cols-1.
export function renderStatusLine2(fields: StatusLine2Fields, columns: number): string {
    const attempts: readonly (readonly [0 | 1 | 2, 0 | 1 | 2, boolean])[] = [
        [0, 0, false], [1, 0, false], [2, 0, false],
        [2, 1, false], [2, 2, false], [2, 2, true],
    ];
    let line = '';
    for (const [conditionSize, capacitySize, shortLevel] of attempts) {
        const location = shortLevel ? fields.location.replace(/^[^:]+:/, 'Dl:') : fields.location;
        line = `${location} ${fields.gold} ${fields.health} ${fields.experience}`;
        if (fields.moves !== null) line += ` T:${fields.moves}`;
        if (fields.hunger) line += ` ${fields.hunger}`;
        const load = capacityText[capacitySize]?.[fields.capacity] ?? '';
        if (load || capacitySize > 0) line += ` ${load}`;
        for (const condition of fields.conditions) line += ` ${condition[conditionSize]}`;
        if (line.length <= columns - 1) return line;
    }
    return line.slice(0, Math.max(0, columns - 1));
}
