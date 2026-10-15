import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('trying to mount a named worm tail identifies the worm', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const worm = await createMonsterAt('long worm', 13, 10);
    setMonsterGivenName(worm, 'Wriggly');
    worm.wormSegments = [{ x: 12, y: 10 }, { x: 11, y: 10 }];
    await runExtendedCommand('ride', 'l');
    assert.equal(game._last_message, "You couldn't ride Wriggly, let alone its tail.");
    assert.ok(!game.u.usteed);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=steed_tail_mount.test.js.map