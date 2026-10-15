import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { LARGE_BOX } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer } from '../js/object_timers.js';
import { runDueTimers } from '../js/timer_effects.js';
import { addInventoryObject, untimedCorpse } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a troll unable to revive in a dropped locked box makes the hero feel less hassled', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const box = await addInventoryObject(LARGE_BOX, { invlet: 'a', olocked: true });
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('troll'), { age: game.moves });
    await addCreatedObjectToContainer(box, corpse, game);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.REVIVE_MON, game.moves + 1);
    pushKeys('a');
    await rhack('d'.charCodeAt(0));
    game.moves++;
    game._pending_message = '';
    await runDueTimers();
    assert.equal(game._pending_message, 'You feel less hassled.');
    assert.equal(corpse.where, 'contained');
    assert.ok(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
});
//# sourceMappingURL=dropped_corpse_revival_failure.test.js.map