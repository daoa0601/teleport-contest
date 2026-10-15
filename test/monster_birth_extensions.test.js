import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_EDOG, MM_EGD, MM_EMIN, MM_EPRI, MM_ESHK, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { game } from '../js/gstate.js';
import { setMonsterMalign } from '../js/monster_alignment.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
void test('MM_EMIN gives the caller an unassigned minion record', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const angel = await makemonAt(MONSTER_NAME.indexOf('Angel'), 12, 10, MM_NOMSG | NO_MINVENT | MM_EMIN);
    assert.ok(angel?.emin, 'the minion record must exist before the caller assigns its alignment');
    assert.equal(!!angel.isminion, false);
    angel.isminion = 1;
    angel.emin.min_align = 0;
    angel.mpeaceful = 0;
    setMonsterMalign(angel);
    assert.equal(angel.malign, 3);
});
void test('MM_EPRI gives the caller an unassigned shrine record', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const priest = await makemonAt(MONSTER_NAME.indexOf('aligned cleric'), 12, 10, MM_NOMSG | NO_MINVENT | MM_EPRI);
    assert.ok(priest?.epri, 'the shrine record must exist before temple initialization');
    assert.equal(!!priest.ispriest, false);
    assert.equal(!!priest.isminion, false);
    priest.ispriest = 1;
    priest.epri.shralign = 0;
    priest.mpeaceful = 0;
    setMonsterMalign(priest);
    assert.equal(priest.malign, 15, 'a hostile always-peaceful cleric is a renegade');
});
void test('MM_EDOG allocates pet state without taming the newborn', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const dog = await makemonAt(MONSTER_NAME.indexOf('little dog'), 12, 10, MM_NOMSG | NO_MINVENT | MM_EDOG);
    assert.ok(dog?.edog, 'pet initialization must have a record to fill');
    assert.equal(!!dog.mtame, false);
    assert.equal(dog.edog.hungrytime, 0, 'initedog(), rather than allocation, starts the hunger clock');
});
void test('MM_ESHK allocates a shop record without appointing a shopkeeper', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const human = await makemonAt(MONSTER_NAME.indexOf('human'), 12, 10, MM_NOMSG | NO_MINVENT | MM_ESHK);
    assert.ok(human?.eshk, 'shop setup must have a record to fill');
    assert.equal(!!human.isshk, false);
});
void test('MM_EGD allocates guard state before a vault is assigned', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const guard = await makemonAt(MONSTER_NAME.indexOf('guard'), 12, 10, MM_NOMSG | NO_MINVENT | MM_EGD);
    assert.ok(guard?._egd, 'guard setup must have a record to fill');
    assert.equal(!!guard.isgd, false);
});
void test('unassigned birth records survive saving before role initialization', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n });
    game.plname = 'Unassigned';
    const flags = MM_EDOG | MM_EGD | MM_EMIN | MM_EPRI | MM_ESHK;
    const monster = await makemonAt(MONSTER_NAME.indexOf('human'), 12, 10, MM_NOMSG | NO_MINVENT | flags);
    assert.ok(monster);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Unassigned', storage), true);
    const restored = game.level?.monsters.find(actor => actor.m_id === monster.m_id);
    assert.ok(restored && restored.edog && restored.emin && restored.epri && restored.eshk && restored._egd);
    assert.notEqual(game.level, level);
    assert.equal(restored._egd.vault, null);
    assert.equal(restored.edog.hungrytime, 0);
    assert.equal(!!restored.ispriest || !!restored.isminion || !!restored.isshk || !!restored.isgd, false);
});
//# sourceMappingURL=monster_birth_extensions.test.js.map