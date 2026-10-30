// botl.c STATUS_HILITES: the interactive status-hilite rule menus reached
// from the options menus ("status highlight rules"), and the rule store
// (blstats[][].thresholds plus gc.cond_hilites) that they edit.
import { game } from './gstate.js';
import { pline } from './display.js';
import { getLine } from './query.js';
import { showMultiSelectWindow, showTextWindow } from './windows.js';
import { colorName, queryAttributeSet, queryAttributeMenu, queryColorMenu } from './color_query.js';
import { BL_AC, BL_ALIGN, BL_ARMOR, BL_CAP, BL_CONDITION, BL_ENE, BL_ENEMAX, BL_EXP, BL_FLUSH, BL_HP, BL_HPMAX, BL_HUNGER, BL_MASK_BAREH, BL_MASK_BLIND, BL_MASK_BUSY, BL_MASK_CONF, BL_TERRAIN, BL_WEAPON, BL_XP, BL_MASK_DEAF, BL_MASK_ELF_IRON, BL_MASK_FLY, BL_MASK_FOODPOIS, BL_MASK_GLOWHANDS, BL_MASK_GRAB, BL_MASK_HALLU, BL_MASK_HELD, BL_MASK_HOLDING, BL_MASK_ICY, BL_MASK_INLAVA, BL_MASK_LEV, BL_MASK_PARLYZ, BL_MASK_RIDE, BL_MASK_SLEEPING, BL_MASK_SLIME, BL_MASK_SLIPPERY, BL_MASK_STONE, BL_MASK_STRNGL, BL_MASK_STUN, BL_MASK_SUBMERGED, BL_MASK_TERMILL, BL_MASK_TETHERED, BL_MASK_TRAPPED, BL_MASK_UNCONSC, BL_MASK_WOUNDEDL, BL_SCORE, BL_TH_ALWAYS_HILITE, BL_TH_CONDITION, BL_TH_CRITICALHP, BL_TH_NONE, BL_TH_TEXTMATCH, BL_TH_UPDOWN, BL_TH_VAL_ABSOLUTE, BL_TH_VAL_PERCENTAGE, BL_TIME, BL_TITLE, BL_VERS, CLR_MAX, EQ_VALUE, GE_VALUE, GT_VALUE, HL_BLINK, HL_BOLD, HL_DIM, HL_INVERSE, HL_ITALIC, HL_NONE, HL_ULINE, LE_VALUE, LT_VALUE, MAXBLSTATS, NO_LTEQGT, TXT_VALUE, } from './const.js';
import { NO_COLOR } from './terminal.js';
// botl.c initblstats[] in its own order: the menus index this table by
// position, not by enum value. The last five rows are permuted — the table
// runs condition, version, weapon, armor, terrain while the enum numbers
// weapon, armor, terrain, vers — and `fld` below carries C's initblstats[].fld
// (the enum value) exactly, so the main menu's identifiers pick the shifted
// rows just as native does. idxmax is the field a percentage is taken
// against (-1: no percentage rules).
const STATUS_FIELDS = [
    { fld: BL_TITLE, name: 'title', anytype: 'str', idxmax: -1 },
    { fld: 1, name: 'strength', anytype: 'int', idxmax: -1 },
    { fld: 2, name: 'dexterity', anytype: 'int', idxmax: -1 },
    { fld: 3, name: 'constitution', anytype: 'int', idxmax: -1 },
    { fld: 4, name: 'intelligence', anytype: 'int', idxmax: -1 },
    { fld: 5, name: 'wisdom', anytype: 'int', idxmax: -1 },
    { fld: 6, name: 'charisma', anytype: 'int', idxmax: -1 },
    { fld: 7, name: 'alignment', anytype: 'str', idxmax: -1 },
    { fld: BL_SCORE, name: 'score', anytype: 'long', idxmax: -1 },
    { fld: 9, name: 'carrying-capacity', anytype: 'int', idxmax: -1 },
    { fld: 10, name: 'gold', anytype: 'long', idxmax: -1 },
    { fld: BL_ENE, name: 'power', anytype: 'int', idxmax: BL_ENEMAX },
    { fld: BL_ENEMAX, name: 'power-max', anytype: 'int', idxmax: -1 },
    { fld: BL_XP, name: 'experience-level', anytype: 'int', idxmax: BL_EXP },
    { fld: BL_AC, name: 'armor-class', anytype: 'int', idxmax: -1 },
    { fld: 15, name: 'HD', anytype: 'int', idxmax: -1 },
    { fld: 16, name: 'time', anytype: 'long', idxmax: -1 },
    { fld: BL_HUNGER, name: 'hunger', anytype: 'int', idxmax: -1 },
    { fld: BL_HP, name: 'hitpoints', anytype: 'int', idxmax: BL_HPMAX },
    { fld: BL_HPMAX, name: 'hitpoints-max', anytype: 'int', idxmax: -1 },
    { fld: 20, name: 'dungeon-level', anytype: 'str', idxmax: -1 },
    { fld: BL_EXP, name: 'experience', anytype: 'long', idxmax: BL_EXP },
    { fld: BL_CONDITION, name: 'condition', anytype: 'mask32', idxmax: -1 },
    { fld: BL_VERS, name: 'version', anytype: 'str', idxmax: -1 },
    { fld: BL_WEAPON, name: 'weapon', anytype: 'str', idxmax: -1 },
    { fld: BL_ARMOR, name: 'armor', anytype: 'str', idxmax: -1 },
    { fld: BL_TERRAIN, name: 'terrain', anytype: 'str', idxmax: -1 },
];
if (STATUS_FIELDS.length !== MAXBLSTATS)
    throw new Error('initblstats must list every status field');
