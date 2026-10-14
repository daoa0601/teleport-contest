import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a hostile demon can taunt the hero after its ordinary action', async () => {
    const input = freshTurnRoom({ hero: { uhp: 2000, uhpmax: 2000 } });
    requirePlayingGame(game);
    const demon = await createMonsterAt('imp', 11, 10, MM_ANGRY | NO_MINVENT);
    demon.mcan = 1;
    const messages = [];
    let reads = 0;
    input.display = { async readKey() {
            assert.ok(++reads <= 200, 'demon turns must reach command input');
            const message = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
            messages.push(message);
            return message.includes('--More--') && game._pending_message ? 32 : 27;
        } };
    initRng(17);
    for (let turn = 0; turn < 24; turn++) {
        demon.movement = 12;
        game.u.umovement = 0;
        game._heroTimePending = true;
        await moveloop_core();
    }
    assert.ok(messages.some(message => /"[^"]+[!?]"/.test(message)), `the demon must deliver a common quest insult; observed: ${messages.slice(-5).join(' | ')}`);
});
//# sourceMappingURL=monster_cuss.test.js.map