import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandBindings } from '../js/command_bindings.js';
import { pushKeys } from '../js/input.js';
import { promptDirection } from '../js/tty_prompts.js';
import { selectMapPosition } from '../js/getpos.js';
import { doOptions } from '../js/options.js';
import { startLuaCore } from './support/lua-game.js';
import { parseNethackrc, applyNethackrc } from '../js/options.js';
import { commandKeyDescription } from '../js/command_keys.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { saveGame, restoreGame } from '../js/save.js';
import { freshObjectRoom } from './support/object-room.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { POT_HEALING } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';

const code = (key: string) => key.charCodeAt(0);
const command = (bindings: CommandBindings, key: string) => bindings.lookup(code(key))?.command?.name ?? null;

void test('switching to the number pad restores the commands hidden by vi movement', () => {
    const bindings = new CommandBindings();
    assert.equal(command(bindings, 'h'), 'movewest');
    bindings.bindKey(code('h'), 'search');
    bindings.setNumberPad(1);
    assert.equal(command(bindings, 'h'), 'help');
    assert.equal(command(bindings, '4'), 'movewest');
    assert.equal(bindings.keyForDirection(0, 2), 0);
});

void test('a keypad reset hides and later restores a custom binding on its movement keys', () => {
    const bindings = new CommandBindings();
    bindings.bindKey(code('4'), 'search');
    bindings.setNumberPad(1);
    assert.equal(command(bindings, '4'), 'movewest');
    bindings.setNumberPad(0);
    assert.equal(command(bindings, '4'), 'search');
    assert.notEqual(bindings.keyForCommand('search'), code('4'));
});

void test('QWERTZ and phone layouts bind their corresponding directions', () => {
    const bindings = new CommandBindings();
    bindings.setNumberPad(-1);
    assert.equal(command(bindings, 'z'), 'movenorthwest');
    bindings.setNumberPad(3);
    assert.equal(command(bindings, '1'), 'movenorthwest');
    assert.equal(command(bindings, '7'), 'movesouthwest');
    bindings.setNumberPad(1);
    assert.equal(command(bindings, '7'), 'movenorthwest');
});

void test('command descriptions choose the newest printable binding without reordering replaced keys', () => {
    const bindings = new CommandBindings();
    bindings.bindKey(code('!'), 'search');
    bindings.bindKey(code('~'), 'search');
    assert.equal(bindings.keyForCommand('search'), code('~'));
    bindings.bindKey(code('!'), 'search');
    assert.equal(bindings.keyForCommand('search'), code('~'));
});

void test('Space is preferred to a control-only binding when no printable key is left', () => {
    const bindings = new CommandBindings();
    bindings.bindKey(code('s'), 'nothing');
    bindings.bindKey(1, 'search');
    bindings.bindKey(32, 'search');
    assert.equal(bindings.keyForCommand('search'), 32);
    bindings.bindKey(32, 'nothing');
    assert.equal(bindings.keyForCommand('search'), 1);
});

void test('rest on Space temporarily replaces a custom Space command and restores it when turned off', () => {
    const bindings = new CommandBindings();
    bindings.setRestOnSpace(true, { initial: true });
    bindings.bindKey(32, 'search');
    bindings.finishConfiguration();
    assert.equal(command(bindings, ' '), 'wait');
    bindings.setRestOnSpace(false);
    assert.equal(command(bindings, ' '), 'search');
});



for (const [entry, keys, configuration] of [
    ['default key', '\\', ''],
    ['rebound key', '!', 'BIND=!:known'],
    ['extended command', '#known\n', ''],
] as const) {
    void test(`the discoveries ${entry} opens its menu without spending a turn`, async () => {
        freshObjectRoom();
        recordObjectKnowledge(POT_HEALING);
        if (configuration) applyNethackrc(configuration);
        const moves = game.moves;
        const input = resetInputState();
        input.feed(keys);

        const action = rhack(0);
        try {
            const menuOpened = await Promise.race([
                input.waitUntilBlocked().then(() => true),
                action.then(() => false),
            ]);
            assert.equal(menuOpened, true, 'the command should wait for discovery-menu dismissal');
            assert.ok(game.nhDisplay);
            const text = game.nhDisplay.grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /Discoveries, by order of discovery within each class/);
            assert.match(text, /potion of healing/);
        } finally {
            input.feed('\x1b');
            await action;
        }

        assert.equal(game.context.move, 0);
        assert.equal(game.moves, moves);
    });
}

