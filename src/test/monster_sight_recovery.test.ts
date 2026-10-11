import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, NO_MINVENT, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/display.js';
import { lifeSaveMonster } from '../js/mondeath.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const blind of [false, true]) {
    void test(`a ${blind ? 'blind' : 'sighted'} hero detecting an invisible monster cannot see its recovery`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('jackal', 12, 10, MM_ANGRY | NO_MINVENT);
        const amulet = await equipMonsterObject(monster,
            await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        monster.minvis = 1;
        monster.mhp = 0;
        grantIntrinsicProperty('detectMonsters', 'potion');
        if (blind) await makeBlinded(10, { talk: false });
        const messages: string[] = [];
        const publish = async (message: string) => {
            await pline(message);
            messages.push(message);
        };

        await lifeSaveMonster(monster, amulet, {
            continueLine: publish, page: publish, line: publish,
        });

        assert.ok(monster.mhp > 0);
        assert.equal(amulet.where, 'gone');
        assert.equal(messages.some(message => /medallion begins to glow/.test(message)), !blind);
        assert.equal(messages.some(message => /looks much better|reconstitutes/.test(message)), false,
            messages.join(' | '));
    });
}
