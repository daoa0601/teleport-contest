import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishDeferredMonsterMiscItem, takeMonsterTurn } from '../js/monmove.js';
import { BULLWHIP, DAGGER, HEAVY_IRON_BALL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('a monster bullwhip cannot wrap around the hero\'s heavy iron ball', async () => {
    let failuresToWrap = 0;
    for (let seed = 1; seed <= 8; seed++) {
        freshObjectRoom({ heroX: 10, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('soldier', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        await equipMonsterObject(monster, await knownObject(BULLWHIP), W_WEP);
        monster.movement = 12;
        const ball = await addInventoryObject(HEAVY_IRON_BALL);
        await setPrimaryWeapon(ball);
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        installPagerInput(input, { expected: /soldier|whip|ball/, limit: 8 });

        await finishAtCommandInput(input, moveloop_core, /soldier|whip|ball/);

        assert.equal(ball.where, 'inventory', `The iron ball must remain wielded after turn seed ${seed}`);
        assert.equal(game.uwep, ball);
        if (/fails to wrap/.test(game._lastPlineMessage ?? '')) failuresToWrap++;
    }
    assert.ok(failuresToWrap > 0, 'At least one soldier must attempt to disarm the ball');
});

void test('a bullwhip can snatch a cursed secondary weapon because it is not welded', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    await equipMonsterObject(monster, await knownObject(BULLWHIP), W_WEP);
    const primary = await addInventoryObject(DAGGER);
    const secondary = await addInventoryObject(DAGGER, { cursed: true });
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(secondary);
    setTwoWeaponCombat(true);
    const input = resetInputState();
    installPagerInput(input, { expected: /soldier|whip|dagger/, limit: 6 });
    const turn = await takeMonsterTurn(monster, game, range => range === 4 ? 3 : range === 2 ? 1 : 0);

    await finishDeferredMonsterMiscItem({ monster, ...turn }, game);

    assert.equal(secondary.ocarry, monster);
    assert.equal(game.uwep, primary);
    assert.equal(game.uswapwep, null);
});

void test('a named weapon remains free while the disarm announcement waits for input', async () => {
    let sawFreeWeapon = false;
    let disarms = 0;
    for (let seed = 1; seed <= 8; seed++) {
        freshObjectRoom({ heroX: 10, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('soldier', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        await equipMonsterObject(monster, await knownObject(BULLWHIP), W_WEP);
        monster.movement = 12;
        const dagger = await addInventoryObject(DAGGER, { oname: 'Needle' });
        await setPrimaryWeapon(dagger);
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        input.beforeRead = () => {
            if (dagger.where === 'free') sawFreeWeapon = true;
        };
        installPagerInput(input, { expected: /soldier|whip|dagger|Needle/, limit: 8 });

        await finishAtCommandInput(input, moveloop_core, /soldier|whip|dagger|Needle/);

        if (dagger.where !== 'inventory') {
            disarms++;
            assert.match(game._lastPlineMessage ?? '', /(?:yanks|snatches) the dagger named Needle/);
        }
    }
    assert.ok(disarms > 0, 'At least one soldier must disarm the weapon');
    assert.equal(sawFreeWeapon, true, 'Weapon transfer must wait for the disarm announcement');
});