/** botl.c initblstats[] table for the config rule parser. */
export function statusFieldTable() {
    return STATUS_FIELDS;
}
// botl.c conditions[]: the picker order and canonical display names.
const HILITE_CONDITIONS = [
    [BL_MASK_BAREH, 'Bare'], [BL_MASK_BLIND, 'Blind'], [BL_MASK_BUSY, 'Busy'],
    [BL_MASK_CONF, 'Conf'], [BL_MASK_DEAF, 'Deaf'], [BL_MASK_ELF_IRON, 'Iron'],
    [BL_MASK_FLY, 'Fly'], [BL_MASK_FOODPOIS, 'FoodPois'], [BL_MASK_GLOWHANDS, 'Glow'],
    [BL_MASK_GRAB, 'Grab'], [BL_MASK_HALLU, 'Hallu'], [BL_MASK_HELD, 'Held'],
    [BL_MASK_ICY, 'Icy'], [BL_MASK_INLAVA, 'InLava'], [BL_MASK_LEV, 'Lev'],
    [BL_MASK_PARLYZ, 'Parlyz'], [BL_MASK_RIDE, 'Ride'], [BL_MASK_SLEEPING, 'Zzz'],
    [BL_MASK_SLIME, 'Slime'], [BL_MASK_SLIPPERY, 'Slip'], [BL_MASK_STONE, 'Stone'],
    [BL_MASK_STRNGL, 'Strngl'], [BL_MASK_STUN, 'Stun'], [BL_MASK_SUBMERGED, 'Submrg'],
    [BL_MASK_TERMILL, 'TermIll'], [BL_MASK_TETHERED, 'Teth'], [BL_MASK_TRAPPED, 'Trap'],
    [BL_MASK_UNCONSC, 'Out'], [BL_MASK_WOUNDEDL, 'WLegs'], [BL_MASK_HOLDING, 'UHold'],
];
/** botl.c conditions[] for the config rule parser. */
export function conditionEntries() {
    return HILITE_CONDITIONS;
}
// botl.c condition_aliases[]; conditionbitmask2str() starts comparing at
// index 1, so the "strangled" spelling never names a rendered mask.
const CONDITION_ALIASES = [
    ['strangled', BL_MASK_STRNGL],
    ['all', BL_MASK_BAREH | BL_MASK_BLIND | BL_MASK_BUSY | BL_MASK_CONF | BL_MASK_DEAF
            | BL_MASK_ELF_IRON | BL_MASK_FLY | BL_MASK_FOODPOIS | BL_MASK_GLOWHANDS
            | BL_MASK_GRAB | BL_MASK_HALLU | BL_MASK_HELD | BL_MASK_ICY | BL_MASK_INLAVA
            | BL_MASK_LEV | BL_MASK_PARLYZ | BL_MASK_RIDE | BL_MASK_SLEEPING | BL_MASK_SLIME
            | BL_MASK_SLIPPERY | BL_MASK_STONE | BL_MASK_STRNGL | BL_MASK_STUN
            | BL_MASK_SUBMERGED | BL_MASK_TERMILL | BL_MASK_TETHERED | BL_MASK_TRAPPED
            | BL_MASK_UNCONSC | BL_MASK_WOUNDEDL | BL_MASK_HOLDING],
    ['major_troubles', BL_MASK_FOODPOIS | BL_MASK_GRAB | BL_MASK_INLAVA | BL_MASK_SLIME
            | BL_MASK_STONE | BL_MASK_STRNGL | BL_MASK_TERMILL],
    ['minor_troubles', BL_MASK_BLIND | BL_MASK_CONF | BL_MASK_DEAF | BL_MASK_HALLU
            | BL_MASK_PARLYZ | BL_MASK_SUBMERGED | BL_MASK_STUN],
    ['movement', BL_MASK_LEV | BL_MASK_FLY | BL_MASK_RIDE],
    ['opt_in', BL_MASK_BAREH | BL_MASK_BUSY | BL_MASK_GLOWHANDS | BL_MASK_HELD | BL_MASK_ICY
            | BL_MASK_PARLYZ | BL_MASK_SLEEPING | BL_MASK_SLIPPERY | BL_MASK_SUBMERGED
            | BL_MASK_TETHERED | BL_MASK_TRAPPED | BL_MASK_UNCONSC | BL_MASK_WOUNDEDL
            | BL_MASK_HOLDING],
];
/** botl.c condition_aliases[] for the config rule parser. */
export function conditionAliasEntries() {
    return CONDITION_ALIASES;
}
// botl.c enc_stat[] (index SLT_ENCUMBER..OVERLOADED), the alignment texts,
// and the hunger names hu_stat[] carries between Satiated and Hungry.
const ENC_STAT = ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'];
const ALIGN_TEXTS = ['chaotic', 'neutral', 'lawful'];
const HUNGER_TEXTS = ['Satiated', null, 'Hungry', 'Weak', 'Fainting', 'Fainted', 'Starved'];
/** botl.c enc_stat[] indices SLT_ENCUMBER..OVERLOADED. */
export function encStatNames() {
    return ENC_STAT;
}
/** botl.c aligntxt[]. */
export function alignTexts() {
    return ALIGN_TEXTS;
}
/** botl.c hutxt[]: hu_stat[] names between Satiated and Starved. */
export function hungerTexts() {
    return HUNGER_TEXTS;
}
// threshold_value / is_out_of_range fragments of the out-of-range plines.
const THRESHOLD_VALUE = 'hilite_status threshold ';
const IS_OUT_OF_RANGE = ' is out of range';
const HL_ATTCLR_BOLD = CLR_MAX + 2;
const HL_ATTCLR_DIM = CLR_MAX + 3;
const HL_ATTCLR_ITALIC = CLR_MAX + 4;
const HL_ATTCLR_ULINE = CLR_MAX + 5;
const HL_ATTCLR_BLINK = CLR_MAX + 6;
const HL_ATTCLR_INVERSE = CLR_MAX + 7;
const BL_ATTCLR_MAX = CLR_MAX + 8;
function fieldThresholds() {
    return game.iflags.statusThresholds ??= Array.from({ length: MAXBLSTATS }, () => []);
}
function condHilites() {
    return game.iflags.condHilites ??= new Array(BL_ATTCLR_MAX).fill(0);
}
// botl.c conditionbitmask2str(): canonical names joined with '+', replaced
// by an alias name when the whole mask equals that alias.
function conditionBitmaskToString(mask) {
    if (!mask)
        return '';
    let alias = null;
    for (const [aliasName, aliasMask] of CONDITION_ALIASES.slice(1))
        if (aliasMask === mask)
            alias = aliasName;
    const text = HILITE_CONDITIONS.filter(([bit]) => (bit & mask) !== 0)
        .map(([, name]) => name).join('+');
    return text && alias ? alias : text;
}
// botl.c hlattr2attrname(): the attribute half of a hilite rule's
// coloridx, as written into config-format rule text.
function hlAttrToAttrName(attrib) {
    if (!attrib)
        return null;
    if (attrib === HL_NONE)
        return 'normal';
    const parts = [];
    if (attrib & HL_BOLD)
        parts.push('bold');
    if (attrib & HL_DIM)
        parts.push('dim');
    if (attrib & HL_ITALIC)
        parts.push('italic');
    if (attrib & HL_ULINE)
        parts.push('underline');
    if (attrib & HL_BLINK)
        parts.push('blink');
    if (attrib & HL_INVERSE)
        parts.push('inverse');
    return parts.join('+') || null;
}
// botl.c status_hilite2str(): the config-format "field/behavior/color"
// rendering of one rule. a_int reads truncate the stored value to 32 bits
// for both int and long rules, as C's union read does in practice.
function statusHiliteToString(rule) {
    const field = STATUS_FIELDS[rule.fld];
    const op = rule.rel === LT_VALUE ? '<' : rule.rel === LE_VALUE ? '<='
        : rule.rel === GT_VALUE ? '>' : rule.rel === GE_VALUE ? '>='
            : rule.rel === EQ_VALUE ? '=' : '';
    let behave = '';
    switch (rule.behavior) {
        case BL_TH_VAL_PERCENTAGE:
            behave = `${op}${rule.value | 0}%`;
            break;
        case BL_TH_UPDOWN:
            behave = rule.rel === LT_VALUE ? 'down' : rule.rel === GT_VALUE ? 'up' : 'changed';
            break;
        case BL_TH_VAL_ABSOLUTE:
            behave = `${op}${rule.value | 0}`;
            break;
        case BL_TH_TEXTMATCH:
            behave = rule.textmatch;
            break;
        case BL_TH_CONDITION:
            behave = conditionBitmaskToString(rule.value);
            break;
        case BL_TH_ALWAYS_HILITE:
            behave = 'always';
            break;
        case BL_TH_CRITICALHP:
            behave = 'criticalhp';
            break;
        default: break;
    }
    const attr = rule.coloridx >> 8;
    const clrbuf = colorName(rule.coloridx & 0xff).replace(/ /g, '-')
        + (attr !== 0 ? `&${hlAttrToAttrName(attr) ?? ''}` : '');
    return `${field?.name ?? ''}/${behave}/${clrbuf}`;
}
// C keeps the gathered display list in function statics; ids restart at one
// for every gather. Rules live on the per-game flags, this list does not.
let hiliteStrs = [];
let hiliteStrId = 0;
function linestrAdd(fld, rule, mask, str) {
    // status_hilite_linestr_add() strips every space except for title rows.
    hiliteStrs.push({ id: ++hiliteStrId, fld, rule, mask,
        str: fld === BL_TITLE ? str : str.replace(/ /g, '') });
}
function linestrDone() {
    hiliteStrs = [];
    hiliteStrId = 0;
}
function linestrCountField(fld) {
    return hiliteStrs.reduce((count, line) => count + (fld === BL_FLUSH || line.fld === fld ? 1 : 0), 0);
}
// botl.c status_hilite_linestr_gather_conditions(): every condition mask
// that shares a color/attribute pair becomes one grouped rule row.
function linestrGatherConditions() {
    const condMaps = HILITE_CONDITIONS.map(() => ({ mask: 0, clratr: -1 }));
    for (const [mask] of HILITE_CONDITIONS) {
        const conds = condHilites();
        let clr = NO_COLOR;
        let atr = HL_NONE;
        for (let j = 0; j < CLR_MAX; j++)
            if (((conds[j] ?? 0) & mask) !== 0) {
                clr = j;
                break;
            }
        if (((conds[HL_ATTCLR_BOLD] ?? 0) & mask) !== 0)
            atr |= HL_BOLD;
        if (((conds[HL_ATTCLR_DIM] ?? 0) & mask) !== 0)
            atr |= HL_DIM;
        if (((conds[HL_ATTCLR_ITALIC] ?? 0) & mask) !== 0)
            atr |= HL_ITALIC;
        if (((conds[HL_ATTCLR_ULINE] ?? 0) & mask) !== 0)
            atr |= HL_ULINE;
        if (((conds[HL_ATTCLR_BLINK] ?? 0) & mask) !== 0)
            atr |= HL_BLINK;
        if (((conds[HL_ATTCLR_INVERSE] ?? 0) & mask) !== 0)
            atr |= HL_INVERSE;
        if (atr !== HL_NONE)
            atr &= ~HL_NONE;
        if (clr === NO_COLOR && atr === HL_NONE)
            continue;
        const ca = clr | (atr << 8);
        const existing = condMaps.find(entry => entry.clratr === ca);
        if (existing)
            existing.mask |= mask;
        else {
            const free = condMaps.find(entry => entry.mask === 0);
            if (free) {
                free.mask = mask;
                free.clratr = ca;
            }
        }
    }
    for (const { mask, clratr } of condMaps) {
        if (!mask)
            continue;
        const clr = clratr & 0xff;
        const atr = clratr >> 8;
        if (clr === NO_COLOR && atr === HL_NONE)
            continue;
        const clrbuf = colorName(clr).replace(/ /g, '-')
            + (hlAttrToAttrName(atr) !== null ? `&${hlAttrToAttrName(atr)}` : '');
        linestrAdd(BL_CONDITION, null, mask, `condition/${conditionBitmaskToString(mask)}/${clrbuf}`);
    }
}
function linestrGather() {
    linestrDone();
    const thresholds = fieldThresholds();
    for (let fld = 0; fld < MAXBLSTATS; fld++)
        for (const rule of thresholds[fld] ?? [])
            linestrAdd(fld, rule, 0, statusHiliteToString(rule));
    linestrGatherConditions();
}
// botl.c count_status_hilites(), used by the options-menu rows.
export function countStatusHilites() {
    linestrGather();
    const count = linestrCountField(BL_FLUSH);
    linestrDone();
    return count;
}
export function clearStatusHilites(iflags = game.iflags) {
    iflags.statusThresholds = Array.from({ length: MAXBLSTATS }, () => []);
}
// botl.c reset_status_hilites(): the tty repaint (disp.botlx = TRUE, a full
// BL_RESET render of both rows) is carried by context.botl here because every
// status refresh repaints the rows in full; the update_all round that
// re-evaluates unchanged fields runs only while highlighting is on.
export function resetStatusHilites() {
    if (game.iflags.hiliteDelta)
        game.nhDisplay?.statusHighlights.reset();
    game.context.botl = true;
}
// botl.c query_conditions(): PICK_ANY over the condition names.
async function queryConditions() {
    const picks = await showMultiSelectWindow({
        title: 'Choose status conditions', omitHeadings: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items: HILITE_CONDITIONS.map(([mask, name]) => ({ value: mask, text: name })) }],
    });
    return (picks ?? []).reduce((mask, bit) => mask | bit, 0);
}
// botl.c query_arrayvalue(): PICK_ONE over a slice of a name table.
async function queryArrayValue(prompt, values, arrmin, arrmax) {
    const adj = arrmin > 0 ? 1 : arrmax;
    const rows = [];
    for (let i = arrmin; i < arrmax; i++) {
        const text = values[i];
        if (text === null || text === undefined)
            continue; // hunger gap
        rows.push({ value: i + adj, text });
    }
    const picks = await showMultiSelectWindow({
        title: prompt, omitHeadings: true, pickOne: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ value: row.value, text: row.text })) }],
    });
    if (!picks || picks[0] === undefined)
        return arrmin - 1;
    return picks[0] - adj;
}
// botl.c status_hilite_menu_choose_field(): BL_FLUSH when nothing is picked.
async function statusHiliteMenuChooseField() {
    const thresholds = fieldThresholds();
    const rows = [];
    for (let i = 0; i < MAXBLSTATS; i++) {
        // SCORE_ON_BOTL is not compiled in: 'score' appears only when its
        // rules came from the config file.
        if (i === BL_SCORE && !(thresholds[BL_SCORE]?.length))
            continue;
        rows.push({ value: i + 1, text: STATUS_FIELDS[i]?.name ?? '' });
    }
    const picks = await showMultiSelectWindow({
        title: 'Select a hilite field:', omitHeadings: true, pickOne: true,
        signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ value: row.value, text: row.text })) }],
    });
    if (!picks || picks[0] === undefined)
        return BL_FLUSH;
    return picks[0] - 1;
}
// botl.c status_hilite_menu_choose_behavior(): BL_TH_NONE-1 for a cancelled
// menu, BL_TH_NONE for an answered-but-empty one.
async function statusHiliteMenuChooseBehavior(fld) {
    if (fld < 0 || fld >= MAXBLSTATS)
        return BL_TH_NONE;
    const field = STATUS_FIELDS[fld];
    if (!field)
        return BL_TH_NONE;
    const rows = [];
    let onlyBehavior = BL_TH_NONE;
    if (fld !== BL_CONDITION) {
        onlyBehavior = BL_TH_ALWAYS_HILITE;
        rows.push({ key: 'a', value: onlyBehavior, text: `Always highlight ${field.name}` });
    }
    if (fld === BL_CONDITION) {
        onlyBehavior = BL_TH_CONDITION;
        rows.push({ key: 'b', value: onlyBehavior, text: 'Bitmask of conditions' });
    }
    if (fld !== BL_CONDITION && fld !== BL_VERS) {
        onlyBehavior = BL_TH_UPDOWN;
        rows.push({ key: 'c', value: onlyBehavior, text: `${field.name} value changes` });
    }
    if (fld !== BL_CAP && fld !== BL_HUNGER && (field.anytype === 'int' || field.anytype === 'long')) {
        onlyBehavior = BL_TH_VAL_ABSOLUTE;
        rows.push({ key: 'n', value: onlyBehavior, text: 'Number threshold' });
    }
    if (field.idxmax >= 0) {
        onlyBehavior = BL_TH_VAL_PERCENTAGE;
        rows.push({ key: 'p', value: onlyBehavior, text: 'Percentage threshold' });
    }
    if (fld === BL_HP) {
        onlyBehavior = BL_TH_CRITICALHP;
        rows.push({ key: 'C', value: onlyBehavior, text: `Highlight critically low ${field.name}` });
    }
    if (field.anytype === 'str' || fld === BL_CAP || fld === BL_HUNGER) {
        onlyBehavior = BL_TH_TEXTMATCH;
        rows.push({ key: 't', value: onlyBehavior, text: `${field.name} text match` });
    }
    if (rows.length <= 1)
        return onlyBehavior;
    const picks = await showMultiSelectWindow({
        title: `Select ${field.name} field hilite behavior:`, omitHeadings: true,
        pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ key: row.key, value: row.value, text: row.text })) }],
    });
    if (picks === null)
        return BL_TH_NONE - 1;
    if (picks[0] === undefined)
        return BL_TH_NONE;
    return picks[0];
}
// botl.c status_hilite_menu_choose_updownboth().
async function statusHiliteMenuChooseUpDownBoth(fld, str, ltok, gtok) {
    const rows = [];
    if (ltok) {
        if (str !== null)
            rows.push({ value: 10 + LT_VALUE, text: `${fld === BL_AC ? 'Better (lower)' : 'Less'} than ${str}` });
        else
            rows.push({ value: 10 + LT_VALUE, text: 'Value goes down' });
        if (str !== null)
            rows.push({ value: 10 + LE_VALUE, text: `${str} or ${fld === BL_AC ? 'better (lower)' : 'less'}` });
    }
    rows.push(str !== null
        ? { value: 10 + EQ_VALUE, text: `Exactly ${str}` }
        : { value: 10 + EQ_VALUE, text: 'Value changes' });
    if (gtok) {
        if (str !== null)
            rows.push({ value: 10 + GE_VALUE, text: `${str} or ${fld === BL_AC ? 'worse (higher)' : 'more'}` });
        if (str !== null)
            rows.push({ value: 10 + GT_VALUE, text: `${fld === BL_AC ? 'Worse (higher)' : 'More'} than ${str}` });
        else
            rows.push({ value: 10 + GT_VALUE, text: 'Value goes up' });
    }
    const picks = await showMultiSelectWindow({
        title: `Select field ${STATUS_FIELDS[fld]?.name ?? ''} value:`, omitHeadings: true,
        pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ value: row.value, text: row.text })) }],
    });
    if (!picks || picks[0] === undefined)
        return NO_LTEQGT;
    return picks[0] - 10;
}
// botl.c status_hilite_menu_add(): one whole rule entry session, including
// C's goto retry structure. Returns whether a rule was added.
async function statusHiliteMenuAdd(origfld) {
    const printable = (_character, key) => key >= 32 && key < 127;
    let retry = 0;
    chooseField: for (;;) {
        let fld = origfld;
        if (fld === BL_FLUSH) {
            fld = await statusHiliteMenuChooseField();
            if (fld === BL_FLUSH)
                return false;
        }
        const field = STATUS_FIELDS[fld];
        if (!field)
            return false;
        let behavior = BL_TH_NONE;
        let colorqry = '';
        let attrqry = '';
        let cond = 0;
        let ltGtEq = NO_LTEQGT;
        let value = 0;
        const rule = {
            fld, set: false, anytype: field.anytype, value: 0,
            behavior: BL_TH_NONE, textmatch: '', rel: NO_LTEQGT, coloridx: 0,
        };
        chooseBehavior: for (;;) {
            behavior = await statusHiliteMenuChooseBehavior(fld);
            if (behavior === BL_TH_NONE - 1)
                return false;
            if (behavior === BL_TH_NONE) {
                if (origfld === BL_FLUSH)
                    continue chooseField;
                return false;
            }
            rule.behavior = behavior;
            chooseValue: for (;;) {
                // C's `retry++ > 5` blocks the seventh value prompt.
                if (retry++ > 5) {
                    await pline("That's enough tries.");
                    return false;
                }
                if (behavior === BL_TH_VAL_PERCENTAGE || behavior === BL_TH_VAL_ABSOLUTE) {
                    const percent = behavior === BL_TH_VAL_PERCENTAGE;
                    const answer = await getLine(`Enter ${percent ? 'percentage ' : ''}value for ${field.name} threshold:`, printable);
                    if (answer === null || answer.trim() === '')
                        continue chooseBehavior;
                    // C walks and mangles the response buffer in place;
                    // trimspaces() only skips the leading blanks in it, so
                    // they stay in the buffer and reach the value rows.
                    const raw = [...answer];
                    let start = 0;
                    let cut = raw.length;
                    while (/\s/.test(raw[start] ?? ''))
                        start++;
                    while (cut > start && /\s/.test(raw[cut - 1] ?? ''))
                        cut--;
                    const chars = raw.slice(0, cut);
                    let position = start;
                    let numstart = start;
                    let gotnum = false;
                    ltGtEq = NO_LTEQGT;
                    const first = chars[start];
                    if (first === '>' || first === '<' || first === '=') {
                        const second = chars[start + 1];
                        ltGtEq = first === '>' ? (second === '=' ? GE_VALUE : GT_VALUE)
                            : first === '<' ? (second === '=' ? LE_VALUE : LT_VALUE)
                                : EQ_VALUE;
                        chars[position] = ' ';
                        position++;
                        numstart++;
                        if (ltGtEq === GE_VALUE || ltGtEq === LE_VALUE) {
                            chars[position] = ' ';
                            position++;
                            numstart++;
                        }
                    }
                    if (chars[position] === '-')
                        position++;
                    else if (chars[position] === '+') {
                        chars[position] = ' ';
                        position++;
                        numstart++;
                    }
                    while (/[0-9]/.test(chars[position] ?? '')) {
                        position++;
                        gotnum = true;
                    }
                    let end = chars.length;
                    if (chars[position] === '%') {
                        if (!percent) {
                            await pline('Not expecting a percentage.');
                            continue chooseBehavior;
                        }
                        // strip '%': trailing junk past it is accepted
                        chars[position] = '\0';
                        end = position;
                    }
                    else if (chars[position] !== undefined) {
                        await pline(`"${chars.slice(position).join('')}" is not a recognized number.`);
                        continue chooseValue;
                    }
                    if (!gotnum) {
                        await pline('Is that an invisible number?');
                        continue chooseValue;
                    }
                    const op = ltGtEq === LT_VALUE ? '<' : ltGtEq === LE_VALUE ? '<='
                        : ltGtEq === GT_VALUE ? '>' : ltGtEq === GE_VALUE ? '>='
                            : ltGtEq === EQ_VALUE ? '=' : '';
                    let numText = chars.slice(numstart, end).join('');
                    value = Number.parseInt(numText, 10) || 0;
                    const int32 = Math.trunc(value) | 0;
                    if (percent) {
                        if (field.idxmax === -1) {
                            await pline(`Field '${field.name}' does not support percentage values.`);
                            behavior = BL_TH_VAL_ABSOLUTE;
                            continue chooseValue;
                        }
                        if ((int32 < 0 && (int32 !== -1 || ltGtEq !== GT_VALUE))
                            || (int32 === 0 && ltGtEq === LT_VALUE)
                            || (int32 === 100 && ltGtEq === GT_VALUE)
                            || (int32 > 100 && (int32 !== 101 || ltGtEq !== LT_VALUE))) {
                            await pline(`'${op}${int32}%' is not a valid percent value.`);
                            continue chooseValue;
                        }
                        numText += '%';
                    }
                    else if (field.anytype === 'int'
                        && int32 < (fld === BL_AC ? -128
                            : ltGtEq === GT_VALUE ? -1 : ltGtEq === LT_VALUE ? 1 : 0)) {
                        await pline(`${THRESHOLD_VALUE}'${op}${int32}'${IS_OUT_OF_RANGE}`);
                        continue chooseValue;
                    }
                    else if (field.anytype === 'long'
                        && value < (ltGtEq === GT_VALUE ? -1 : ltGtEq === LT_VALUE ? 1 : 0)) {
                        await pline(`${THRESHOLD_VALUE}'${op}${value}'${IS_OUT_OF_RANGE}`);
                        continue chooseValue;
                    }
                    const displayStr = chars.slice(0, end).join('') + (percent ? '%' : '');
                    if (ltGtEq === NO_LTEQGT) {
                        const ltok = field.anytype === 'int' ? (int32 > 0 || fld === BL_AC) : value > 0;
                        const gtok = !percent || value < 100;
                        ltGtEq = await statusHiliteMenuChooseUpDownBoth(fld, displayStr, ltok, gtok);
                        if (ltGtEq === NO_LTEQGT)
                            continue chooseValue;
                    }
                    const relation = ltGtEq === LT_VALUE ? 'less than '
                        : ltGtEq === GT_VALUE ? 'more than ' : '';
                    const suffix = ltGtEq === LE_VALUE ? ' or less' : ltGtEq === GE_VALUE ? ' or more' : '';
                    colorqry = `Choose a color for when ${field.name} is ${relation}${numText}${suffix}:`;
                    attrqry = `Choose attribute for when ${field.name} is ${relation}${numText}${suffix}:`;
                    rule.rel = ltGtEq;
                    rule.value = value;
                }
                else if (behavior === BL_TH_UPDOWN) {
                    if (field.anytype !== 'str') {
                        const ltok = fld !== BL_TIME;
                        ltGtEq = await statusHiliteMenuChooseUpDownBoth(fld, null, ltok, true);
                        if (ltGtEq === NO_LTEQGT)
                            continue chooseBehavior;
                    }
                    else {
                        // ordered text comparison is pointless for the string
                        // fields; skip the single-choice menu, use 'changed'
                        ltGtEq = EQ_VALUE;
                    }
                    const verb = ltGtEq === EQ_VALUE ? 'changes'
                        : ltGtEq === LT_VALUE ? 'decreases' : 'increases';
                    colorqry = `Choose a color for when ${field.name} ${verb}:`;
                    attrqry = `Choose attribute for when ${field.name} ${verb}:`;
                    rule.rel = ltGtEq;
                }
                else if (behavior === BL_TH_CONDITION) {
                    cond = await queryConditions();
                    if (!cond) {
                        if (origfld === BL_FLUSH)
                            continue chooseField;
                        return false;
                    }
                    const names = conditionBitmaskToString(cond);
                    colorqry = `Choose a color for conditions ${names}:`;
                    attrqry = `Choose attribute for conditions ${names}:`;
                }
                else if (behavior === BL_TH_TEXTMATCH) {
                    const lead = (fld === BL_CAP || fld === BL_ALIGN || fld === BL_HUNGER
                        || fld === BL_TITLE) ? 'Choose' : 'Enter';
                    const query = `${lead} ${field.name} text value to match:`;
                    if (fld === BL_CAP) {
                        const rv = await queryArrayValue(query, ENC_STAT, 1, 6);
                        if (rv < 1)
                            continue chooseBehavior;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = ENC_STAT[rv] ?? '';
                    }
                    else if (fld === BL_ALIGN) {
                        const rv = await queryArrayValue(query, ALIGN_TEXTS, 0, 3);
                        if (rv < 0)
                            continue chooseBehavior;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = ALIGN_TEXTS[rv] ?? '';
                    }
                    else if (fld === BL_HUNGER) {
                        const rv = await queryArrayValue(query, HUNGER_TEXTS, 0, 7);
                        if (rv < 0)
                            continue chooseBehavior;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = HUNGER_TEXTS[rv] ?? '';
                    }
                    else if (fld === BL_TITLE) {
                        const rows = titleTextMatchRows();
                        const rv = await queryArrayValue(query, rows, 0, rows.length);
                        if (rv >= 0) {
                            rule.rel = TXT_VALUE;
                            rule.textmatch = rows[rv] ?? '';
                        }
                        if (rv < 0)
                            continue chooseBehavior;
                    }
                    else {
                        const answer = await getLine(query, printable);
                        if (answer === null || answer === '')
                            continue chooseBehavior;
                        // struct hilite_s.textmatch[MAXVALWIDTH]
                        if (new TextEncoder().encode(answer).length >= 80)
                            return false;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = answer;
                    }
                    colorqry = `Choose a color for when ${field.name} is '${rule.textmatch}':`;
                    attrqry = `Choose attribute for when ${field.name} is '${rule.textmatch}':`;
                }
                else if (behavior === BL_TH_ALWAYS_HILITE) {
                    colorqry = `Choose a color to always hilite ${field.name}:`;
                    attrqry = `Choose attribute to always hilite ${field.name}:`;
                }
                chooseColor: for (;;) {
                    const clr = await queryColorMenu(colorqry, NO_COLOR);
                    if (clr === null) {
                        if (behavior !== BL_TH_ALWAYS_HILITE)
                            continue chooseValue;
                        continue chooseBehavior;
                    }
                    // "Choose" prompts allow combining attributes; the
                    // empty criticalhp prompt is a plain PICK_ONE.
                    const atr = behavior === BL_TH_CRITICALHP
                        ? await queryAttributeMenu(attrqry, 0)
                        : await queryAttributeSet(attrqry);
                    if (atr === null || atr === -1)
                        continue chooseColor;
                    if (behavior === BL_TH_CONDITION) {
                        const conds = condHilites();
                        if (atr & HL_BOLD)
                            conds[HL_ATTCLR_BOLD] = (conds[HL_ATTCLR_BOLD] ?? 0) | cond;
                        if (atr & HL_DIM)
                            conds[HL_ATTCLR_DIM] = (conds[HL_ATTCLR_DIM] ?? 0) | cond;
                        if (atr & HL_ITALIC)
                            conds[HL_ATTCLR_ITALIC] = (conds[HL_ATTCLR_ITALIC] ?? 0) | cond;
                        if (atr & HL_ULINE)
                            conds[HL_ATTCLR_ULINE] = (conds[HL_ATTCLR_ULINE] ?? 0) | cond;
                        if (atr & HL_BLINK)
                            conds[HL_ATTCLR_BLINK] = (conds[HL_ATTCLR_BLINK] ?? 0) | cond;
                        if (atr & HL_INVERSE)
                            conds[HL_ATTCLR_INVERSE] = (conds[HL_ATTCLR_INVERSE] ?? 0) | cond;
                        if (atr === HL_NONE) {
                            conds[HL_ATTCLR_BOLD] = (conds[HL_ATTCLR_BOLD] ?? 0) & ~cond;
                            conds[HL_ATTCLR_DIM] = (conds[HL_ATTCLR_DIM] ?? 0) & ~cond;
                            conds[HL_ATTCLR_ITALIC] = (conds[HL_ATTCLR_ITALIC] ?? 0) & ~cond;
                            conds[HL_ATTCLR_ULINE] = (conds[HL_ATTCLR_ULINE] ?? 0) & ~cond;
                            conds[HL_ATTCLR_BLINK] = (conds[HL_ATTCLR_BLINK] ?? 0) & ~cond;
                            conds[HL_ATTCLR_INVERSE] = (conds[HL_ATTCLR_INVERSE] ?? 0) & ~cond;
                        }
                        conds[clr] = (conds[clr] ?? 0) | cond;
                        const clrbuf = colorName(clr).replace(/ /g, '-')
                            + (hlAttrToAttrName(atr) !== null ? `&${hlAttrToAttrName(atr)}` : '');
                        await pline(`Added hilite condition/${conditionBitmaskToString(cond)}/${clrbuf}`);
                    }
                    else {
                        rule.coloridx = clr | (atr << 8);
                        rule.set = true;
                        const rules = fieldThresholds()[fld] ?? [];
                        const orSplit = fld === BL_TITLE ? rule.textmatch.indexOf(' or ') : -1;
                        if (orSplit >= 0) {
                            const male = { ...rule, textmatch: rule.textmatch.slice(0, orSplit) };
                            rules.push(male);
                            await pline(`Added hilite ${statusHiliteToString(male)}`);
                            rule.textmatch = rule.textmatch.slice(orSplit + 4);
                        }
                        rules.push(rule);
                        await pline(`Added hilite ${statusHiliteToString(rule)}`);
                    }
                    resetStatusHilites();
                    return true;
                }
            }
        }
    }
}
// botl.c status_hilite_menu_add() BL_TITLE branch: the role's nine ranks,
// female variants first for a female hero, then the polymorph fallback.
function titleTextMatchRows() {
    const rows = [];
    const female = game.flags.female === true;
    for (const rank of game.urole?.title ?? []) {
        const male = `"${rank.m}"`;
        const femaleExists = rank.f !== rank.m;
        const femaleText = `"${rank.f}"`;
        const both = `"${female ? rank.f : rank.m}" or "${female ? rank.m : rank.f}"`;
        if (female) {
            if (femaleExists)
                rows.push(femaleText);
            rows.push(male);
            if (femaleExists)
                rows.push(both);
        }
        else {
            rows.push(male);
            if (femaleExists)
                rows.push(femaleText);
            if (femaleExists)
                rows.push(both);
        }
    }
    rows.push('"none of the above (polymorphed)"');
    return rows;
}
// botl.c status_hilite_remove().
function statusHiliteRemove(id) {
    const line = hiliteStrs.find(entry => entry.id === id);
    if (!line)
        return false;
    if (line.fld === BL_CONDITION) {
        const conds = condHilites();
        for (let i = 0; i < CLR_MAX; i++)
            conds[i] = (conds[i] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_BOLD] = (conds[HL_ATTCLR_BOLD] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_DIM] = (conds[HL_ATTCLR_DIM] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_ITALIC] = (conds[HL_ATTCLR_ITALIC] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_ULINE] = (conds[HL_ATTCLR_ULINE] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_BLINK] = (conds[HL_ATTCLR_BLINK] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_INVERSE] = (conds[HL_ATTCLR_INVERSE] ?? 0) & ~line.mask;
        return true;
    }
    const rules = fieldThresholds()[line.fld] ?? [];
    const index = line.rule === null ? -1 : rules.indexOf(line.rule);
    if (index < 0)
        return false;
    rules.splice(index, 1);
    return true;
}
// botl.c status_hilite_menu_fld().
async function statusHiliteMenuFld(fld) {
    const field = STATUS_FIELDS[fld];
    if (!field)
        return false;
    let count = linestrCountField(fld);
    if (!count) {
        if (await statusHiliteMenuAdd(fld)) {
            linestrDone();
            linestrGather();
            count = linestrCountField(fld);
        }
        else {
            return false;
        }
    }
    const items = [];
    for (const line of hiliteStrs)
        if (line.fld === fld)
            items.push({ value: line.id, text: line.str });
    // A stored rule the gather step skips (a condition rule with "no color"
    // and attribute none) leaves the list empty; native says so.
    if (!count)
        items.push({ selectable: false, text: `No current hilites for ${field.name}` });
    items.push({ selectable: false, text: '' });
    if (count)
        items.push({ key: 'X', value: -1, text: 'Remove selected hilites' });
    // SCORE_ON_BOTL is not compiled in, so 'score' never offers new rules.
    if (fld !== BL_SCORE)
        items.push({ key: 'Z', value: -2, text: 'Add new hilites' });
    const picks = await showMultiSelectWindow({
        title: `Current ${field.name} hilites:`, omitHeadings: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items }],
    });
    let acted = false;
    if (picks && picks.length) {
        const remove = picks.includes(-1);
        const add = picks.includes(-2);
        if (remove) {
            for (const id of picks)
                if (id > 0 && statusHiliteRemove(id))
                    acted = true;
        }
        if (add) {
            while (await statusHiliteMenuAdd(fld))
                acted = true;
        }
    }
    return acted;
}
// botl.c status_hilites_viewall(): every rule in config format.
async function statusHilitesViewAll() {
    const lines = hiliteStrs.map(line => `OPTIONS=hilite_status: ${line.str}`);
    await showTextWindow(lines);
}
// botl.c status_hilite_menu(): the "status highlight rules" handler.
export async function statusHiliteMenu() {
    let countAll = 0;
    for (;;) {
        linestrGather();
        countAll = linestrCountField(BL_FLUSH);
        const items = [];
        if (countAll) {
            items.push({ value: 0, text: 'View all hilites in config format' });
            items.push({ selectable: false, text: '' });
        }
        for (let i = 0; i < MAXBLSTATS; i++) {
            const row = STATUS_FIELDS[i];
            if (!row)
                continue;
            const count = linestrCountField(row.fld);
            // SCORE_ON_BOTL is not compiled in: hide 'score' without rules.
            if (row.fld === BL_SCORE && !count)
                continue;
            let text = row.name.padEnd(18);
            if (count)
                text += ` (${count} defined)`;
            items.push({ value: row.fld + 1, text });
        }
        const picks = await showMultiSelectWindow({
            title: 'Status hilites:', omitHeadings: true, pickOne: true, signalEscape: true,
            pageLocalKeys: true,
            sections: [{ items }],
        });
        let redo = false;
        if (picks && picks[0] !== undefined) {
            const fld = picks[0] - 1;
            if (fld < 0)
                await statusHilitesViewAll();
            else if (await statusHiliteMenuFld(fld))
                resetStatusHilites();
            redo = true;
        }
        // The listing survives a field edit, including deleted rules. C
        // uses that listing's count before destroying it, even for fuzzer exit.
        countAll = linestrCountField(BL_FLUSH);
        linestrDone();
        // The native fuzzer gets one attempt at the nested field menus.
        if (!redo || game.iflags.debug_fuzzer)
            break;
    }
    // statushilites doubles as the on-switch for highlighting: enabling a
    // default duration when rules now exist.
    if (countAll > 0 && !game.iflags.hiliteDelta)
        game.iflags.hiliteDelta = 3;
    return true;
}
//# sourceMappingURL=status_hilites.js.map