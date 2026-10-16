import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription, rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { NO_MINVENT, PARANOID_PRAY, PARANOID_SWIM, PARANOID_TRAP } from '../js/const.js';
import { inventoryOrderSymbols } from '../js/object_sort.js';
import { applyNethackrc } from '../js/options.js';
import { flush_screen, newsym } from '../js/display.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenCell } from './support/screen.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';

function screen(): string {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}

async function fullOptions(names: readonly string[], respond: (view: string) => string = () => '\x1b'): Promise<string[]> {
    const input = resetInputState();
    const remaining = new Set(names);
    const views: string[] = [];
    let selecting = true;
    let answer = '';
    let reads = 0;
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const view = screen();
        if (++reads > 300) throw new Error(`Options did not finish; remaining: ${[...remaining].join(', ')}`);
        if (!selecting) {
            if (!answer) {
                views.push(view);
                answer = respond(view);
            }
            input.feed(answer.charAt(0));
            answer = answer.slice(1);
            return;
        }
        const row = view.split('\n').find(line => [...remaining].some(name => line.includes(` ${name} `)));
        const name = [...remaining].find(name => row?.includes(` ${name} `));
        const key = row?.match(/^\s*([a-zA-Z?]) [-+] /)?.[1];
        if (name && key) {
            remaining.delete(name);
            input.feed(key);
        } else if (!remaining.size) {
            selecting = false;
            input.feed('\n');
        } else input.feed(' ');
    };
    input.feed('O');
    try {
        await command;
        assert.equal(remaining.size, 0, 'Every requested option was offered');
        return views;
    } finally {
        input.beforeRead = null;
    }
}

async function simpleOption(name: string, select = true): Promise<string> {
    const input = resetInputState();
    const command = rhack('O'.charCodeAt(0));
    for (let page = 0; page < 12; page++) {
        await input.waitUntilBlocked();
        const row = screen().split('\n').find(line => line.includes(` ${name} `));
        const key = row?.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
        if (key && row) {
            if (select) {
                input.feed(key);
                await input.waitUntilBlocked();
            }
            input.feed('\x1b');
            await command;
            return row;
        }
        input.feed(' ');
    }
    input.feed('\x1b');
    await command;
    assert.fail(`The simple options menu did not offer ${name}`);
}

void test('the simple options menu toggles autoquiver without using a turn', async () => {
    freshObjectRoom({ flags: { autoquiver: false } });
    requirePlayingGame(game);

    await simpleOption('autoquiver');

    assert.equal(game.flags.autoquiver, true);
    assert.equal(game.moves, 40);
    assert.equal(game.context.move, 0);
});

void test('simple option help explains the choices and can be hidden again', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const command = rhack('O'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('?');
    await input.waitUntilBlocked();
    try {
        assert.match(screen(), /Use command '#optionsfull' to get the complete options list\./);
        assert.match(screen(), /name of a fruit you enjoy eating/);
        assert.match(screen(), /\? - hide help/);
        input.feed('?');
        await input.waitUntilBlocked();
        assert.match(screen(), /\? - show help/);
        assert.doesNotMatch(screen(), /name of a fruit you enjoy eating/);
    } finally {
        input.feed('\x1b');
        await command;
    }
});

void test('full options edit compounds in their displayed order', async () => {
    freshObjectRoom();

    const prompts = await fullOptions(['fruit', 'number_pad']);

    assert.match(prompts[0] ?? '', /Set fruit to what\?/);
    assert.match(prompts[1] ?? '', /Select number_pad mode:/);
});

void test('full option help returns to the choices with its help offer removed', async () => {
    freshObjectRoom();

    const views = await fullOptions(['view help for options menu'], view => view.includes('--More--') ? ' ' : '\x1b');

    assert.ok(views.some(view => view.includes('How dynamically setting options works:')));
    assert.match(views.at(-1) ?? '', /Set what options\?/);
    assert.doesNotMatch(views.at(-1) ?? '', /view help for options menu/);
});

void test('full fruit edits announce the native singular name', async () => {
    freshObjectRoom();

    await fullOptions(['fruit'], view => view.includes('Set fruit to what?') ? 'mangos\n' : ' ');

    assert.equal(game.fruitName, 'mango');
    assert.match(game._pending_message, /Fruit is now "mango"\./);
});

void test('runmode offers native display choices and keeps the selected mode', async () => {
    freshObjectRoom();

    const views = await fullOptions(['runmode'], () => 't');

    assert.ok(views.some(view => view.includes('Select run/travel display mode:')));
    assert.equal(game.flags.runmode, 'teleport');
});