void test('rc lists apply right to left, while later physical lines still take precedence', () => {
    const options = parseNethackrc([
        'BIND=!:wait,!:search',
        'BIND=~:wait',
        'OPTIONS=number_pad:1,number_pad:0',
    ].join('\n'));
    assert.equal(command(options.commandBindings, '!'), 'wait');
    assert.equal(commandKeyDescription('wait', options.commandBindings), '~');
    assert.equal(command(options.commandBindings, '4'), 'movewest');
});

void test('rc applies keypad resets at their position, without a final movement reset', () => {
    const first = parseNethackrc('BIND=h:search\nOPTIONS=number_pad:1');
    assert.equal(command(first.commandBindings, 'h'), 'help');
    const second = parseNethackrc('OPTIONS=number_pad:1\nBIND=1:search');
    assert.equal(command(second.commandBindings, '1'), 'search');
});

void test('startup reconciles Space, but a config fragment defers its new rest policy until a reset', () => {
    const options = parseNethackrc('OPTIONS=rest_on_space\nBIND=<space>:search');
    assert.equal(command(options.commandBindings, ' '), 'wait');
    applyNethackrc('OPTIONS=rest_on_space:false', options);
    assert.equal(options.flags.rest_on_space, false);
    assert.equal(command(options.commandBindings, ' '), 'wait');
    applyNethackrc('OPTIONS=number_pad:0', options);
    assert.equal(command(options.commandBindings, ' '), 'search');
});

void test('Native key notation resolves escapes, control-meta bytes and decimal codes', () => {
    const options = parseNethackrc(String.raw`BIND=\x21:search,M-C-a:wait,160:open,<enter>:inventory`);
    assert.equal(command(options.commandBindings, '!'), 'search');
    assert.equal(options.commandBindings.lookup(129)?.command?.name, 'wait');
    assert.equal(options.commandBindings.lookup(160)?.command?.name, 'open');
    assert.equal(options.commandBindings.lookup(10)?.command?.name, 'inventory');
    assert.equal(commandKeyDescription('open', options.commandBindings), 'o');
    const invalid = parseNethackrc("BIND='!':search,space:wait");
    assert.equal(command(invalid.commandBindings, '!'), 'shell');
    assert.equal(command(invalid.commandBindings, ' '), null);
});

void test('live keypad and rebound movement keys dispatch their configured directions', async () => {
    freshTurnRoom();
    applyNethackrc('OPTIONS=number_pad:1');
    await rhack(code('6'));
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 10);
    applyNethackrc('BIND=!:movesouth');
    await rhack(code('!'));
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 11);
});

void test('removing a default movement binding does not fall through to the old direction', async () => {
    freshTurnRoom();
    applyNethackrc('BIND=l:nothing');
    await rhack(code('l'));
    assert.equal(game.u.ux, 10);
    assert.match(game._pending_message, /Unknown command/);
});

void test('restore retains the current key bindings rather than the saved process configuration', async () => {
    freshTurnRoom();
    game.plname = 'Keys';
    const storage = memoryStorage();
    applyNethackrc('BIND=!:movewest');
    assert.equal(await saveGame(storage), true);
    applyNethackrc('BIND=!:moveeast');
    assert.equal(restoreGame('Keys', storage), true);
    await rhack(code('!'));
    assert.equal(game.u.ux, 11);
});


void test('a digit can be a prompted direction even when top-level digits are counts', async () => {
    freshTurnRoom();
    applyNethackrc('BIND=4:moveeast,l:search');
    pushKeys('4');
    const direction = await promptDirection();
    assert.ok(direction);
    assert.equal(direction.dx, 1);
    assert.equal(direction.dy, 0);
});

