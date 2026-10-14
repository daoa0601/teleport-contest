const capacityText = [
    ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'],
    ['', 'Burden', 'Stress', 'Strain', 'Overtax', 'Overload'],
    ['', 'Brd', 'Strs', 'Strn', 'Ovtx', 'Ovld'],
];
export function capacityIndex(label) {
    return Math.max(0, capacityText[0]?.indexOf(label ?? '') ?? 0);
}
// wintty.c:make_things_fit() tries all condition abbreviations, then both
// encumbrance abbreviations, then Dlvl -> Dl, before truncating at cols-1.
export function renderStatusLine2(fields, columns) {
    const attempts = [
        [0, 0, false], [1, 0, false], [2, 0, false],
        [2, 1, false], [2, 2, false], [2, 2, true],
    ];
    let line = '';
    for (const [conditionSize, capacitySize, shortLevel] of attempts) {
        const location = shortLevel ? fields.location.replace(/^[^:]+:/, 'Dl:') : fields.location;
        line = `${location} ${fields.gold} ${fields.health} ${fields.experience}`;
        if (fields.moves !== null)
            line += ` T:${fields.moves}`;
        if (fields.hunger)
            line += ` ${fields.hunger}`;
        const load = capacityText[capacitySize]?.[fields.capacity] ?? '';
        if (load || capacitySize > 0)
            line += ` ${load}`;
        for (const condition of fields.conditions)
            line += ` ${condition[conditionSize]}`;
        for (const equipment of fields.equipment)
            line += ` ${equipment}`;
        if (fields.version) {
            // The last field is right justified, with its leading separator
            // still counted by make_things_fit().
            const gap = Math.max(1, columns - 1 - line.length - fields.version.length);
            line += ' '.repeat(gap) + fields.version;
        }
        if (line.length <= columns - 1)
            return line;
    }
    return line.slice(0, Math.max(0, columns - 1));
}
//# sourceMappingURL=status_layout.js.map