void test('message history mode uses its own choice menu and confirmation', async () => {
    freshObjectRoom();

    const views = await fullOptions(['msg_window'], () => 'r');

    assert.ok(views.some(view => view.includes('Select message history display type:')));
    assert.equal(game.iflags.prevmsg_window, 'r');
    assert.match(game._pending_message, /'msg_window' changed to "reversed"\./);
});

void test('paranoid confirmation can clear all preselected actions', async () => {
    freshObjectRoom({ flags: { paranoia_bits: PARANOID_PRAY | PARANOID_TRAP | PARANOID_SWIM } });

    const views = await fullOptions(['paranoid_confirmation'], () => '-\n');

    assert.ok(views.some(view => view.includes('Actions requiring extra confirmation:')));
    assert.equal(game.flags.paranoia_bits, 0);
});

void test('disclosure edits selected categories in native category order', async () => {
    freshObjectRoom();

    const views = await fullOptions(['disclose'], view => {
        if (view.includes('Change which disclosure options categories:')) return 'iv\n';
        if (view.includes('Disclosure options for inventory:')) return 'b';
        if (view.includes('Disclosure options for vanquished:')) return 'c';
        return '\x1b';
    });

    assert.ok(views.some(view => view.includes('Disclosure options for inventory:')));
    assert.ok(views.some(view => view.includes('Disclosure options for vanquished:')));
    assert.equal(game.flags.disclose, '+i na #v ng nc no');
});

void test('autounlock applies the checked action set from the simple menu', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('iauf\n\x1b');

    await rhack('O'.charCodeAt(0));

    assert.equal(game.flags.autounlock, 9);
});

void test('pickup burden uses the native encumbrance choices', async () => {
    freshObjectRoom();

    const views = await fullOptions(['pickup_burden'], () => 'l');

    assert.ok(views.some(view => view.includes('Select encumbrance level:')));
    assert.equal(game.flags.pickup_burden, 5);
});

void test('cancelling autopickup types discards new checks', async () => {
    freshObjectRoom({ flags: { pickup_types: '$' } });

    await fullOptions(['pickup_types'], () => 'c\x1b');

    assert.equal(game.flags.pickup_types, '$');
});

void test('the all-classes autopickup choice stores the native empty list', async () => {
    freshObjectRoom({ flags: { pickup_types: '$' } });

    await fullOptions(['pickup_types'], () => 'A\n');

    assert.equal(game.flags.pickup_types, '');
});

void test('traditional autopickup prompts for symbols and preserves order', async () => {
    freshObjectRoom({ flags: { menu_style: 0, pickup_types: '$' } });

    const views = await fullOptions(['pickup_types'], () => ')%\n');

    assert.ok(views.some(view => view.includes('New pickup_types: [') && view.includes('am] ($)')));
    assert.equal(game.flags.pickup_types, ')%');
});

for (const [value, expected] of [['12', 12], ['-2', 5], ['nonsense', 0], ['', 5]] as const) {
    void test(`pile_limit accepts native numeric input ${JSON.stringify(value)}`, async () => {
        freshObjectRoom();

        const views = await fullOptions(['pile_limit'], () => `${value}\n`);

        assert.ok(views.some(view => view.includes('Set pile_limit to what?')));
        assert.equal(game.flags.pile_limit, expected);
    });
}

void test('packorder reports bad classes while retaining the valid entries', async () => {
    freshObjectRoom();

    await fullOptions(['packorder'], view => view.includes('Set packorder to what?') ? ')~)%\n' : ' ');

    assert.match(inventoryOrderSymbols(), /^\$\)%/);
    assert.match(game._pending_message, /Duplicate object class '\)'/);
    assert.match(game._pending_message, /Not an object class '~'/);
});

void test('invalid menuinvertmode leaves its previous value and reports the range error', async () => {
    freshObjectRoom();
    game.iflags.menuinvertmode = 2;

    const views = await fullOptions(['menuinvertmode'], () => '3\n');

    assert.ok(views.some(view => view.includes('Set menuinvertmode to what?')));
    assert.equal(game.iflags.menuinvertmode, 2);
    assert.match(game._pending_message, /Illegal menuinvertmode parameter '3'/);
});

void test('invalid status height is rejected by its compound prompt', async () => {
    freshObjectRoom();

    const views = await fullOptions(['statuslines'], () => '4\n');

    assert.ok(views.some(view => view.includes('Set statuslines to what?')));
    assert.match(game._pending_message, /'statuslines:4' is invalid; must be 2 or 3/);
});

void test('a highlighting rule with an unknown status field reports that field', async () => {
    freshObjectRoom();

    const views = await fullOptions(['hilite_status'], () => 'mystery/red\n');

    assert.ok(views.some(view => view.includes('Set hilite_status to what?')));
    assert.match(game._pending_message, /Unknown status field 'mystery'/);
});

