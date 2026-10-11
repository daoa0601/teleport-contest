import { installHeroChainedToBuriedBall } from './support/hero-state.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import {
    ANTI_MAGIC, ARROW_TRAP, FIRE_TRAP, MAGIC_PORTAL, PIT, ROCKTRAP, ROOM,
    SLP_GAS_TRAP, RUST_TRAP, SQKY_BOARD,
    TT_BURIEDBALL, TT_PIT, TT_WEB, STATUE_TRAP, Upolyd, VIBRATING_SQUARE,
} from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { GameMap } from '../js/game.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { createCorpstatAt } from '../js/mklev.js';
import {
    AMULET_OF_LIFE_SAVING, ARROW, HEAVY_IRON_BALL, IRON_SHOES, ORCISH_HELM,
    ROCK, SCR_IDENTIFY, STATUE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import {
    addInventoryObject, floorObject,
} from './support/game-objects.js';
import { wearHeroArmor } from '../js/armor.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { installPolymorphedHero } from './support/hero-state.js';

void test('escaping a web takes a movement attempt without moving the hero',
    async () => {
        freshGameplayRoom();
        requireFixtureGame(game);
        game.u.utrap = 1;
        game.u.utraptype = TT_WEB;

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.equal(game.u.utrap, 0);
    });

void test('climbing from a pit leaves the hero on the pit square', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.utrap = 1;
    game.u.utraptype = TT_PIT;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.u.utrap, 0);
});

void test('falling into a pit can destroy a monster body without hurting saved human health', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 1 });
    const health = game.u.uhp;
    addTrap(game.level, PIT, 11, 10);

    await rhack('l'.charCodeAt(0));

    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, health);
    assert.equal(!!game.program_state.gameover, false);
});

void test('a trapped hero cannot swap places with a pet', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog, { state: game });
    game.u.utrap = 1;
    game.u.utraptype = TT_WEB;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual([dog.mx, dog.my], [11, 10]);
});

void test('the hero can move while staying within a buried ball chain',
    async () => {
        const level = freshGameplayRoom();
        requireFixtureGame(game);
        await installHeroChainedToBuriedBall({ x: 10, y: 10 });
        game.u.utrap = 3;
        game.u.utraptype = TT_BURIEDBALL;
        vision_reset();

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game.u.utrap, 3);
    });

void test('pulling a buried ball free restores the ball and chain', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const ball = await installHeroChainedToBuriedBall({ x: 8, y: 10 });
    game.u.utrap = 1;
    game.u.utraptype = TT_BURIEDBALL;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.uball, ball);
    assert.ok(game.uchain);
    assert.ok(level.buriedObjects != null);
    assert.equal(level.buriedObjects.includes(ball), false);
});

void test('the invocation square reveals itself when the hero steps on it',
    async () => {
        const level = freshGameplayRoom();
        requireFixtureGame(game);
        const square = addTrap(
            level, VIBRATING_SQUARE, 11, 10, { tseen: false },
        );
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ num_dunlevs: 30, flags: { hellish: true } } })];
        game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
        game.u.uz = { dnum: 0, dlevel: 29 };

        await rhack('l'.charCodeAt(0));

        assert.equal(square.tseen, true);
        assert.ok(game.u.uevent != null);
        assert.equal(game.u.uevent.uvibrated, 1);
        assert.equal(
            game._pending_message,
            'You feel a strange vibration under your feet.',
        );
    });

void test('stepping on a fire trap burns the hero', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const trap = addTrap(level, FIRE_TRAP, 11, 10, { tseen: false });
    game.u.uhp = game.u.uhpmax = 40;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(trap.tseen, true);
    assert.ok(game.u.uhp < 40);
});

void test('a missed arrow trap leaves its arrow on the floor', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const trap = addTrap(level, ARROW_TRAP, 11, 10, { tseen: false });
    game.u.uac = -20;

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW && object.where === 'floor',
    ));
});

void test('a squeaky board wakes nearby monsters', async () => {
    const level = freshGameplayRoom();
    const trap = addTrap(level, SQKY_BOARD, 11, 10, {
        tseen: false,
        tnote: 0,
    });
    const sleeper = await createMonsterAt('jackal', 13, 10);
    sleeper.msleeping = 1;

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.equal(sleeper.msleeping, 0);
});

void test('a falling-rock trap drops a rock and hurts the hero', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const trap = addTrap(level, ROCKTRAP, 11, 10, { tseen: false });
    game.u.uhp = game.u.uhpmax = 40;

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.ok(game.u.uhp < 40);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ROCK && object.where === 'floor',
    ));
});

void test('sleeping gas stops a susceptible hero', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const trap = addTrap(level, SLP_GAS_TRAP, 11, 10, { tseen: false });

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.ok((game._helplessTurns ?? 0) >= 1 && (game._helplessTurns ?? 0) <= 25);
    assert.equal(game._helplessReason, 'sleeping');
});

