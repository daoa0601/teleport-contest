import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { assertWormBody } from './support/worms.js';
for (const consecutive of [true, false]) {
    void test(`a diagonal hero step ${consecutive ? 'cannot cross consecutive' : 'can pass nonconsecutive'} worm segments`, async () => {
        freshObjectRoom();
        const worm = await createMonsterAt('long worm', 12, 9, NO_MINVENT | MM_NOTAIL);
        initializeMonsterWormBody(worm, { segmentCount: 0 });
        assertWormBody(worm);
        worm.wormSegments = consecutive
            ? [{ x: 10, y: 9 }, { x: 11, y: 10 }]
            : [{ x: 10, y: 9 }, { x: 10, y: 8 }, { x: 11, y: 10 }];
        await rhack('u'.charCodeAt(0));
        assert.equal(game.u.ux, consecutive ? 10 : 11);
        assert.equal(game.u.uy, consecutive ? 10 : 9);
        assert.equal(game.context.move, consecutive ? 0 : 1);
        if (consecutive)
            assert.equal(game._pending_message, 'The long worm is in your way.');
    });
}
//# sourceMappingURL=hero_worm_crossing.test.js.map