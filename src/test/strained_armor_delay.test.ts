import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES, ROCK } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('Strained boots removal finishes after two world turns while the hero still awaits movement', async () => {
    const input = freshTurnRoom({ flags: { runmode: 'walk' } });
    requirePlayingGame(game);
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('low boots'));
    wearHeroArmor(boots);
    await addInventoryObject(ROCK, { quan: 120 });
    assert.equal(nearCapacity(game), 3, 'the load must leave the hero Strained');
    game._encumbranceLevel = 3;
    const started = game.moves;
    let lastDressingFrame = 0;
    game.animationFrame = async () => { lastDressingFrame = game.moves - started; };
    installPagerInput(input, { expected: /load|taking off|take off/, limit: 8 });
    input.feed('T');

    await moveloop_core();
    input.feed('\x1b');
    for (let attempt = 0; attempt < 8 && boots.worn; attempt++)
        await moveloop_core();

    assert.equal(lastDressingFrame, 2, 'the visible dressing delay ends after two world turns');
    assert.equal(game.moves, started + 4, 'a Strained hero still waits four turns for the next command');
    assert.equal(game.uarmf, null);
});
