import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { WAN_MAKE_INVISIBLE, WAN_SPEED_MONSTER } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a monster finishes making itself invisible before its turn returns', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_MAKE_INVISIBLE, { spe: 3 }), game);
    assert.ok(wand);
    installPagerInput(resetInputState(), { expected: /zaps|cannot see/, limit: 4 });

    await takeMonsterTurn(monster, game);

    assert.equal(wand.spe, 2);
    assert.equal(!!monster.minvis, true);
    assert.equal(monster.mx, 10);
    assert.equal(monster.my, 10);
});

void test('a monster finishes speeding itself before its turn returns', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_SPEED_MONSTER, { spe: 3 }), game);
    assert.ok(wand);
    installPagerInput(resetInputState(), { expected: /zaps|moving faster/, limit: 4 });

    await takeMonsterTurn(monster, game);

    assert.equal(wand.spe, 2);
    assert.equal(monster.permspeed, MFAST);
    assert.equal(monster.mx, 10);
    assert.equal(monster.my, 10);
});
