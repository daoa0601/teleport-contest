import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { A_WIS, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { canSpotMonster, map_invisible } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeBlinded } from '../js/potion.js';
import { initRng } from '../js/rng.js';
import { setMonsterPermanentInvisibility } from '../js/worn.js';
import { initializeMonsterWormBody } from '../js/worm.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { assertWormBody } from './support/worms.js';
for (const concealment of ['blindness', 'invisibility']) {
    void test(`searching beside a worm tail finds its unseen head despite ${concealment}`, async () => {
        const level = await freshObjectRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 3;
        if (concealment === 'blindness')
            await makeBlinded(100, { talk: false });
        const worm = await createMonsterAt('long worm', 12, 11, MM_NOTAIL | NO_MINVENT);
        await initializeMonsterWormBody(worm, { segmentCount: 2, random: () => 0 });
        assertWormBody(worm);
        if (concealment === 'invisibility')
            setMonsterPermanentInvisibility(worm);
        assert.equal(canSpotMonster(worm), false);
        const adjacentTail = worm.wormSegments.find(segment => Math.abs(segment.x - game.u.ux) <= 1 && Math.abs(segment.y - game.u.uy) <= 1);
        assert.ok(adjacentTail, 'The hero must be beside the tail, with the head two squares away');
        await map_invisible(adjacentTail.x, adjacentTail.y);
        initRng(1n);
        await rhack('s'.charCodeAt(0));
        assert.equal(game._pending_message, 'You feel an unseen monster!');
        assert.equal(level.requireAt(worm.mx, worm.my).remembered_glyph?.kind, 'invisible', 'Searching the tail must mark the head, even when the tail is already remembered');
        assert.equal(game.u._exercise?.[A_WIS], 1, 'Finding the unseen worm exercises Wisdom');
        assert.equal(game.context.move, 1, 'Searching consumes a turn');
    });
}
//# sourceMappingURL=search_unseen_worm.test.js.map