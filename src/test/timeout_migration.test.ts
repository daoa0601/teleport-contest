import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameLevel } from '../js/gstate.js';
import { beginObjectBurn } from '../js/light.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG, OIL_LAMP } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer } from '../js/object_timers.js';
import { runDueTimers } from '../js/timer_effects.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const kind of ['lamp', 'egg'] as const) {
    void test(`a migrating monster's ${kind} timer runs without a map location`, async () => {
        freshObjectRoom();
        const carrier = await createMonsterAt('goblin', 12, 10);
        const object = await knownObject(kind === 'lamp' ? OIL_LAMP : EGG, {
            initialize: false, age: 1, corpsenm: MONSTER_NAME.indexOf('crocodile'),
        });
        await linkObjectToMonsterInventory(carrier, object);
        if (kind === 'lamp') beginObjectBurn(object);
        else scheduleObjectTimer(object, OBJECT_TIMER_KIND.HATCH_EGG, game.moves + 1);
        const level = requireGameLevel(game);
        level.monsters = level.monsters.filter(monster => monster !== carrier);
        carrier.mx = carrier.my = 0;
        game._migratingMonsters = [carrier];
        game.moves++;

        await runDueTimers();

        assert.equal(object.timed, 0);
        assert.ok(!object.lamplit);
        assert.equal(object.where, 'minvent');
        if (kind === 'egg') {
            assert.equal(object.quan, 1);
            assert.equal(level.monsters.length, 0);
        }
    });
}
