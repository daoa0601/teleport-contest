import assert from 'node:assert/strict';
import test from 'node:test';
import { newsym } from '../js/display.js';
import { VIBRATING_SQUARE } from '../js/const.js';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createDungeon } from './support/topology.js';
for (const genuine of [false, true]) {
    void test(`vibrating-square search ${genuine ? 'finds the invocation square' : 'skips an artificial square'} beneath an object`, async () => {
        const level = freshObjectRoom();
        game.dungeons[0] = createDungeon({ dname: 'Gehennom', num_dunlevs: 9, flags: { hellish: true } });
        level.invocationPosition = { x: genuine ? 12 : 14, y: 10 };
        addTrap(level, VIBRATING_SQUARE, 12, 10, { tseen: true });
        await floorObject(APPLE, 12, 10);
        newsym(12, 10);
        const input = resetInputState();
        input.feed('~');
        const selected = await answerPrompts(selectMapPosition({
            start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        }), input, [{ prompt: genuine ? /apple/ : /Can't find dungeon feature '~'/, keys: '.' }]);
        assert.equal(selected?.x, genuine ? 12 : 10);
    });
}
//# sourceMappingURL=getpos_vibrating_square.test.js.map