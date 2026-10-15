import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { A_WIS, MFAST, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POT_SPEED, WAN_SPEED_MONSTER } from '../js/object_data.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('a monster retains its speed potion until the speed-change feedback has resumed', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.movement = 12;
    const potion = await addObjectToMonsterInventory(monster, await knownObject(POT_SPEED), game);
    assert.ok(potion);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_SPEED] = 'pink';
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 12;
    initRng(8n);
    const input = resetInputState();
    let sawSpeedWhileCarrying = false;
    input.beforeRead = () => {
        if (monster.mspeed === MFAST && potion.where === 'minvent') sawSpeedWhileCarrying = true;
    };
    installPagerInput(input, { expected: /drinks|moving faster/, limit: 4 });

    await finishAtCommandInput(input, moveloop_core, /moving faster/);

    assert.equal(monster.permspeed, MFAST);
    assert.equal(potion.where, 'gone');
    assert.equal(sawSpeedWhileCarrying, true, 'The drinker must still carry its potion during the speed announcement');
});

void test('watching a known speed wand does not exercise Wisdom again', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.movement = 12;
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_SPEED_MONSTER, { spe: 3 }), game);
    assert.ok(wand);
    recordObjectKnowledge(WAN_SPEED_MONSTER, game);
    game.u._exercise = [0, 0, 0, 0, 0, 0];
    game.u.acurr.a[A_WIS] = 3;
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 12;
    initRng(8n);
    const input = resetInputState();
    installPagerInput(input, { expected: /zaps|moving faster/, limit: 4 });

    await finishAtCommandInput(input, moveloop_core, /moving faster/);

    assert.equal(wand.spe, 2);
    assert.equal(monster.permspeed, MFAST);
    assert.equal(game.u._exercise[A_WIS], 0);
});
