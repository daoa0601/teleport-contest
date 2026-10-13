import test from 'node:test';
import assert from 'node:assert/strict';
import { roles } from '../js/roles.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_HEALING } from '../js/object_data.js';
import { quaff } from '../js/quaff.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [roleName, score] of [['wizard', 990], ['knight', 1990]]) {
    void test(`identifying healing ends beginner feedback for a ${roleName} at its score threshold`, async () => {
        assert.ok(typeof score === 'number');
        freshObjectRoom({ flags: { beginner: true }, hero: { urexp: score } });
        requirePlayingGame(game);
        const role = roles.find(candidate => candidate.key === roleName);
        assert.ok(role);
        game.urole = role;
        const potion = await addInventoryObject(POT_HEALING, { dknown: true, typeKnown: false });
        const input = resetInputState();
        input.feed(potion.invlet + ' '.repeat(30));
        const result = await quaff();
        assert.equal(result.spentTime, true);
        assert.equal(game.u.urexp, score + 10);
        assert.equal(game.flags.beginner, false);
        assert.equal(game.inventory.includes(potion), false);
    });
}
//# sourceMappingURL=potion_identification_experience.test.js.map