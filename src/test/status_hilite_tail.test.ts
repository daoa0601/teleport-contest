import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { toggleBooleanOptionPrefix } from '../js/options.js';
import { describeDecor } from '../js/dungeon_feature.js';
import type { StatusHiliteRule } from '../js/flags.js';
import { BL_HP, BL_TITLE, BL_ALIGN, BL_TH_UPDOWN, BL_TH_ALWAYS_HILITE,
    EQ_VALUE, HL_NONE, MAXBLSTATS, NO_LTEQGT, ICE, STONE } from '../js/const.js';
import { ATR_INVERSE, CLR_RED, CLR_BLUE, CLR_GREEN, NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function rule(fld: number, behavior: number, value: number, rel: number, color: number,
    attr = HL_NONE, textmatch = ''): StatusHiliteRule {
    return { fld, behavior, value, rel, coloridx: color | (attr << 8), textmatch, set: true, anytype: 'int' };
}

function roomWithRules(rules: readonly StatusHiliteRule[], flags: Record<string, boolean> = { time: true }) {
    const thresholds = Array.from({ length: MAXBLSTATS }, (_, fld) => rules.filter(entry => entry.fld === fld));
    freshObjectRoom({ iflags: { statusThresholds: thresholds, hiliteDelta: 2 }, flags });
    requirePlayingGame(game);
}

function fieldCell(text: string, row: number) {
    const cells = requireScreenRow(row);
    const column = cells.map(cell => cell.ch).join('').indexOf(text);
    assert.ok(column >= 0, `Expected '${text}' on status row ${row}: ${cells.map(cell => cell.ch).join('')}`);
    const cell = cells[column];
    assert.ok(cell);
    return cell;
}

void test('a gold symbol change re-evaluates status fields from gold onward', async () => {
    // botl.c:1564-1576: when the gold encoding or symbol changed since the
    // last status round, gu.update_all is forced while evaluating BL_GOLD,
    // so gold and every later field is treated as changed (chg = 0) with its
    // temporary-highlight timer cleared.  Alignment precedes gold in
    // initblstats order, so its temporary highlight survives.
    roomWithRules([
        rule(BL_ALIGN, BL_TH_UPDOWN, 0, EQ_VALUE, CLR_RED),
        rule(BL_HP, BL_TH_UPDOWN, 0, EQ_VALUE, CLR_BLUE),
    ]);
    await bot();
    if (game.u.ualign) game.u.ualign.type = -1;
    game.u.uhp = 39;
    await bot();
    assert.equal(fieldCell('Chaotic', 22).color, CLR_RED);
    assert.equal(fieldCell('HP:39', 23).color, CLR_BLUE);

    game.shownSymbols = { rogue: true, name: null };
    await bot();

    assert.equal(fieldCell('Chaotic', 22).color, CLR_RED,
        'alignment precedes gold in the field order and keeps its temporary highlight');
    assert.equal(fieldCell('HP:39', 23).color, NO_COLOR,
        'the gold symbol change drops hit points back to its persistent rule');
});

void test('a title-only status change leaves the hitpoint bar in the title rule style', async () => {
    // wintty.c:4588-4589 stores the title rule colour/attribute on the title
    // cell and wintty.c:4613-4615 overwrite it only when the HP field is
    // updated.  A rank-title change with unchanged HP leaves the bar in the
    // title rule's colour and drops inverse until hit points change again.
    roomWithRules([rule(BL_TITLE, BL_TH_ALWAYS_HILITE, 0, NO_LTEQGT, CLR_GREEN)],
        { hitpointbar: true });
    await bot();
    const initial = requireScreenRow(22);
    const initialTitle = initial.map(cell => cell.ch).join('');
    assert.equal(initial[1]?.attr, ATR_INVERSE, 'the HP update owns the bar style after a full update');

    game.u.uhp = 20;
    await bot();
    const injured = requireScreenRow(22);
    assert.equal(injured[1]?.attr, ATR_INVERSE);
    assert.equal(injured[1]?.color, NO_COLOR, 'no HP rule is set');

    game.u.ulevel = 10;
    await bot();
    const restyled = requireScreenRow(22);
    assert.notEqual(restyled.map(cell => cell.ch).join(''), initialTitle,
        'the rank title itself must change for this test');
    assert.equal(restyled[15]?.color, CLR_GREEN, 'the title update repaints the bar in the title rule colour');
    assert.equal(restyled[16]?.color, NO_COLOR, 'the unlit half never takes the title colour');
    assert.equal(restyled[16]?.attr, 0);

    game.u.uhp = 21;
    await bot();
    const recovered = requireScreenRow(22);
    assert.equal(recovered[1]?.attr, ATR_INVERSE, 'the next HP update restores the bar attribute');
    assert.equal(recovered[1]?.color, NO_COLOR);
});

void test('toggling customsymbols redraws without refreshing the gold symbol probe', async () => {
    // reset_needed_visuals() (options.c:8995-9001) reruns reset_customsymbols
    // and docrt() but skips the check_gold_symbol() that an opt_need_redraw
    // change would run.
    freshObjectRoom({ flags: { customsymbols: true } });
    requirePlayingGame(game);
    game.shownSymbols = { rogue: true, name: 'blank' };
    game.iflags.optionMessages = false;
    assert.ok(!game.iflags.invis_goldsym, 'the probe starts unset');

    await toggleBooleanOptionPrefix('customsymbols');

    assert.equal(game.flags.customsymbols, false);
    assert.ok(!game.iflags.invis_goldsym,
        'the invisible gold symbol is not re-probed while toggling customsymbols');
});

void test('toggling mention_decor forgets the previous decoration', async () => {
    // options.c:5422-5423: any in-game mention_decor toggle resets
    // iflags.prev_decor to STONE, so describe_decor() re-announces the
    // feature the hero is standing on instead of suppressing it as the
    // same terrain (pickup.c:392).
    freshObjectRoom({ flags: { mention_decor: true } });
    requirePlayingGame(game);
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };
    game.level.requireAt(game.u.ux, game.u.uy).typ = ICE;

    await describeDecor({ publish });
    assert.equal(messages.length, 1, 'arriving on the ice announces it');

    game.iflags.optionMessages = false;
    await toggleBooleanOptionPrefix('mention_decor');
    await toggleBooleanOptionPrefix('mention_decor');
    assert.equal(game.flags.mention_decor, true);
    assert.equal(game._prevDecorType, STONE, 'the toggle forgets the remembered surface');

    await describeDecor({ publish });
    assert.equal(messages.length, 2, 'the same ice is announced again after the toggle');
});
