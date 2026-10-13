import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription } from '../js/cmd.js';
import { TER_MAP } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
for (const role of ['wizard', 'knight']) {
    void test(`farlook identifies the ${role} on the hero's square`, async () => {
        freshObjectRoom({ role });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy), `human ${role} called Aster`);
    });
}
void test('farlook respects terrain-only mode on the hero square', async () => {
    freshObjectRoom({ role: 'wizard' });
    game.iflags.terrainmode = TER_MAP;
    newsym(game.u.ux, game.u.uy);
    assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy), 'floor of a room');
});
//# sourceMappingURL=farlook_self.test.js.map