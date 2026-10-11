import test from 'node:test';
import assert from 'node:assert/strict';
import { askTeleportDestination } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { startLuaCore } from './support/lua-game.js';
import { freshPlayableRoom } from './support/playable-room.js';
async function freshLuaRoom(t) {
    freshPlayableRoom();
    const input = resetInputState();
    const state = await startLuaCore(t);
    return { input, state };
}
function visibleText() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function expectInput(input, operation) {
    assert.equal(await Promise.race([
        input.waitUntilBlocked().then(() => 'input'),
        operation.then(() => 'finished'),
    ]), 'input', 'Lua should wait for the player');
}
void test('a blocking Lua message stays visible until the player dismisses it', async (t) => {
    const { input, state } = await freshLuaRoom(t);
    const operation = state.executeAsync(`
        nh.pline("The gate opens.", true)
        finished = true
    `);
    try {
        await expectInput(input, operation);
        assert.match(visibleText(), /The gate opens\./);
        assert.match(visibleText(), /--More--/);
        assert.notEqual(state.getGlobal('finished'), true);
        input.feed(' ');
        await operation;
        assert.equal(state.getGlobal('finished'), true);
    }
    finally {
        input.feed(' ');
        await operation;
    }
});
void test('Lua text displays instructions and resumes after its menu closes', async (t) => {
    const { input, state } = await freshLuaRoom(t);
    const turn = game.moves;
    const operation = state.executeAsync(`
        nh.text("Read the inscription.\\nThen open the door.\\n")
        nh.pline("You finish reading.")
    `);
    try {
        await expectInput(input, operation);
        assert.match(visibleText(), /Read the inscription\./);
        assert.match(visibleText(), /Then open the door\./);
        input.feed(' ');
        await operation;
        assert.match(game._pending_message, /You finish reading\./);
        assert.equal(game.moves, turn);
    }
    finally {
        input.feed(' ');
        await operation;
    }
});
void test('long Lua text can be paged forward and backward before dismissal', async (t) => {
    const { input, state } = await freshLuaRoom(t);
    state.setGlobal('instructions', Array.from({ length: 30 }, (_, index) => `Instruction ${index + 1}.\n`).join(''));
    const operation = state.executeAsync('nh.text(instructions); finished = true');
    try {
        await expectInput(input, operation);
        assert.match(visibleText(), /Instruction 1\./);
        assert.doesNotMatch(visibleText(), /Instruction 30\./);
        input.feed('>');
        await expectInput(input, operation);
        assert.match(visibleText(), /Instruction 30\./);
        input.feed('<');
        await expectInput(input, operation);
        assert.match(visibleText(), /Instruction 1\./);
        input.feed('\x1b');
        await operation;
        assert.equal(state.getGlobal('finished'), true);
    }
    finally {
        input.feed('\x1b');
        await operation;
    }
});
for (const tips of [true, false]) {
    void test(tips ? 'closing Lua map help leaves destination selection open'
        : 'disabling tips opens destination selection without help', async (t) => {
        const { input } = await freshLuaRoom(t);
        game.flags.tips = tips;
        const operation = askTeleportDestination();
        try {
            await expectInput(input, operation);
            if (tips) {
                input.feed(' ');
                await expectInput(input, operation);
                assert.match(visibleText(), /Tip: Farlooking/);
                input.feed('\x1b');
                await expectInput(input, operation);
                assert.match(visibleText(), /Move cursor/);
            }
            else {
                assert.doesNotMatch(visibleText(), /Tip: Farlooking/);
                assert.match(visibleText(), /Where do you want to be teleported/);
            }
            input.feed('.');
            const result = await operation;
            assert.ok(result);
            assert.equal(result.x, game.u.ux);
            assert.equal(result.y, game.u.uy);
        }
        finally {
            input.feed(' \x1b\x1b');
            await operation;
        }
    });
}
void test('Lua impossible feedback precedes the next script message', async (t) => {
    const { input, state } = await freshLuaRoom(t);
    const pages = [];
    input.beforeRead = () => {
        pages.push(visibleText());
        input.feed(' ');
    };
    await state.executeAsync(`
        nh.impossible("The level needs repair.")
        nh.pline("The dungeon continues.")
    `);
    await flush_screen(1);
    pages.push(visibleText());
    const output = pages.join('\n');
    assert.match(output, /The level needs repair/);
    assert.match(output, /Program in disorder/);
    const report = output.indexOf('Please report these messages');
    const continuation = output.indexOf('The dungeon continues.');
    assert.ok(report >= 0 && continuation > report);
});
//# sourceMappingURL=lua_messages.test.js.map