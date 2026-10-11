import type { InputGate } from '../js/input.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { resetInputState } from '../js/input.js';
import {
    BOULDER, OBJECT_NAMES, SPE_NOVEL, SCR_BLANK_PAPER, SCR_MAGIC_MAPPING,
    SPE_FORCE_BOLT, WAN_MAGIC_MISSILE,
} from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const SCR_CONFUSE_MONSTER = OBJECT_NAMES.indexOf('confuse monster');
const SCR_CHARGING = OBJECT_NAMES.indexOf('charging');

function readingRoom(options: ObjectRoomOptions = {}) {
    freshObjectRoom({ gameplaySeed: 62n, ...options });
    requirePlayingGame(game);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => {
        const screen = screenText();
        if (!screen.includes('--More--')) {
            assert.match(screen, /What do you want to read\?/);
            return;
        }
        messages.push(game._pending_message);
        input.feed(' ');
    };
    return { input, messages };
}

function screenText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

async function read(object: GameObject, input: InputGate) {
    assert.ok(object.invlet);
    input.feed(object.invlet);
    await rhack('r'.charCodeAt(0));
}

void test('blindness rejects an unseen scroll before literacy or consumption', async () => {
    const { input } = readingRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    const scroll = await addInventoryObject(SCR_MAGIC_MAPPING, {
        observed: false, dknown: false, pickup_prev: true,
    });

    await read(scroll, input);

    assert.equal(game.context.move, 0);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.equal(scroll.where, 'inventory');
    assert.equal(scroll.pickup_prev, false);
    assert.ok(!scroll.in_use);
    assert.match(game._pending_message, /cannot read the formula on the scroll/);
});

for (const [type, wording] of [[SPE_FORCE_BOLT, 'mystic runes'], [SPE_NOVEL, 'words']] as const) {
    void test(`blindness prevents reading a book's ${wording} even after seeing it`, async () => {
        const { input } = readingRoom();
        requirePlayingGame(game);
        const book = await addInventoryObject(type);
        setHeroBlindnessTurns(10);

        await read(book, input);

        assert.equal(game.context.move, 0);
        assert.equal(game.u.uconduct.literate || 0, 0);
        assert.match(game._pending_message, new RegExp(`cannot read the ${wording}`));
    });
}

void test('a seen scroll can be recited while blind and unable to speak', async () => {
    const { input, messages } = readingRoom();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_MAGIC_MAPPING);
    setHeroBlindnessTurns(10);
    game.u.strangledTurns = 6;

    await read(scroll, input);

    assert.equal(game.context.move, 1);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.u.uconduct.literate, 1);
    assert.match([...messages, game._pending_message].join('\n'), /As you cogitate the formula/);
});

void test('reading one scroll in a stack consumes one and discovers its type only once', async () => {
    const { input } = readingRoom();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_MAGIC_MAPPING, { quan: 2 });

    await read(scroll, input);

    assert.equal(scroll.quan, 1);
    assert.equal(scroll.in_use, false);
    assert.equal(game.u.urexp, 10);
    assert.ok(game._knownObjectTypes != null);
    assert.ok(game._knownObjectTypes.has(scroll.otyp));
    await read(scroll, input);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.u.urexp, 10);
    assert.equal(game.u.uconduct.literate, 2);
    assert.deepEqual(gameLogEvents().map(event => event.text), ['became literate by reading a scroll']);
});

void test('blank paper remains carried and does not break illiteracy', async () => {
    const { input } = readingRoom();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_BLANK_PAPER);

    await read(scroll, input);

    assert.equal(game.context.move, 1);
    assert.equal(scroll.where, 'inventory');
    assert.equal(scroll.in_use, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.ok(game._knownObjectTypes != null);
    assert.ok(game._knownObjectTypes.has(scroll.otyp));
    assert.match(game._pending_message, /This scroll seems to be blank\./);
});

void test('an unidentified scroll remains in use until its actual naming prompt is answered', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_CONFUSE_MONSTER, { typeKnown: false });
    const input = resetInputState();
    assert.ok(scroll.invlet);
    input.feed(scroll.invlet);
    const action = rhack('r'.charCodeAt(0));
    await input.waitUntilBlocked();
    for (let pause = 0; !game._pending_message.startsWith('Call ') && pause < 4; pause++) {
        assert.ok(screenText().includes('--More--'), `Unexpected input: ${game._pending_message}`);
        input.feed(' ');
        await input.waitUntilBlocked();
    }
    assert.match(game._pending_message, /^Call /);
    assert.equal(scroll.where, 'inventory');
    assert.equal(scroll.in_use, true);
    assert.ok(game.u.umconf != null);
    assert.ok(game.u.umconf > 0);

    input.feed('red hands\n');
    await action;

    assert.equal(scroll.where, 'gone');
    assert.ok(game._objectCallNames != null);
    assert.equal(game._objectCallNames[scroll.otyp], 'red hands');
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(scroll.otyp), false);
    assert.equal(game.context.move, 1);
});

void test('charging acknowledges the consumed scroll before asking which object to charge', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_CHARGING, { typeKnown: false });
    const wand = await addInventoryObject(WAN_MAGIC_MISSILE, { spe: 0, recharged: 0 });
    const input = resetInputState();
    assert.ok(scroll.invlet);
    input.feed(scroll.invlet);
    const action = rhack('r'.charCodeAt(0));
    await input.waitUntilBlocked();

    assert.match(screenText().split('\n')[0] ?? '', /This is a charging scroll\..*--More--/);
    assert.equal(scroll.where, 'gone');
    assert.ok(game._knownObjectTypes != null);
    assert.ok(game._knownObjectTypes.has(scroll.otyp));
    assert.equal(wand.spe, 0);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^What do you want to charge\?/);

    assert.ok(wand.invlet);
    input.feed(wand.invlet);
    await action;

    assert.ok(wand.spe > 0);
    assert.equal(game.context.move, 1);
});

void test('canceling reading with an empty inventory spends no time and records no literacy', async () => {
    const { input } = readingRoom();
    requirePlayingGame(game);
    input.feed('\u001b');

    await rhack('r'.charCodeAt(0));

    assert.equal(game.context.move, 0);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(game._pending_message, /Never mind\./);
});

void test('overtaxed reading rejects the action before asking for an object', async () => {
    readingRoom();
    requirePlayingGame(game);
    await addInventoryObject(BOULDER, { quan: 2 });
    const scroll = await addInventoryObject(SCR_MAGIC_MAPPING);

    await rhack('r'.charCodeAt(0));

    assert.equal(game.context.move, 0);
    assert.equal(scroll.where, 'inventory');
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(game._pending_message, /carrying so much stuff/);
});
