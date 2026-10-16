import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { DISMOUNT_GENERIC, MM_NOGRP, MM_NOWAIT, NO_MINVENT, STONE } from '../js/const.js';
import { clearMessageWindow, flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { lightHitsGremlin } from '../js/light.js';
import { returnMonsterWeapon } from '../js/monster_returning_weapon.js';
import { AKLYS } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { dismountHero } from '../js/steed.js';
import { vision_recalc } from '../js/vision.js';
import { runExtendedCommand } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;

async function messageLine() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

void test('a gas-cloud death during the world turn uses the native cause message', async () => {
    const input = freshTurnRoom();
    const jackal = await createMonsterAt('jackal', 11, 10, BIRTH_FLAGS);
    jackal.mhp = jackal.mhpmax = 1;
    jackal.movement = 0;
    jackal.mcanmove = 0;
    assert.ok(game.level);
    game.level.regions = [{
        kind: 'gas-cloud', heroInside: false, visible: true, heroFault: false,
        damage: 8, ttl: 3, cells: [{ x: 11, y: 10 }], monsterIds: [jackal.m_id],
    }];
    input.feed('.');

    await moveloop_core();
    await answerPrompts(moveloop_core(), input, [{
        prompt: /The jackal is killed by the gas cloud!/, keys: 27,
    }]);

    assert.equal(game.level.monsters.includes(jackal), false);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});

void test('monster-caused light kills a visible pet gremlin without an extra death line', async () => {
    const level = freshObjectRoom();
    const gremlin = await createMonsterAt('gremlin', 11, 10, BIRTH_FLAGS);
    initializePet(gremlin);
    gremlin.mhp = 1;
    game.context.mon_moving = true;
    const input = resetInputState();

    await answerPrompts(lightHitsGremlin(gremlin, 2), input, [{
        prompt: /The gremlin wails in agony!/, keys: ' ',
    }]);

    assert.equal(level.monsters.includes(gremlin), false);
    assert.equal(await messageLine(), 'You have a sad feeling for a moment, then it passes.');
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});

for (const visible of [true, false]) {
    void test(`a lethal returning club ${visible ? 'announces its visible victim' : 'gives grief for an unseen pet'}`, async () => {
        const level = freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 13, 10, BIRTH_FLAGS);
        initializePet(soldier);
        soldier.mconf = 1;
        soldier.mhp = 1;
        soldier.minvis = visible ? 0 : 1;
        const weapon = await knownObject(AKLYS);
        const input = resetInputState();
        initRng(4n);

        await answerPrompts(returnMonsterWeapon(soldier, weapon, 11, 10), input, [{
            prompt: visible ? /aklys flies back toward the soldier, hitting/ : /You hear something hit it with a thud!/, keys: ' ',
        }]);

        assert.equal(level.monsters.includes(soldier), false);
        assert.ok(floorObjectsAt(level, 13, 10).includes(weapon));
        assert.equal(await messageLine(), visible
            ? 'The soldier is killed!'
            : 'You have a sad feeling for a moment, then it passes.');
        assert.equal(game.u.uconduct?.killer ?? 0, 0);
    });
}

void test('an involuntary dismount with no landing room announces the steed death without hero blame', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    clearMessageWindow();
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            if (x !== game.u.ux || y !== game.u.uy)
                level.requireAt(x, y).typ = STONE;
        }
    }
    vision_recalc(0);
    const alignment = game.u.ualign?.record;

    await dismountHero(DISMOUNT_GENERIC);

    assert.equal(game.u.usteed, null);
    assert.equal(level.monsters.includes(pony), false);
    assert.match(await messageLine(), /The saddled pony is killed!/);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
    assert.equal(game.u.ualign?.record, alignment);
});
