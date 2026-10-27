import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { FOOD_RATION, SACK } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// The recorder's contents page sorts under the partly eaten phrase: the
// whole ration stack is listed first even though add_to_container() prepends
// and the partly eaten piece heads the container chain (fresh6791).
void test('container contents list the whole ration stack before the partly eaten piece', async () => {
    freshObjectRoom();
    const sack = await floorObject(SACK, game.u.ux, game.u.uy, { cknown: true });
    const whole = await knownObject(FOOD_RATION, {
        where: 'free', quan: 2, quantity: 2,
    });
    const partly = await knownObject(FOOD_RATION, {
        where: 'free', oeaten: 400,
    });
    await addObjectToContainer(sack, whole);
    await addObjectToContainer(sack, partly);

    const input = resetInputState();
    let contents = '';
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('Contents of the sack:')) contents = screen;
            return ' '.charCodeAt(0);
        },
    };

    await runExtendedCommand('loot', ':');

    assert.ok(contents, 'the look-inside page was displayed');
    const wholeLine = contents.split('\n')
        .findIndex(line => /2 uncursed food rations/.test(line));
    const partlyLine = contents.split('\n')
        .findIndex(line => /an uncursed partly eaten food ration/.test(line));
    assert.ok(wholeLine >= 0, `whole ration stack listed: ${contents}`);
    assert.ok(partlyLine >= 0, `partly eaten ration listed: ${contents}`);
    assert.ok(wholeLine < partlyLine,
        `the whole ration stack is listed before the partly eaten piece:\n${contents}`);
});
