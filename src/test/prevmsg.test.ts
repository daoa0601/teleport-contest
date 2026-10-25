// ^P previous-message recall, driven through rhack() and the shared prompt
// owners. C refs: cmd.c doprev_message(), win/tty/topl.c
// tty_doprev_message()/remember_topl()/update_topl(), win/tty/getline.c.
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { flush_screen, pline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { nhgetch, queueCommandKeys, resetInputState } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { ARROW, DAGGER } from '../js/object_data.js';
import { answerPrompts } from './support/input-boundaries.js';
import { planInput } from './support/planned-input.js';
import { runSegment } from '../js/jsmain.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { restoreGame, saveGame } from '../js/save.js';
import { resetGame } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { promptChoice } from '../js/query.js';

function rowText(row: number): string {
    return requireGameDisplay().grid[row]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

// tty_nhgetch() marks the displayed topline as seen; feeding one key through
// it is the boundary between two commands.
async function markSeen(input: InputGate): Promise<void> {
    input.feed(' ');
    await nhgetch();
}

async function recallGame(mode: 'single' | 'combination', moves: string, storage = memoryStorage()) {
    return await runSegment({
        seed: 3,
        datetime: '2026-10-25T12:00:00',
        nethackrc: 'OPTIONS=name:Recall,role:Valkyrie,race:human,gender:female,align:lawful,'
            + `!legacy,!tutorial,!tips,pettype:none,msg_window:${mode}`,
        moves,
        storage,
    });
}

void test('single-mode ^P recalls the joined line, wraps to the newest, and takes no time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('The door creaks open.');
    await pline('A gust of wind follows.'); // update_topl() joins both lines
    await markSeen(input);
    await pline('You are in luck.'); // remember_topl() files the joined line
    const moves = game.moves;

    await rhack(16);
    assert.equal(rowText(0), 'You are in luck.');
    await rhack(16);
    assert.equal(rowText(0), 'The door creaks open.  A gust of wind follows.',
        'one recall entry keeps the two-space join');
    await rhack(16);
    assert.equal(rowText(0), 'You are in luck.',
        'the walk past the oldest entry wraps back to the pending line');
    assert.equal(game.moves, moves, '^P takes no game time');
});

void test('an unknown command replaces the line without being remembered', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('You remember this line.');
    await markSeen(input);

    await rhack('%'.charCodeAt(0));
    await flush_screen(1); // parse() reports it before any command repaint
    assert.equal(rowText(0), "Unknown command '%'.");

    await rhack(16);
    assert.equal(rowText(0), '',
        'custompline(SUPPRESS_HISTORY) leaves the complaint out of gt.toplines');
    await rhack(16);
    assert.equal(rowText(0), 'You remember this line.',
        'the line before the complaint is still the newest entry');
});

void test('msg_window:full lists the ring oldest-first with the pending line last', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'f';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');

    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(0), /Message History/);
    assert.match(rowText(2), /Alpha line here\./);
    assert.match(rowText(3), /Beta line now\./);
    assert.match(rowText(4), /Gamma falls\./);
    input.feed(' ');
    await recall;
    assert.doesNotMatch(rowText(0), /Message History/,
        'destroy_nhwindow() erases the recall window');
});

void test('msg_window:reversed leads with the pending line and runs newest-first', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'r';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');

    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.equal(rowText(2).trim(), 'Gamma falls.');
    assert.equal(rowText(3).trim(), 'Beta line now.');
    assert.equal(rowText(4).trim(), 'Alpha line here.');
    input.feed(' ');
    await recall;
});

void test('msg_window:combination pages two single lines before the full window', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'c';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');

    await rhack(16);
    assert.equal(rowText(0), 'Gamma falls.');
    await rhack(16);
    assert.equal(rowText(0), 'Beta line now.');

    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(0), /Message History/);
    input.feed(' ');
    await recall;
});

