import assert from 'node:assert/strict';
import test from 'node:test';
import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import { NO_MINVENT } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('Stormbringer displays the HP restored by draining a monster', async () => {
    freshObjectRoom({ hero: { uhp: 5, uhpmax: 12 } });
    const monster = await createMonsterAt('pony', 12, 10, NO_MINVENT);
    monster.mhp = monster.mhpmax = 20;
    const weapon = await artifactObject('Stormbringer');
    await bot();

    await applyArtifactHitToMonster(weapon, monster, 4, { random: () => 1, rollOne: limit => limit, publish: async () => undefined });
    await flush_screen(1);

    assert.ok(game.u.uhp !== undefined && game.u.uhp > 5);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`HP:${game.u.uhp}\\(12\\)`));
});
