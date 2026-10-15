import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { ALTAR, AM_SANCTUM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const high of [false, true]) {
    void test(`an earthquake ${high ? 'preserves high altars' : 'provokes divine retaliation when an ordinary altar falls'}`, async () => {
        const input = freshTurnRoom({ hero: {
            levitating: true, shockResistance: true, disintegrationResistance: true,
        } });
        const altars = [];
        for (let x = 8; x <= 12; x++) {
            for (let y = 8; y <= 12; y++) {
                if (x === 10 && y === 10) continue;
                const location = game.level?.requireAt(x, y);
                assert.ok(location);
                location.typ = ALTAR;
                location.altarmask = 1 | (high ? AM_SANCTUM : 0);
                location.flags = location.altarmask;
                altars.push(location);
            }
        }
        const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 2 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        const expected = /playing|thunderous|shaking|chasm|altar|charged|noticed|voice|lightning|affect|deterred|disintegration|bask|believe/;
        installPagerInput(input, { expected, limit: 100 });
        pushKeys(`a${drum.invlet}`);

        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, expected);
        messages.push(game._pending_message);

        if (high) {
            assert.ok(altars.every(location => location.typ === ALTAR));
            assert.doesNotMatch(messages.join('\n'), /desecrate|noticed you/);
        } else {
            assert.ok(altars.some(location => location.typ !== ALTAR));
            assert.match(messages.join('\n'), /You dare desecrate my altar!/);
            assert.match(messages.join('\n'), /wide-angle disintegration beam hits you!/);
        }
    });
}
