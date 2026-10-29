import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { bindInputGate, InputGate, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
import { applyNethackrc, toggleBooleanOptionPrefix } from '../js/options.js';
import { bot, flush_screen } from '../js/display.js';
import { statusHiliteMenu } from '../js/status_hilites.js';
import { cansee } from '../js/vision.js';
import { BL_HP, BL_TH_ALWAYS_HILITE, HL_NONE, MAXBLSTATS, NO_LTEQGT } from '../js/const.js';
import { CLR_RED, ATR_BOLD, NO_COLOR } from '../js/terminal.js';

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

async function statusHiliteDurationRow(): Promise<string> {
    const [input, command] = openFullMenu();
    await input.waitUntilBlocked();
    input.feed('O');
    const { views } = await runScript(input, command, [
        { at: /statushilites\s+\[/, keys: '\x1b' },
    ]);
    const row = views.flatMap(view => view.split('\n'))
        .find(line => /statushilites\s+\[/.test(line));
    assert.ok(row, 'The full options menu shows the status highlight duration');
    return row;
}

for (const key of ['X', '~']) {
    void test(`rebinding '${key}' reports an empty required parameter before any binding confirmation`, async () => {
        freshObjectRoom();
        if (key === '~') game.commandBindings.remove(key.charCodeAt(0));
        const [input, command] = openFullMenu();
        await input.waitUntilBlocked();
        input.feed('O');
        const { views, prose } = await runScript(input, command, [
            { at: / - /, pick: /bind keys/ },
            { at: /bind keys/, keys: '\n' },
            { at: /Do what\?/, pick: /bind key to a command/ },
            { at: /Bind which key\?/, keys: key },
            { at: / - /, pick: /^toggle: / },
            { at: /Command toggle requires a parameter:/, keys: '\n' },
            { at: /Do what\?/, keys: '\x1b' },
        ]);
        const transcript = `${prose.join('\n')}\n${views.join('\n')}\n${messages()}`;
        assert.ok(transcript.includes('Required parameter cannot be empty.'), 'The empty parameter error is shown');
        if (key === 'X') assert.doesNotMatch(transcript, /(?:Changed|Bound) key 'X'/);
        else {
            assert.match(transcript, /Bound key '~' to "toggle\(\)"\./);
            const error = prose.join('\n').indexOf('Required parameter cannot be empty.');
            const bound = prose.join('\n').indexOf("Bound key '~'");
            assert.ok(error >= 0 && bound > error, 'The parameter error appears before the binding confirmation');
        }
    });
}

for (const name of ['silent', 'perm_invent']) {
    void test(`the fuzzer accepts toggle(${name}) without changing it or printing a message`, async () => {
        freshObjectRoom({ flags: { silent: true }, iflags: { debug_fuzzer: true, perm_invent: false } });
        assert.equal(await toggleBooleanOptionPrefix(name), true);
        assert.equal(game.flags.silent, true);
        assert.equal(game.iflags.perm_invent, false);
        assert.doesNotMatch(messages(), /option toggled/);
    });
}

void test('a fuzzer deletion keeps the menu listing count when enabling status highlights', async () => {
    const thresholds = Array.from({ length: MAXBLSTATS }, (_, fld) => fld === BL_HP ? [{
        fld: BL_HP, set: true, anytype: 'int' as const, value: 0,
        behavior: BL_TH_ALWAYS_HILITE, textmatch: '', rel: NO_LTEQGT, coloridx: 1 | (HL_NONE << 8),
    }] : []);
    freshObjectRoom({ iflags: { statusThresholds: thresholds, hiliteDelta: 0, debug_fuzzer: true } });
    // With the config-format row present, 's' is hitpoints. Select its
    // only rule and the explicit remove action, then accept that menu.
    bindInputGate(new HiliteFuzzerInput('saX\n'));
    assert.equal(await statusHiliteMenu(), true);
    game.iflags.debug_fuzzer = false;

    const [input, command] = openSimpleMenu();
    const { views } = await runScript(input, command, [{ at: /status highlight rules/, keys: '\x1b' }]);
    assert.match(views.at(-1) ?? '', /status highlight rules\s+\[\(0 currently set\)\]/);
    assert.match(await statusHiliteDurationRow(), /\[3 \(on: highlight status for 3 turns\)\]/);
});

class HiliteFuzzerInput extends InputGate {
    private readonly keys: number[];

    constructor(keys: string) {
        super();
        this.keys = [...keys].map(key => key.charCodeAt(0));
    }

    override readKey(): Promise<number> {
        const key = this.keys.shift();
        if (key === undefined) throw new Error(`Unexpected fuzzer menu input:\n${screen()}`);
        return Promise.resolve(key);
    }
}

void test('status highlight rules add, show and count a hitpoints threshold', async () => {
    freshObjectRoom({ hero: { uhp: 50, uhpmax: 60 } });
    requirePlayingGame(game);
    await bot();
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
    function hitpointsCell(value: number) {
        const cells = game.nhDisplay?.grid[23] ?? [];
        const hitpoints = cells[cells.map(cell => cell.ch).join('').indexOf(`HP:${value}`)];
        assert.ok(hitpoints, `The status shows HP:${value}`);
        return hitpoints;
    }
    assert.match(await statusHiliteDurationRow(), /\[3 \(on: highlight status for 3 turns\)\]/);
    assert.equal(hitpointsCell(50).color, NO_COLOR, 'Enabling highlights leaves unchanged HP uncolored');
    assert.equal(hitpointsCell(50).attr, 0);
    game.u.uhp = 49;
    await bot();
    assert.equal(hitpointsCell(49).color, NO_COLOR);
    game.u.uhp = 50;
    await bot();
    assert.equal(hitpointsCell(50).color, CLR_RED, 'Changing HP evaluates the new rule');
    assert.equal(hitpointsCell(50).attr, ATR_BOLD);
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
    const { views } = await runScript(input, command, [
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
        { at: /status highlight rules/, keys: '\x1b' },
    ]);

    assert.match(messages(), /Not expecting a percentage\./);
    assert.match(messages(), /"abc" is not a recognized number\./);
    assert.match(messages(), /Is that an invisible number\?/);
    assert.match(messages(), /hilite_status threshold '-5' is out of range/);
    assert.match(views.at(-1) ?? '', /status highlight rules\s+\[\(0 currently set\)\]/,
        'Cancelling the invalid threshold leaves the options menu with no rules');
});

void test('status highlight condition rules group the chosen conditions', async () => {
    freshObjectRoom({ hero: { blindTurns: 5 } });
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
    const cells = game.nhDisplay?.grid[23] ?? [];
    const blind = cells[cells.map(cell => cell.ch).join('').indexOf('Blind')];
    assert.ok(blind, 'The active condition appears on the status line');
    assert.equal(blind.color, CLR_RED);
    assert.equal(blind.attr, ATR_BOLD);
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

void test('the hilite field table follows initblstats order, not the enum', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views } = await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        // initblstats runs condition, version, weapon, armor, terrain; the
        // "version" row carries enum BL_VERS, so menu_fld(26) reads the
        // table's terrain row.
        { at: / - (?:title|strength|dexterity|constitution|condition|version|weapon|armor|terrain)/, pick: /^version\s*$/ },
        { at: /Select terrain field hilite behavior:/, keys: '\x1b' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);
    const fieldPage = views.find(view => / - condition/.test(view));
    assert.ok(fieldPage, 'The field list paged to the last five fields');
    assert.ok(fieldPage.indexOf('version') < fieldPage.indexOf('weapon'),
        'initblstats lists version before weapon');
    assert.ok(views.some(view => /Select terrain field hilite behavior:/.test(view)),
        'The version row opens the terrain behavior menu');
});

void test("a sixth bad value is still prompted; the seventh draws the line", async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views, prose } = await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        { at: /Status hilites:/, pick: /^strength\s*$/ },
        { at: /Select strength field hilite behavior:/, pick: /Number threshold/ },
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        { at: /Enter value for strength threshold:/, keys: 'abc\n' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);
    const transcript = `${messages()}\n${views.join('\n')}\n${prose.join('\n')}`;
    assert.match(transcript, /"abc" is not a recognized number\./);
    assert.match(transcript, /That's enough tries\./);
    // Six submissions drew six fresh prompts; the seventh was refused
    // before prompting again.
    const prompts = views.filter(view =>
        /^Enter value for strength threshold:\s*$/.test(view.split('\n')[0] ?? '')).length;
    assert.equal(prompts, 6);
});

void test('a condition rule the gather skips leaves "No current hilites"', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views, prose } = await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        { at: / - (?:title|strength|dexterity|constitution|condition|version|weapon|armor|terrain)/, pick: /^condition\s*$/ },
        { at: / - /, pick: /^Blind$/ },
        { at: / - /, keys: '\n' },
        // Accept the preselected "no color" and "none": the stored rule has
        // no visible color or attribute, so the gather drops it again.
        { at: /Choose a color for conditions Blind:/, keys: '\n' },
        { at: /Choose attribute for conditions Blind:/, keys: '\n' },
        { at: /Current condition hilites:/, keys: '\x1b' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);
    assert.match(`${messages()}\n${prose.join('\n')}`,
        /Added hilite condition\/Blind\/no-color&normal/);
    const empty = views.find(view => /Current condition hilites:/.test(view));
    assert.ok(empty);
    assert.match(empty, /No current hilites for condition/);
    assert.doesNotMatch(empty, /Remove selected hilites/);
    assert.match(empty, /Add new hilites/);
    assert.match(await statusHiliteDurationRow(), /\[0 \(off: don't highlight status fields\)\]/);
});

void test('toggle skips wizard-only booleans and reports uncompiled idlecheckpoint', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    // menu_tab_sep and montelecontrol are set_wizonly: no match at all.
    assert.equal(await toggleBooleanOptionPrefix('menu_tab_s'), false);
    assert.equal(await toggleBooleanOptionPrefix('montele'), false);
    assert.doesNotMatch(messages(), /option toggled/);

    // idlecheckpoint is set_in_game but uncompiled: the complaint, and the
    // option messages go quiet for the rest of the command.
    assert.equal(await toggleBooleanOptionPrefix('idle'), true);
    assert.match(messages(), /There is no underlying support for 'idlecheckpoint' compiled in\./);
    assert.equal(await toggleBooleanOptionPrefix('verbose'), true);
    assert.doesNotMatch(messages(), /'verbose' option toggled/);
});

void test('idlecheckpoint quiets later toggles until the simple options menu closes', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);

    await toggleBooleanOptionPrefix('idlecheckpoint');
    assert.equal(await toggleBooleanOptionPrefix('verbose'), true);
    assert.equal(game.flags.verbose, false);
    assert.doesNotMatch(messages(), /option toggled/);

    // The simple options menu resets the flag on exit.
    const [input, command] = openSimpleMenu();
    await runScript(input, command, [{ at: /Options/, keys: '\x1b' }]);
    assert.equal(await toggleBooleanOptionPrefix('verbose'), true);
    assert.match(messages(), /'verbose' option toggled on\./);
});

