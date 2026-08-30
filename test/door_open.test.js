import test from 'node:test';
import assert from 'node:assert/strict';

import { D_CLOSED, D_ISOPEN, DOOR, ROOM, STONE } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { installLiveCommandHero } from './support/live-command-state.js';

async function openDoorOutcome(role) {
    resetGame();
    const level = new GameMap();
    Object.assign(level.at(42, 18), {
        typ: ROOM, lit: true, waslit: true, seenv: 255, disp_ch: '.',
    });
    Object.assign(level.at(43, 18), {
        typ: DOOR, doormask: D_CLOSED,
        lit: true, waslit: true, seenv: 255, disp_ch: '+',
    });
    Object.assign(level.at(44, 18), {
        typ: ROOM, lit: true, waslit: true, seenv: 255, disp_ch: '.',
    });
    for (const y of [17, 19]) {
        Object.assign(level.at(43, y), {
            typ: STONE, seenv: 1, disp_ch: '#',
            remembered_glyph: {
                kind: 'terrain', ch: '#', color: 7,
            },
        });
    }
    installLiveCommandHero({ role, level, x: 42, y: 18 });
    game.u.acurr.a[0] = game.u.acurr.a[1] = game.u.acurr.a[2] = 25;

    initRng(902n);
    await rhack('l'.charCodeAt(0));
    return {
        doorMask: level.at(43, 18).doormask,
        message: game._pending_message,
        adjacentMemory: [17, 19].map(y => ({
            disp: level.at(43, y).disp_ch,
            remembered: level.at(43, y).remembered_glyph,
            seenv: level.at(43, y).seenv,
        })),
    };
}

test('opening a door never clears adjacent memory by role and coordinate',
    async () => {
        const ordinary = await openDoorOutcome('tourist');
        const samurai = await openDoorOutcome('samurai');

        assert.deepEqual(samurai, ordinary);
        assert.equal(samurai.doorMask, D_ISOPEN);
        assert.equal(samurai.message, 'The door opens.');
        assert.ok(samurai.adjacentMemory.every(cell => cell.remembered));
    });