void test('map movement bindings beat feature-editor keys, but not position pick keys', async () => {
    freshTurnRoom();
    applyNethackrc('BIND=z:moveeast,.:moveeast');
    pushKeys('z.');
    const position = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a position.', goal: 'a position',
        isValidLocation: () => true,
    });
    assert.ok(position);
    assert.deepEqual({ x: position.x, y: position.y }, { x: 11, y: 10 });
});

void test('restoring keeps the current keypad and Space command until the next option change', async () => {
    freshTurnRoom();
    game.plname = 'Layout';
    const storage = memoryStorage();
    applyNethackrc('OPTIONS=rest_on_space,number_pad:0');
    assert.equal(await saveGame(storage), true);
    applyNethackrc('OPTIONS=!rest_on_space,number_pad:1');
    applyNethackrc('BIND=<space>:search');
    assert.equal(restoreGame('Layout', storage), true);
    assert.equal(game.iflags.num_pad, true);
    assert.equal(game.flags.rest_on_space, true);
    assert.equal(command(game.commandBindings, ' '), 'search');
    applyNethackrc('OPTIONS=number_pad:1');
    assert.equal(command(game.commandBindings, ' '), 'wait');
});

void test('the options keypad selector changes live movement without spending a turn', async () => {
    freshTurnRoom();
    pushKeys('bb  ');
    await doOptions();
    assert.equal(game.context.move, 0);
    await rhack(code('6'));
    assert.equal(game.u.ux, 11);
});


void test('Lua config changes rest policy without immediately replacing Space or returning a value', async t => {
    freshTurnRoom();
    applyNethackrc('BIND=<space>:search');
    const core = await startLuaCore(t);
    core.execute('result = nh.parse_config("OPTIONS=rest_on_space")');
    assert.equal(core.getGlobal('result') == null, true, 'nh.parse_config returns no value');
    assert.equal(game.flags.rest_on_space, true);
    assert.equal(command(game.commandBindings, ' '), 'search');
    core.execute('nh.parse_config("OPTIONS=number_pad:1")');
    assert.equal(command(game.commandBindings, ' '), 'wait');
});


void test('special direction keys move independently of command bindings and give self priority', async () => {
    freshTurnRoom();
    applyNethackrc('BIND=!:getdir.self,!:moveeast');
    pushKeys('!');
    const direction = await promptDirection();
    assert.ok(direction);
    assert.deepEqual({ dx: direction.dx, dy: direction.dy, dz: direction.dz },
        { dx: 0, dy: 0, dz: 0 });
    assert.equal(command(game.commandBindings, '!'), 'moveeast');
    applyNethackrc('BIND=~:getdir.self');
    pushKeys('!');
    const reboundDirection = await promptDirection();
    assert.ok(reboundDirection);
    assert.equal(reboundDirection.dx, 1);
});

void test('a rebound map pick key selects before its ordinary movement binding', async () => {
    freshTurnRoom();
    applyNethackrc('BIND=!:getpos.pick,!:moveeast');
    pushKeys('!');
    const position = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a position.', goal: 'a position',
    });
    assert.ok(position);
    assert.deepEqual({ x: position.x, y: position.y }, { x: 10, y: 10 });
});


void test('keypad resets preserve bindings on the stair command keys', () => {
    const bindings = new CommandBindings();
    bindings.bindKey(code('>'), 'search');
    bindings.bindKey(code('<'), 'wait');
    bindings.setNumberPad(1);
    assert.equal(command(bindings, '>'), 'search');
    assert.equal(command(bindings, '<'), 'wait');
    bindings.setNumberPad(0);
    assert.equal(command(bindings, '>'), 'search');
});

void test('movement layouts do not add control-byte shortcuts for stairs', () => {
    const bindings = new CommandBindings();
    assert.equal(bindings.movementForKey(30), null);
    assert.equal(bindings.movementForKey(28), null);
    bindings.setNumberPad(1);
    assert.equal(bindings.movementForKey(190), null);
});
