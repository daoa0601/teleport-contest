import type { InputGate } from '../js/input.js';
import { requireScreenRow } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { SCORR, CORR, TIMEOUT } from '../js/const.js';
import { freshTurnRoom } from './support/playable-room.js';
import { initRng } from '../js/rng.js';
import { rhack } from '../js/cmd.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { addInventoryObject } from './support/game-objects.js';
import { DAGGER, PICK_AXE, SHORT_SWORD, SMALL_SHIELD } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { floatHeroDown } from '../js/terrain_movement.js';
import { putHeroToSleep } from '../js/hero_sleep.js';

async function untilNextInput<T>(gate: InputGate, snapshot: () => T): Promise<T> {
    let stopped = false;
    const drive = (async () => {
        for (let attempts = 0; !stopped; attempts++) {
            assert.ok(attempts < 30, 'the command must finish or request input');
            await moveloop_core();
        }
    })();
    try {
        for (;;) {
            await Promise.race([
                gate.waitUntilBlocked(),
                drive.then(() => {
                    throw new Error('turn loop ended without input');
                }),
            ]);
            const topline = requireScreenRow(0)
                .map((cell) => cell.ch)
                .join('');
            if (!topline.includes('--More--')) break;
            gate.feed(' ');
        }
        return snapshot();
    } finally {
        stopped = true;
        gate.feed(27);
        await drive;
    }
}

for (const [keys, distance] of [
    ['3l', 3],
    ['3L', 3],
    ['3.', 0],
] as const) {
    void test(`${keys} spends three separate scheduled hero actions`, async () => {
        const gate = freshTurnRoom();
        requirePlayingGame(game);
        const turn = game.moves;
        gate.feed(keys);
        const result = await untilNextInput(gate, () => ({
            x: game.u.ux,
            turns: game.moves - turn,
        }));
        assert.equal(result.x, 10 + distance);
        assert.equal(result.turns, 3);
    });
}

for (const name of ['sit', 'search']) {
    void test(`a counted #${name} asks for another extended command after one action`, async () => {
        const gate = freshTurnRoom();
        requirePlayingGame(game);
        const turn = game.moves;
        gate.feed(`3#${name}\n`);
        const result = await untilNextInput(gate, () => ({
            message: game._pending_message,
            turns: game.moves - turn,
        }));
        assert.equal(result.turns, 1);
        assert.equal(result.message, '#');
    });
}

void test('finding a secret passage ends a timed search at its wrapper boundary', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    requireGameLevel().requireAt(11, 10).typ = SCORR;
    gate.feed('20s');
    let searches = 0;
    while (requireGameLevel().requireAt(11, 10).typ === SCORR) {
        assert.ok(searches++ < 20, 'searching should discover the passage');
        await moveloop_core();
    }
    assert.equal(requireGameLevel().requireAt(11, 10).typ, CORR);
    const foundAt = game.moves;
    const turns = await untilNextInput(gate, () => game.moves - foundAt);
    assert.equal(
        turns,
        searches === 1 ? 2 : 1,
        'only a discovery in the initial direct action leaves an uncalled wrapper',
    );
});

void test('a discovery during the initial direct search leaves one final timed callback', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    requireGameLevel().requireAt(11, 10).typ = SCORR;
    initRng(7n);
    gate.feed('20s');
    await moveloop_core();
    assert.equal(requireGameLevel().requireAt(11, 10).typ, CORR);
    const foundAt = game.moves;
    const turns = await untilNextInput(gate, () => game.moves - foundAt);
    assert.equal(turns, 2);
});

void test('restore discards a timed command and accepts the next player action', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    const storage = memoryStorage();
    game.plname = 'Counter';
    game.storage = storage;
    gate.feed('9.');
    await rhack(0);
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Counter', storage), true);
    const turn = game.moves;
    gate.feed('l');
    const result = await untilNextInput(gate, () => ({
        x: game.u.ux,
        turns: game.moves - turn,
    }));
    assert.equal(result.x, 11);
    assert.equal(result.turns, 1);
});

void test('turning undead replaces a command count with its recovery delay', async () => {
    const gate = freshTurnRoom({ role: 'priest' });
    requirePlayingGame(game);
    const turn = game.moves;
    gate.feed('3#turn\n');
    const result = await untilNextInput(gate, () => ({
        message: game._pending_message,
        turns: game.moves - turn,
    }));
    assert.equal(result.turns, 5);
    assert.notEqual(result.message, '#', 'recovery must not repeat the extended-command editor');
});

