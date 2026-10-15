import test from 'node:test';
import assert from 'node:assert/strict';
import { W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';

void test('a floating eye saved from a fiery gaze still paralyzes its attacker', async () => {
    freshMonsterAbilityRoom('pyrolisk', { energy: 30 });
    const eye = await createMonsterAt('floating eye', 11, 10);
    eye.mhp = 1;
    eye.mpeaceful = 0;
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    await equipMonsterObject(eye, amulet, W_AMUL);

    await runMonsterAbilityCommand('                                                ');

    assert.ok(eye.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.ok((game._helplessTurns ?? 0) > 0);
    assert.equal(game.context.move, 1);
    assert.equal(game.u.uen, 15);
});
