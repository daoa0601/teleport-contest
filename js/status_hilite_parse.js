import { fuzzyMatch, matchAttributeName, matchColorName } from './color_query.js';
import { BL_CHARACTERISTICS, BL_FLUSH, BL_CONDITION, BL_TITLE, BL_CAP, BL_ALIGN, BL_HUNGER, BL_HP, BL_AC, BL_EXP, BL_STR, BL_CH, BL_SCORE, BL_DX, BL_CO, BL_ENE, BL_ENEMAX, BL_XP, BL_HD, BL_TIME, BL_HPMAX, BL_LEVELDESC, BL_TH_VAL_ABSOLUTE, BL_TH_VAL_PERCENTAGE, BL_TH_UPDOWN, BL_TH_ALWAYS_HILITE, BL_TH_TEXTMATCH, BL_TH_CRITICALHP, BL_TH_NONE, LT_VALUE, LE_VALUE, GT_VALUE, GE_VALUE, EQ_VALUE, TXT_VALUE, NO_LTEQGT, HL_NONE, HL_BOLD, HL_DIM, HL_ITALIC, HL_ULINE, HL_BLINK, HL_INVERSE, CLR_MAX, LARGEST_INT, MAXBLSTATS, BL_ATTCLR_MAX, } from './const.js';
import { NO_COLOR } from './terminal.js';
import { statusFieldTable, conditionEntries, conditionAliasEntries, encStatNames, alignTexts, hungerTexts, } from './status_hilites.js';
const THRESHOLD_VALUE = 'hilite_status threshold ';
const IS_OUT_OF_RANGE = ' is out of range';
// wintype.h ATR_* values as carried by ATTRIBUTE_NAMES.
const ATR_NONE = 0, ATR_BOLD = 1, ATR_DIM = 2, ATR_ITALIC = 3, ATR_ULINE = 4, ATR_BLINK = 5, ATR_INVERSE = 7;
// botl.c fieldids_alias[].
const FIELD_ALIASES = [
    ['characteristics', BL_CHARACTERISTICS],
    ['encumbrance', BL_CAP],
    ['experience-points', BL_EXP],
    ['dx', BL_DX], ['co', BL_CO], ['con', BL_CO],
    ['points', BL_SCORE],
    ['cap', BL_CAP],
    ['pw', BL_ENE], ['pw-max', BL_ENEMAX],
    ['xl', BL_XP], ['xplvl', BL_XP],
    ['ac', BL_AC],
    ['hit-dice', BL_HD],
    ['turns', BL_TIME],
    ['hp', BL_HP], ['hp-max', BL_HPMAX],
    ['dgn', BL_LEVELDESC],
    ['xp', BL_EXP], ['exp', BL_EXP],
    ['flags', BL_CONDITION],
];
// botl.c fldname_to_bl_indx().
function fieldNameToIndex(name) {
    const table = statusFieldTable();
    if (!name)
        return BL_FLUSH;
    let fld = 0;
    let matches = 0;
    for (const field of table)
        if (fuzzyMatch(field.name, name)) {
            fld = field.fld;
            matches++;
        }
    if (!matches) {
        for (const [alias, value] of FIELD_ALIASES)
            if (fuzzyMatch(alias, name)) {
                fld = value;
                matches++;
            }
    }
    if (!matches) {
        for (const field of table)
            if (field.name.toLowerCase().startsWith(name.toLowerCase())) {
                fld = field.fld;
                matches++;
            }
    }
    return matches === 1 ? fld : BL_FLUSH;
}
// botl.c is_ltgt_percentnumber(): "[<>]?=?[-+]?[0-9]+%?"
function isLtgtPercentNumber(text) {
    return /^[<>]?=?[+-]?\d+%?$/.test(text);
}
// botl.c has_ltgt_percentnumber().
function hasLtgtPercentNumber(text) {
    return /^[<>=\-+0-9%]*$/.test(text);
}
// botl.c splitsubfields(): split on '+' or '&'.
function splitSubfields(text) {
    const pieces = text.split(/[+&]/);
    // C rejects fifteen separators, even when the final piece is empty.
    if (pieces.length >= 16)
        return [];
    if (pieces.length > 1 && pieces.at(-1) === '')
        pieces.pop();
    return pieces;
}
// C botl.c:is_fld_arrayvalues().
function isFieldArrayValue(text, values, minimum, maximum) {
    for (let index = minimum; index < maximum; index++) {
        const entry = values[index];
        if (entry !== undefined && entry !== null && entry.toLowerCase() === text.toLowerCase())
            return index;
    }
    return null;
}
// botl.c s_to_anything(): C's atoi()/atol() semantics stop at the first
// non-digit, so a leading number is read and anything after it ignored.
function cAtoi(text) {
    const match = /^[+-]?\d+/.exec(text.trim());
    return match ? Number.parseInt(match[0], 10) : 0;
}
function stripChars(text, remove) {
    return [...text].filter(character => !remove.includes(character)).join('');
}
/** botl.c parse_status_hl1(): split one config entry into rules. */
export function parseStatusHl1(option, addError, fromConfigFile = false, operations = []) {
    const MAX_THRESH = 21;
    const fields = Array.from({ length: MAX_THRESH }, () => '');
    let badOption = false;
    let fieldCount = 0;
    let count = 0;
    let position = 0;
    while (position < option.length && fieldCount < MAX_THRESH && count < 128 - 2) {
        const character = option[position]?.toLowerCase() ?? '';
        if (character === ' ') {
            if (fieldCount >= 1) {
                if (fieldCount === 1 && fields[0] === 'title') {
                    // spaces are allowed inside a title match
                    fields[fieldCount] += character;
                    count++;
                    position++;
                    continue;
                }
                if (!parseStatusHl2(fields, addError, fromConfigFile, operations)) {
                    badOption = true;
                    break;
                }
            }
            fields.fill('');
            fieldCount = 0;
            count = 0;
        }
        else if (character === '/') {
            fieldCount++;
            count = 0;
        }
        else {
            fields[fieldCount] += character;
            count++;
        }
        position++;
    }
    if (fieldCount >= 1 && !badOption) {
        if (!parseStatusHl2(fields, addError, fromConfigFile, operations))
            badOption = true;
    }
    if (badOption)
        return false;
    // make sure highlighting is On; use short duration for temp highlights
    operations.push({ enableDelta: true });
    return true;
}
/** botl.c parse_status_hl2(): parse one field/behavior/color rule. */
export function parseStatusHl2(fields, addError, fromConfigFile = false, operations = []) {
    void fromConfigFile;
    let successes = 0;
    let sidx = 0;
    const fld = fieldNameToIndex(fields[sidx] ?? '');
    if (fld === BL_CHARACTERISTICS) {
        // recursively set each of strength, dexterity, constitution, &c
        const table = statusFieldTable();
        for (const field of table) {
            if (field.fld >= BL_STR && field.fld <= BL_CH) {
                const copy = [...fields];
                copy[sidx] = field.name;
                if (!parseStatusHl2(copy, addError, false, operations))
                    return false;
            }
        }
        return true;
    }
    if (fld === BL_FLUSH) {
        addError(`Unknown status field '${fields[sidx] ?? ''}'`);
        return false;
    }
    if (fld === BL_CONDITION)
        return parseCondition(fields, sidx, addError, operations);
    sidx++;
    while ((fields[sidx] ?? '') !== '') {
        let txt = null;
        let percent = false, numeric = false, always = false;
        let down = false, up = false, changed = false;
        let criticalhp = false;
        let grt = false, gte = false, eq = false, le = false, lt = false;
        let txtval = false;
        const field = statusFieldTable().find(entry => entry.fld === fld);
        const anytype = field?.anytype ?? 'int';
        const idxmax = field?.idxmax ?? -1;
        const rule = {
            fld, set: false, anytype, value: 0,
            behavior: BL_TH_NONE, textmatch: '', rel: NO_LTEQGT, coloridx: 0,
        };
        let value = 0;
        let relation = NO_LTEQGT;
        const token = fields[sidx] ?? '';
        if ((fields[sidx + 1] ?? '') === '' || token.toLowerCase() === 'always') {
            // "field/always/color" OR "field/color"
            always = true;
            if ((fields[sidx + 1] ?? '') === '')
                sidx--;
        }
        else if (token.toLowerCase() === 'up' || token.toLowerCase() === 'down') {
            if (anytype === 'str') {
                // ordered string comparison is pointless; treat as 'changed'
            }
            else if (token.toLowerCase() === 'down')
                down = true;
            else
                up = true;
            changed = true;
        }
        else if (fld === BL_CAP
            && isFieldArrayValue(token, encStatNames(), 1, 6) !== null) {
            txt = encStatNames()[isFieldArrayValue(token, encStatNames(), 1, 6) ?? 0] ?? null;
            txtval = true;
        }
        else if (fld === BL_ALIGN
            && isFieldArrayValue(token, alignTexts(), 0, 3) !== null) {
            txt = alignTexts()[isFieldArrayValue(token, alignTexts(), 0, 3) ?? 0] ?? null;
            txtval = true;
        }
        else if (fld === BL_HUNGER
            && isFieldArrayValue(token, hungerTexts(), 0, 7) !== null) {
            txt = hungerTexts()[isFieldArrayValue(token, hungerTexts(), 0, 7) ?? 0] ?? null;
            txtval = true;
        }
        else if (token.toLowerCase() === 'changed') {
            changed = true;
        }
        else if (fld === BL_HP && token.toLowerCase() === 'criticalhp') {
            criticalhp = true;
        }
        else if (isLtgtPercentNumber(token)) {
            percent = token.includes('%');
            if (token.startsWith('<')) {
                if (token[1] === '=')
                    le = true;
                else
                    lt = true;
            }
            else if (token.startsWith('>')) {
                if (token[1] === '=')
                    gte = true;
                else
                    grt = true;
            }
            const digits = stripChars(token, '%<>=+');
            numeric = true;
            value = cAtoi(digits);
            const op = grt ? '>' : gte ? '>=' : lt ? '<' : le ? '<=' : '=';
            const minimum = fld === BL_AC ? -128 : grt ? -1 : lt ? 1 : 0;
            const maximum = percent ? (lt ? 101 : 100) : LARGEST_INT;
            if ((anytype === 'int' || percent) && (value < minimum || value > maximum)) {
                addError(`${THRESHOLD_VALUE}'${op}${value}${percent ? '%' : ''}'${IS_OUT_OF_RANGE}`);
                return false;
            }
            if (anytype === 'long'
                && value < (grt ? -1 : lt ? 1 : 0)) {
                addError(`${THRESHOLD_VALUE}'${op}${value}'${IS_OUT_OF_RANGE}`);
                return false;
            }
        }
        else if (anytype === 'str') {
            txt = token;
            txtval = true;
        }
        else {
            addError(hasLtgtPercentNumber(token)
                ? `Wrong format '${token}', expected a threshold number or percent`
                : `Unknown behavior '${token}'`);
            return false;
        }
        // relationships {LT_VALUE, LE_VALUE, EQ_VALUE, GE_VALUE, GT_VALUE}
        if (grt || up)
            relation = GT_VALUE;
        else if (lt || down)
            relation = LT_VALUE;
        else if (gte)
            relation = GE_VALUE;
        else if (le)
            relation = LE_VALUE;
        else if (eq || percent || numeric || changed)
            relation = EQ_VALUE;
        else if (txtval)
            relation = TXT_VALUE;
        else
            relation = LT_VALUE;
        if (anytype === 'str' && (percent || numeric)) {
            const name = statusFieldTable().find(entry => entry.fld === fld)?.name ?? '';
            addError(`Field '${name}' does not support numeric values`);
            return false;
        }
        if (percent) {
            if (idxmax < 0) {
                const name = statusFieldTable().find(entry => entry.fld === fld)?.name ?? '';
                addError(`Cannot use percent with '${name}'`);
                return false;
            }
            // The pinned C compares these boundary values to the relation
            // constants by mistake, rejecting both -1% and 101%.
            if (value < -1 || value === -1
                || (value === 0 && relation === LT_VALUE)
                || (value === 100 && relation === GT_VALUE)
                || value === 101 || value > 101) {
                const prefix = relation === LT_VALUE ? '<'
                    : relation === LE_VALUE ? '<='
                        : relation === GT_VALUE ? '>'
                            : relation === GE_VALUE ? '>=' : '=';
                addError(`hilite_status: invalid percentage value '${prefix}${value}%'`);
                return false;
            }
        }
        // actions
        sidx++;
        const how = fields[sidx] ?? '';
        if (how === '') {
            if (!successes)
                return false;
        }
        let coloridx = -1;
        let dispAttrib = 0;
        const subfields = splitSubfields(how);
        if (subfields.length < 1)
            return false;
        for (const subfield of subfields) {
            const attribute = matchAttributeName(subfield, null);
            if (attribute === ATR_BOLD)
                dispAttrib |= HL_BOLD;
            else if (attribute === ATR_DIM)
                dispAttrib |= HL_DIM;
            else if (attribute === ATR_ITALIC)
                dispAttrib |= HL_ITALIC;
            else if (attribute === ATR_ULINE)
                dispAttrib |= HL_ULINE;
            else if (attribute === ATR_BLINK)
                dispAttrib |= HL_BLINK;
            else if (attribute === ATR_INVERSE)
                dispAttrib |= HL_INVERSE;
            else if (attribute === ATR_NONE)
                dispAttrib = HL_NONE;
            else {
                const color = matchColorName(subfield, addError);
                if (color >= CLR_MAX || coloridx !== -1) {
                    addError(`bad color '${color} ${coloridx}'`);
                    return false;
                }
                coloridx = color;
            }
        }
        if (coloridx === -1)
            coloridx = NO_COLOR;
        rule.coloridx = coloridx | (dispAttrib << 8);
        if (always)
            rule.behavior = BL_TH_ALWAYS_HILITE;
        else if (percent)
            rule.behavior = BL_TH_VAL_PERCENTAGE;
        else if (changed)
            rule.behavior = BL_TH_UPDOWN;
        else if (numeric)
            rule.behavior = BL_TH_VAL_ABSOLUTE;
        else if (txtval)
            rule.behavior = BL_TH_TEXTMATCH;
        else if (value !== 0)
            rule.behavior = BL_TH_VAL_ABSOLUTE;
        else if (criticalhp)
            rule.behavior = BL_TH_CRITICALHP;
        else
            rule.behavior = BL_TH_NONE;
        rule.rel = relation;
        rule.value = value;
        if (rule.behavior === BL_TH_TEXTMATCH && txt !== null)
            rule.textmatch = txt.trim();
        rule.set = true;
        operations.push({ threshold: { fld, rule } });
        successes++;
        sidx++;
    }
    return successes > 0;
}
/** botl.c parse_condition(). */
function parseCondition(fields, start, addError, operations) {
    let result = false;
    let coloridx = NO_COLOR;
    let sidx = start;
    sidx++;
    if ((fields[sidx] ?? '') === '') {
        addError('Missing condition(s)');
        return false;
    }
    while ((fields[sidx] ?? '') !== '') {
        const bits = str2ConditionBitmask(fields[sidx] ?? '', addError);
        if (!bits)
            return false;
        sidx++;
        const how = fields[sidx] ?? '';
        if (how === '') {
            addError('Missing color+attribute');
            return false;
        }
        const subfields = splitSubfields(how);
        const setBits = (index) => {
            operations.push({ condition: { index, bits, clear: false } });
        };
        const clearBits = (index) => {
            operations.push({ condition: { index, bits, clear: true } });
        };
        for (const subfield of subfields) {
            const attribute = matchAttributeName(subfield, null);
            if (attribute === ATR_BOLD)
                setBits(CLR_MAX + 2);
            else if (attribute === ATR_DIM)
                setBits(CLR_MAX + 3);
            else if (attribute === ATR_ITALIC)
                setBits(CLR_MAX + 4);
            else if (attribute === ATR_ULINE)
                setBits(CLR_MAX + 5);
            else if (attribute === ATR_BLINK)
                setBits(CLR_MAX + 6);
            else if (attribute === ATR_INVERSE)
                setBits(CLR_MAX + 7);
            else if (attribute === ATR_NONE) {
                for (let index = CLR_MAX + 2; index < CLR_MAX + 8; index++)
                    clearBits(index);
            }
            else {
                const color = matchColorName(subfield, addError);
                if (color >= CLR_MAX) {
                    addError(`bad color ${color}`);
                    return false;
                }
                coloridx = color;
            }
        }
        operations.push({ condition: { index: coloridx, bits, clear: false } });
        result = true;
        sidx++;
    }
    return result;
}
// botl.c str2conditionbitmask().
function str2ConditionBitmask(text, addError) {
    let mask = 0;
    const subfields = splitSubfields(text);
    if (subfields.length < 1)
        return 0;
    for (const subfield of subfields) {
        const bits = matchConditionBitmask(subfield);
        if (!bits) {
            addError(`Unknown condition '${subfield}'`);
            return 0;
        }
        mask |= bits;
    }
    return mask;
}
// botl.c match_str2conditionbitmask().
function matchConditionBitmask(text) {
    let mask = 0;
    let matches = 0;
    if (!text)
        return 0;
    for (const [bit, name] of conditionEntries())
        if (fuzzyMatch(name, text)) {
            mask |= bit;
            matches++;
        }
    if (!matches) {
        for (const [alias, bits] of conditionAliasEntries())
            if (fuzzyMatch(alias, text)) {
                mask |= bits;
                matches++;
            }
    }
    if (!matches) {
        for (const [alias, bits] of conditionAliasEntries())
            if (alias.toLowerCase().startsWith(text.toLowerCase())) {
                mask |= bits;
                matches++;
            }
    }
    return mask;
}
// Apply every successful installation, including those before a parse error.
// Each config entry is applied immediately so later options see its changes.
export function replayStatusHiliteOperations(operations, iflags) {
    for (const operation of operations) {
        if (operation.threshold) {
            const thresholds = iflags.statusThresholds
                ??= Array.from({ length: MAXBLSTATS }, () => []);
            thresholds[operation.threshold.fld]?.push(operation.threshold.rule);
        }
        if (operation.condition) {
            const conditions = iflags.condHilites
                ??= new Array(BL_ATTCLR_MAX).fill(0);
            const { index, bits, clear } = operation.condition;
            conditions[index] = clear
                ? (conditions[index] ?? 0) & ~bits
                : (conditions[index] ?? 0) | bits;
        }
        if (operation.enableDelta && !iflags.hiliteDelta)
            iflags.hiliteDelta = 3;
    }
}
//# sourceMappingURL=status_hilite_parse.js.map