for (const configuration of ['OPTIONS=menu_next_page:^F,menu_previous_page:^B', 'BINDINGS=^F:menu_next_page,^B:menu_previous_page']) {
    void test(`configured menu navigation works in the public options command (${configuration.split('=')[0]})`, async () => {
        freshObjectRoom();
        applyNethackrc(configuration);
        const input = resetInputState();
        const command = rhack('O'.charCodeAt(0));
        await input.waitUntilBlocked();
        input.feed('\x06');
        await input.waitUntilBlocked();
        try {
            assert.match(screen(), / Status /);
            input.feed('\x02');
            await input.waitUntilBlocked();
            assert.match(screen(), / General /);
        } finally {
            input.feed('\x1b');
            await command;
        }
    });
}

for (const symbols of ['0!~', '0\\x21\\o176']) {
    void test(`configured warning symbols retain their threat description (${symbols})`, async () => {
        freshObjectRoom({ hero: { warning: true } });
        applyNethackrc(`OPTIONS=warnings:${symbols}`);
        const xorn = await createMonsterAt('xorn', 11, 10, NO_MINVENT);
        xorn.minvis = 1;
        xorn.mpeaceful = false;
        xorn.m_lev = 8;
        resetInputState().feed('\x1b');

        await rhack('O'.charCodeAt(0));
        newsym(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).ch, '~');
        assert.equal(await farlookLocationDescription(11, 10), 'unknown creature causing you anxiety');
    });
}

void test('bulk inversion leaves unselected full-menu booleans unchanged', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('O');
    await input.waitUntilBlocked();
    input.feed('@');
    await input.waitUntilBlocked();
    try {
        let row = screen().split('\n').find(line => line.includes(' acoustics '));
        for (let page = 0; !row && page < 12; page++) {
            input.feed('>');
            await input.waitUntilBlocked();
            row = screen().split('\n').find(line => line.includes(' acoustics '));
        }
        assert.match(row ?? '', /^[ ]*[a-zA-Z] - acoustics /);
    } finally {
        input.feed('\x1b');
        await command;
    }
});

void test('idlecheckpoint reports that the native build cannot enable it', async () => {
    freshObjectRoom();

    await fullOptions(['idlecheckpoint']);

    assert.match(game._pending_message, /There is no underlying support for 'idlecheckpoint' compiled in\./);
});

void test('native no-prefixes and repeated negations survive opening options', async () => {
    freshObjectRoom({ flags: { color: true, time: true, verbose: false } });
    applyNethackrc('OPTIONS=nocolor,no-time,!!verbose');
    resetInputState().feed('\x1b');

    await rhack('O'.charCodeAt(0));

    assert.equal(game.flags.color, false);
    assert.equal(game.flags.time, false);
    assert.equal(game.flags.verbose, true);
});

void test('native compound abbreviations show their canonical settings', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=runmode:w,pile_limit:-8,msg_window:reversed,paranoid_confirmation:pr tr sw');
    resetInputState().feed('\x1b');

    await rhack('O'.charCodeAt(0));

    assert.equal(game.flags.runmode, 'walk');
    assert.equal(game.flags.pile_limit, 5);
    assert.equal(game.iflags.prevmsg_window, 'r');
    assert.equal(game.flags.paranoia_bits, PARANOID_PRAY | PARANOID_TRAP | PARANOID_SWIM);
});

void test('invalid traditional pickup classes retain valid symbols once and report the error', async () => {
    freshObjectRoom({ flags: { menu_style: 0 } });

    await fullOptions(['pickup_types'], () => ')x)\n');

    assert.equal(game.flags.pickup_types, ')');
    assert.match(game._pending_message, /Unknown pickup_types parameter ''\./);
});

void test('coordinate and location filtering options use their native menus', async () => {
    freshObjectRoom();

    const views = await fullOptions(['whatis_coord', 'whatis_filter'], view =>
        view.includes('Select coordinate display') ? 'm' : 'v');

    assert.ok(views.some(view => view.includes('map <x,y>')));
    assert.ok(views.some(view => view.includes('in view only')));
    assert.equal(game.iflags.getpos_coords, 'm');
    assert.equal(game.iflags.getloc_filter, 1);
});

void test('changing version information redraws the displayed version', async () => {
    freshObjectRoom({ flags: { showvers: true } });

    const views = await fullOptions(['versinfo'], view => view.includes('Select version information flags:') ? 'ng\n' : ' ');

    assert.equal(game.flags.versinfo, 2);
    assert.ok(views.some(view => view.includes("'versinfo' changed to 2.")));
    assert.match(screen(), /nethack/);
});

