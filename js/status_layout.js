import { statusConditionBit } from './status_conditions.js';
import { BL_LEVELDESC, BL_GOLD, BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC, BL_XP, BL_HD, BL_EXP, BL_TIME, BL_HUNGER, BL_CAP, BL_CONDITION, BL_VERS } from './const.js';
const capacityText = [
    ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'],
    ['', 'Burden', 'Stress', 'Strain', 'Overtax', 'Overload'],
    ['', 'Brd', 'Strs', 'Strn', 'Ovtx', 'Ovld'],
];
// wintty.c:make_things_fit() tries all condition abbreviations, then both
// encumbrance abbreviations, then Dlvl -> Dl, before truncating at cols-1.
export function renderStatusLine2(fields, columns, capacityBlank = false, levelPrefixChanged = false) {
    const attempts = [
        [0, 0, false], [1, 0, false], [2, 0, false],
        [2, 1, false], [2, 2, false], [2, 2, true],
    ];
    let line = '';
    let spans = [];
    let emptyCapacitySpace = fields.capacity === 0 && capacityBlank;
    // shrink_dlvl(0) restores Dlvl, even when the original label was Tutorial.
    const fullLocation = levelPrefixChanged
        ? fields.location.replace(/^[^:]+:/, 'Dlvl:') : fields.location;
    let prefixChanged = levelPrefixChanged;
    for (const [conditionSize, capacitySize, shortLevel] of attempts) {
        const location = shortLevel ? fullLocation.replace(/^[^:]+:/, 'Dl:') : fullLocation;
        if (location !== fullLocation)
            prefixChanged = true;
        line = '';
        spans = [];
        const append = (text, field, condition) => {
            const start = line.length;
            line += text;
            spans.push({ field, start, end: line.length, ...(condition !== undefined ? { condition } : {}) });
        };
        const appendSeparated = (text, field) => { line += ' '; append(text, field); };
        append(location, BL_LEVELDESC);
        appendSeparated(fields.gold, BL_GOLD);
        line += ' ';
        append(`HP:${fields.health.hitpoints}`, BL_HP);
        append(`(${fields.health.maximumHitpoints})`, BL_HPMAX);
        appendSeparated(`Pw:${fields.health.power}`, BL_ENE);
        append(`(${fields.health.maximumPower})`, BL_ENEMAX);
        appendSeparated(`AC:${fields.health.armorClass}`, BL_AC);
        const [level, experience] = fields.experience.split('/');
        appendSeparated(level ?? '', fields.experience.startsWith('HD:') ? BL_HD : BL_XP);
        if (experience !== undefined) {
            line += '/';
            append(experience, BL_EXP);
        }
        if (fields.moves !== null)
            appendSeparated(`T:${fields.moves}`, BL_TIME);
        if (fields.hunger)
            appendSeparated(fields.hunger, BL_HUNGER);
        const load = capacityText[capacitySize]?.[fields.capacity] ?? '';
        // shrink_enc() leaves a blank even for an unencumbered hero.
        // Restoring the full label on later flushes preserves that blank.
        if (fields.capacity === 0 && capacitySize > 0)
            emptyCapacitySpace = true;
        if (load || emptyCapacitySpace)
            appendSeparated(load, BL_CAP);
        for (const condition of fields.conditions) {
            line += ' ';
            append(condition[conditionSize], BL_CONDITION, statusConditionBit(condition));
        }
        for (const equipment of fields.equipment)
            appendSeparated(equipment.text, equipment.field);
        if (fields.version) {
            // The last field is right justified, with its leading separator
            // still counted by make_things_fit().
            const gap = Math.max(1, columns - 1 - line.length - fields.version.length);
            line += ' '.repeat(gap);
            append(fields.version, BL_VERS);
        }
        if (line.length <= columns - 1)
            return { text: line, spans, capacityBlank: emptyCapacitySpace, levelPrefixChanged: prefixChanged };
    }
    return {
        text: line.slice(0, Math.max(0, columns - 1)),
        spans,
        capacityBlank: emptyCapacitySpace,
        levelPrefixChanged: prefixChanged,
    };
}
//# sourceMappingURL=status_layout.js.map