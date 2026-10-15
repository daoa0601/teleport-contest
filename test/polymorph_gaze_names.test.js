import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
void test('a confusing gaze addresses a named target by its proper name', async () => {
    freshMonsterAbilityRoom('umber hulk', { energy: 30 });
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mgivenname = 'Jack';
    jackal.mpeaceful = 0;
    await runMonsterAbilityCommand('                        ');
    assert.equal(jackal.mconf, 1);
    assert.equal(game._pending_message, 'Your gaze confuses Jack!');
});
//# sourceMappingURL=polymorph_gaze_names.test.js.map