import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { glyphAt, map_background, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { SACK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const alreadySeen of [false, true]) {
    void test(`opening at ${alreadySeen ? 'a known' : 'a newly noticed'} floor object ${alreadySeen ? 'does not use' : 'uses'} a turn`, async () => {
        freshObjectRoom();
        await floorObject(SACK, 11, 10);
        if (alreadySeen)
            newsym(11, 10);
        else
            map_background(11, 10, true);
        pushKey('l');
        await rhack('o'.charCodeAt(0));
        assert.equal(glyphAt(11, 10)?.kind, 'object');
        assert.equal(game.context.move, alreadySeen ? 0 : 1);
        assert.match(game._pending_message, /You see no door there\./);
    });
}
//# sourceMappingURL=open_door_observation.test.js.map