void test('status condition choices update the live status line', async () => {
    freshObjectRoom();

    const views = await fullOptions(['status condition fields'], view => {
        if (view.includes('Choose status conditions to toggle')) return 'a\n';
        return '\x1b';
    });

    assert.ok(views.some(view => view.includes('cond_barehanded')));
    await flush_screen(1);
    assert.match(screen(), /Bare/);
});

void test('accepting an autounlock alias preserves its current key action', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=autounlock:apply_key');
    resetInputState().feed('i\n\x1b');

    await rhack('O'.charCodeAt(0));

    assert.equal(game.flags.autounlock, 2);
});

void test('number-pad mode selection honors the configured menu search key', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menu_search:;');
    const input = resetInputState();
    input.feed('b;');
    const command = rhack('O'.charCodeAt(0));
    await input.waitUntilBlocked();
    try {
        assert.match(game._pending_message, /Search for:/);
    } finally {
        input.feed('phone\n\x1b\x1b');
        await command;
    }
    assert.equal(game.commandBindings.phoneLayout, true);
});

void test('scores retains valid prefixes and reports a negative count', async () => {
    freshObjectRoom();

    await fullOptions(['scores'], () => '4top/-2around\n');

    assert.equal(game.flags.end_top, 4);
    assert.equal(game.flags.end_around, 0);
    assert.match(game._pending_message, /Values for scores:top and scores:around must not be negative\./);
});

void test('feature-alert suppression accepts a current or older native version', async () => {
    freshObjectRoom();

    await fullOptions(['suppress_alert'], () => '3.7.2\n');

    assert.equal(game.flags.suppress_alert, '3.7.2');
    assert.match(game._pending_message, /Feature change alerts disabled for NetHack 3\.7\.2 features and prior\./);
});

void test('feature-alert suppression rejects future versions and keeps the old setting', async () => {
    freshObjectRoom({ flags: { suppress_alert: '3.3.1' } });

    await fullOptions(['suppress_alert'], () => '9.0.0\n');

    assert.equal(game.flags.suppress_alert, '3.3.1');
    assert.match(game._pending_message, /You can't disable new feature alerts for future versions\./);
});

void test('packorder keeps its old order until all validation errors have been acknowledged', async () => {
    freshObjectRoom();
    const previous = inventoryOrderSymbols();
    let acknowledged = false;

    await fullOptions(['packorder'], view => {
        if (view.includes('Set packorder to what?')) return '%)~^|@\n';
        assert.match(view, /--More--/);
        assert.equal(inventoryOrderSymbols(), previous);
        acknowledged = true;
        return ' ';
    });

    assert.equal(acknowledged, true);
    assert.match(inventoryOrderSymbols(), /^\$%\)/);
});

void test('each disclosure category commits before the next category prompt', async () => {
    freshObjectRoom();

    await fullOptions(['disclose'], view => {
        if (view.includes('Change which disclosure options categories:')) return 'iv\n';
        if (view.includes('Disclosure options for inventory:')) return 'b';
        assert.match(view, /Disclosure options for vanquished:/);
        assert.match(game.flags.disclose ?? '', /^\+i /);
        return '\x1b';
    });

    assert.match(game.flags.disclose ?? '', /^\+i /);
});

for (const style of [0, 2] as const) {
    void test(`pickup types are cleared during the native ${style === 0 ? 'text' : 'menu'} prompt and restored on Escape`, async () => {
        freshObjectRoom({ flags: { menu_style: style, pickup_types: '$' } });

        await fullOptions(['pickup_types'], view => {
            assert.match(view, style === 0 ? /New pickup_types:/ : /Autopickup what\?/);
            assert.equal(game.flags.pickup_types, '');
            return '\x1b';
        });

        assert.equal(game.flags.pickup_types, '$');
    });
}

void test('restoring a game retains the current background-color preference', async () => {
    freshObjectRoom();
    game.plname = 'Options';
    const storage = memoryStorage();
    await simpleOption('bgcolors');
    assert.equal(await saveGame(storage), true);
    await simpleOption('bgcolors');

    assert.equal(restoreGame('Options', storage), true);
    const row = await simpleOption('bgcolors', false);

    assert.match(row, /\[X\]/);
});

void test('restoring a game retains the current sound preference', async () => {
    freshObjectRoom();
    game.plname = 'Options';
    const storage = memoryStorage();
    await fullOptions(['sounds']);
    assert.equal(await saveGame(storage), true);
    await fullOptions(['sounds']);

    assert.equal(restoreGame('Options', storage), true);
    await fullOptions(['sounds']);

    assert.match(game._pending_message, /'sounds' option toggled on\./);
});
