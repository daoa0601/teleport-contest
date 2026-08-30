import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { vision_reset_new_level } from '../js/vision.js';
import {
    roleOutcome, freshRoleOutcome,
} from './support/role-outcome.js';
import { installLiveCommandHero } from './support/live-command-state.js';

function freshKnightArena() {
    resetGame();
    const level = new GameMap();
    for (let x = 8; x <= 14; x++) {
        for (let y = 8; y <= 12; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM, lit: true, waslit: true, seenv: 255,
            });
        }
    }
    installLiveCommandHero({ role: 'knight', level, x: 10, y: 10 });
    vision_reset_new_level();
    game.inventory = [];
    game.animationFrame = async () => {};
    resetInputState();
    initRng(46001n);
    return level;
}

function pony(overrides = {}) {
    return {
        mnum: 100,
        name: 'pony',
        mx: 11,
        my: 10,
        mhp: 8,
        mhpmax: 8,
        mtame: 20,
        mpeaceful: true,
        pet: true,
        saddled: true,
        minvent: [],
        edog: { hungrytime: 1001 },
        ...overrides,
    };
}

async function extended(command, suffix = '') {
    pushKeys(`${command}\n${suffix}`);
    await rhack('#'.charCodeAt(0));
}

test('mount and voluntary dismount preserve the live pony identity', async () => {
    const level = freshKnightArena();
    const steed = pony();
    level.monsters = [steed];

    await extended('ride', 'l');

    assert.equal(game.u.usteed, steed);
    assert.equal(level.monsters.includes(steed), false);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /mount the saddled pony/);

    await extended('ride');

    assert.equal(game.u.usteed, null);
    assert.equal(level.monsters.filter(monster => monster === steed).length, 1);
    assert.deepEqual([steed.mx, steed.my], [11, 10]);
    assert.equal(
        Math.abs(game.u.ux - steed.mx) + Math.abs(game.u.uy - steed.my),
        1,
    );
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /pony with no name/);
});

test('an unsaddled pony rejects riding without time or state mutation',
    async () => {
        const level = freshKnightArena();
        const target = pony({ saddled: false });
        level.monsters = [target];
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await extended('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /not saddled/);
    });

test('a saddled but untamed pony refuses the mount without injuring the hero',
    async () => {
        const level = freshKnightArena();
        const target = pony({ mtame: 0, pet: false });
        level.monsters = [target];
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await extended('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /would mind/);
    });

test('chat derives a pony response from its current tame and hunger state',
    async () => {
        const level = freshKnightArena();
        const target = pony();
        level.monsters = [target];

        await extended('chat', 'l');

        assert.equal(game.context.move, 1);
        assert.equal(level.monsters[0], target);
        assert.deepEqual([target.mx, target.my, target.mhp], [11, 10, 8]);
        assert.match(game._pending_message, /pony whickers\.$/i);
    });

test('fresh Knight prayer completes through live occupation turns', async () => {
    const input = moves => ({
        role: 'Knight', race: 'human', gender: 'male', align: 'lawful',
        seed: 46003, datetime: '20260830110000', moves,
    });
    const startup = await roleOutcome(input(' '));
    const prayed = await roleOutcome(input(' #pray\ny'));

    assert.equal(prayed.gnosticConduct, startup.gnosticConduct + 1);
    assert.equal(prayed.moves, startup.moves + 3);
    assert.match(
        prayed.message,
        /^You begin praying to .+\.  You finish your prayer\.$/,
    );
});

test('fresh Knight waits schedule current actors without moving the hero',
    async () => {
        const input = moves => ({
            role: 'Knight', race: 'human', gender: 'male', align: 'lawful',
            seed: 46010, datetime: '20260830121000', moves,
        });
        const startup = await roleOutcome(input(' '));
        const waited = await roleOutcome(input(' ....'));

        assert.deepEqual(waited.hero, startup.hero);
        assert.equal(waited.moves, startup.moves + 4);
        assert.notDeepEqual(waited.actors, startup.actors);
    });

test('the former Knight prefix cannot select a future-input world engine',
    async () => {
        const input = moves => ({
            role: 'Knight', race: 'human', gender: 'male', align: 'lawful',
            seed: 46007, datetime: '20260830120000', moves,
        });
        const startup = (await freshRoleOutcome(input(' '))).world;
        const outcome = (await freshRoleOutcome(input('  ns#ride\nl '))).world;
        const distance = Math.abs(outcome.hero[0] - startup.hero[0])
            + Math.abs(outcome.hero[1] - startup.hero[1]);

        // Two directional commands and one adjacent mount transaction cannot
        // legitimately relocate a hero outside this physical command bound.
        assert.ok(distance <= 3);
        assert.ok(outcome.moves <= startup.moves + 4);
        assert.deepEqual(
            outcome.actors.map(actor => actor.species).sort((a, b) => a - b),
            startup.actors.map(actor => actor.species).sort((a, b) => a - b),
        );
    });
