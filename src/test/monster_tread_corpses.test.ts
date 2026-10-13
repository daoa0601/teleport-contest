import test from 'node:test';
import assert from 'node:assert/strict';
import { buryObject } from '../js/buried_object.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers } from '../js/object_timers.js';
import { corpseObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a grounded monster walking near a buried corpse hurries its zombification', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('gnome')), 14, 10);
    await buryObject(corpse);
    stopAllObjectTimers(corpse);
    const deadline = game.moves + 90;
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, deadline);
    const monster = await createMonsterAt('goblin', 14, 10);
    monster.msleeping = 0;
    monster.mpeaceful = true;

    await takeMonsterTurn(monster, game, () => 0);

    assert.ok(monster.mx !== 14 || monster.my !== 10, 'the monster took a step');
    assert.equal(objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON)?.deadline,
        deadline - 30);
});
