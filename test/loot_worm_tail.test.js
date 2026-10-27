import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
// C pickup.c:doloot_core() asks "Loot in what direction?" when
// mon_beside(u.ux, u.uy) is true.  mon_beside() scans MON_AT() over the
// 3x3 squares around the hero, and MON_AT() counts a long worm's tail
// segments, so a worm whose head is farther away still triggers the
// direction question.
void test('a long worm tail beside the hero asks the loot direction', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('long worm', 13, 10);
    worm.wormSegments = [{ x: 12, y: 10 }, { x: 11, y: 10 }];
    worm.msleeping = 0;
    const input = resetInputState();
    input.feed('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Loot in what direction\?/, keys: '.' },
    ]);
    assert.equal(game._pending_message, "You don't find anything here to loot.");
    assert.equal(game.context.move, 0);
});
void test('a long worm two squares away does not ask the loot direction', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('long worm', 13, 10);
    worm.wormSegments = [{ x: 13, y: 11 }];
    worm.msleeping = 0;
    const input = resetInputState();
    input.feed('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
    assert.equal(game._pending_message, "You don't find anything here to loot.");
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=loot_worm_tail.test.js.map