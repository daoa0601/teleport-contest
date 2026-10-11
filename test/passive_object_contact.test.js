import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { applyMonsterPassiveToObject } from '../js/monster_passive.js';
import { ARROW, CLUB } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { form, objectType, field } of [
    { form: 'rust monster', objectType: ARROW, field: 'oeroded' },
    { form: 'black pudding', objectType: ARROW, field: 'oeroded2' },
    { form: 'red mold', objectType: CLUB, field: 'oeroded' },
]) {
    void test(`a missile touching the hero's ${form} body suffers its passive erosion`, async () => {
        const level = freshObjectRoom();
        installPolymorphedHero(form);
        const projectile = await floorObject(objectType, game.u.ux, game.u.uy);
        await applyMonsterPassiveToObject(game.u, projectile, {
            publish: () => { }, random: () => 0,
        });
        assert.equal(projectile[field], 1);
        assert.equal(projectile.where, 'floor');
        assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy)[0], projectile);
    });
}
void test('grease protects a projectile from a rust-monster hero and can wear off', async () => {
    freshObjectRoom();
    installPolymorphedHero('rust monster');
    const arrow = await floorObject(ARROW, game.u.ux, game.u.uy, { greased: true });
    await applyMonsterPassiveToObject(game.u, arrow, {
        publish: () => { }, random: () => 0,
    });
    assert.equal(arrow.oeroded ?? 0, 0);
    assert.equal(arrow.greased, false);
});
for (const form of ['rust monster', 'red mold', 'disenchanter']) {
    void test(`a cancelled ${form} hero leaves an impacting object intact`, async () => {
        freshObjectRoom();
        installPolymorphedHero(form);
        game.u.mcan = true;
        const projectile = await floorObject(form === 'red mold' ? CLUB : ARROW, game.u.ux, game.u.uy, { spe: 3 });
        await applyMonsterPassiveToObject(game.u, projectile, {
            publish: () => { }, random: limit => limit === 6 ? 0 : limit - 1,
        });
        assert.equal(projectile.oeroded ?? 0, 0);
        assert.equal(projectile.oeroded2 ?? 0, 0);
        assert.equal(projectile.spe, 3);
    });
}
void test('a cancelled acid-blob hero can still corrode an impacting arrow', async () => {
    freshObjectRoom();
    installPolymorphedHero('acid blob');
    game.u.mcan = true;
    const arrow = await floorObject(ARROW, game.u.ux, game.u.uy);
    await applyMonsterPassiveToObject(game.u, arrow, {
        publish: () => { }, random: () => 0,
    });
    assert.equal(arrow.oeroded2, 1);
});
void test('a steam-vortex hero does not burn a wooden projectile', async () => {
    freshObjectRoom();
    installPolymorphedHero('steam vortex');
    const club = await floorObject(CLUB, game.u.ux, game.u.uy);
    await applyMonsterPassiveToObject(game.u, club, {
        publish: () => { }, random: () => 0,
    });
    assert.equal(club.oeroded ?? 0, 0);
});
void test('a disenchanter hero drains an impacting arrow without taking ownership or announcing hero equipment', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('disenchanter');
    const arrow = await floorObject(ARROW, game.u.ux, game.u.uy, { spe: 3 });
    const messages = [];
    await applyMonsterPassiveToObject(game.u, arrow, {
        publish: message => { messages.push(message); }, random: limit => limit - 1,
    });
    assert.equal(arrow.spe, 2);
    assert.equal(arrow.enchantment, 2);
    assert.equal(arrow.where, 'floor');
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy)[0], arrow);
    assert.equal(game.inventory.includes(arrow), false);
    assert.equal(messages.length, 0);
});
void test('a monster disenchanter still drains and describes the hero\'s carried weapon', async () => {
    freshObjectRoom();
    const disenchanter = await createMonsterAt('disenchanter', 11, 10, NO_MINVENT);
    const club = await addInventoryObject(CLUB, { spe: 3 });
    const messages = [];
    await applyMonsterPassiveToObject(disenchanter, club, {
        publish: message => { messages.push(message); }, random: limit => limit - 1,
    });
    assert.equal(club.spe, 2);
    assert.equal(game.inventory[0], club);
    assert.equal(game._armorClassDirty, true);
    assert.deepEqual(messages, ['Your club seems less effective.']);
});
void test('an ordinary human hero has no passive object damage', async () => {
    freshObjectRoom();
    const arrow = await floorObject(ARROW, game.u.ux, game.u.uy, { spe: 3 });
    await applyMonsterPassiveToObject(game.u, arrow, {
        publish: () => { }, random: () => 0,
    });
    assert.equal(arrow.spe, 3);
    assert.equal(arrow.oeroded ?? 0, 0);
    assert.equal(arrow.oeroded2 ?? 0, 0);
});
//# sourceMappingURL=passive_object_contact.test.js.map