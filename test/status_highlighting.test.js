import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen, timebot, updateStatusLines, statusEvalNextUnhilite } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { clearStatusHilites, resetStatusHilites } from '../js/status_hilites.js';
import { addExperience } from '../js/exper.js';
import { BL_HP, BL_ENE, BL_TITLE, BL_TIME, BL_XP, BL_EXP, BL_TH_ALWAYS_HILITE, BL_TH_VAL_PERCENTAGE, BL_TH_VAL_ABSOLUTE, BL_TH_UPDOWN, BL_TH_TEXTMATCH, BL_TH_CRITICALHP, BL_MASK_BLIND, HL_BOLD, HL_INVERSE, HL_NONE, EQ_VALUE, LT_VALUE, GT_VALUE, TXT_VALUE, MAXBLSTATS, NO_LTEQGT, BL_ATTCLR_MAX, HL_ATTCLR_BOLD } from '../js/const.js';
import { ATR_BOLD, ATR_INVERSE, CLR_RED, CLR_GREEN, CLR_BLUE, NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function rule(fld, behavior, value, rel, color, attr = HL_NONE, textmatch = '') {
    return { fld, behavior, value, rel, coloridx: color | (attr << 8), textmatch, set: true, anytype: 'int' };
}
async function roomWithRules(rules) {
    const thresholds = Array.from({ length: MAXBLSTATS }, (_, fld) => rules.filter(entry => entry.fld === fld));
    await freshObjectRoom({ iflags: { statusThresholds: thresholds, hiliteDelta: 2 }, flags: { time: true } });
    requirePlayingGame(game);
}
function fieldCell(text, row = 23, offset = 0) {
    const cells = requireScreenRow(row);
    const column = cells.map(cell => cell.ch).join('').indexOf(text);
    assert.ok(column >= 0, `Expected '${text}' on status row ${row}: ${cells.map(cell => cell.ch).join('')}`);
    const cell = cells[column + offset];
    assert.ok(cell);
    return cell;
}
void test('status fields use the closest threshold and exact values take precedence', async () => {
    await roomWithRules([
        rule(BL_HP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_GREEN),
        rule(BL_HP, BL_TH_VAL_PERCENTAGE, 80, LT_VALUE, CLR_BLUE),
        rule(BL_HP, BL_TH_VAL_PERCENTAGE, 50, LT_VALUE, CLR_RED, HL_BOLD),
        rule(BL_HP, BL_TH_VAL_ABSOLUTE, 12, EQ_VALUE, CLR_GREEN, HL_INVERSE),
    ]);
    game.u.uhp = 15;
    await bot();
    assert.equal(fieldCell('HP:15').color, CLR_RED);
    assert.equal(fieldCell('HP:15').attr, ATR_BOLD);
    assert.equal(fieldCell('(40)').color, NO_COLOR, 'HP maximum is a separate field');
    game.u.uhp = 12;
    await bot();
    assert.equal(fieldCell('HP:12').color, CLR_GREEN);
    assert.equal(fieldCell('HP:12').attr, ATR_INVERSE);
});
void test('temporary change highlights expire back to the persistent rule', async () => {
    await roomWithRules([
        rule(BL_HP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_GREEN),
        rule(BL_HP, BL_TH_UPDOWN, 0, LT_VALUE, CLR_RED, HL_BOLD),
    ]);
    await bot();
    game.u.uhp = 39;
    await bot();
    assert.equal(fieldCell('HP:39').color, CLR_RED);
    statusEvalNextUnhilite();
    game.moves += 2;
    statusEvalNextUnhilite();
    updateStatusLines();
    assert.equal(fieldCell('HP:39').color, CLR_RED);
    game.moves++;
    statusEvalNextUnhilite();
    updateStatusLines();
    assert.equal(fieldCell('HP:39').color, CLR_GREEN);
    assert.equal(fieldCell('HP:39').attr, 0);
});
for (const hitpointbar of [false, true]) {
    void test(`expired HP highlights use ${hitpointbar ? 'the recalculated' : 'zero'} percentage with hitpointbar ${hitpointbar}`, async () => {
        await roomWithRules([
            rule(BL_HP, BL_TH_VAL_PERCENTAGE, 30, LT_VALUE, CLR_RED),
            rule(BL_HP, BL_TH_UPDOWN, 0, GT_VALUE, CLR_GREEN, HL_BOLD),
        ]);
        game.flags.hitpointbar = hitpointbar;
        game.u.uhp = 39;
        await bot();
        game.u.uhp = 40;
        await bot();
        assert.equal(fieldCell('HP:40').color, CLR_GREEN);
        assert.equal(fieldCell('HP:40').attr, ATR_BOLD);
        statusEvalNextUnhilite();
        game.moves += 3;
        statusEvalNextUnhilite();
        updateStatusLines();
        assert.equal(fieldCell('HP:40').color, hitpointbar ? NO_COLOR : CLR_RED, 'Only the HP bar recalculates the percentage when unchanged HP loses its temporary highlight');
        assert.equal(fieldCell('HP:40').attr, 0);
        resetStatusHilites();
        await bot();
        assert.equal(fieldCell('HP:40').color, NO_COLOR, 'A full highlight reset uses the actual percentage');
    });
}
void test('experience percentage highlights change while the level stays the same', async () => {
    await roomWithRules([
        rule(BL_XP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_GREEN),
        rule(BL_XP, BL_TH_VAL_PERCENTAGE, 50, LT_VALUE, CLR_RED),
    ]);
    game.u.ulevel = 1;
    game.u.uexp = 0;
    await bot();
    assert.equal(fieldCell('Xp:1').color, CLR_RED);
    game.u.uexp = 12;
    await bot();
    assert.equal(fieldCell('Xp:1').color, CLR_GREEN);
});
for (const { field, hitpointbar, label } of [
    { field: BL_HP, hitpointbar: false, label: 'HP' },
    { field: BL_HP, hitpointbar: true, label: 'HP with its bar' },
    { field: BL_ENE, hitpointbar: false, label: 'power' },
    { field: BL_EXP, hitpointbar: false, label: 'experience points' },
]) {
    void test(`${label} highlight direction after an unchanged status repaint`, async () => {
        await roomWithRules([
            rule(field, BL_TH_UPDOWN, 0, LT_VALUE, CLR_RED),
            rule(field, BL_TH_UPDOWN, 0, GT_VALUE, CLR_GREEN),
        ]);
        game.flags.hitpointbar = hitpointbar;
        game.flags.showexp = true;
        game.u.ulevel = 1;
        game.u.uhpmax = 20;
        game.u.uenmax = 20;
        function setValue(value) {
            if (field === BL_HP)
                game.u.uhp = value;
            else if (field === BL_ENE)
                game.u.uen = value;
            else
                game.u.uexp = value;
        }
        const prefix = field === BL_HP ? 'HP:' : field === BL_ENE ? 'Pw:' : '/';
        const offset = field === BL_EXP ? 1 : 0; // The slash separator is uncolored.
        setValue(16);
        await bot();
        resetStatusHilites();
        await bot();
        setValue(12);
        await bot();
        assert.equal(fieldCell(`${prefix}12`, 23, offset).color, CLR_RED);
        await bot();
        setValue(13);
        await bot();
        assert.equal(fieldCell(`${prefix}13`, 23, offset).color, hitpointbar ? CLR_GREEN : CLR_RED, 'Without the HP bar, the new 65% is compared with the older 80% after an unchanged repaint');
    });
}
void test('a time-only status update preserves the percentage used for the next HP change', async () => {
    await roomWithRules([
        rule(BL_HP, BL_TH_UPDOWN, 0, LT_VALUE, CLR_RED),
        rule(BL_HP, BL_TH_UPDOWN, 0, GT_VALUE, CLR_GREEN),
    ]);
    await bot();
    resetStatusHilites();
    await bot();
    game.u.uhp = 30;
    await bot();
    assert.equal(fieldCell('HP:30').color, CLR_RED);
    game.moves++;
    timebot();
    assert.equal(fieldCell(`T:${game.moves}`).color, NO_COLOR);
    game.u.uhp = 31;
    await bot();
    assert.equal(fieldCell('HP:31').color, CLR_GREEN);
});
void test('hidden experience points refresh the level highlight when a percentage rule changes', async () => {
    await roomWithRules([
        rule(BL_XP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_GREEN),
        rule(BL_XP, BL_TH_VAL_PERCENTAGE, 50, LT_VALUE, CLR_RED),
    ]);
    game.flags.showexp = false;
    game.u.ulevel = 1;
    game.u.uexp = 8;
    await bot();
    assert.equal(fieldCell('Xp:1').color, CLR_RED);
    addExperience(1);
    updateStatusLines();
    assert.equal(fieldCell('Xp:1').color, CLR_RED);
    addExperience(1);
    updateStatusLines();
    assert.equal(fieldCell('Xp:1').color, CLR_GREEN);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Xp:1\//, 'Experience points remain hidden');
});
void test('the hitpoint bar uses the HP rule color only on its filled segment', async () => {
    await roomWithRules([rule(BL_HP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_RED)]);
    game.flags.hitpointbar = true;
    game.u.uhp = 20;
    await bot();
    const cells = requireScreenRow(22);
    assert.equal(cells[0]?.color, NO_COLOR, 'The opening bracket is outside the bar');
    assert.equal(cells[1]?.color, CLR_RED);
    assert.equal(cells[1]?.attr, ATR_INVERSE);
    assert.equal(cells[16]?.color, NO_COLOR, 'The empty half has no HP color');
});
void test('critical HP rules override a persistent numeric rule', async () => {
    await roomWithRules([
        rule(BL_HP, BL_TH_VAL_PERCENTAGE, 50, LT_VALUE, CLR_GREEN),
        rule(BL_HP, BL_TH_CRITICALHP, 0, NO_LTEQGT, CLR_RED, HL_BOLD),
    ]);
    game.u.uhp = 1;
    await bot();
    assert.equal(fieldCell('HP:1').color, CLR_RED);
    assert.equal(fieldCell('HP:1').attr, ATR_BOLD);
});
void test('text rules match the rank without the hero name and survive map flushes', async () => {
    await roomWithRules([rule(BL_TITLE, BL_TH_TEXTMATCH, 0, TXT_VALUE, CLR_BLUE, HL_BOLD, 'wanderer')]);
    await bot();
    assert.equal(fieldCell('Hero the Wanderer', 22).color, CLR_BLUE);
    await flush_screen(1);
    assert.equal(fieldCell('Hero the Wanderer', 22).attr, ATR_BOLD);
});
void test('a hero name resembling a status field keeps its title highlight', async () => {
    await roomWithRules([rule(BL_TITLE, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_BLUE)]);
    game.plname = 'St:12 Hero';
    await bot();
    assert.equal(fieldCell('St:12 Hero', 22).color, CLR_BLUE);
    assert.equal(fieldCell(' St:12', 22).color, NO_COLOR, 'The separator before real strength is uncolored');
});
void test('condition rules color active conditions without coloring the separator', async () => {
    await roomWithRules([]);
    game.u.blindTurns = 5;
    game.iflags.condHilites = Array.from({ length: BL_ATTCLR_MAX }, (_, index) => index === CLR_RED || index === HL_ATTCLR_BOLD ? BL_MASK_BLIND : 0);
    await bot();
    assert.equal(fieldCell('Blind').color, CLR_RED);
    assert.equal(fieldCell('Blind').attr, ATR_BOLD);
    assert.equal(fieldCell(' Blind').color, NO_COLOR);
});
void test('time-only updates retain other fields and evaluate the time highlight', async () => {
    await roomWithRules([
        rule(BL_HP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_RED),
        rule(BL_TIME, BL_TH_VAL_ABSOLUTE, 41, EQ_VALUE, CLR_BLUE, HL_BOLD),
        rule(BL_ENE, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_GREEN),
    ]);
    await bot();
    game.moves = 41;
    game.u.uhp = 12;
    timebot();
    assert.equal(fieldCell('T:41').color, CLR_BLUE);
    assert.equal(fieldCell('HP:40').color, CLR_RED);
    assert.equal(fieldCell('Pw:0').color, CLR_GREEN);
    game.iflags.hiliteDelta = 0;
    resetStatusHilites();
    await bot();
    assert.equal(fieldCell('HP:12').color, NO_COLOR);
});
void test('a cleared rule keeps its stale color until the hilite reset repaints every field', async () => {
    await roomWithRules([rule(BL_HP, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_RED)]);
    await bot();
    assert.equal(fieldCell('HP:40').color, CLR_RED);
    clearStatusHilites();
    await bot();
    assert.equal(fieldCell('HP:40').color, CLR_RED, 'an unchanged field keeps the buffered color of a removed rule');
    resetStatusHilites();
    await bot();
    assert.equal(fieldCell('HP:40').color, NO_COLOR, 'the reset round repaints unchanged fields without the rule');
});
//# sourceMappingURL=status_highlighting.test.js.map