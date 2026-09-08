import test from 'node:test';
import assert from 'node:assert/strict';

import { askTeleportDestination } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { bindLuaLifecycle, currentLuaLifecycle, LuaLifecycle } from '../js/lua/lifecycle.js';
import { freshPlayableRoom } from './support/playable-room.js';

function freshLuaRoom(t) {
    freshPlayableRoom();
    const input = resetInputState();
    const lifecycle = new LuaLifecycle();
    const previousLifecycle = currentLuaLifecycle();
    bindLuaLifecycle(lifecycle);
    const state = lifecycle.startCore(game);
    t.after(() => {
        bindLuaLifecycle(previousLifecycle);
        lifecycle.destroy();
    });
    return { input, state };
}

function visibleText() {
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

async function expectInput(input, operation) {
    assert.equal(await Promise.race([
        input.waitUntilBlocked().then(() => 'input'),
        operation.then(() => 'finished'),
    ]), 'input', 'Lua should wait for the player');
}

test('a blocking Lua message stays visible until the player dismisses it', async t => {
    const { input, state } = freshLuaRoom(t);
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
    } finally {
        input.feed(' ');
        await operation;
    }
});

test('Lua text displays instructions and resumes after its menu closes', async t => {
    const { input, state } = freshLuaRoom(t);
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
    } finally {
        input.feed(' ');
        await operation;
    }
});

test('long Lua text can be paged forward and backward before dismissal', async t => {
    const { input, state } = freshLuaRoom(t);
    state.setGlobal('instructions', Array.from({ length: 30 }, (_, index) =>
        `Instruction ${index + 1}.\n`).join(''));
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
    } finally {
        input.feed('\x1b');
        await operation;
    }
});

for (const tips of [true, false]) {
    test(tips ? 'closing Lua map help leaves destination selection open'
        : 'disabling tips opens destination selection without help', async t => {
        const { input } = freshLuaRoom(t);
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
            } else {
                assert.doesNotMatch(visibleText(), /Tip: Farlooking/);
                assert.match(visibleText(), /Where do you want to be teleported/);
            }
            input.feed('.');
            const result = await operation;
            assert.equal(result.editorOpened, true);
            assert.equal(result.destination.x, game.u.ux);
            assert.equal(result.destination.y, game.u.uy);
        } finally {
            input.feed(' \x1b\x1b');
            await operation;
        }
    });
}
