import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, ROOM, STRAT_APPEARMSG, VWALL } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { mkstairs } from '../js/mklev.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('a blind covetous lich can locate and attack the hero after teleporting', async () => {
    freshObjectRoom({ left: 7, right: 35,
        hero: { uac: -10, uhp: 100, uhpmax: 100, coldResistance: true } });
    requirePlayingGame(game);
    const lich = await createMonsterAt('master lich', 30, 10, NO_MINVENT);
    lich.mstrategy = STRAT_APPEARMSG;
    lich.mpeaceful = false;
    lich.movement = 12;
    lich.mspec_used = 100;
    lich.mcansee = 0;
    lich.mblinded = 100;
    lich.mux = 0;
    lich.muy = 0;
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 12;
    initRng(7n);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /lich|cold/, limit: 10 });

    await finishAtCommandInput(input, moveloop_core, /lich|cold|^$/);

    assert.match(messages.join('\n'), /The master lich vanishes and reappears next to you\./);
    assert.match(messages.join('\n'), /The master lich touches you!/);
    assert.ok(game.u.uhp < 100, 'the returning lich should damage the hero on the same turn');
});

void test('a lich returning from unseen retreat stairs announces its arrival from that location', async () => {
    let returns = 0;
    for (let seed = 1; seed <= 20; seed++) {
        const level = freshObjectRoom({ left: 8, right: 45,
            hero: { uac: -1000, coldResistance: true, seeInvisible: true } });
        await init_dungeons();
        requirePlayingGame(game);
        for (let y = 6; y <= 14; y++) level.requireAt(20, y).typ = VWALL;
        vision_reset();
        vision_recalc(0);
        await mkstairs(40, 10, true, null);
        const lich = await createMonsterAt('master lich', 11, 10, NO_MINVENT);
        lich.minvis = 1;
        lich.mhp = 85;
        lich.mhpmax = 90;
        lich.mpeaceful = false;
        lich.mstrategy = 0;
        lich.movement = 12;
        lich.mspec_used = 100;
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /lich/, limit: 12 });

        await finishAtCommandInput(input, moveloop_core, /lich|^$/);

        if (Math.max(Math.abs(lich.mx - game.u.ux), Math.abs(lich.my - game.u.uy)) <= 1) {
            returns++;
            assert.match(messages.join('\n'), /The invisible master lich appears next to you!/);
            assert.doesNotMatch(messages.join('\n'), /vanishes and reappears/);
        }
    }
    assert.ok(returns > 0, 'some wounded liches should return instead of healing at the stairs');
});

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