void test('multi-match toggles update the status before each toggle message pauses', async () => {
    freshObjectRoom({ hero: { uexp: 123 }, flags: { showexp: false, showvers: false } });
    applyNethackrc('MSGTYPE=stop "option toggled"');
    await bot();
    const input = resetInputState();
    const pauses: { message: string; status: string }[] = [];
    input.beforeRead = () => {
        const rows = screen().split('\n');
        pauses.push({ message: rows[0] ?? '', status: rows[23] ?? '' });
        input.feed(' ');
    };
    try {
        assert.equal(await toggleBooleanOptionPrefix('show'), true);
    } finally {
        input.beforeRead = null;
    }

    const experiencePause = pauses.find(pause => /'showexp' option toggled on\..*--More--/.test(pause.message));
    assert.ok(experiencePause, 'The experience toggle pauses on its confirmation');
    assert.match(experiencePause.status, /Xp:8\/123/);
    const versionPause = pauses.find(pause => /'showvers' option toggled on\..*--More--/.test(pause.message));
    assert.ok(versionPause, 'The version toggle pauses on its confirmation');
    assert.match(versionPause.status, /\b\d+\.\d+\.\d+\b/);
});

void test('a quiet status toggle updates the status before returning', async () => {
    freshObjectRoom({ flags: { time: false } });
    await bot();
    await toggleBooleanOptionPrefix('idlecheckpoint');

    assert.equal(await toggleBooleanOptionPrefix('time'), true);

    assert.match(screen().split('\n')[23] ?? '', /T:40/);
    assert.doesNotMatch(messages(), /'time' option toggled/);
});

