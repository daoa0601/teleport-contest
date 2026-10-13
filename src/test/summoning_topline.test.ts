import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { msummon } from '../js/minion.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a summoned demon shares the unread hero attack message', async () => {
    freshObjectRoom();
    const summoner = await createMonsterAt('incubus', 12, 10, NO_MINVENT);
    await plineWithContinuation('You hit the incubus!');

    const result = await msummon(summoner);

    assert.ok(result.created.length > 0, 'a demon must answer the summons');
    assert.match(game._pending_message, /^You hit the incubus!  .+ appears in a cloud of smoke!$/);
});
