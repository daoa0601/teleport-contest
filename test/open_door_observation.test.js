import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { glyphAt, map_background, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { BAG_OF_TRICKS, ROCK, SACK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { objectType, name, message } of [
    { objectType: SACK, name: 'sack', message: 'Seems like something lootable over there.' },
    { objectType: BAG_OF_TRICKS, name: 'bag of tricks', message: 'Seems like something lootable over there.' },
    { objectType: ROCK, name: 'rock', message: 'You see no door there.' },
]) {
    for (const alreadySeen of [false, true]) {
        void test(`opening at ${alreadySeen ? 'a known' : 'a newly noticed'} ${name} ${alreadySeen ? 'does not use' : 'uses'} a turn`, async () => {
            freshObjectRoom();
            await floorObject(objectType, 11, 10);
            if (alreadySeen)
                newsym(11, 10);
            else
                map_background(11, 10, true);
            pushKey('l');
            await rhack('o'.charCodeAt(0));
            assert.equal(glyphAt(11, 10)?.kind, 'object');
            assert.equal(game.context.move, alreadySeen ? 0 : 1);
            assert.equal(game._pending_message, message);
        });
    }
}
for (const { objectType, message } of [
    { objectType: SACK, message: 'Feels like something lootable over there.' },
    { objectType: ROCK, message: 'You feel no door there.' },
]) {
    void test(`opening toward an object while blind reports: ${message}`, async () => {
        freshObjectRoom({ hero: { blindTurns: 10 } });
        await floorObject(objectType, 11, 10);
        pushKey('l');
        await rhack('o'.charCodeAt(0));
        assert.equal(game._pending_message, message);
    });
}
//# sourceMappingURL=open_door_observation.test.js.map