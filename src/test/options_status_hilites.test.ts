import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
import { toggleBooleanOptionPrefix } from '../js/options.js';
import { BL_STR } from '../js/const.js';

function screen(): string {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}

function messages(): string {
    return [...game._messageHistory, game._toplines, game._pending_message].join('\n');
}

// The selector letter of the first menu row whose text matches.
function rowKey(view: string, pattern: RegExp): string | null {
    for (const line of view.split('\n')) {
        const match = line.match(/^\s*([a-zA-Z*?#]) [-+] (.*)$/);
        if (match && match[2] !== undefined && pattern.test(match[2].trim())) return match[1] ?? null;
    }
    return null;
}
interface Step {
    at: RegExp;
    pick?: RegExp;
    keys?: string;
}

// Feeds one key per input read, choosing from the step list; menu pages
async function runScript(
    input: InputGate, command: Promise<unknown>, steps: readonly Step[],
): Promise<{ views: string[]; prose: string[] }> {
    const views: string[] = [];
    const prose: string[] = [];
    let pending = '';
    let index = 0;
    let reads = 0;
    let misses = 0;
    input.beforeRead = () => {
        const view = screen();
        views.push(view);
        prose.push([game._pending_message, game._toplines, game._retained_message]
            .filter(Boolean).join('\n'));
        if (++reads > 600) {
            throw new Error(`The menu flow never finished; stuck at:\n${view}`);
        }
        if (pending) {
            input.feed(pending.charAt(0));
            pending = pending.slice(1);
            return;
        }
        // A message pager keeps its "--More--" on the message row; text
        // windows page with "--More--" on the bottom row and their steps
        // must still run.
        const firstRow = view.split('\n')[0] ?? '';
        if (/--More--|Hit space to continue/.test(firstRow)) {
            input.feed(' ');
            return;
        }
        // A step matching this screen always wins: text windows also render
        // "--More--", so the pager check must not hijack their dismissal.
        const step = steps[index];
        if (step && step.at.test(view)) {
            if (step.keys !== undefined) {
                misses = 0;
                index++;
                pending = step.keys;
            } else {
                const key = rowKey(view, step.pick ?? step.at);
                if (key === null && !/ - /.test(view))
                    throw new Error(`No row ${step.pick ?? step.at} in:\n${view}`);
                // The row is on a later page; mostly bell so an early
                // redraw cannot page past the menu's end. misses only
                // resets once the step is consumed, so paging happens.
                if (key === null) {
                    misses++;
                    pending = misses % 3 === 0 ? ' ' : '\x01';
                } else {
                    misses = 0;
                    index++;
                    pending = key;
                }
            }
        } else if (/--More--|Hit space to continue/.test(view)) {
            // A pending message pager takes the next key whatever it is.
            input.feed(' ');
            return;
        } else if (/ - /.test(view)) {
            // A redraw or a menu whose next page holds the wanted row.
            // Mostly ring the terminal bell, which no prompt or menu
            // treats as input; page only after several stray redraws so a
            // leftover view of an earlier menu is never paged past its end.
            misses++;
            pending = misses % 8 === 0 ? ' ' : '\x01';
        } else {
            throw new Error(`Unexpected screen awaiting step ${index} (${steps[index]?.at}):\n${view}`);
        }
        input.feed(pending.charAt(0));
        pending = pending.slice(1);
    };
    try {
        await command;
    } finally {
        input.beforeRead = null;
    }
    return { views, prose };
}

const openSimpleMenu = (): [InputGate, Promise<unknown>] => {
    const input = resetInputState();
    const command = rhack('O'.charCodeAt(0));
    return [input, command];
};

const openFullMenu = (): [InputGate, Promise<unknown>] => {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    return [input, command];
};

void test('status highlight rules add, show and count a hitpoints threshold', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views, prose } = await runScript(input, command, [
        { at: /status highlight rules\s+\[\(0 currently set\)\]/, pick: /status highlight rules/ },
        { at: /Status hilites:/, pick: /^hitpoints\s*$/ },
        { at: /Select hitpoints field hilite behavior:/, pick: /Number threshold/ },
        { at: /Enter value for hitpoints threshold:/, keys: '50\n' },
        { at: /Select field hitpoints value:/, pick: /Exactly 50/ },
        { at: /Choose a color for when hitpoints is 50:/, pick: /^red$/ },
        { at: /Choose attribute for when hitpoints is 50:/, keys: 'b\n' },
        { at: /Current hitpoints hilites:/, keys: '\x1b' },
        { at: /Status hilites:/, pick: /View all hilites in config format/ },
        { at: /OPTIONS=hilite_status:/, keys: ' ' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /status highlight rules\s+\[\(1 currently set\)\]/, keys: '\x1b' },
    ]);

    const transcript = `${messages()}\n${views.join('\n')}\n${prose.join('\n')}`;
    const firstMenu = views.find(view => /Status hilites:/.test(view));
    assert.ok(firstMenu, 'The status hilite menu opened');
    assert.doesNotMatch(firstMenu, /View all hilites in config format/);
    assert.doesNotMatch(firstMenu, /score/);

    assert.match(transcript, /Added hilite hitpoints\/=50\/red&bold/);
    const listMenu = views.find(view => /Current hitpoints hilites:/.test(view));
    assert.ok(listMenu);
    assert.match(listMenu, /hitpoints\/=50\/red&bold/);
    assert.match(listMenu, /X - Remove selected hilites/);
    assert.match(listMenu, /Z - Add new hilites/);

    const secondMenu = views.filter(view => /Status hilites:/.test(view))[1];
    assert.ok(secondMenu);
    assert.match(secondMenu, /View all hilites in config format/);
    assert.match(secondMenu, /hitpoints\s+\(1 defined\)/);
    assert.ok(views.some(view => /OPTIONS=hilite_status: hitpoints\/=50\/red&bold/.test(view)),
        'The config-format listing shows the rule');
    assert.ok(views.some(view => /status highlight rules\s+\[\(1 currently set\)\]/.test(view)),
        'The simple options menu reports the live rule count');
    // status_hilite_menu() enables a default highlight duration.
    assert.equal(game.iflags.hiliteDelta, 3);
});

void test('status highlight percentage rules keep their threshold operator', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views, prose } = await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        { at: /Status hilites:/, pick: /^hitpoints\s*$/ },
        { at: /Select hitpoints field hilite behavior:/, pick: /Percentage threshold/ },
        { at: /Enter percentage value for hitpoints threshold:/, keys: '50\n' },
        { at: /Select field hitpoints value:/, pick: /Less than 50%/ },
        { at: /Choose a color for when hitpoints is less than 50%:/, pick: /^red$/ },
        { at: /Choose attribute for when hitpoints is less than 50%:/, keys: '\n' },
        { at: /Current hitpoints hilites:/, keys: '\x1b' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);

    assert.match(`${messages()}\n${views.join('\n')}\n${prose.join('\n')}`, /Added hilite hitpoints\/<50%\/red&normal/);
    assert.ok(views.some(view => /Select field hitpoints value:/.test(view)
        && /Less than 50%/.test(view) && /50% or less/.test(view)));
});

