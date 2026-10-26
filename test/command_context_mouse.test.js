import assert from 'node:assert/strict';
import test from 'node:test';
import { D_CLOSED, D_ISOPEN, D_LOCKED, DOOR } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { newsym } from '../js/display.js';
import { choose, finish, screen, startMenuGame, type } from './support/context-menu-game.js';
import { createSaddledSteed } from './support/monsters.js';
void test('the default left mouse button opens the here menu at the hero', async () => {
    const engine = await startMenuGame();
    try {
        engine.inputGate.feedMapClick(10, 10, 1);
        await engine.runUntilInputNeeded();
        assert.match(screen(), /What do you want to do/);
        assert.match(screen(), /Rest one turn/);
    }
    finally {
        await finish(engine);
    }
});
void test('the default right mouse button describes its target without a turn', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        engine.inputGate.feedMapClick(11, 10, 2);
        await engine.runUntilInputNeeded();
        assert.match(screen(), /floor of a room/);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('mouse bindings can route the right button to the context menu', async () => {
    const engine = await startMenuGame('BINDINGS=mouse2:therecmdmenu');
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        engine.inputGate.feedMapClick(11, 10, 2);
        await engine.runUntilInputNeeded();
        assert.match(screen(), /Open the door/);
    }
    finally {
        await finish(engine);
    }
});
void test('unbinding a mouse button ignores its clicks', async () => {
    const engine = await startMenuGame('BINDINGS=mouse1:nothing');
    try {
        const moves = game.moves;
        engine.inputGate.feedMapClick(10, 10, 1);
        await engine.runUntilInputNeeded();
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('the legacy mouse action binding rests when clicking empty floor under the hero', async () => {
    const engine = await startMenuGame('BINDINGS=mouse1:mouseaction');
    try {
        const moves = game.moves;
        engine.inputGate.feedMapClick(10, 10, 1);
        await engine.runUntilInputNeeded();
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(game.moves, moves + 1);
    }
    finally {
        await finish(engine);
    }
});
for (const { state, kind } of [
    { state: D_CLOSED, kind: 'closed' },
    { state: D_LOCKED, kind: 'locked' },
]) {
    void test(`a legacy click on a ${kind} door asks for a direction before acting`, async () => {
        const engine = await startMenuGame('BINDINGS=mouse1:mouseaction');
        try {
            const door = requireGameLevel().requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = state;
            newsym(11, 10);
            const moves = game.moves;
            // C domouseaction() queues open/kick without cmdq_add_dir().
            engine.inputGate.feedMapClick(11, 10, 1);
            await engine.runUntilInputNeeded();
            assert.match(screen(), /In what direction\?/);
            assert.equal(door.doormask, state);
            assert.equal(game.moves, moves);
            await type(engine, '\x1b');
            assert.equal(door.doormask, state);
            assert.equal(game.moves, moves);
            await type(engine, 'i');
            assert.match(screen(), /Weapons|Armor/);
        }
        finally {
            await finish(engine);
        }
    });
}
void test('an actual distant context click travels, while a simulated left click offers a menu', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        // C dotherecmdmenu() passes CLICK_1 | CLICK_2 for an actual click.
        // No far/common entries accept that modifier, so it queues travel.
        engine.inputGate.feedMapClick(13, 10, 1);
        await engine.runUntilInputNeeded();
        assert.equal(game.u.ux, 13);
        assert.equal(game.u.uy, 10);
        assert.equal(game.moves, moves + 3);
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(screen().split('\n')[11]?.[12], '@');
        await type(engine, '#therecmdmenu\n_lll,');
        assert.match(screen(), /What do you want to do/);
        assert.match(screen(), /Throw something/);
        assert.match(screen(), /Travel here/);
        assert.match(screen(), /Look at map symbol/);
        assert.equal(game.u.ux, 13);
        assert.equal(game.moves, moves + 3);
    }
    finally {
        await finish(engine);
    }
});
void test('an actual context right click enters an open doorway, while a simulated right click offers closing', async () => {
    const engine = await startMenuGame('BINDINGS=mouse2:therecmdmenu');
    try {
        const level = requireGameLevel();
        const door = level.requireAt(11, 10);
        for (const x of [11, 12]) {
            const doorway = level.requireAt(x, 10);
            doorway.typ = DOOR;
            doorway.doormask = D_ISOPEN;
            newsym(x, 10);
        }
        const moves = game.moves;
        engine.inputGate.feedMapClick(11, 10, 2);
        await engine.runUntilInputNeeded();
        assert.equal(game.u.ux, 11);
        assert.equal(game.u.uy, 10);
        assert.equal(game.moves, moves + 1);
        assert.equal(door.doormask, D_ISOPEN);
        assert.doesNotMatch(screen(), /What do you want to do|Close the door/);
        await type(engine, '#therecmdmenu\n_l.');
        assert.match(screen(), /What do you want to do/);
        assert.match(screen(), /Close the door/);
        assert.match(screen(), /Look at map symbol/);
        assert.equal(game.u.ux, 11);
        assert.equal(game.moves, moves + 1);
        assert.equal(level.requireAt(12, 10).doormask, D_ISOPEN);
    }
    finally {
        await finish(engine);
    }
});
void test('repeating a mouse look retains its map target without spending a turn', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        engine.inputGate.feedMapClick(11, 10, 2);
        await engine.runUntilInputNeeded();
        await type(engine, '\x01');
        assert.match(screen(), /floor of a room/);
        assert.doesNotMatch(screen(), /unknown extended command/);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('a mounted self-click clears the map-look target before the queued look runs', async () => {
    const engine = await startMenuGame();
    try {
        game.u.usteed = await createSaddledSteed();
        newsym(10, 10);
        const moves = game.moves;
        engine.inputGate.feedMapClick(10, 10, 1);
        await engine.runUntilInputNeeded();
        await choose(engine, 'Look at map symbol');
        assert.equal(screen().split('\n')[0]?.trim(), '');
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('the keyboard here menu keeps the map-look target when mounted', async () => {
    const engine = await startMenuGame();
    try {
        game.u.usteed = await createSaddledSteed();
        newsym(10, 10);
        await type(engine, '#herecmdmenu\n');
        await choose(engine, 'Look at map symbol');
        assert.match(screen().split('\n')[0] ?? '', /pony/);
    }
    finally {
        await finish(engine);
    }
});
void test('remembered position clicks let repeat select the current hero square', async () => {
    const engine = await startMenuGame();
    try {
        game.iflags.remember_getpos = true;
        await type(engine, '_');
        engine.inputGate.feedMapClick(13, 10, 1);
        await engine.runUntilInputNeeded();
        assert.equal(game.u.ux, 13);
        await type(engine, '\x01');
        assert.match(screen(), /You are already here\./);
        assert.equal(game.u.ux, 13);
    }
    finally {
        await finish(engine);
    }
});
for (const button of [1, 2]) {
    void test(`mouse button ${button} selects a travel position without queuing a command, then regains its binding`, async () => {
        const engine = await startMenuGame(button === 2 ? 'BINDINGS=mouse2:therecmdmenu' : '');
        try {
            await type(engine, '_');
            engine.inputGate.feedMapClick(13, 10, button);
            await engine.runUntilInputNeeded();
            assert.equal(game.u.ux, 13);
            assert.equal(game.u.uy, 10);
            assert.doesNotMatch(screen(), /What do you want to do/);
            engine.inputGate.feedMapClick(13, 10, button);
            await engine.runUntilInputNeeded();
            assert.match(screen(), /What do you want to do/);
            assert.match(screen(), /Rest one turn/);
        }
        finally {
            await finish(engine);
        }
    });
}
void test('clicking a glance position does not run its mouse-button command afterward', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, ';');
        engine.inputGate.feedMapClick(13, 10, 1);
        await engine.runUntilInputNeeded();
        for (let page = 0; page < 2 && screen().includes('--More--'); page++)
            await type(engine, ' ');
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.equal(game.moves, moves);
        assert.doesNotMatch(screen(), /What do you want to do/);
        await type(engine, 'i');
        assert.match(screen(), /Weapons|Armor/);
    }
    finally {
        await finish(engine);
    }
});
for (const ending of ['\x1b', '.']) {
    void test(`mouse bindings return after ${ending === '.' ? 'accepting' : 'cancelling'} a position with the keyboard`, async () => {
        const engine = await startMenuGame('BINDINGS=mouse2:therecmdmenu');
        try {
            await type(engine, '_' + ending);
            engine.inputGate.feedMapClick(10, 10, 2);
            await engine.runUntilInputNeeded();
            assert.match(screen(), /What do you want to do/);
            assert.match(screen(), /Rest one turn/);
        }
        finally {
            await finish(engine);
        }
    });
}
//# sourceMappingURL=command_context_mouse.test.js.map