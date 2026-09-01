import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, A_DEX, A_STR, D_CLOSED, D_ISOPEN, DOOR, STONE,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { freshPlayableRoom } from './support/playable-room.js';

async function openDoorOutcome(role) {
    const level = freshPlayableRoom({
        left: 42, right: 44, top: 18, bottom: 18,
        heroX: 42, heroY: 18, role,
    });
    level.at(42, 18).disp_ch = '.';
    Object.assign(level.at(43, 18), {
        typ: DOOR, doormask: D_CLOSED,
        lit: true, waslit: true, seenv: 255, disp_ch: '+',
    });
    level.at(44, 18).disp_ch = '.';
    for (const y of [17, 19]) {
        Object.assign(level.at(43, y), {
            typ: STONE, seenv: 1, disp_ch: '#',
            remembered_glyph: {
                kind: 'terrain', ch: '#', color: 7,
            },
        });
    }
    game.u.acurr.a[A_STR] = 25;
    game.u.acurr.a[A_DEX] = 25;
    game.u.acurr.a[A_CON] = 25;

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
