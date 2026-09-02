import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import {
    BEAR_TRAP, DOOR, D_CLOSED, D_TRAPPED,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { BEARTRAP, CHEST } from '../js/object_data.js';
import { invokeInventoryObject } from './support/commands.js';
import {
    artifactObject, floorObject,
} from './support/game-objects.js';
import {
    addTrap, floorObjectsAt,
} from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

test('a ranger can disarm an adjacent bear trap', async () => {
    const level = freshObjectRoom({ role: 'ranger' });
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

test('the Master Key disarms a trapped chest', async () => {
    freshObjectRoom({
        role: 'rogue',
        moves: 70,
        hero: { ualign: { type: -1, record: 10 } },
    });
    const key = artifactObject('The Master Key of Thievery', {
        invlet: 'a',
        where: 'inventory',
    });
    const chest = floorObject(CHEST, 10, 10, {
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

test('declining a floor trap still allows disarming a chest', async () => {
    const level = freshObjectRoom({
        role: 'rogue',
        hero: { ualign: { type: -1, record: 10 } },
    });
    const key = artifactObject('The Master Key of Thievery', {
        invlet: 'a',
        where: 'inventory',
    });
    const trap = addTrap(level, BEAR_TRAP, 10, 10, { tseen: true });
    const chest = floorObject(CHEST, 10, 10, {
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

test('carrying the Master Key guarantees disarming a door trap', async () => {
    const level = freshObjectRoom({ role: 'rogue' });
    const key = artifactObject('The Master Key of Thievery', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [key];
    Object.assign(level.at(11, 10), {
        typ: DOOR,
        doormask: D_CLOSED | D_TRAPPED,
    });
    pushKeys('untrap\nly');

    await rhack('#'.charCodeAt(0));

    assert.equal(level.at(11, 10).doormask, D_CLOSED);
    assert.equal(game.context.move, 1);
});

test('cancelling the Master Key direction does not start its cooldown',
    async () => {
        freshObjectRoom({
            role: 'rogue',
            moves: 90,
            hero: { ualign: { type: -1, record: 10 } },
        });
        const key = artifactObject('The Master Key of Thievery', {
            invlet: 'a',
            where: 'inventory',
        });
        game.inventory = [key];

        await invokeInventoryObject(key, '\x1b');

        assert.equal(key.age, 0);
        assert.equal(game.context.move, 0);
    });