void test('a rust trap can rust the helmet worn by the hero', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const helmet = await addInventoryObject(ORCISH_HELM, {
        invlet: 'a', oeroded: 0,
    });
    wearHeroArmor(helmet);
    const trap = addTrap(level, RUST_TRAP, 11, 10, { tseen: false });
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(trap.tseen, true);
    assert.equal(helmet.oeroded, 1);
});

void test('enchanted iron shoes absorb an anti-magic field', async () => {
    const level = freshObjectRoom({
        hero: { uen: 20, uenmax: 20 },
    });
    requireFixtureGame(game);
    const shoes = await addInventoryObject(IRON_SHOES, { spe: 1 });
    wearHeroArmor(shoes);
    const trap = addTrap(level, ANTI_MAGIC, 11, 10, { tseen: false });

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(trap.tseen, true);
    assert.equal(shoes.spe, 0);
    assert.deepEqual([game.u.uen, game.u.uenmax], [20, 20]);
});

void test('an anti-magic field drains energy from an unprotected hero', async () => {
    const level = freshGameplayRoom({ energy: 20 });
    requireFixtureGame(game);
    const trap = addTrap(level, ANTI_MAGIC, 11, 10, { tseen: false });
    const hitPoints = game.u.uhp;
    initRng(8201n);

    await rhack('l'.charCodeAt(0));

    assert.equal(trap.tseen, true);
    assert.equal(game.u.uhp, hitPoints);
    assert.ok(game.u.uen < 20);
    assert.ok(game.u.uenmax < 20);
});

void test('wielding Magicbane turns an anti-magic field into an implosion',
    async () => {
        const level = freshObjectRoom({
            hero: { uen: 20, uenmax: 20 },
        });
        requireFixtureGame(game);
        const artifact = artifactByName('Magicbane');
        assert.ok(artifact !== null && artifact !== undefined);
        const magicbane = await addInventoryObject(artifact.baseType, { spe: 0 });
        nameArtifact(magicbane, artifact);
        await setPrimaryWeapon(magicbane);
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

void test('stepping on a statue trap releases its monster', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    initRng(9402n);
    const statue = await createCorpstatAt(STATUE, null, 12, 11, 10, 0);
    addTrap(level, STATUE_TRAP, 11, 10, { tseen: false });
    // The live floor-look announcement must be acknowledged before the
    // statue's activation message can replace it.
    pushKeys(' ');

    await rhack('l'.charCodeAt(0));

    const released = level.monsters.find(monster => monster.mnum === 12);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
});

void test('stepping into a magic portal moves the hero to its other end',
    async () => {
        const source = freshGameplayRoom();
        requireFixtureGame(game);
        const destination = new GameMap();
        for (let x = 8; x <= 18; x++) {
            for (let y = 8; y <= 12; y++) {
                const location = destination.requireAt(x, y);
                location.typ = ROOM;
                location.lit = true;
                location.waslit = true;
                location.seenv = 255;
            }
        }
        const sourcePortal = addTrap(source, MAGIC_PORTAL, 11, 10, {
            dst: { dnum: 0, dlevel: 2 }, tseen: false,
        });
        const destinationPortal = addTrap(destination, MAGIC_PORTAL, 15, 10, {
            dst: { dnum: 0, dlevel: 1 }, tseen: false,
        });
        game.u.uz = { dnum: 0, dlevel: 1 };
        game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom', num_dunlevs: 2, flags: {},
        })];
        game._levelCache = new Map([[
            '0:2', { level: destination, stairs: null, heroTrack: [], savedAt: game.moves },
        ]]);

        const input = resetInputState();
        const movement = rhack('l'.charCodeAt(0));
        await input.waitUntilBlocked();
        const text = requireGameDisplay(game).grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /You activated a magic portal!--More--/);
        input.feed(' ');
        await movement;

        assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 2 });
        assert.equal(game.level, destination);
        assert.deepEqual([game.u.ux, game.u.uy], [15, 10]);
        assert.equal(sourcePortal.tseen, true);
        assert.equal(destinationPortal.tseen, true);
    });

for (const lifesaving of [false, true] as const) {
    void test(`walking into a fire trap ${lifesaving ? 'resumes floor burning after life saving' : 'stops floor burning and movement bookkeeping on death'}`, async () => {
        const level = freshObjectRoom({
            hero: { uhp: 1, uhpmax: 80 }, flags: { pickup: false },
        });
        requireFixtureGame(game);
        addTrap(level, FIRE_TRAP, 11, 10);
        const paper = await floorObject(SCR_IDENTIFY, 11, 10, { quan: 40, quantity: 40 });
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);

        await rhack('l'.charCodeAt(0));

        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(game.context.move, lifesaving ? 1 : 0);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok(paper.quan < 40, 'the surviving trap really burns the floor stack');
        } else {
            assert.equal(game._deathKiller, 'tower of flame');
            assert.equal(paper.quan, 40);
        }
    });
}