void test('a combination history window opened by a separate command ignores ^P', async () => {
    const engine = await recallGame('combination', ' $)=\x10\x10\x10');
    assert.match(rowText(0), /Message History/);

    engine.inputGate.feed(16);
    await engine.runUntilInputNeeded();

    assert.match(rowText(0), /Message History/,
        '^P cannot dismiss a window without a single-line step in this call');
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.doesNotMatch(rowText(0), /Message History/, 'Space still dismisses the window');
});

void test('combination recall opens the full window on its second press when the ring write slot wraps', async () => {
    // The greeting and nineteen command responses fill twenty saved slots;
    // the twentieth response is still the pending line.
    const engine = await recallGame('combination', ' ' + '$)'.repeat(10) + '\x10');
    assert.match(rowText(0), /spear \(weapon in left hand\)/);

    engine.inputGate.feed(16);
    await engine.runUntilInputNeeded();

    assert.match(rowText(0), /Message History/,
        'at write slot zero, C skips the newest saved line and opens the window');
});

void test('restoring a full recall ring restarts combination mode at write slot zero', async () => {
    const storage = memoryStorage();
    const saved = await recallGame('combination', ' ' + '$)'.repeat(10) + 'Sy', storage);
    assert.equal(saved.lastRunResult?.kind, 'stopped', 'the save command must finish');
    const engine = await recallGame('combination', '\x10', storage);
    assert.match(rowText(0), /welcome back to NetHack!/);

    engine.inputGate.feed(16);
    await engine.runUntilInputNeeded();

    assert.match(rowText(0), /Message History/,
        'refilling all twenty slots during restore takes the same wrapped-ring branch');
});

void test('menu search remembers the message it replaces before recalling it', async () => {
    const engine = await recallGame('single', ' $i:');
    assert.match(rowText(0), /^Search for:/);

    engine.inputGate.feed(16);
    await engine.runUntilInputNeeded();

    assert.equal(rowText(0), 'Your wallet is empty.',
        'the first ^P in menu search recalls the message shown before the menu');
});

void test('a wrapped recall pages with --More-- and ^P keeps the walk going', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const long = 'You hear the distant tone of a bell being struck over and over without any pause.';
    input.feed(' ');
    await pline(long); // wraps, then the fed space dismisses its --More--
    await markSeen(input);
    await pline('Short now.');

    await rhack(16);
    assert.equal(rowText(0), 'Short now.');

    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(1), /--More--/, 'a wrapped recall entry needs a pager');
    input.feed(16);
    await recall;
    assert.equal(rowText(0), 'Short now.',
        'the pager accepts ^P and continues the walk to the pending line');
});

void test('single-mode ^P in a question discards the first following key and records the answer', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('Before the question.');
    await markSeen(input);

    const question = promptChoice('Really try?', ['y', 'n'], 'n');
    await input.waitUntilBlocked();
    assert.equal(rowText(0).trimEnd(), 'Really try? [yn] (n)');
    input.feed(16);
    await input.waitUntilBlocked();
    assert.equal(rowText(0), 'Before the question.',
        'the first ^P at a question steps past the empty prompt line');
    input.feed('y');
    await input.waitUntilBlocked();
    assert.equal(rowText(0).trimEnd(), 'Really try? [yn] (n)',
        'the key after browsing only repaints the question');
    input.feed('y');
    assert.equal(await question, 'y');

    await pline('Afterwards.'); // remembers the answered question
    await rhack(16);
    await rhack(16);
    assert.equal(rowText(0), 'Really try? [yn] (n) y',
        'clean_up files the prompt with its recorded answer');
});

