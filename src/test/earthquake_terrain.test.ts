import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { DOOR, D_NODOOR, PIT, SDOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const secret of [false, true]) {
    void test(`an applied earthquake drum ${secret ? 'reveals and collapses secret doors without digging pits' : 'digs pits in doorways while preserving the doorway terrain'}`, async () => {
        const input = freshTurnRoom({ hero: { levitating: true } });
        const doors = [];
        for (let x = 8; x <= 12; x++) {
            for (let y = 8; y <= 12; y++) {
                if (x === 10 && y === 10) continue;
                const location = game.level?.requireAt(x, y);
                assert.ok(location);
                location.typ = secret ? SDOOR : DOOR;
                location.doormask = D_NODOOR;
                doors.push({ x, y, location });
            }
        }
        const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 2 });
        installPagerInput(input, { expected: /playing|thunderous|shaking|chasm|secret door|collapses/, limit: 30 });
        pushKeys(`a${drum.invlet}`);

        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /playing|thunderous|shaking|chasm|secret door|collapses|^$/);

        const affected = doors.filter(({ x, y, location }) => secret
            ? location.typ !== SDOOR
            : game.level?.traps.some(trap => trap.tx === x && trap.ty === y && trap.ttyp === PIT));
        assert.ok(affected.length > 0, 'The earthquake must affect at least one surrounding doorway');
        for (const { x, y, location } of affected) {
            assert.equal(location.typ, DOOR, `Doorway at ${x},${y}`);
            assert.equal(location.doormask, D_NODOOR);
            if (secret) assert.equal(game.level?.traps.some(trap => trap.tx === x && trap.ty === y), false);
        }
    });
}
