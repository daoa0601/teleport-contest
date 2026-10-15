import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { SCR_TELEPORTATION } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject } from './support/game-objects.js';

void test('wizard level teleport leaves the departure level active until deferred travel', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    pushKeys('2\n' + ' '.repeat(20));

    await rhack(22);

    assert.ok(game.level === source, 'the command schedules travel before changing the active level');
    assert.equal(game.u.uz.dlevel, 1);
    assert.equal(game.context.move, 0);

    await finishScheduledLevelChange();

    assert.ok(game.level === destination, 'deferred travel installs the destination level');
    assert.equal(game.u.uz.dlevel, 2);
});

void test('reading a cursed teleport scroll consumes it before deferred level travel', async () => {
    const { source, destination } = freshConnectedLevels();
    grantIntrinsicProperty('teleportControl', 'outside');
    const scroll = await addInventoryObject(SCR_TELEPORTATION, { cursed: true });
    const input = resetInputState();
    const keys = [scroll.invlet, '2', '\n'];
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('--More--')) input.feed(' ');
        else {
            const key = keys.shift();
            assert.ok(key, `Unexpected input request: ${screen.split('\n')[0]}`);
            input.feed(key);
        }
    };

    await rhack('r'.charCodeAt(0));

    assert.equal(scroll.where, 'gone');
    assert.ok(game.level === source, 'reading finishes on the departure level');
    assert.equal(game.context.move, 1);

    await finishScheduledLevelChange();

    assert.ok(game.level === destination, 'deferred travel installs the destination level');
});
