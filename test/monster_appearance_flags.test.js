import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_F_DKNOWN, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, NO_MINVENT, } from '../js/const.js';
import { createEarthquake } from '../js/earthquake.js';
import { breatheInDirection } from '../js/breath_ray.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { cancelMonster } from '../js/monster_cancellation.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AD_COLD, AT_BREA } from '../js/monster_attack_types.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { checkSpecialRoom } from '../js/shk.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
async function knownMonsterDisguise() {
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_MONSTER | M_AP_F_DKNOWN;
    mimic.mappearance = MONSTER_NAME.indexOf('goblin');
    mimic.msleeping = 0;
    return mimic;
}
void test('cancellation reveals a known monster disguise without putting its actor to sleep', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await knownMonsterDisguise();
    requirePlayingGame(game);
    const result = await cancelMonster(mimic, { attackLevel: 20 });
    assert.equal(result.cancelled, true);
    assert.equal(M_AP_TYPE(mimic), 0);
    assert.equal(mimic.mappearance, 0);
    assert.equal(mimic.msleeping, 0);
});
void test('cancellation still puts a revealed known object mimic to sleep', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = BOULDER;
    mimic.msleeping = 0;
    await cancelMonster(mimic, { attackLevel: 20 });
    assert.equal(M_AP_TYPE(mimic), 0);
    assert.equal(mimic.mappearance, 0);
    assert.equal(mimic.msleeping, 1);
});
void test('a breath ray reports missing a known monster disguise', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const mimic = await knownMonsterDisguise();
    requirePlayingGame(game);
    const messages = [];
    initRng(2n);
    await breatheInDirection('l', {
        attack: [AT_BREA, AD_COLD, 1, 6],
        random: range => range === 20 ? 0 : range - 1,
        rollOne: sides => sides === 10 ? 10 : 1,
        publish: (message) => messages.push(message),
    });
    assert.match(messages.join('\n'), /The blast of frost misses/);
});
void test('an earthquake preserves a known monster disguise', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const mimic = await knownMonsterDisguise();
    requirePlayingGame(game);
    pushKeys(' '.repeat(30));
    initRng(1n);
    await createEarthquake(1);
    assert.equal(mimic.msleeping, 0);
    assert.equal(M_AP_TYPE(mimic), M_AP_MONSTER);
    assert.equal(mimic.mappearance, MONSTER_NAME.indexOf('goblin'));
});
void test('a visible known monster disguise makes an untended shop certain', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 13 });
    await knownMonsterDisguise();
    requirePlayingGame(game);
    await removeMonsterFromGame(shopkeeper);
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = 10;
    pushKeys(' '.repeat(30));
    await checkSpecialRoom();
    assert.equal(game._lastPlineMessage, 'This shop is untended.');
});
//# sourceMappingURL=monster_appearance_flags.test.js.map