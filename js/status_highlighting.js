import { currentAttribute } from './attrib.js';
import { newExperienceThreshold } from './exper.js';
import { criticallyLowHp } from './prayer_trouble.js';
import { heroGoldAmount } from './hero_gold.js';
import { statusTitle } from './status_title.js';
import { A_STR, A_DEX, A_CON, A_INT, A_WIS, A_CHA, BL_TITLE, BL_STR, BL_DX, BL_CO, BL_IN, BL_WI, BL_CH, BL_ALIGN, BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC, BL_XP, BL_EXP, BL_HD, BL_TIME, BL_HUNGER, BL_CAP, BL_GOLD, BL_LEVELDESC, BL_VERS, BL_WEAPON, BL_ARMOR, BL_TERRAIN, BL_TH_UPDOWN, BL_TH_VAL_ABSOLUTE, BL_TH_VAL_PERCENTAGE, BL_TH_ALWAYS_HILITE, BL_TH_TEXTMATCH, BL_TH_CRITICALHP, EQ_VALUE, LT_VALUE, LE_VALUE, GT_VALUE, GE_VALUE, TXT_VALUE, Upolyd, HL_BOLD, HL_DIM, HL_ITALIC, HL_ULINE, HL_BLINK, HL_INVERSE, HL_ATTCLR_BOLD, HL_ATTCLR_DIM, HL_ATTCLR_ITALIC, HL_ATTCLR_ULINE, HL_ATTCLR_BLINK, HL_ATTCLR_INVERSE, CLR_MAX, } from './const.js';
import { MONSTER_LEVEL } from './monster_data.js';
import { NO_COLOR, ATR_BOLD, ATR_INVERSE, ATR_UNDERLINE } from './terminal.js';
import { ATR_BLINK, TERMINAL_DIM, TERMINAL_ITALIC } from './terminal_attributes.js';
// botl.c initblstats evaluates gold as the eleventh field.  A forced
// gu.update_all from the gold encoding check therefore re-evaluates gold
// and every field after it, leaving title, attributes, alignment, score
// and carrying-capacity alone.
const AT_OR_AFTER_GOLD = new Set([BL_GOLD, BL_ENE, BL_ENEMAX, BL_XP, BL_AC, BL_HD,
    BL_TIME, BL_HUNGER, BL_HP, BL_HPMAX, BL_LEVELDESC, BL_EXP, BL_VERS,
    BL_WEAPON, BL_ARMOR, BL_TERRAIN]);
