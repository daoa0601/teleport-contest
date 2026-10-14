import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { A_CON, A_DEX, A_STR, DOOR, D_CLOSED, D_ISOPEN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { DAGGER, LOADSTONE, OIL_LAMP, POT_HEALING, SCR_BLANK_PAPER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { startLuaCore } from './support/lua-game.js';
void test('repeat without a saved command reports why it cannot run', async () => {
    const input = freshTurnRoom();
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
void test('cancelling chat clears recall without spending time', async () => {
    const input = freshTurnRoom();
    input.feed('#chat\n\x1b');
    await rhack(0);
    assert.equal(game.context.move, 0);
    input.feed('\x01h');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0), 'repeat must not reopen the chat direction prompt');
});
for (const command of ['a', '#apply\n']) {
    for (const cancel of ['\x1b', '\n']) {
        void test(`cancelling ${JSON.stringify(command)} with ${JSON.stringify(cancel)} clears apply recall`, async () => {
            const input = freshTurnRoom();
            const lamp = await addInventoryObject(OIL_LAMP);
            input.feed(command + cancel);
            await rhack(0);
            assert.equal(game.context.move, 0);
            input.feed('\x01\x1b');
            await rhack(0);
            assert.equal(game._pending_message, 'There is no command available to repeat.');
            assert.equal(game.context.move, 0);
            assert.equal(game.inventory.includes(lamp), true);
            assert.equal(await nhgetch(), 27, 'repeat must not reopen the apply prompt');
        });
    }
}
void test('trying to apply with no usable inventory clears recall', async () => {
    const input = freshTurnRoom();
    input.feed('a');
    await rhack(0);
    assert.equal(game._pending_message, "You don't have anything to use or apply.");
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
for (const command of ['r', '#read\n']) {
    void test(`cancelling ${JSON.stringify(command)} clears read recall`, async () => {
        const input = freshTurnRoom();
        const scroll = await addInventoryObject(SCR_BLANK_PAPER);
        input.feed(`${command}\x1b`);
        await rhack(0);
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.context.move, 0);
        assert.equal(game.inventory.includes(scroll), true);
        assert.equal(await nhgetch(), 27, 'repeat must not reopen the read prompt');
    });
}
void test('a selected object with nothing to read remains available to repeat', async () => {
    const input = freshTurnRoom();
    const dagger = await addInventoryObject(DAGGER);
    input.feed(`r${dagger.invlet}`);
    await rhack(0);
    input.feed('\x01h');
    await rhack(0);
    assert.equal(game._pending_message, 'That is a silly thing to read.');
    assert.equal(game.context.move, 0);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0), 'repeat reuses the accepted object choice');
});
void test('repeat retains the chosen command when its old key is rebound', async () => {
    const input = freshTurnRoom();
    input.feed('l');
    await rhack(0);
    game.commandBindings.bindKey('l'.charCodeAt(0), 'movewest');
    input.feed('\x01\x01h');
    await rhack(0);
    await rhack(0);
    assert.equal(game.u.ux, 13);
    assert.equal(game.context.move, 1);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
void test('repeat reuses a direction without asking for another key', async () => {
    const input = freshTurnRoom();
    const door = game.level?.requireAt(11, 10);
    assert.ok(door);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    assert.ok(game.u.acurr);
    game.u.acurr.a[A_STR] = 25;
    game.u.acurr.a[A_DEX] = 25;
    game.u.acurr.a[A_CON] = 25;
    input.feed('ol');
    await rhack(0);
    assert.equal(door.doormask, D_ISOPEN);
    door.doormask = D_CLOSED;
    input.feed('\x01h');
    await rhack(0);
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
void test('repeat drops the same partial quantity from the remaining carried stack', async () => {
    const input = freshTurnRoom();
    const daggers = await addInventoryObject(DAGGER, { quan: 10, quantity: 10 });
    input.feed(`d3${daggers.invlet}`);
    await rhack(0);
    assert.equal(daggers.quan, 7);
    input.feed('\x01h');
    await rhack(0);
    assert.equal(daggers.quan, 4);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
for (const command of ['d', '#drop\n']) {
    void test(`cancelling ${JSON.stringify(command)} clears drop recall`, async () => {
        const input = freshTurnRoom();
        const dagger = await addInventoryObject(DAGGER);
        input.feed(`${command}\x1b`);
        await rhack(0);
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.inventory.includes(dagger), true);
        assert.equal(game.context.move, 0);
        assert.equal(await nhgetch(), 27, 'repeat must not reopen the drop prompt');
    });
}
void test('trying to drop from an empty inventory clears recall', async () => {
    const input = freshTurnRoom();
    input.feed('d\x01');
    await rhack(0);
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
void test('a refused loadstone drop clears recall', async () => {
    const input = freshTurnRoom();
    const stone = await addInventoryObject(LOADSTONE, { cursed: true });
    input.feed(`d${stone.invlet}`);
    await rhack(0);
    assert.match(game._pending_message, /cannot drop/);
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.inventory.includes(stone), true);
    assert.equal(game.context.move, 0);
});
void test('repeat can execute an extended command without reopening its editor', async () => {
    const input = freshTurnRoom();
    input.feed('#autopickup\n');
    await rhack(0);
    assert.equal(game.flags.pickup, true);
    input.feed('\x01h');
    await rhack(0);
    assert.equal(game.flags.pickup, false);
    assert.equal(game.context.move, 0);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
void test('repeat replays movement prefixes and the selected direction together', async () => {
    const input = freshTurnRoom();
    input.feed('ml');
    await rhack(0);
    input.feed('\x01h');
    await rhack(0);
    assert.equal(game.u.ux, 12);
    assert.equal(game.context.nopick, true);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
void test('an unknown command discards the previous repeat command', async () => {
    const input = freshTurnRoom();
    input.feed('l~\x01');
    await rhack(0);
    await rhack(0);
    await rhack(0);
    assert.equal(game.u.ux, 11);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
});
for (const command of ['q', '#quaff\n']) {
    void test(`cancelling ${JSON.stringify(command)} forgets it instead of asking for another potion`, async () => {
        const input = freshTurnRoom();
        const potion = await addInventoryObject(POT_HEALING);
        input.feed(`${command}\x1b`);
        await rhack(0);
        assert.equal(game.context.move, 0);
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.inventory.includes(potion), true);
        assert.equal(await nhgetch(), 27, 'repeat must not ask for an inventory choice');
    });
}
void test('trying to drink without any potions clears command recall', async () => {
    const input = freshTurnRoom();
    input.feed('q');
    await rhack(0);
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
});
void test('strangulation refuses drinking without cancelling command recall', async () => {
    const input = freshTurnRoom({ hero: { strangledTurns: 6 } });
    input.feed('q\x01');
    await rhack(0);
    await rhack(0);
    assert.equal(game._pending_message, "If you can't breathe air, how can you drink liquid?");
    assert.equal(game.context.move, 0);
});
void test('repeat resolves an alias to the native command used by Lua admission', async (t) => {
    const input = freshTurnRoom();
    const core = await startLuaCore(t);
    core.execute(`
        blocked_calls = 0
        function reject_call(command)
            if command == "call" then
                blocked_calls = blocked_calls + 1
                return false
            end
            return true
        end
        nh.callback("cmd_before", "reject_call")
    `);
    input.feed('#name\n\x1b');
    await rhack(0);
    input.feed('\x01\x1b');
    await rhack(0);
    assert.equal(core.getGlobal('blocked_calls'), 1);
    assert.equal(await nhgetch(), 27, 'the vetoed repeat never enters the naming menu');
    assert.equal(game.context.move, 0);
});
for (const command of ['\x04', '#kick\n']) {
    for (const direction of ['\x1b', '.', '<', '>']) {
        void test(`kick ${JSON.stringify(command + direction)} clears recall when no adjacent direction is selected`, async () => {
            const input = freshTurnRoom();
            input.feed(command + direction);
            await rhack(0);
            assert.equal(game.context.move, 0);
            input.feed('\x01');
            await rhack(0);
            assert.equal(game._pending_message, 'There is no command available to repeat.');
            assert.equal(game.context.move, 0);
        });
    }
}
void test('cancelling the ride direction clears recall', async () => {
    const input = freshTurnRoom();
    input.feed('#ride\n\x1b');
    await rhack(0);
    assert.equal(game.context.move, 0);
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
void test('a ride direction outside the map clears recall', async () => {
    const input = freshTurnRoom({ heroX: 1 });
    input.feed('#ride\nh');
    await rhack(0);
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
for (const direction of ['.', '<', '>']) {
    void test(`ride toward ${direction} checks the current square and retains recall`, async () => {
        const input = freshTurnRoom();
        input.feed(`#ride\n${direction}`);
        await rhack(0);
        assert.equal(game._pending_message, 'I see nobody there.');
        assert.equal(game.context.move, 0);
        input.feed('\x01h');
        await rhack(0);
        assert.equal(game._pending_message, 'I see nobody there.');
        assert.equal(await nhgetch(), 'h'.charCodeAt(0), 'the repeat reuses the accepted direction');
    });
}
//# sourceMappingURL=command_repeat.test.js.map