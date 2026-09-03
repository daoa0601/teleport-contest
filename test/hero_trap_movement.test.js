import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import {
    ANTI_MAGIC, ARROW_TRAP, FIRE_TRAP, MAGIC_PORTAL, ROCKTRAP, ROOM,
    SLP_GAS_TRAP, RUST_TRAP, SQKY_BOARD, W_ARMF, W_ARMH, W_WEP,
    TT_BURIEDBALL, TT_PIT, TT_WEB, STATUE_TRAP, VIBRATING_SQUARE,
} from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import { mkcorpstat } from '../js/mklev.js';
import {
    ARROW, HEAVY_IRON_BALL, IRON_SHOES, ORCISH_HELM, ROCK, STATUE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import {
    addInventoryObject,
} from './support/game-objects.js';
import { wearHeroObject } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { addMonster, addPet } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('escaping a web takes a movement attempt without moving the hero',
    async () => {
        freshGameplayRoom();
        game.u.utrap = 1;
        game.u.utraptype = TT_WEB;

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.equal(game.u.utrap, 0);
    });

test('climbing from a pit leaves the hero on the pit square', async () => {
    freshGameplayRoom();
    game.u.utrap = 1;
    game.u.utraptype = TT_PIT;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.u.utrap, 0);
});

test('a trapped hero cannot swap places with a pet', async () => {
    freshGameplayRoom();
    const dog = addPet({
        mnum: 16, x: 11, y: 10, hitPoints: 8,
    });
    game.u.utrap = 1;
    game.u.utraptype = TT_WEB;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual([dog.mx, dog.my], [11, 10]);
});

test('the hero can move while staying within a buried ball chain',
    async () => {
        const level = freshGameplayRoom();
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
    const level = freshGameplayRoom();
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

test('the invocation square reveals itself when the hero steps on it',
    async () => {
        const level = freshGameplayRoom();
        const square = addTrap(
            level, VIBRATING_SQUARE, 11, 10, { tseen: false },
        );
        game.dungeons = [{ num_dunlevs: 30, flags: { hellish: true } }];
        game.u.uz = { dnum: 0, dlevel: 29 };

        await rhack('l'.charCodeAt(0));

        assert.equal(square.tseen, true);
        assert.equal(game.u.uevent.uvibrated, 1);
        assert.equal(
            game._pending_message,
            'You feel a strange vibration under your feet.',
        );
    });

test('stepping on a fire trap burns the hero', async () => {
    const level = freshGameplayRoom();
    const trap = addTrap(level, FIRE_TRAP, 11, 10, { tseen: false });
    game.u.uhp = game.u.uhpmax = 40;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(trap.tseen, true);
    assert.ok(game.u.uhp < 40);
});

test('a missed arrow trap leaves its arrow on the floor', async () => {
    const level = freshGameplayRoom();
    const trap = addTrap(level, ARROW_TRAP, 11, 10, { tseen: false });
    game.u.uac = -20;

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW && object.where === 'floor',
    ));
});

test('a squeaky board wakes nearby monsters', async () => {
    const level = freshGameplayRoom();
    const trap = addTrap(level, SQKY_BOARD, 11, 10, {
        tseen: false,
        tnote: 0,
    });
    const sleeper = addMonster({
        species: 'jackal', x: 13, y: 10, msleeping: 1,
    });

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.equal(sleeper.msleeping, 0);
});

test('a falling-rock trap drops a rock and hurts the hero', async () => {
    const level = freshGameplayRoom();
    const trap = addTrap(level, ROCKTRAP, 11, 10, { tseen: false });
    game.u.uhp = game.u.uhpmax = 40;

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.ok(game.u.uhp < 40);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ROCK && object.where === 'floor',
    ));
});

test('sleeping gas stops a susceptible hero', async () => {
    const level = freshGameplayRoom();
    const trap = addTrap(level, SLP_GAS_TRAP, 11, 10, { tseen: false });

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.ok(game._helplessTurns >= 1 && game._helplessTurns <= 25);
    assert.equal(game._helplessReason, 'sleeping');
});

