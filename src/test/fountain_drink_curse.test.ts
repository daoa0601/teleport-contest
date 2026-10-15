import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldObject, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { ROCK, DAGGER, LEATHER_ARMOR, SACK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('bad fountain water removes nutrition and can curse blessed equipment while sparing gold', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = FOUNTAIN;
    const equipment = [];
    for (const type of [ROCK, DAGGER, LEATHER_ARMOR, SACK])
        equipment.push(await addInventoryObject(type, { blessed: true, buc: 'blessed' }));
    setHeroGoldAmount(game, 100);
    const hunger = game.u.uhunger;
    resetInputState().feed('y' + ' '.repeat(10));
    initRng(34n);

    await rhack('q'.charCodeAt(0));

    assert.ok(game.u.uhunger < hunger);
    assert.ok(equipment.some(object => object.cursed && !object.blessed));
    assert.equal(!!heroGoldObject(game)?.cursed, false);
    assert.match(game._pending_message, /This water's no good!/);
});
