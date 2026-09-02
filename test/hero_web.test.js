import test from 'node:test';
import assert from 'node:assert/strict';

import { PIT, POOL, WEB } from '../js/const.js';
import { game } from '../js/gstate.js';
import { useHeroWeb } from '../js/hero_web.js';
import { DART, ROCK } from '../js/object_data.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { addMonster } from './support/monsters.js';

function webAtHero() {
    return game.level.traps.find(trap =>
        trap.tx === game.u.ux && trap.ty === game.u.uy
        && trap.ttyp === WEB);
}

test('a giant spider can spin a web', async () => {
    freshRoomWithPolymorphedHero('giant spider');

    await runMonsterAbilityCommand();

    assert.equal(webAtHero()?.madeby_u, 1);
    assert.equal(game.context.move, 1);
});

test('a cave spider can choose hiding instead of spinning', async () => {
    freshRoomWithPolymorphedHero('cave spider');
    floorObject(ROCK, game.u.ux, game.u.uy);

    await runMonsterAbilityCommand('h');

    assert.equal(game.u.uundetected, 1);
    assert.equal(webAtHero(), undefined);
});

test('a spider cannot anchor a web in water', async () => {
    const level = freshRoomWithPolymorphedHero('giant spider');
    level.at(game.u.ux, game.u.uy).typ = POOL;

    await runMonsterAbilityCommand();

    assert.equal(webAtHero(), undefined);
    assert.equal(game.context.move, 0);
});

test('webbing over a pit removes it and buries its contents', async () => {
    const level = freshRoomWithPolymorphedHero('giant spider');
    const dart = floorObject(DART, game.u.ux, game.u.uy);
    level.traps.push({
        tx: game.u.ux, ty: game.u.uy, ttyp: PIT, tseen: true,
    });

    await runMonsterAbilityCommand();

    assert.equal(level.traps.length, 0);
    assert.equal(dart.buried, true);
    assert.equal(game.context.move, 1);
});

test('web fluid makes an animal release a swallowed spider', async () => {
    freshRoomWithPolymorphedHero('giant spider', {
        left: 2,
        right: 24,
        top: 4,
        bottom: 16,
        gameplaySeed: 918,
    });
    const worm = addMonster({
        species: 'purple worm',
        x: game.u.ux,
        y: game.u.uy,
    });
    game.u.uswallow = 1;
    game.u.ustuck = worm;

    const result = await useHeroWeb({ state: game });

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.notDeepEqual([worm.mx, worm.my], [game.u.ux, game.u.uy]);
    assert.equal(result.spentTime, false);
});
