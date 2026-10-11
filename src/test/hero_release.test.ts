import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { unplaceBallAndChain } from '../js/ball.js';
import { rhack } from '../js/cmd.js';
import { PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { releaseHeroFromMonster } from '../js/hero_expulsion.js';
import { pushKeys } from '../js/input.js';
import { punishHero } from '../js/punishment.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('release from a holder lets the hero walk without moving the monster', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const mimic = await createMonsterAt('large mimic', 11, 10);
    game.u.ustuck = mimic;

    await releaseHeroFromMonster(mimic);
    await rhack('h'.charCodeAt(0));

    assert.equal(game.u.ux, 9);
    assert.equal(mimic.mx, 11);
    assert.equal(mimic.my, 10);
});

void test('release from swallowing replaces punishment without expulsion or a landing', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    pushKeys('                    ');
    await punishHero();
    const engulfer = await createMonsterAt('air elemental', 11, 10);
    engulfer.mx = game.u.ux;
    engulfer.my = game.u.uy;
    game.u.ustuck = engulfer;
    game.u.uswallow = game.uswallow = 1;
    game._monsterSwallower = engulfer;
    unplaceBallAndChain();
    addTrap(game.level, PIT, engulfer.mx, engulfer.my);

    await releaseHeroFromMonster(engulfer);
    const storage = memoryStorage();
    game.plname = 'Released';
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Released', storage), true);

    assert.equal(game.u.ustuck, null);
    assert.equal(!!game.u.uswallow, false);
    assert.equal(!!game.uswallow, false);
    assert.ok(game.uchain && game.uball);
    assert.equal(game.uchain.where, 'floor');
    assert.equal(game.uball.where, 'floor');
    assert.equal(game.uchain.ox, game.u.ux);
    assert.equal(game.uchain.oy, game.u.uy);
    assert.equal(engulfer.mx, game.u.ux);
    assert.equal(engulfer.my, game.u.uy);
    assert.equal(game.u.utrap || 0, 0);
});

void test('releasing another monster does not free the hero from a holder', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const holder = await createMonsterAt('large mimic', 11, 10);
    const other = await createMonsterAt('orc', 13, 10);
    game.u.ustuck = holder;

    await releaseHeroFromMonster(other);

    assert.equal(game.u.ustuck, holder);
    assert.equal(holder.mx, 11);
});
