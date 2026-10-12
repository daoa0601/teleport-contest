import { requireFixtureGame } from './support/game-state.js';
import type { RoleKey } from '../js/roles.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, A_DEX, A_STR, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DOOR, STONE,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { pushKeys } from '../js/input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';

for (const command of ['o', 'l'] as const) {
    for (const halfDamage of [false, true]) {
        void test(`${command === 'o' ? 'explicit' : 'automatic'} opening explodes a trapped door${halfDamage ? ' with half physical damage' : ''}`, async () => {
            const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
            requireFixtureGame(game);
            const door = level.requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_CLOSED | D_TRAPPED;
            const sleeper = await createMonsterAt('newt', 14, 10);
            sleeper.msleeping = 1;
            game.u.halfPhysicalDamage = halfDamage;
            for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 25;
            initRng(902n);
            pushKeys((command === 'o' ? 'l' : '') + ' '.repeat(10));

            await rhack(command.charCodeAt(0));

            assert.equal(door.doormask, D_NODOOR);
            const blastDamage = game.u.stunnedTurns;
            assert.ok(blastDamage && blastDamage >= 1 && blastDamage <= 11);
            assert.equal(game.u.uhp, 100 - (halfDamage ? Math.ceil(blastDamage / 2) : blastDamage));
            assert.equal(sleeper.msleeping, 0);
            assert.equal(game.u.ux, 10, 'opening spends the turn without entering the doorway');
        });
    }
}

async function openDoorOutcome(role: RoleKey) {
    const level = freshPlayableRoom({
        left: 42, right: 44, top: 18, bottom: 18,
        heroX: 42, heroY: 18, role,
    });
    requireFixtureGame(game);
    level.requireAt(42, 18).disp_ch = '.';
    const door = level.requireAt(43, 18);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    door.lit = true;
    door.waslit = true;
    door.seenv = 255;
    door.disp_ch = '+';
    level.requireAt(44, 18).disp_ch = '.';
    for (const y of [17, 19] as const) {
        const wall = level.requireAt(43, y);
        wall.typ = STONE;
        wall.seenv = 1;
        wall.disp_ch = '#';
        wall.remembered_glyph = {
            kind: 'terrain', ch: '#', color: 7, terrainName: 'corridor',
        };
    }
    game.u.acurr.a[A_STR] = 25;
    game.u.acurr.a[A_DEX] = 25;
    game.u.acurr.a[A_CON] = 25;

    initRng(902n);
    await rhack('l'.charCodeAt(0));
    return {
        doorMask: level.requireAt(43, 18).doormask,
        message: game._pending_message,
        adjacentMemory: [17, 19].map(y => ({
            disp: level.requireAt(43, y).disp_ch,
            remembered: level.requireAt(43, y).remembered_glyph,
            seenv: level.requireAt(43, y).seenv,
        })),
    };
}

void test('opening a door never clears adjacent memory by role and coordinate',
    async () => {
        const ordinary = await openDoorOutcome('tourist');
        const samurai = await openDoorOutcome('samurai');

        assert.deepEqual(samurai, ordinary);
        assert.equal(samurai.doorMask, D_ISOPEN);
        assert.equal(samurai.message, 'The door opens.');
        assert.ok(samurai.adjacentMemory.every(cell => cell.remembered));
    });

for (const command of ['o', 'l'] as const) {
    void test(`${command === 'o' ? 'explicit' : 'automatic'} resisted opening exercises Strength`, async () => {
        const level = freshPlayableRoom({ seed: 1n });
        requireFixtureGame(game);
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        game.u.acurr.a[A_STR] = 3;
        game.u.acurr.a[A_DEX] = 10;
        game.u.acurr.a[A_CON] = 3;
        if (command === 'o') pushKeys('l');

        await rhack(command.charCodeAt(0));

        assert.equal(game._pending_message, 'The door resists!');
        assert.equal(door.doormask, D_CLOSED);
        assert.equal(game.u._exercise?.[A_STR], 1);
    });
}

for (const locked of [false, true] as const) {
    void test(`explicit opening does not exercise Strength when the door ${locked ? 'is locked' : 'opens'}`, async () => {
        const level = freshPlayableRoom({ seed: 1n });
        requireFixtureGame(game);
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = locked ? D_LOCKED : D_CLOSED;
        for (const attribute of [A_STR, A_DEX, A_CON] as const) game.u.acurr.a[attribute] = 25;
        pushKeys('l');

        await rhack('o'.charCodeAt(0));

        assert.equal(game.u._exercise?.[A_STR] ?? 0, 0);
        assert.equal(door.doormask, locked ? D_LOCKED : D_ISOPEN);
    });
}
