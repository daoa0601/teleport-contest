import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import {
    TT_BURIEDBALL, TT_PIT, TT_WEB,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { HEAVY_IRON_BALL } from '../js/object_data.js';
import { vision_reset } from '../js/vision.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('escaping a web takes a movement attempt without moving the hero',
    async () => {
        freshWeaponArena();
        game.u.utrap = 1;
        game.u.utraptype = TT_WEB;

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.equal(game.u.utrap, 0);
    });

test('climbing from a pit leaves the hero on the pit square', async () => {
    freshWeaponArena();
    game.u.utrap = 1;
    game.u.utraptype = TT_PIT;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.u.utrap, 0);
});

test('a trapped hero cannot swap places with a pet', async () => {
    const level = freshWeaponArena();
    const dog = {
        mnum: 16, mx: 11, my: 10, mhp: 8, mhpmax: 8,
        pet: true, mtame: 10, minvent: [],
    };
    level.monsters.push(dog);
    game.u.utrap = 1;
    game.u.utraptype = TT_WEB;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual([dog.mx, dog.my], [11, 10]);
});

test('the hero can move while staying within a buried ball chain',
    async () => {
        const level = freshWeaponArena();
        level.buriedObjects = [{
            otyp: HEAVY_IRON_BALL, ox: 10, oy: 10,
        }];
        game.u.utrap = 3;
        game.u.utraptype = TT_BURIEDBALL;
        vision_reset();

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game.u.utrap, 3);
    });

test('pulling a buried ball free restores the ball and chain', async () => {
    const level = freshWeaponArena();
    const ball = {
        otyp: HEAVY_IRON_BALL, ox: 8, oy: 10, oclass: 15,
        quan: 1, quantity: 1, where: 'buried', owornmask: 0,
    };
    level.buriedObjects = [ball];
    game.u.utrap = 1;
    game.u.utraptype = TT_BURIEDBALL;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.uball, ball);
    assert.ok(game.uchain);
    assert.equal(level.buriedObjects.includes(ball), false);
});
