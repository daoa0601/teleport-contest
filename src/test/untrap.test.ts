import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import {
    BEAR_TRAP, DOOR, D_CLOSED, D_TRAPPED, M_AP_FURNITURE,
    M_AP_OBJECT, PIT,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { BEARTRAP, BOULDER, CHEST } from '../js/object_data.js';
import { invokeInventoryObject } from './support/commands.js';
import {
    artifactObject, floorObject,
} from './support/game-objects.js';
import {
    addTrap, floorObjectsAt,
} from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const CLOSED_DOOR_APPEARANCE = 15;

void test('a ranger can disarm an adjacent bear trap', async () => {
    const level = freshObjectRoom({ role: 'ranger' });
    requirePlayingGame(game);
    const trap = addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    pushKeys('untrap\nl');

    await rhack('#'.charCodeAt(0));

    assert.equal(level.traps.includes(trap), false);
    assert.equal(
        floorObjectsAt(level, 11, 10)
            .some(object => object.otyp === BEARTRAP),
        true,
    );
    assert.equal(game.context.move, 1);
});

void test('untrapping reveals a monster disguised over the trap', async () => {
    const level = freshObjectRoom({ role: 'ranger' });
    requirePlayingGame(game);
    const trap = addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    const mimic = await createMonsterAt('small mimic', 11, 10);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = CHEST;
    mimic.msleeping = 1;
    pushKeys('untrap\nl' + ' '.repeat(10));

    await rhack('#'.charCodeAt(0));

    assert.equal(mimic.m_ap_type, 0);
    assert.equal(mimic.msleeping, 0);
    assert.equal(level.traps.includes(trap), true);
    assert.equal(game.context.move, 1);
});

void test('untrapping toward a disguised door reveals its mimic', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = CLOSED_DOOR_APPEARANCE;
    mimic.msleeping = 1;
    pushKeys('untrap\nl' + ' '.repeat(10));

    await rhack('#'.charCodeAt(0));

    assert.equal(mimic.m_ap_type, 0);
    assert.equal(mimic.msleeping, 0);
    assert.equal(game.context.move, 1);
});

void test('a boulder fills a pit after its monster is pulled out', async () => {
    const level = freshObjectRoom({ role: 'ranger' });
    requirePlayingGame(game);
    const trap = addTrap(level, PIT, 11, 10, {
        tseen: true,
        madeby_u: true,
    });
    const monster = await createMonsterAt('jackal', 11, 10);
    monster.mtrapped = 1;
    const boulder = await floorObject(BOULDER, 11, 10);
    pushKeys('untrap\nl ');

    await rhack('#'.charCodeAt(0));

    assert.equal(monster.mtrapped, 0);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(boulder.where, 'gone');
    assert.equal(game.context.move, 1);
});

void test('the Master Key disarms a trapped chest', async () => {
    freshObjectRoom({
        role: 'rogue',
        moves: 70,
        hero: { ualign: { type: -1, record: 10 } },
    });
    requirePlayingGame(game);
    const key = await artifactObject('The Master Key of Thievery', {
        invlet: 'a',
        where: 'inventory',
    });
    const chest = await floorObject(CHEST, 10, 10, {
        otrapped: true,
        tknown: true,
        dknown: true,
    });
    game.inventory = [key];

    await invokeInventoryObject(key, '.y');

    assert.equal(chest.otrapped, false);
    assert.ok(key.age > game.moves);
    assert.equal(game.context.move, 1);
});

void test('declining a floor trap still allows disarming a chest', async () => {
    const level = freshObjectRoom({
        role: 'rogue',
        hero: { ualign: { type: -1, record: 10 } },
    });
    requirePlayingGame(game);
    const key = await artifactObject('The Master Key of Thievery', {
        invlet: 'a',
        where: 'inventory',
    });
    const trap = addTrap(level, BEAR_TRAP, 10, 10, { tseen: true });
    const chest = await floorObject(CHEST, 10, 10, {
        otrapped: true,
        tknown: true,
        dknown: true,
    });
    game.inventory = [key];
    pushKeys('untrap\n.ny');

    await rhack('#'.charCodeAt(0));

    assert.equal(level.traps.includes(trap), true);
    assert.equal(chest.otrapped, false);
    assert.equal(game.context.move, 1);
});

void test('carrying the Master Key guarantees disarming a door trap', async () => {
    const level = freshObjectRoom({ role: 'rogue' });
    requirePlayingGame(game);
    const key = await artifactObject('The Master Key of Thievery', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [key];
    const doorSquare = level.requireAt(11, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_CLOSED | D_TRAPPED;
    const input = resetInputState();
    input.feed('untrap\nl');
    const untrapping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'You find a trap on the door!');
    assert.equal(level.requireAt(11, 10).doormask, D_CLOSED | D_TRAPPED);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^Disarm it\?/);
    input.feed('y');
    await untrapping;

    assert.equal(level.requireAt(11, 10).doormask, D_CLOSED);
    assert.equal(game.context.move, 1);
});

void test('cancelling the Master Key direction does not start its cooldown',
    async () => {
        freshObjectRoom({
            role: 'rogue',
            moves: 90,
            hero: { ualign: { type: -1, record: 10 } },
        });
        requirePlayingGame(game);
        const key = await artifactObject('The Master Key of Thievery', {
            invlet: 'a',
            where: 'inventory',
        });
        game.inventory = [key];

        await invokeInventoryObject(key, '\x1b');

        assert.equal(key.age, 0);
        assert.equal(game.context.move, 0);
    });

void test('disarming a trapped door awards both score and a threshold level', async () => {
    const level = freshObjectRoom({ role: 'rogue', hero: {
        ulevel: 1, uexp: 19, urexp: 0,
    } });
    requirePlayingGame(game);
    const key = await artifactObject('The Master Key of Thievery', {
        invlet: 'a', where: 'inventory',
    });
    game.inventory = [key];
    const doorSquare = level.requireAt(11, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_CLOSED | D_TRAPPED;
    const input = resetInputState();
    input.feed('untrap\nl');
    const untrapping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'You find a trap on the door!');
    assert.equal(game.u.uexp, 19);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^Disarm it\?/);
    input.feed('y');
    await untrapping;

    assert.equal(level.requireAt(11, 10).doormask, D_CLOSED);
    assert.equal(game.u.uexp, 27);
    assert.equal(game.u.urexp, 32);
    assert.equal(game.u.ulevel, 2);
});
