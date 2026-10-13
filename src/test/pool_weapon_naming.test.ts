import assert from 'node:assert/strict';
import test from 'node:test';

import { NEED_HTH_WEAPON, NEED_RANGED_WEAPON, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { wieldMonsterWeapon } from '../js/monster_weapon.js';
import { ORCISH_DAGGER, ELVEN_BOW, ELVEN_ARROW } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
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