test('a rust trap can rust the helmet worn by the hero', async () => {
    const level = freshGameplayRoom();
    const helmet = addInventoryObject(ORCISH_HELM, {
        invlet: 'a', oeroded: 0,
    });
    wearHeroObject(helmet, 'uarmh', W_ARMH);
    const trap = addTrap(level, RUST_TRAP, 11, 10, { tseen: false });
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(trap.tseen, true);
    assert.equal(helmet.oeroded, 1);
});

test('enchanted iron shoes absorb an anti-magic field', async () => {
    const level = freshObjectRoom({
        hero: { uen: 20, uenmax: 20 },
    });
    const shoes = addInventoryObject(IRON_SHOES, { spe: 1 });
    wearHeroObject(shoes, 'uarmf', W_ARMF);
    const trap = addTrap(level, ANTI_MAGIC, 11, 10, { tseen: false });

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(trap.tseen, true);
    assert.equal(shoes.spe, 0);
    assert.deepEqual([game.u.uen, game.u.uenmax], [20, 20]);
});

test('an anti-magic field drains energy from an unprotected hero', async () => {
    const level = freshGameplayRoom({ energy: 20 });
    const trap = addTrap(level, ANTI_MAGIC, 11, 10, { tseen: false });
    const hitPoints = game.u.uhp;
    initRng(8201n);

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.equal(game.u.uhp, hitPoints);
    assert.ok(game.u.uen < 20);
    assert.ok(game.u.uenmax < 20);
});

test('wielding Magicbane turns an anti-magic field into an implosion',
    async () => {
        const level = freshObjectRoom({
            hero: { uen: 20, uenmax: 20 },
        });
        const artifact = artifactByName('Magicbane');
        const magicbane = addInventoryObject(artifact.baseType, { spe: 0 });
        nameArtifact(magicbane, artifact);
        magicbane.wielded = true;
        wearHeroObject(magicbane, 'uwep', W_WEP);
        const trap = addTrap(
            level, ANTI_MAGIC, 11, 10, { tseen: false },
        );
        const hitPoints = game.u.uhp;
        initRng(8202n);

        await rhack('l'.charCodeAt(0));

        assert.equal(trap.tseen, true);
        assert.ok(game.u.uhp < hitPoints);
        assert.ok(game.u.uen < 20);
        assert.ok(game.u.uenmax < 20);
    });

test('stepping on a statue trap releases its monster', async () => {
    const level = freshGameplayRoom();
    initRng(9402n);
    const statue = mkcorpstat(STATUE, null, 12, 11, 10, 0);
    addTrap(level, STATUE_TRAP, 11, 10, { tseen: false });

    await rhack('l'.charCodeAt(0));

    const released = level.monsters.find(monster => monster.mnum === 12);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
});

test('stepping into a magic portal moves the hero to its other end',
    async () => {
        const source = freshGameplayRoom();
        const destination = new GameMap();
        for (let x = 8; x <= 18; x++) {
            for (let y = 8; y <= 12; y++) {
                Object.assign(destination.at(x, y), {
                    typ: ROOM, lit: true, waslit: true, seenv: 255,
                });
            }
        }
        const sourcePortal = addTrap(source, MAGIC_PORTAL, 11, 10, {
            dst: { dnum: 0, dlevel: 2 }, tseen: false,
        });
        const destinationPortal = addTrap(destination, MAGIC_PORTAL, 15, 10, {
            dst: { dnum: 0, dlevel: 1 }, tseen: false,
        });
        game.u.uz = { dnum: 0, dlevel: 1 };
        game.dungeons = [{
            dname: 'The Dungeons of Doom', num_dunlevs: 2, flags: {},
        }];
        game._levelCache = new Map([[
            '0:2', { level: destination, stairs: null, heroTrack: [] },
        ]]);

        await rhack('l'.charCodeAt(0));

        assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 2 });
        assert.equal(game.level, destination);
        assert.deepEqual([game.u.ux, game.u.uy], [15, 10]);
        assert.equal(sourcePortal.tseen, true);
        assert.equal(destinationPortal.tseen, true);
    });