void test('a full recall ring skips its oldest entry and wraps to the pending line', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.msg_history = 200; // the ring clamps to MAX_MSG_HISTORY
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    for (let index = 0; index < 130; index++) {
        await pline(`Message number ${index}.`);
        await markSeen(input);
    }
    const recalled: string[] = [];
    for (let press = 0; press < 132; press++) {
        await rhack(16);
        recalled.push(rowText(0));
    }
    assert.equal(recalled[0], 'Message number 129.', 'the pending line recalls first');
    assert.ok(recalled.includes('Message number 2.'), 'the walk reaches the oldest displayed entry');
    assert.ok(!recalled.includes('Message number 1.'),
        "a full ring never displays the entry occupying maxrow's own slot");
    const wrap = recalled.indexOf('Message number 129.', 1);
    assert.ok(wrap > 0 && recalled[wrap - 1] === 'Message number 2.',
        'the walk wraps to the pending line right after the oldest displayed entry');
});

void test('a full ring omits its oldest entry from the reversed window', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.msg_history = 200;
    game.iflags.prevmsg_window = 'r';
    const input = resetInputState();
    for (let index = 0; index < 130; index++) {
        await pline(`Message number ${index}.`);
        await markSeen(input);
    }
    const seen: string[] = [];
    const recall = rhack(16);
    for (let page = 0; page < 6; page++) {
        await input.waitUntilBlocked();
        seen.push(...requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()));
        input.feed(' ');
    }
    await recall;
    assert.ok(seen.some(row => row.includes('Message number 129.')),
        'the pending topline leads the reversed window');
    assert.ok(seen.some(row => row.includes('Message number 2.')));
    assert.ok(!seen.some(row => row.includes('Message number 1.')),
        'the reversed walk stops before the slot holding the oldest entry');
});

void test('save and restore carry the recall ring', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await pline('One forgotten turn.');
    await markSeen(input);
    await pline('Two remembered turns.');
    const storage = memoryStorage();
    game.plname = 'Prevmsg';

    assert.equal(await saveGame(storage), true, 'save_msghistory() flushes the pending line');
    resetGame();
    assert.equal(restoreGame('Prevmsg', storage), true);
    // jsmain attaches the terminal before dorecover(); reattach it here.
    game.nhDisplay = new GameDisplay(null);
    await pline('Three follows.'); // remembers the restored pending line
    await rhack(16);
    assert.equal(rowText(0), 'Three follows.');
    await rhack(16);
    assert.equal(rowText(0), 'Two remembered turns.', 'restored entries recall oldest-first');
    await rhack(16);
    assert.equal(rowText(0), 'One forgotten turn.');
});


void test('the # editor files the line before its prompt and keeps its own text out of history', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.extmenu = false;
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('Before the hash.');
    await markSeen(input);

    const editor = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('\x10'); // browse inside the editor; the ESC cancels it
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await editor;

    await pline('After the cancel.');
    await rhack(16);
    assert.equal(rowText(0), 'After the cancel.');
    await rhack(16);
    assert.equal(rowText(0), 'Before the hash.',
        'the SUPPRESS_HISTORY prompt files the line it replaces');
    await rhack(16);
    assert.equal(rowText(0), 'After the cancel.',
        'neither the "# " line nor any editor text is remembered');
});

void test('a line prompt records the answer typed into it', async t => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await addInventoryObject(ARROW, { invlet: 'a', quan: 4, oextra: { oname: 'First Flight' } });
    input.feed('name\r');
    queueCommandKeys('ia');
    planInput(input, t, [{
        prompt: /What do you want to name these arrows named First Flight\?/,
        keys: 'Fletching\r',
    }]);

    await rhack('#'.charCodeAt(0));
    await pline('Named and done.');
    await rhack(16);
    assert.equal(rowText(0), 'Named and done.');
    await rhack(16);
    assert.match(rowText(0), /name these arrows named First Flight\? Fletching$/,
        'gt.toplines follows the typed text, not the empty prompt');
});

