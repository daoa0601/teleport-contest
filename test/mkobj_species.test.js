import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, FIGURINE, STATUE } from '../js/object_data.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { freshObjectRoom } from './support/object-room.js';
void test('changing a half-eaten human corpse into a newt preserves the eaten fraction', async () => {
    freshObjectRoom();
    const corpse = await mksobj(CORPSE, false, false);
    set_corpsenm(corpse, MONSTER_NAME.indexOf('human'));
    corpse.oeaten = 200;
    set_corpsenm(corpse, MONSTER_NAME.indexOf('newt'));
    assert.equal(corpse.oeaten, 10);
    assert.equal(corpse.owt, 5);
});
void test('changing a statue from a human to a newt updates its weight', async () => {
    freshObjectRoom();
    const statue = await mksobj(STATUE, false, false);
    set_corpsenm(statue, MONSTER_NAME.indexOf('human'));
    assert.equal(statue.owt, 2175);
    set_corpsenm(statue, MONSTER_NAME.indexOf('newt'));
    assert.equal(statue.owt, 100);
});
void test('changing a carried figurine species restarts transformation even when uncursed', async () => {
    freshObjectRoom();
    const figurine = await mksobj(FIGURINE, false, false);
    figurine.where = 'inventory';
    game.inventory.push(figurine);
    set_corpsenm(figurine, MONSTER_NAME.indexOf('newt'));
    const timer = objectTimers(figurine).find(timer => timer.kind === OBJECT_TIMER_KIND.FIG_TRANSFORM);
    assert.ok(timer, 'the carried figurine will transform');
    assert.ok(timer.deadline >= game.moves + 201 && timer.deadline <= game.moves + 9200);
});
//# sourceMappingURL=mkobj_species.test.js.map