export class StatusHighlights {
    fields = new Map();
    styles = new Map();
    currentPercentages = new Map();
    previousPercentages = new Map();
    conditionMasks = [];
    enabled = false;
    resetPending = true;
    moves = null;
    // botl.c:1498-1499 oldrndencode/oldgoldsym statics.
    oldRndEncode = null;
    oldGoldSym = null;
    // wintty.c tty_status[NOW][BL_TITLE].color/.attr and hpbar_crit_hp: the
    // hitpoint bar style, owned by whichever title or HP update ran last.
    barStyle = { color: NO_COLOR, attr: 0 };
    barCritical = false;
    spans = [[], []];
    // botl.c gu.update_all re-evaluates every field as unchanged. A tty
    // botlx repaint alone keeps the cached rules and temporary highlights.
    reset() {
        this.resetPending = true;
    }
    // botl.c:status_hilite_remove() clears references to the deleted rule
    // and its timer. The tty retains the last color until a field update.
    removeRule(rule) {
        const field = this.fields.get(rule.fld);
        if (field?.rule !== rule)
            return;
        field.rule = null;
        field.expires = 0;
    }
    evaluateNextUnhilite(state) {
        this.moves = state.moves;
        let update = !!state.context.botl;
        for (const field of this.fields.values()) {
            if (field.changed) {
                field.expires = field.rule?.behavior === BL_TH_UPDOWN
                    ? state.moves + (state.iflags.hiliteDelta ?? 0) : 0;
                field.changed = false;
                update = true;
            }
            else if (!state.multi && field.expires > 0 && field.expires < state.moves)
                update = true;
        }
        return update;
    }
    update(state, fields, goldSymbol = '$') {
        // bot_via_windowport() alternates buffers even when values are unchanged.
        // Each buffer keeps its percentage until that field recalculates it.
        const previous = this.currentPercentages;
        this.currentPercentages = this.previousPercentages;
        this.previousPercentages = previous;
        this.moves ??= state.moves;
        this.enabled = !!state.iflags.hiliteDelta;
        this.conditionMasks = [...(state.iflags.condHilites ?? [])];
        // botl.c:1564-1570: a changed gold encoding (the new-game rndencode
        // or a new symbol set) forces gu.update_all while gold is evaluated.
        // The first update never needs it; status_initialize already set
        // update_all for that round.
        const encodingChanged = this.oldGoldSym !== null
            && (this.oldGoldSym !== goldSymbol || this.oldRndEncode !== (state.rndencode ?? 0));
        this.oldGoldSym = goldSymbol;
        this.oldRndEncode = state.rndencode ?? 0;
        for (const [field, value] of fieldValues(state, fields))
            this.updateField(state, field, value, encodingChanged);
        this.resetPending = false;
    }
    updateTime(state) {
        this.enabled = !!state.iflags.hiliteDelta;
        this.updateField(state, BL_TIME, numberValue(state.moves));
    }
    // botl.c exp_percent_changing(): hidden points can change the level's rule.
    experiencePercentChanging(state) {
        if (state.context.botl)
            return false;
        const rules = state.iflags.statusThresholds?.[BL_XP] ?? [];
        if (rules.length === 0)
            return false;
        const percent = experiencePercentage(state);
        if (percent === (this.currentPercentages.get(BL_XP) ?? 0))
            return false;
        const level = state.u.ulevel ?? 1;
        const rule = chooseHilite(rules, numberValue(level, level, percent), 0, false, false);
        return rule !== (this.fields.get(BL_XP)?.rule ?? null);
    }
    style(span) {
        if (!this.enabled)
            return { color: NO_COLOR, attr: 0 };
        if (span.condition !== undefined)
            return conditionStyle(span.condition, this.conditionMasks);
        return this.styles.get(span.field) ?? { color: NO_COLOR, attr: 0 };
    }
    // wintty.c:5233-5241: the lit portion of the hitpoint bar takes the
    // title cell's colour, applied only while status highlighting is on.
    barSpanStyle() {
        return { color: this.enabled ? this.barStyle.color : NO_COLOR, attr: this.barStyle.attr };
    }
    updateField(state, field, current, encodingChanged = false) {
        const previous = this.fields.get(field);
        const rules = state.iflags.statusThresholds?.[field] ?? [];
        // botl.c:1574-1576: gu.update_all, forced from BL_GOLD onward by a
        // gold encoding change, evaluates the field as unchanged (chg = 0)
        // and clears its temporary-highlight timer.
        const reset = this.resetPending || !previous
            || encodingChanged && AT_OR_AFTER_GOLD.has(field);
        let change = reset ? 0 : compare(previous.raw, current.raw);
        const percentMatters = field === BL_HP || field === BL_ENE || field === BL_XP || field === BL_EXP;
        const calculatePercent = (percentMatters && rules.length > 0 && (change !== 0 || reset || field === BL_XP))
            || (field === BL_HP && state.flags.hitpointbar);
        // C keeps the cached percentage but passes zero to get_hilite() when
        // this update does not calculate it, including temporary hilite expiry.
        const percent = calculatePercent ? current.percent : 0;
        const previousPercent = this.previousPercentages.get(field) ?? 0;
        if (calculatePercent)
            this.currentPercentages.set(field, percent);
        const percentChanged = calculatePercent && !reset && percent !== previousPercent;
        if (percentChanged) {
            change = compare(previousPercent, percent);
            if (change === 1 && field === BL_XP && previous)
                change = compare(previous.raw, current.raw);
        }
        const expired = !!previous?.expires && !state.multi && previous.expires < (this.moves ?? state.moves);
        // botl.c:1584 re-sends a field only for gu.update_all, a value or
        // percentage change, or a temporary-hilite expiry. A rule list that
        // changed on its own never re-sends anything: the tty keeps the
        // buffered color of a removed rule until one of those rounds runs
        // (reset_status_hilites() supplies update_all when highlighting is on).
        if (!reset && !change && !percentChanged && !expired)
            return;
        const rule = chooseHilite(rules, { ...current, percent }, change, field === BL_HP && rules.some(entry => entry.behavior === BL_TH_CRITICALHP)
            && criticallyLowHp(false, state), field === BL_TITLE && Upolyd(state.u));
        this.fields.set(field, { raw: current.raw, rule, changed: true,
            expires: reset || expired ? 0 : previous?.expires ?? 0 });
        this.styles.set(field, rule ? decodeStyle(rule.coloridx) : { color: NO_COLOR, attr: 0 });
        // wintty.c:4588-4589 stores the title rule's colour and attribute on
        // the title cell; wintty.c:4613-4615 overwrite the cell when the HP
        // field is updated (botl.c evaluates the title first).  A status
        // round that updates neither field keeps the previous bar style.
        if (field === BL_TITLE)
            this.barStyle = rule ? decodeStyle(rule.coloridx) : { color: NO_COLOR, attr: 0 };
        if (field === BL_HP && state.flags.hitpointbar) {
            this.barCritical = criticallyLowHp(true, state);
            this.barStyle = { color: rule ? rule.coloridx & 255 : NO_COLOR,
                attr: hiliteAttributes(HL_INVERSE | (this.barCritical ? HL_BLINK : 0)) };
        }
    }
}
// C best-fit precedence is shared between absolute and percentage rules:
// exact matches win; otherwise prefer the closest lower/upper bound. Change
// rules override persistent rules, and a qualifying critical-HP rule wins.
// C botl.c:get_hilite().
function chooseHilite(rules, current, change, critical, polymorphed) {
    let selected = null;
    let exact = false, updown = false, changed = false, numeric = false, criticalHp = false;
    let minPercent = 101, maxPercent = -1;
    const limit = rules.some(rule => rule.anytype === 'long') ? Number.MAX_SAFE_INTEGER : 32767;
    let minValue = limit, maxValue = -limit;
    for (const rule of rules) {
        if (criticalHp && rule.behavior !== BL_TH_CRITICALHP)
            continue;
        if ((updown || changed) && rule.behavior !== BL_TH_UPDOWN)
            continue;
        if (numeric && rule.behavior === BL_TH_ALWAYS_HILITE)
            continue;
        if (rule.behavior === BL_TH_VAL_ABSOLUTE || rule.behavior === BL_TH_VAL_PERCENTAGE) {
            const percent = rule.behavior === BL_TH_VAL_PERCENTAGE;
            const value = percent ? current.percent : current.value;
            if (typeof value !== 'number')
                continue;
            const threshold = rule.value;
            let matched = false;
            if (rule.rel === EQ_VALUE && value === threshold) {
                exact = matched = true;
                if (percent)
                    minPercent = maxPercent = threshold;
                else
                    minValue = maxValue = threshold;
            }
            else if (!exact) {
                const lower = rule.rel === LT_VALUE && value < threshold || rule.rel === LE_VALUE && value <= threshold;
                const upper = rule.rel === GT_VALUE && value > threshold || rule.rel === GE_VALUE && value >= threshold;
                if (lower && threshold <= (percent ? minPercent : minValue)) {
                    matched = true;
                    if (percent)
                        minPercent = threshold;
                    else
                        minValue = threshold;
                }
                else if (upper && threshold >= (percent ? maxPercent : maxValue)) {
                    matched = true;
                    if (percent)
                        maxPercent = threshold;
                    else
                        maxValue = threshold;
                }
            }
            if (matched) {
                selected = rule;
                numeric = true;
            }
        }
        else if (rule.behavior === BL_TH_UPDOWN) {
            if (change < 0 && rule.rel === LT_VALUE || change > 0 && rule.rel === GT_VALUE) {
                selected = rule;
                updown = true;
            }
            else if (change && rule.rel === EQ_VALUE && !updown) {
                selected = rule;
                changed = true;
            }
        }
        else if (rule.behavior === BL_TH_TEXTMATCH && rule.rel === TXT_VALUE && rule.textmatch) {
            const pattern = fuzzyText(rule.textmatch);
            if (pattern === fuzzyText(current.text)) {
                selected = rule;
                exact = true;
            }
            else if (!exact && polymorphed && isPolymorphedTitleFallback(rule.textmatch))
                selected = rule;
        }
        else if (rule.behavior === BL_TH_ALWAYS_HILITE)
            selected = rule;
        else if (rule.behavior === BL_TH_CRITICALHP && critical) {
            selected = rule;
            criticalHp = true;
            updown = changed = numeric = false;
        }
    }
    return selected;
}
// C botl.c:noneoftheabove(). Each spelling has its own ignored punctuation.
function isPolymorphedTitleFallback(text) {
    return fuzzyText(text) === 'noneoftheabove'
        || text.replace(/["()]/g, '').toLowerCase() === 'polymorphed'
        || text.replace(/[" _()\-]/g, '').toLowerCase() === 'noneoftheabovepolymorphed';
}
function compare(previous, current) {
    if (typeof previous === 'string' && typeof current === 'string')
        return previous < current ? -1 : previous > current ? 1 : 0;
    return previous < current ? 1 : previous > current ? -1 : 0;
}
function fuzzyText(text) { return text.replace(/[" _-]/g, '').toLowerCase(); }
function numberValue(value, raw = value, percent = 0, text = String(value)) {
    return { value, raw, percent, text };
}
function textValue(text) { return { value: text, raw: text, text, percent: 0 }; }
function percentage(value, maximum) {
    if (!maximum)
        return 0;
    const percent = Math.trunc(100 * value / maximum);
    return value && !percent ? 1 : percent;
}
// botl.c exp_percentage(): the final point before a new level counts as 100%.
function experiencePercentage(state) {
    const level = state.u.ulevel ?? 1;
    if (level >= 30)
        return 0;
    const start = newExperienceThreshold(level - 1);
    const range = newExperienceThreshold(level) - start;
    const progress = (state.u.uexp ?? 0) - start;
    return progress === range - 1 ? 100 : percentage(progress, range);
}
function fieldValues(state, fields) {
    const hero = state.u;
    const hp = Math.max(0, (Upolyd(hero) ? hero.mh : hero.uhp) ?? 0);
    const maximum = (Upolyd(hero) ? hero.mhmax : hero.uhpmax) ?? 0;
    const energy = hero.uen ?? 0, energyMaximum = hero.uenmax ?? 0;
    const level = hero.ulevel ?? 1, experience = hero.uexp ?? 0;
    const gold = Math.max(0, state._statusGoldOverride ?? heroGoldAmount(state));
    const title = statusTitle(state).padEnd(30);
    const nameLength = (state.plname || state.displayName || 'Hero').length;
    const values = new Map([
        [BL_TITLE, { ...textValue(title), text: title.slice(nameLength + 5) }],
        [BL_ALIGN, textValue(hero.ualign?.type === -1 ? 'Chaotic' : hero.ualign?.type === 0 ? 'Neutral' : 'Lawful')],
        [BL_HP, numberValue(Math.min(hp, 9999), hp, percentage(hp, maximum))],
        [BL_HPMAX, numberValue(Math.min(maximum, 9999), maximum)],
        [BL_ENE, numberValue(Math.min(energy, 9999), energy, percentage(energy, energyMaximum))],
        [BL_ENEMAX, numberValue(Math.min(energyMaximum, 9999), energyMaximum)],
        [BL_AC, numberValue(hero.uac ?? 10)], [BL_TIME, numberValue(state.moves)],
        [BL_HUNGER, numberValue(hero.uhs ?? 0, hero.uhs ?? 0, 0, fields.hunger)],
        [BL_CAP, numberValue(fields.capacity, fields.capacity, 0, ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'][fields.capacity] ?? '')],
        [BL_GOLD, numberValue(Math.min(gold, 999999), gold)],
        [BL_LEVELDESC, textValue(fields.location)], [BL_VERS, textValue(fields.version)],
    ]);
    const experiencePercent = experiencePercentage(state);
    values.set(BL_XP, numberValue(level, level, experiencePercent));
    values.set(BL_EXP, numberValue(experience, experience, experiencePercent));
    values.set(BL_HD, numberValue(Upolyd(hero) ? MONSTER_LEVEL[hero.umonnum ?? -1] ?? 0 : 0));
    for (const [field, attribute] of [[BL_STR, A_STR], [BL_DX, A_DEX], [BL_CO, A_CON],
        [BL_IN, A_INT], [BL_WI, A_WIS], [BL_CH, A_CHA]])
        values.set(field, numberValue(currentAttribute(attribute, state)));
    for (const equipment of fields.equipment)
        values.set(equipment.field, textValue(equipment.text));
    if (!state.flags.time)
        values.delete(BL_TIME);
    if (!state.flags.showvers)
        values.delete(BL_VERS);
    if (Upolyd(hero)) {
        values.delete(BL_XP);
        values.delete(BL_EXP);
    }
    else
        values.delete(BL_HD);
    if (!state.flags.showexp)
        values.delete(BL_EXP);
    return values;
}
function plainStatusText(text) {
    return text.replace(/\x1b\[(\d+)C/g, (_match, count) => ' '.repeat(Number(count)))
        .replace(/\x1b\[[0-9;]*m/g, '');
}
export function firstStatusLineSpans(text, hitpointBar, hitpointBarFill = 0) {
    const plain = plainStatusText(text);
    const stats = plain.lastIndexOf(' St:');
    const spans = [{ field: BL_TITLE, start: hitpointBar ? 1 : 0,
            end: hitpointBar ? 31 : Math.max(0, stats), hitpointBar,
            ...(hitpointBar ? { fill: hitpointBarFill } : {}) }];
    const fields = new Map([['St', BL_STR], ['Dx', BL_DX], ['Co', BL_CO], ['In', BL_IN], ['Wi', BL_WI], ['Ch', BL_CH]]);
    for (const match of plain.slice(stats + 1).matchAll(/(St|Dx|Co|In|Wi|Ch):\S+/g)) {
        const field = fields.get(match[1] ?? '');
        if (field !== undefined)
            spans.push({ field, start: stats + 1 + match.index,
                end: stats + 1 + match.index + match[0].length });
    }
    const alignment = plain.match(/(?:Lawful|Neutral|Chaotic)\s*$/);
    if (alignment?.index !== undefined)
        spans.push({ field: BL_ALIGN, start: alignment.index, end: plain.trimEnd().length });
    return spans;
}
// C wintty.c:condattr().
// C wintty.c:condcolor().
function conditionStyle(mask, masks) {
    let color = NO_COLOR, attr = 0;
    for (let index = 0; index < CLR_MAX; index++) {
        if (mask & (masks[index] ?? 0)) {
            color = index;
            break;
        }
    }
    for (const [index, bit] of [[HL_ATTCLR_BOLD, ATR_BOLD], [HL_ATTCLR_DIM, TERMINAL_DIM],
        [HL_ATTCLR_ITALIC, TERMINAL_ITALIC], [HL_ATTCLR_ULINE, ATR_UNDERLINE],
        [HL_ATTCLR_BLINK, ATR_BLINK], [HL_ATTCLR_INVERSE, ATR_INVERSE]])
        if (mask & (masks[index] ?? 0))
            attr |= bit;
    return { color, attr };
}
// term_attr_fixup() is identity for the recorded terminal, so hilite
// attribute masks map straight onto terminal attributes.
function hiliteAttributes(mask) {
    let attr = 0;
    for (const [hilite, terminal] of [[HL_BOLD, ATR_BOLD], [HL_DIM, TERMINAL_DIM], [HL_ITALIC, TERMINAL_ITALIC],
        [HL_ULINE, ATR_UNDERLINE], [HL_BLINK, ATR_BLINK], [HL_INVERSE, ATR_INVERSE]])
        if (mask & hilite)
            attr |= terminal;
    return attr;
}
function decodeStyle(coloridx) {
    return { color: coloridx & 255, attr: hiliteAttributes(coloridx >> 8) };
}
//# sourceMappingURL=status_highlighting.js.map