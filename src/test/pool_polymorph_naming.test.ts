import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [species, description] of [
    ['monk', 'an initiate'], ['cave dweller', 'a wanderer'], ['Olog-hai', 'an Olog-hai'],
] as const) {
    void test(`polymorph announces the new form as ${description}`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('little dog', 11, 10);
        setMonsterGivenName(monster, 'Spot');
        const messages: string[] = [];

        await changeMonsterForm(monster, MONSTER_NAME.indexOf(species), game, {
            showMessage: true, publish: text => { messages.push(text); },
        });

        assert.equal(messages[0], `Spot turns into ${description}!`);
        assert.equal(monster.mgivenname, 'Spot');
    });
}

void test('a named mount that becomes visible announces its saddle', async () => {
    freshObjectRoom();
    const mount = await createSaddledSteed('pony');
    setMonsterGivenName(mount, 'Spot');
    mount.minvis = true;
    const messages: string[] = [];

    await changeMonsterForm(mount, MONSTER_NAME.indexOf('horse'), game, {
        showMessage: true, publish: text => { messages.push(text); },
    });

    assert.equal(messages[0], 'Saddled Spot appears!');
    assert.equal(mount.saddled, true);
});
