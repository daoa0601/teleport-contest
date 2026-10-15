import assert from 'node:assert/strict';
import test from 'node:test';
import { NEED_HTH_WEAPON, NO_MINVENT, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { wieldMonsterWeapon } from '../js/monster_weapon.js';
import { DAGGER, LONG_SWORD } from '../js/object_data.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a balrog unable to release a welded dagger uses its perceived possessive pronoun', async () => {
    freshObjectRoom();
    const balrog = await createMonsterAt('balrog', 11, 10, NO_MINVENT);
    const dagger = await equipMonsterObject(balrog, await knownObject(DAGGER, { cursed: true }), W_WEP);
    await addObjectToMonsterInventory(balrog, await knownObject(LONG_SWORD));
    balrog.weaponCheck = NEED_HTH_WEAPON;
    const messages: string[] = [];

    const spentTime = await wieldMonsterWeapon(balrog, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(spentTime, true);
    assert.equal(balrog.mw, dagger);
    assert.equal(messages[1], "The balrog's dagger is welded to its foreclaw!");
});

void test('an undiscovered artifact keeps its object description when a monster makes it shine', async () => {
    freshObjectRoom();
    const giant = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    const sword = await artifactObject('Sunsword', { known: false, typeKnown: false, bknown: false });
    await addObjectToMonsterInventory(giant, sword);
    giant.weaponCheck = NEED_HTH_WEAPON;
    const messages: string[] = [];

    await wieldMonsterWeapon(giant, game, { publish: async message => { messages.push(message); } });

    assert.equal(giant.mw, sword);
    const light = messages.find(message => message.includes('shines'));
    assert.match(light ?? '', /^The long sword named Sunsword shines /);
});

