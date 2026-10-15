import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { pline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
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

void test('failed revival acknowledges earlier prose before scheduling rot in a dropped box', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const box = await addInventoryObject(LARGE_BOX, { invlet: 'a', olocked: true });
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('troll'), { age: game.moves });
    await addCreatedObjectToContainer(box, corpse, game);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.REVIVE_MON, game.moves + 1);
    pushKeys('a');
    await rhack('d'.charCodeAt(0));
    game.moves++;
    await pline('You examine the locked box, but the troll corpse inside cannot get out.');
    const input = resetInputState();

    const running = runDueTimers();
    await input.waitUntilBlocked();
    try {
        const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(message, /You examine the locked box.*--More--/);
        assert.equal(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE), false,
            'rot is scheduled after the relief message can be printed');
    } finally {
        input.feed(' ');
        await running;
    }

    assert.equal(game._pending_message, 'You feel less hassled.');
    assert.ok(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
});
