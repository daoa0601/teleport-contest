import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, ROOM, STRAT_APPEARMSG } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('an unseen arch-lich introduces its covetous arrival with An', async () => {
    let arrivals = 0;
    for (let seed = 1; seed <= 20; seed++) {
        const level = freshObjectRoom({ hero: { uac: -1000, coldResistance: true } });
        requirePlayingGame(game);
        level.requireAt(30, 10).typ = ROOM;
        const lich = await createMonsterAt('arch-lich', 30, 10, NO_MINVENT);
        lich.mstrategy = (lich.mstrategy ?? 0) | STRAT_APPEARMSG;
        lich.mpeaceful = false;
        lich.movement = 12;
        lich.mspec_used = 100;
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /arch-lich/, limit: 5 });

        await finishAtCommandInput(input, moveloop_core, /arch-lich|^$/);

        if (Math.max(Math.abs(lich.mx - game.u.ux), Math.abs(lich.my - game.u.uy)) <= 1) {
            arrivals++;
            assert.match(messages.join('\n'), /An arch-lich suddenly appears next to you!/);
            assert.equal((lich.mstrategy ?? 0) & STRAT_APPEARMSG, 0);
        }
    }
    assert.ok(arrivals > 0, 'At least one lich must teleport into view');
});
