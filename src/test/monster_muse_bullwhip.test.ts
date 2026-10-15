import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishDeferredMonsterMiscItem, takeMonsterTurn } from '../js/monmove.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BULLWHIP, CORPSE, DAGGER, HEAVY_IRON_BALL } from '../js/object_data.js';
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

void test('monster bullwhip messages omit the wielded corpse species', async () => {
    const outcomes = [
        { destination: 0, announcement: 'The whip slips free.' },
        { destination: 1, announcement: 'The soldier yanks the corpse from your hand!' },
        { destination: 2, announcement: 'The soldier yanks the corpse to the floor!' },
        { destination: 3, announcement: 'The soldier snatches the corpse!' },
    ];
    for (const { destination, announcement } of outcomes) {
        freshObjectRoom({ heroX: 10, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('soldier', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        await equipMonsterObject(monster, await knownObject(BULLWHIP), W_WEP);
        const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('lizard') });
        await setPrimaryWeapon(corpse);
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /soldier|whip|corpse/, limit: 6 });
        const turn = await takeMonsterTurn(monster, game, range => range === 4 ? destination : 0);

        await finishDeferredMonsterMiscItem({ monster, ...turn }, game);
        messages.push(game._pending_message);

        assert.ok(messages.some(message => message.includes("The bullwhip wraps around the corpse you're wielding!")),
            `Missing corpse wrap message for destination ${destination}: ${messages.join('\n')}`);
        assert.equal(game._lastPlineMessage, announcement);
    }
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
