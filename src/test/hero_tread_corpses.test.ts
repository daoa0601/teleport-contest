import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { buryObject } from '../js/buried_object.js';
import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, TT_BEARTRAP } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers } from '../js/object_timers.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { corpseObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const quiet of [false, true]) {
    void test(`${quiet ? 'stealthy' : 'ordinary'} footsteps ${quiet ? 'leave' : 'hurry'} a nearby buried zombie`, async () => {
        const input = freshTurnRoom({ role: 'caveman' });
        if (quiet) grantIntrinsicProperty('stealth', 'outside');
        const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('gnome')), 12, 10);
        await buryObject(corpse);
        stopAllObjectTimers(corpse);
        const deadline = game.moves + 90;
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, deadline);
        input.feed('l');

        await moveloop_core();

        assert.equal(game.u.ux, 11);
        const timer = objectTimers(corpse).find(item => item.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
        assert.ok(timer);
        if (quiet) assert.equal(timer.deadline, deadline);
        else assert.equal(timer.deadline, deadline - 30);
    });
}

void test('falling into an adjacent trap during untrapping leaves nearby buried zombies asleep', async () => {
    const level = freshObjectRoom({ role: 'caveman' });
    addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('gnome')), 12, 10);
    await buryObject(corpse);
    stopAllObjectTimers(corpse);
    const deadline = (game.moves ?? 0) + 90;
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, deadline);
    pushKeys('untrap\nl' + ' '.repeat(10));
    initRng(2n);

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.ux, 11, 'the failed disarm moves the hero into the trap');
    assert.equal(game.u.utraptype, TT_BEARTRAP);
    const timer = objectTimers(corpse).find(item => item.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
    assert.ok(timer);
    assert.equal(timer.deadline, deadline);
});