void test('a light-option toggle restores vision before its confirmation pauses', async () => {
    freshObjectRoom({ recalculateVision: false });
    requirePlayingGame(game);
    applyNethackrc('MSGTYPE=stop "option toggled"');
    assert.equal(cansee(game.u.ux + 1, game.u.uy), false);
    const input = resetInputState();
    let visibleAtConfirmation = false;
    input.beforeRead = () => {
        if (/'dark_room' option toggled off\..*--More--/.test(screen().split('\n')[0] ?? ''))
            visibleAtConfirmation = cansee(game.u.ux + 1, game.u.uy);
        input.feed(' ');
    };
    try {
        assert.equal(await toggleBooleanOptionPrefix('dark_room'), true);
    } finally {
        input.beforeRead = null;
    }

    assert.equal(visibleAtConfirmation, true, 'The hero can see the neighboring room square at the confirmation');
});

void test('the status hilite menu returns after one field visit under the fuzzer', async () => {
    freshObjectRoom({ gameplaySeed: 2n, iflags: { debug_fuzzer: true } });
    const input = resetInputState();
    let visitedField = false;
    input.beforeRead = () => {
        const view = screen();
        if (/Select .*field hilite behavior:/.test(view)) visitedField = true;
        if (visitedField)
            assert.doesNotMatch(view, /Status hilites:/, 'The fuzzer must return after visiting a field');
    };
    try {
        assert.equal(await statusHiliteMenu(), true);
    } finally {
        input.beforeRead = null;
    }

    assert.equal(visitedField, true, 'The fuzzer selected a field before returning');
});

