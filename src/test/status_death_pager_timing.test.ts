import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen, pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { waitForCurrentMonsterMore } from '../js/monster_attack_death.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a monster death message acknowledgement retains status until the next map flush', async () => {
    freshObjectRoom();
    await bot();
    await pline('You die...');
    game.u.uhp = 0;
    game.context.botl = true;
    pushKeys(' ');

    await waitForCurrentMonsterMore();

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:40\(40\)/);
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:0\(40\)/);
});
