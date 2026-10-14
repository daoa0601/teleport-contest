import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { CHEST, DART } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const source of ['floor', 'container']) {
    for (const verbose of [false, true]) {
        void test(`${source} pickup ${verbose ? 'shows the total after' : 'omits the total and period after'} merging into a carried stack`, async () => {
            freshPlayableRoom({ flags: { verbose } });
            const carried = await addInventoryObject(DART, { invlet: 'a', quantity: 3 });
            if (source === 'floor') {
                await floorObject(DART, 10, 10, { quantity: 2 });
                await rhack(','.charCodeAt(0));
            } else {
                const chest = await floorObject(CHEST, 10, 10, {
                    initialize: false, olocked: false, otrapped: false, cknown: true,
                });
                chest.contents = [await knownObject(DART, {
                    quantity: 2, where: 'contained', container: chest,
                })];
                await runExtendedCommand('loot', 'oa\n    ');
            }

            assert.equal(carried.quan, 5);
            assert.match(game._lastPlineMessage, verbose
                ? / - 2 (?:[+-]\d+ )?darts \(5 in total\)\.$/ : / - 2 (?:[+-]\d+ )?darts$/);
        });
    }

    void test(`${source} pickup retains the period for a new stack with verbose disabled`, async () => {
        freshPlayableRoom({ flags: { verbose: false } });
        if (source === 'floor') {
            await floorObject(DART, 10, 10, { quantity: 2 });
            await rhack(','.charCodeAt(0));
        } else {
            const chest = await floorObject(CHEST, 10, 10, {
                initialize: false, olocked: false, otrapped: false, cknown: true,
            });
            chest.contents = [await knownObject(DART, {
                quantity: 2, where: 'contained', container: chest,
            })];
            await runExtendedCommand('loot', 'oa\n    ');
        }

        assert.match(game._lastPlineMessage, / - 2 (?:[+-]\d+ )?darts\.$/);
    });
}