for (const command of ['w', 'Q']) {
    void test(`a counted ${command} selects equipment once`, async () => {
        const gate = freshTurnRoom();
        requirePlayingGame(game);
        const weapon = await addInventoryObject(DAGGER);
        if (command === 'Q') {
            gate.feed(`w${weapon.invlet}`);
            await rhack(0);
        }
        const turn = game.moves;
        gate.feed(`3${command}${weapon.invlet}${command === 'Q' ? 'y' : ''}`);
        const result = await untilNextInput(gate, () => ({
            item: command === 'w' ? game.uwep : game.uquiver,
            turns: game.moves - turn,
            message: game._pending_message,
        }));
        assert.equal(result.item, weapon);
        assert.equal(result.turns, 1);
        assert.doesNotMatch(result.message, /What do you want to (?:wield|ready)/);
    });
}

void test('a counted swap changes weapons once', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    const first = await addInventoryObject(DAGGER);
    const second = await addInventoryObject(SHORT_SWORD);
    gate.feed(`w${first.invlet}`);
    await rhack(0);
    gate.feed(`w${second.invlet}`);
    await rhack(0);
    const turn = game.moves;
    gate.feed('4x');
    const result = await untilNextInput(gate, () => ({
        item: game.uwep,
        turns: game.moves - turn,
    }));
    assert.equal(result.item, first);
    assert.equal(result.turns, 1);
});

void test('wearing zero-delay armor consumes a command count', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    const shield = await addInventoryObject(SMALL_SHIELD);
    const turn = game.moves;
    gate.feed(`3W${shield.invlet}`);
    const result = await untilNextInput(gate, () => ({
        armor: game.uarms,
        turns: game.moves - turn,
        message: game._pending_message,
    }));
    assert.equal(result.armor, shield);
    assert.equal(result.turns, 1);
    assert.doesNotMatch(result.message, /What do you want to wear/);
});

for (const [keys, count] of [
    ['3', 3],
    ['4', 2],
] as const) {
    void test(`wizard creation uses ${keys === '3' ? 'the command count' : 'an explicit quantity instead of the command count'}`, async () => {
        const gate = freshTurnRoom();
        requirePlayingGame(game);
        game.flags.debug = true;
        const turn = game.moves;
        gate.feed(`${keys}\x07${keys === '4' ? '2 ' : ''}sleeping tame newt\n`);
        const result = await untilNextInput(gate, () => ({
            monsters: requireGameLevel().monsters.filter(
                (monster) => MONSTER_NAME[monster.mnum] === 'newt',
            ),
            turns: game.moves - turn,
        }));
        assert.equal(result.monsters.length, count);
        assert.ok(result.monsters.every((monster) => monster.msleeping && monster.mtame));
        assert.equal(result.turns, 0);
    });
}

void test('teleporting during prayer does not cancel its divine protection', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = 1;
    game.u.uhpmax = 20;
    game.u.ualign.record = 10;
    gate.feed('#pray\ny\x1b');
    await moveloop_core();
    assert.equal(game.u.invulnerable, true);

    await moveHeroByTeleport(14, 10);

    assert.equal(game.u.ux, 14);
    assert.equal(game.u.invulnerable, true);
    const turn = game.moves;
    const turns = await untilNextInput(gate, () => game.moves - turn);
    assert.equal(turns, 3);
    assert.equal(game.u.invulnerable, false);
    assert.equal(game.u.uhp, game.u.uhpmax);
});

void test('relocation cancels a counted application and its queued tool action', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    const pick = await addInventoryObject(PICK_AXE);
    gate.feed(`4a${pick.invlet}`);
    await moveloop_core();
    assert.equal(game.uwep, pick);

    await moveHeroByTeleport(14, 10);
    const turn = game.moves;
    gate.feed('h');
    const result = await untilNextInput(gate, () => ({
        x: game.u.ux,
        turns: game.moves - turn,
    }));
    assert.equal(result.x, 13, 'the next key moves instead of aiming the pick');
    assert.equal(result.turns, 2, 'settle wielding and the new move, without repeating apply');
});

void test('landing ends a counted run before the next player action', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    game.u.levitationTurns = 5;
    gate.feed('4L');
    await moveloop_core();
    assert.equal(game.u.ux, 11);

    await floatHeroDown(TIMEOUT, 0);
    gate.feed('h');
    const x = await untilNextInput(gate, () => game.u.ux);
    assert.equal(x, 10);
});

void test('landing does not wake a sleeping hero early', async () => {
    const gate = freshTurnRoom();
    requirePlayingGame(game);
    game.u.levitationTurns = 5;
    await putHeroToSleep(3);
    await floatHeroDown(TIMEOUT, 0);
    assert.ok(game.u.usleep);
    const turn = game.moves;
    const turns = await untilNextInput(gate, () => game.moves - turn);
    assert.equal(turns, 3);
    assert.equal(game.u.usleep, 0);
});
