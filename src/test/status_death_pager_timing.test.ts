import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { bot, flush_screen, pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { waitForCurrentMonsterMore } from '../js/monster_attack_death.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
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

void test('fatal poison displays zero HP while acknowledging the poison announcement', async () => {
    const input = freshTurnRoom({ flags: { debug: true }, hero: { uhp: 8, uhpmax: 40 } });
    requirePlayingGame(game);
    const bat = await createMonsterAt('vampire bat', 11, 10, NO_MINVENT);
    bat.mpeaceful = false;
    bat.msleeping = 0;
    bat.movement = 12;
    await bot();
    let poisonPages = 0;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            const hp = game.u.uhp;
            if (/bite was poisoned/.test(message) && hp !== undefined && hp < -1) {
                poisonPages++;
                assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:0\(40\)/);
            }
            return (message.includes('Die?') ? 'n' : ' ').charCodeAt(0);
        },
    };
    initRng(1n);
    input.feed('m.');

    await moveloop_core();
    await moveloop_core();

    assert.equal(poisonPages, 1);
});