void test('status highlight value entry rejects bad numbers and ranges', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        { at: /Status hilites:/, pick: /^strength\s*$/ },
        { at: /Select strength field hilite behavior:/, pick: /Number threshold/ },
        // A percentage on an absolute-only entry restarts the behavior menu.
        { at: /Enter value for strength threshold:/, keys: '50%\n' },
        { at: /Select strength field hilite behavior:/, pick: /Number threshold/ },
        // Unrecognized trailing text re-prompts for the value.
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        // A bare minus sign has no digits to read.
        { at: /Enter value for strength threshold:/, keys: '-\n' },
        // A below-range absolute threshold names the field and the value.
        { at: /Enter value for strength threshold:/, keys: '-5\n' },
        // Cancelling the re-prompt, then the behavior menu, aborts the rule.
        { at: /Enter value for strength threshold:/, keys: '\x1b' },
        { at: /Select strength field hilite behavior:/, keys: '\x1b' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);

    assert.match(messages(), /Not expecting a percentage\./);
    assert.match(messages(), /"abc" is not a recognized number\./);
    assert.match(messages(), /Is that an invisible number\?/);
    assert.match(messages(), /hilite_status threshold '-5' is out of range/);
    assert.equal(game.iflags.statusThresholds?.[BL_STR]?.length, 0);
});