void test('#toggle also flips the window-capability booleans', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    // Direct calls page their own toggle messages; acknowledge them.
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    try {
        // optlist.h: popup_dialog and wraptext default off, ascii_map on.
        assert.equal(await toggleBooleanOptionPrefix('popup'), true);
        assert.equal(game.iflags.wc_popup_dialog, true);
        assert.match(messages(), /'popup_dialog' option toggled on\./);
        assert.equal(await toggleBooleanOptionPrefix('wraptext'), true);
        assert.equal(game.iflags.wc2_wraptext, true);
        assert.match(messages(), /'wraptext' option toggled on\./);
        assert.equal(await toggleBooleanOptionPrefix('ascii_map'), true);
        assert.equal(game.iflags.wc_ascii_map, false);
        assert.match(messages(), /'ascii_map' option toggled off\./);

        // Null-address and set_gameview entries never match.
        assert.equal(await toggleBooleanOptionPrefix('showscore'), false);
        assert.equal(await toggleBooleanOptionPrefix('voices'), false);
    } finally {
        input.beforeRead = null;
    }
});

void test('#toggle refuses to enable permanent inventory on tty without a message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    assert.equal(await toggleBooleanOptionPrefix('perm_invent'), false);
    assert.equal(game.iflags.perm_invent ?? false, false);
    assert.doesNotMatch(messages(), /perm_invent/);
});

