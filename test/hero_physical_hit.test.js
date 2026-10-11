import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { gameLogEvents } from '../js/gamelog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitMonsterWithHeroObject } from '../js/hero_physical_hit.js';
import { resetInputState } from '../js/input.js';
import { ARROW, CREAM_PIE, DAGGER } from '../js/object_data.js';
import { freeInventoryObject } from '../js/hero_inventory.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
async function physicalFight(species = 'hill giant') {
    freshObjectRoom({ role: 'tourist', flags: { verbose: true }, hero: { uhitinc: 100 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mhp = monster.mhpmax = 300;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    return { monster, state: game, messages, publish };
}
void test('Grimtooth melee reaches poison resistance and lawful conduct through the shared hit owner', async () => {
    const { monster, state, messages, publish } = await physicalFight('green dragon');
    const weapon = await addInventoryItem(await artifactObject('Grimtooth'));
    await setPrimaryWeapon(weapon);
    state.u.ualign.type = 1;
    state.u.ualign.record = 5;
    initRng(12n);
    const result = await hitMonsterWithHeroObject(monster, weapon, { mode: 'melee', dieRoll: 5, publish });
    assert.equal(result.survived, true);
    assert.ok(monster.mhp < 300);
    assert.equal(state.u.ualign.record, 4);
    assert.match(messages.join('\n'), /evil coward/);
    assert.match(messages.join('\n'), /poison doesn't seem to affect the green dragon/);
    assert.equal(weapon.where, 'inventory');
});
void test('bashing with a poisoned arrow does not activate projectile poison', async () => {
    const { monster, state, messages, publish } = await physicalFight();
    const arrow = await addInventoryObject(ARROW, { opoisoned: true });
    await setPrimaryWeapon(arrow);
    state.u.ualign.type = 1;
    state.u.ualign.record = 5;
    initRng(12n);
    await hitMonsterWithHeroObject(monster, arrow, { mode: 'melee', dieRoll: 5, publish });
    assert.ok(monster.mhp >= 298 && monster.mhp <= 299);
    assert.equal(state.u.ualign.record, 5);
    assert.equal(arrow.opoisoned, true);
    assert.doesNotMatch(messages.join('\n'), /poison|coward/);
});
void test('an actual first weapon hit logs its weapon type without the player-given name', async () => {
    const { monster, state } = await physicalFight();
    const weapon = await addInventoryObject(DAGGER, { oname: 'Private nickname' });
    await setPrimaryWeapon(weapon);
    installPagerInput(resetInputState(), { expected: /hill giant|dagger/, limit: 4 });
    initRng(12n);
    await rhack('l'.charCodeAt(0));
    assert.ok(monster.mhp < 300);
    assert.equal(state.u.uconduct.weaphit, 1);
    const event = gameLogEvents(state).find(entry => entry.text.includes('wielded weapon'));
    assert.ok(event);
    assert.match(event.text, /\(dagger\)/);
    assert.doesNotMatch(event.text, /Private nickname/);
});
void test('a consumed unpaid projectile remains a bill entry and cannot land as a live object', async () => {
    const { monster, state, publish } = await physicalFight();
    const pie = await addInventoryObject(CREAM_PIE, { unpaid: true });
    const { shopkeeper } = await createStaffedShop({
        keeperX: 14, keeperY: 12,
        bill: [{ bo_id: pie.o_id, bquan: 1, useup: false, price: 10 }],
    });
    await freeInventoryObject(pie, state);
    const result = await hitMonsterWithHeroObject(monster, pie, { mode: 'thrown', dieRoll: 1, publish });
    assert.equal(result.objectConsumed, true);
    assert.equal(pie.where, 'onbill');
    assert.equal(shopkeeper.eshk.bill.find(entry => entry.bo_id === pie.o_id)?.useup, true);
    assert.equal(monster.mhp, 300);
    assert.equal(state.inventory.includes(pie), false);
    assert.equal(state.level.objects[11]?.[10]?.includes(pie) ?? false, false);
});
//# sourceMappingURL=hero_physical_hit.test.js.map