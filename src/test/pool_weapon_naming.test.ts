import assert from 'node:assert/strict';
import test from 'node:test';

import { NEED_HTH_WEAPON, NEED_RANGED_WEAPON, NO_MINVENT, NO_WEAPON_WANTED, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { wieldMonsterWeapon } from '../js/monster_weapon.js';
import { ORCISH_DAGGER, ELVEN_BOW, ELVEN_ARROW, LONG_SWORD } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [species, type, request, name] of [
    ['goblin', ORCISH_DAGGER, NEED_HTH_WEAPON, 'crude dagger'],
    ['elf-lord', ELVEN_BOW, NEED_RANGED_WEAPON, 'runed bow'],
] as const) {
    void test(`a monster's cursed ${name} welds under its perceived name`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
        monster.female = false;
        const weapon = await knownObject(type, { known: false, typeKnown: false, dknown: false, cursed: true });
        await addObjectToMonsterInventory(monster, weapon);
        if (type === ELVEN_BOW)
            await addObjectToMonsterInventory(monster, await knownObject(ELVEN_ARROW));
        monster.weaponCheck = request;
        const messages: string[] = [];

        await wieldMonsterWeapon(monster, game, { publish: text => { messages.push(text); } });

        assert.equal(messages.find(text => text.includes('welds itself')),
            `The ${name} welds itself to the ${species}'s hand!`);
        assert.equal(weapon.bknown, true);
    });
}

for (const [identified, name] of [[true, 'orcish dagger'], [false, 'crude dagger']] as const) {
    void test(`a visible failed weapon switch observes the old ${name} before naming it`, async () => {
        freshObjectRoom();
        const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        goblin.female = false;
        const welded = await equipMonsterObject(goblin, await knownObject(ORCISH_DAGGER, {
            typeKnown: identified, dknown: false, bknown: false, cursed: true,
        }), W_WEP);
        await addObjectToMonsterInventory(goblin, await knownObject(LONG_SWORD));
        goblin.weaponCheck = NEED_HTH_WEAPON;
        const messages: string[] = [];

        const spentTurn = await wieldMonsterWeapon(goblin, game, { publish: text => { messages.push(text); } });

        assert.equal(messages.find(text => text.includes('is welded')), `The goblin's ${name} is welded to his hand!`);
        assert.equal(welded.dknown, true);
        assert.equal(welded.bknown, true);
        assert.equal(goblin.mw, welded);
        assert.equal(goblin.weaponCheck, NO_WEAPON_WANTED);
        assert.equal(spentTurn, true);
    });
}

void test('an unseen failed weapon switch does not reveal the old weapon', async () => {
    freshObjectRoom();
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.minvis = true;
    const welded = await equipMonsterObject(goblin, await knownObject(ORCISH_DAGGER, {
        dknown: false, bknown: false, cursed: true,
    }), W_WEP);
    await addObjectToMonsterInventory(goblin, await knownObject(LONG_SWORD));
    goblin.weaponCheck = NEED_HTH_WEAPON;
    const messages: string[] = [];

    await wieldMonsterWeapon(goblin, game, { publish: text => { messages.push(text); } });

    assert.equal(messages.length, 0);
    assert.equal(welded.dknown, false);
    assert.equal(welded.bknown, false);
    assert.equal(goblin.mw, welded);
});
