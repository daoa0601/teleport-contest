import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_MONSTER, M_AP_NOTHING, NO_MINVENT } from '../js/const.js';
import { initializePet, makePetWary } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('pet revival ends both its meal and a borrowed mimic appearance', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    dog.meating = 4;
    dog.m_ap_type = M_AP_MONSTER;
    dog.mappearance = MONSTER_NAME.indexOf('kitten');
    await makePetWary(dog, { wasDead: true, random: limit => limit - 1 });
    assert.equal(dog.meating, 0);
    assert.equal(dog.m_ap_type, M_AP_NOTHING);
    assert.equal(dog.mappearance, 0);
});
void test('a pet becoming feral after life saving retains its grip on the hero', async () => {
    freshObjectRoom();
    const bear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
    initializePet(bear);
    assert.ok(bear.edog);
    bear.edog.abuse = 10;
    game.u.ustuck = bear;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await makePetWary(bear, { wasDead: false });
    assert.equal(bear.mtame, 0);
    assert.equal(bear.mpeaceful, 0);
    assert.ok(game.u.ustuck === bear, 'losing tameness does not itself release a held hero');
});
//# sourceMappingURL=pet_revival_history.test.js.map