for (const mode of ['ascii_map', 'tiled_map']) {
    void test(`#toggle(${mode}) switches map modes and pages its message before redrawing`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        const pagedMessages: string[] = [];
        input.beforeRead = () => {
            pagedMessages.push(screen().split('\n')[0] ?? '');
            input.feed(' ');
        };
        try {
            assert.equal(await toggleBooleanOptionPrefix(mode), true);
            assert.equal(game.iflags.wc_ascii_map, false);
            assert.equal(game.iflags.wc_tiled_map, true);
            const firstState = mode === 'ascii_map' ? 'off' : 'on';
            assert.ok(pagedMessages.some(line => line.includes(`'${mode}' option toggled ${firstState}.`)
                && line.includes('--More--')), 'The toggle message is acknowledged before the redraw');
            // options.c:9278-9297: toggle_bool_option() runs
            // reset_needed_visuals() with no flush_screen(), so the cls()
            // inside docrt() leaves the physical map blank until the next
            // end-of-command flush paints the refilled glyph buffer.
            assert.notEqual(game.nhDisplay?.grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@',
                'The redraw does not paint the hero before the next flush');
            await flush_screen(1);
            assert.equal(game.nhDisplay?.grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@',
                'The buffered redraw displays the hero at the next flush');
            assert.equal(screen().split('\n')[0]?.trim(), '', 'The redraw clears the acknowledged message');

            pagedMessages.length = 0;
            assert.equal(await toggleBooleanOptionPrefix('tiled_map'), true);
            assert.equal(game.iflags.wc_ascii_map, true);
            assert.equal(game.iflags.wc_tiled_map, false);
            assert.ok(pagedMessages.some(line => /'tiled_map' option toggled off\..*--More--/.test(line)),
                'The next toggle reads the updated tiled-map value and redraws again');
        } finally {
            input.beforeRead = null;
        }
    });
}

for (const keyfirst of [true, false]) {
    void test(`rebinding ${keyfirst ? 'a key' : 'a command'} reads the key without adding it to the prompt history`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const [input, command] = openFullMenu();
        await input.waitUntilBlocked();
        input.feed('O');
        const steps: Step[] = [
            { at: / - /, pick: /bind keys/ },
            { at: /bind keys/, keys: '\n' },
            { at: /Do what\?/, pick: keyfirst ? /bind key to a command/ : /bind command to a key/ },
        ];
        if (keyfirst) {
            steps.push(
                { at: /Bind which key\?/, keys: 'X' },
                { at: /Bind 'X' to what command\?/, keys: '\x1b' },
            );
        } else {
            steps.push(
                { at: /Bind what command\?/, pick: /^adjust: / },
                { at: /Bind which key\?/, keys: 'X' },
            );
        }
        steps.push({ at: /Do what\?/, keys: '\x1b' });
        const { views, prose } = await runScript(input, command, steps);

        const transcript = `${messages()}\n${prose.join('\n')}`;
        assert.match(transcript, /Bind which key\?/);
        assert.doesNotMatch(transcript, /Bind which key\? X/);
        assert.ok(views.every(view => !/Bind which key\?.*--More--/.test(view.split('\n')[0] ?? '')),
            'The key prompt reads a key directly without asking for acknowledgement');
        assert.equal(game.commandBindings.lookup('X'.charCodeAt(0))?.command?.name,
            keyfirst ? 'twoweapon' : 'adjust');
    });
}

void test('typed leading blanks survive into the threshold value rows', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const [input, command] = openSimpleMenu();
    const { views } = await runScript(input, command, [
        { at: /status highlight rules/, pick: /status highlight rules/ },
        { at: /Status hilites:/, pick: /^hitpoints\s*$/ },
        { at: /Select hitpoints field hilite behavior:/, pick: /Number threshold/ },
        { at: /Enter value for hitpoints threshold:/, keys: '  50\n' },
        { at: /Select field hitpoints value:/, keys: '\x1b' },
        // Cancelling the value menu re-prompts; an empty answer leaves.
        { at: /Enter value for hitpoints threshold:/, keys: '\x1b' },
        { at: /Select hitpoints field hilite behavior:/, keys: '\x1b' },
        { at: /Status hilites:/, keys: '\x1b' },
        { at: /Options/, keys: '\x1b' },
    ]);
    // trimspaces() skips the blanks in place; inbuf keeps them, so the
    // "Exactly …" row shows them.
    assert.ok(views.some(view => /Select field hitpoints value:/.test(view)
        && /Exactly {3}50/.test(view) && /Less than {3}50/.test(view)),
        'The value rows keep the typed leading blanks');
});