void test('status highlight condition rules group the chosen conditions', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views, prose } = await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        // Menus re-letter each page, so match any page that shows a status
        // field row and pick the wanted row from it.
        { at: / - (?:title|strength|dexterity|constitution|hitpoints|condition|weapon|version)/, pick: /^condition\s*$/ },
        // The condition field has a single behavior, so no behavior menu.
        { at: / - /, pick: /^Blind$/ },
        { at: / - /, pick: /^Stone$/ },
        { at: / - /, keys: '\n' },
        { at: /Choose a color for conditions Blind\+Stone:/, pick: /^red$/ },
        { at: /Choose attribute for conditions Blind\+Stone:/, keys: 'b\n' },
        { at: /Current condition hilites:/, keys: '\x1b' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);

    assert.match(`${messages()}\n${views.join('\n')}\n${prose.join('\n')}`,
        /Added hilite condition\/Blind\+Stone\/red&bold/);
    assert.ok(views.some(view => /Current condition hilites:/.test(view)
        && /condition\/Blind\+Stone\/red&bold/.test(view)),
        'The field list menu shows the config-format condition rule');
    // The chosen conditions are stored against red (1) and bold (18).
    assert.equal(game.iflags.condHilites?.[1], 0x100002);
    assert.equal(game.iflags.condHilites?.[18], 0x100002);
});

void test('the bind keys row binds a command and lists the change', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openFullMenu();
    await input.waitUntilBlocked();
    input.feed('O');
    const { views, prose } = await runScript(input, command, [
        { at: / - /, pick: /bind keys\s+\[\(0 currently set\)\]/ },
        { at: /bind keys/, keys: '\n' },
        { at: /Do what\?/, pick: /bind key to a command/ },
        { at: /Bind which key\?/, keys: 'X' },
        { at: /Bind 'X' to what command\?/, pick: /^adjust: / },
        { at: /Do what\?/, pick: /view changed key binds/ },
        { at: /BIND=X:adjust/, keys: ' ' },
        { at: /Do what\?/, keys: '\x1b' },
    ]);
    assert.ok(views.some(view => /Bind 'X' to what command\?/.test(view)
        && /Key 'X' is currently bound to "twoweapon"\./.test(view)),
        'The bind menu reports the current binding');
    // The "Changed key ..." pline pages behind the next menu; the binding
    // state and the config listing below carry the same outcome.
    assert.equal(game.commandBindings.lookup('X'.charCodeAt(0))?.command?.name, 'adjust');

    // A fresh full menu reports the live count.
    const [secondInput, secondCommand] = openFullMenu();
    await secondInput.waitUntilBlocked();
    secondInput.feed('O');
    const { views: secondViews, prose: secondProse } = await runScript(secondInput, secondCommand, [
        { at: / - /, pick: /bind keys\s+\[\(1 currently set\)\]/ },
        { at: /bind keys/, keys: '\n' },
        { at: /Do what\?/, keys: '\x1b' },
    ]);
    assert.ok(secondViews.some(view => /bind keys\s+\[\(1 currently set\)\]/.test(view)),
        'The options row reports the live binding count');
});

void test('#toggle without a parameter points at the full options command', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    await runExtendedCommand('toggle');

    assert.match(messages(), /Use #optionsfull to set any option instead\./);
    assert.equal(game.context.move, 0);
});

void test('toggle with a parameter flips every matching boolean', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);

    assert.equal(await toggleBooleanOptionPrefix('verbose'), true);
    assert.equal(game.flags.verbose, false);
    assert.match(messages(), /'verbose' option toggled off\./);

    // The parameter is a name prefix, so several options can match.
    assert.equal(await toggleBooleanOptionPrefix('ve'), true);
    assert.equal(game.flags.verbose, true);
});

void test('the full options menu offers perm_invent but cannot enable it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openFullMenu();
    await input.waitUntilBlocked();
    input.feed('O');
    await runScript(input, command, [
        { at: / - /, pick: /perm_invent\s+\[off\]/ },
        // Confirming the selection is a silent no-op and the pass ends.
        { at: /perm_invent/, keys: '\n' },
    ]);
    assert.doesNotMatch(messages(), /perm_invent/);
});