void test('a free-form question answers ^P like any key and records it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await addInventoryObject(DAGGER, { invlet: 'a' });
    const drop = rhack('d'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(rowText(0), /What do you want to drop\?/);
    input.feed('\x10'); // resp==NULL prompts answer ^P like any other key
    await input.waitUntilBlocked();
    assert.match(rowText(0), /don't have that object/,
        'the ^P answer reaches getobj as an ordinary key');
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(rowText(0), /What do you want to drop\?/,
        'the question is asked again');
    input.feed('\xe1'); // M-a survives readchar()'s signed-char decode
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(rowText(0), /What do you want to drop\?/);
    input.feed('\x1b');
    await drop;

    await pline('Dropped nothing.');
    await rhack(16);
    assert.equal(rowText(0), 'Never mind.  Dropped nothing.');
    await rhack(16);
    assert.ok(rowText(0).endsWith('What do you want to drop? [a or ?*] <esc>'));
    await rhack(16);
    assert.equal(rowText(0), "You don't have that object.");
    await rhack(16);
    assert.ok(rowText(0).endsWith('What do you want to drop? [a or ?*] M-a'),
        'a meta answer is named M-a like visctrl()');
    await rhack(16);
    assert.equal(rowText(0), "You don't have that object.");
    await rhack(16);
    assert.ok(rowText(0).endsWith('What do you want to drop? [a or ?*] ^P'),
        'key2txt() records the ^P answer itself');
});

void test('a hidden message that does not fit still files the stopped line', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const stopped = 'A distant rumble grows louder as the ceiling cracks. '.repeat(2);
    input.feed('\x1b');
    await pline(stopped); // wraps; Escape suppresses everything after it
    const hidden = 'Another long hidden line follows here and cannot fit beside the stopped one.';
    await pline(hidden);
    await pline('Visible end.');
    await markSeen(input);

    await rhack(16);
    assert.equal(rowText(0), 'Visible end.');
    await rhack(16);
    assert.equal(rowText(0), hidden, 'the hidden line is still filed for recall');
    // The stopped entry wraps, so its recall pages like any wrapped line.
    const stoppedRecall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(0), /^A distant rumble/);
    assert.match(rowText(1), /--More--/);
    input.feed(' ');
    await stoppedRecall;
    assert.equal(rowText(0), '', 'a dismissed wrapped recall clears the line');
});

void test('the split count files its yn answer and only the conditional final count', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const stack = await addInventoryObject(DAGGER, { invlet: 'a', quan: 9 });
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: stack.invlet },
        { prompt: /Adjust inventory by splitting this stack/, keys: 'I' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /Split off how many\? /, keys: '5' },
        { prompt: /Count: 5 /, keys: '2' },
        { prompt: /Count: 52 /, keys: ' ' },
    ]);

    await rhack(16);
    assert.equal(rowText(0), 'Amount to split from current stack must be less than 9.');
    await rhack(16);
    assert.equal(rowText(0), 'Count: 52 <space>',
        'only the final conditional count enters history');
    await rhack(16);
    assert.equal(rowText(0), 'Split off how many? 5',
        'the yn answer is recorded with its trailing space');
    await rhack(16);
    assert.equal(rowText(0), 'Amount to split from current stack must be less than 9.',
        'the walk wraps back to the newest entry');
});

void test('Escape in a split count files a zero count', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const stack = await addInventoryObject(DAGGER, { invlet: 'a', quan: 9 });
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: stack.invlet },
        { prompt: /Adjust inventory by splitting this stack/, keys: 'I' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /Split off how many\? /, keys: '5' },
        { prompt: /Count: 5 /, keys: '\x1b' },
    ]);

    await rhack(16);
    assert.equal(rowText(0), 'Never mind.');
    await rhack(16);
    assert.equal(rowText(0), 'Count: 0 <esc>',
        'Escape breaks the count with a zero value like get_count()');
    await rhack(16);
    assert.equal(rowText(0), 'Split off how many? 5');
});

