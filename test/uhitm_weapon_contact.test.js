import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { resolveMonsterWeaponContact } from '../js/uhitm.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const DAGGER = OBJECT_NAMES.indexOf('dagger');
const SILVER_DAGGER = OBJECT_NAMES.indexOf('silver dagger');
// C uhitm.c:mhitm_ad_phys(), the hero defender's weapon branch: silver
// contact and black-pudding division pay their damage before the shared
// hitmu() tail.
async function armedAttacker(weaponType) {
    const attacker = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const weapon = await knownObject(weaponType);
    await equipMonsterObject(attacker, weapon, W_WEP);
    return { attacker, weapon };
}
void test('an iron weapon splits a pudding hero and gives up its rolled damage', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('black pudding', { hitPoints: 30, maxHitPoints: 30 });
    const { attacker, weapon } = await armedAttacker(DAGGER);
    const messages = [];
    const puddings = () => (game.level?.monsters ?? []).filter(monster => monster.mnum === MONSTER_NAME.indexOf('black pudding')).length;
    const damage = await resolveMonsterWeaponContact(attacker, weapon, 20, game, async (message) => { messages.push(message); }, sides => sides);
    assert.equal(damage, 0, 'the divided body takes no second hitmu() damage');
    assert.equal(game.u.mh, 5, 'the trial reduction is paid, then cloneu() halves the body');
    assert.equal(puddings(), 1, 'cloneHeroMonsterForm adds the divided twin monster');
    assert.match(messages.join('\n'), /You divide as the soldier hits you!/);
});
void test('a silver weapon sears a silver-hating hero but keeps its damage', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('vampire', { hitPoints: 30, maxHitPoints: 30 });
    const { attacker, weapon } = await armedAttacker(SILVER_DAGGER);
    const messages = [];
    const damage = await resolveMonsterWeaponContact(attacker, weapon, 7, game, async (message) => { messages.push(message); }, sides => sides);
    assert.equal(damage, 7, 'the searing leaves the ordinary damage for hitmu()');
    assert.equal(game.u.mh, 30, 'this branch never subtracts hit points itself');
    assert.equal(messages.includes('The silver sears your flesh!'), true);
});
void test('an ordinary weapon against an ordinary form only reports nothing', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('orc', { hitPoints: 30, maxHitPoints: 30 });
    const { attacker, weapon } = await armedAttacker(DAGGER);
    const messages = [];
    const damage = await resolveMonsterWeaponContact(attacker, weapon, 9, game, async (message) => { messages.push(message); }, sides => sides);
    assert.equal(damage, 9);
    assert.equal(game.u.mh, 30);
    assert.equal(messages.length, 0);
});
//# sourceMappingURL=uhitm_weapon_contact.test.js.map