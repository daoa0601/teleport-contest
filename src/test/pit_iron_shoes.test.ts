import assert from 'node:assert/strict';
import test from 'node:test';

// C trap.c:trapeffect_pit() names the protecting footgear with
// Yname2(uarmf), so iron shoes and kicking boots are both named and the
// verb stays singular.

import { rhack } from '../js/cmd.js';
import { SPIKED_PIT, TT_PIT } from '../js/const.js';
import { wearHeroArmor } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { IRON_SHOES, KICKING_BOOTS } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [footwear, description] of [
    [IRON_SHOES, 'iron shoes'],
    [KICKING_BOOTS, 'kicking boots'],
] as const) {
    void test(`a spiked pit is blunted by ${description} named as worn`, async () => {
        const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        const shoes = await addInventoryObject(footwear);
        wearHeroArmor(shoes);
        addTrap(level, SPIKED_PIT, 11, 10, { tseen: false });
        pushKeys(' '.repeat(20));

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game._pending_message,
            `Your pair of ${description} protects you from the sharp iron spikes.`);
        assert.equal(game.u.utraptype, TT_PIT);
        assert.equal(game.uarmf, shoes);
    });
}