void test('startup clamps msghistory like tty window creation', async () => {
    for (const [config, expected] of [['msghistory:-5', 128], ['msghistory:300', 128],
        ['msghistory:5', 20], ['!msghistory', 20]] as const) {
        const engine = await runSegment({
            seed: 3,
            datetime: '2026-10-25T12:00:00',
            nethackrc: `OPTIONS=name:Clamper,role:Valkyrie,race:human,gender:female,align:lawful,${config}`,
            moves: '',
            storage: memoryStorage(),
        });
        assert.equal(engine.state.iflags.msg_history, expected, config);
    }
});

void test('a wrapped entry recalled from a question pages with --More--', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const long = 'You hear the distant tone of a bell being struck over and over without any pause.';
    input.feed(' ');
    await pline(long);
    await markSeen(input);
    await pline('Short now.');
    await markSeen(input);

    const question = promptChoice('Really try?', ['y', 'n'], 'n');
    await input.waitUntilBlocked();
    input.feed(16);
    await input.waitUntilBlocked();
    // The first press steps past the empty prompt line and shows the line
    // the question replaced; only the wrapped entry beyond it pages.
    assert.equal(rowText(0), 'Short now.');
    input.feed(16);
    await input.waitUntilBlocked();
    assert.match(rowText(0), /^You hear the distant tone/);
    assert.match(rowText(1), /--More--/,
        'the entry was drawn after toplin left TOPLINE_SPECIAL_PROMPT');
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed('y');
    await input.waitUntilBlocked();
    input.feed('y');
    assert.equal(await question, 'y');
});

void test('a history window replaces a repainted question without paging it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'f';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');
    await markSeen(input);

    const question = promptChoice('Really try?', ['y', 'n'], 'n');
    await input.waitUntilBlocked();
    input.feed(16); // the fresh prompt owns the line: no acknowledgment
    await input.waitUntilBlocked();
    assert.doesNotMatch(rowText(0), /--More--/,
        'a TOPLINE_SPECIAL_PROMPT line is never paged over');
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed(16); // reading this press acknowledges the question itself
    await input.waitUntilBlocked();
    // tty_nhgetch() demotes TOPLINE_NEED_MORE to NON_EMPTY on the keypress
    // (wintty.c:4169-4171), so tty_display_nhwindow()'s pending
    // acknowledgment (wintty.c:1969-1970) never fires for this window.
    assert.doesNotMatch(rowText(0), /--More--/);
    assert.match(rowText(0), /Message History/);
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed('y');
    assert.equal(await question, 'y');
});

void test('the adjust destination records the answer after the prompt space', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const dagger = await addInventoryObject(DAGGER, { invlet: 'a' });
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Adjust inventory by assigning new letter/, keys: 'i' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /Adjust letter to what/, keys: 'b' },
    ]);
    assert.equal(dagger.invlet, 'b');

    await pline('Adjusted.');
    await rhack(16);
    assert.equal(rowText(0), 'Moving: b - a +0 dagger.  Adjusted.');
    await rhack(16);
    assert.ok(rowText(0).endsWith('(? see used letters)? b'),
        'yn_function() builds its prompt as "%s " before the answer');
});

void test('a repainted long line prompt pages on its next first recall', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.extmenu = false;
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('Before the hash.');
    await markSeen(input);

    const editor = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('w'.repeat(90));
    await input.waitUntilBlocked();
    input.feed(16); // browse: the prompt-owned line draws without a pager
    await input.waitUntilBlocked();
    assert.doesNotMatch(rowText(1), /--More--/,
        'the first recall after the prompt itself never pages');
    input.feed('w'); // an ordinary key repaints the longer line
    await input.waitUntilBlocked();
    input.feed(16);
    await input.waitUntilBlocked();
    assert.ok([rowText(1), rowText(2)].some(text => text.includes('--More--')),
        'addtopl() left TOPLINE_NEED_MORE, so this recall pages (topl.c:139)');
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await editor;
});
