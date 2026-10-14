import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, W_WEP } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { attackMonsterWithMonster } from '../js/monmove.js';
import { DAGGER } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('seeing the defender allows an unseen attacker to announce its weapon swing', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    const kitten = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    const weapon = await knownObject(DAGGER);
    weapon.dknown = false;
    await equipMonsterObject(goblin, weapon, W_WEP);
    game.viz_array = Array.from({ length: 21 }, () => new Uint8Array(80));
    const row = game.viz_array[10];
    assert.ok(row);
    row[11] = 2;
    assert.equal(canSeeMonster(goblin), false);
    assert.equal(canSeeMonster(kitten), true);
    pushKeys(' '.repeat(10));

    await attackMonsterWithMonster(goblin, kitten, { state: game, rollOne: sides => sides });

    assert.match(game._pending_message, /It thrusts its dagger at the kitten\./);
    assert.equal(weapon.dknown, true, 'the visible swing identifies the weapon appearance');
});
