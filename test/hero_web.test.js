import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PIT, POOL, STONE, WEB } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { useHeroWeb } from '../js/hero_web.js';
import { pushKeys } from '../js/input.js';
import { DART, ROCK } from '../js/object_data.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshMonsterAbilityRoom, installPunishedHero, installSwallowedHero, } from './support/hero-state.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
function webAtHero() {
    return requireGameLevel(game).traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
        && trap.ttyp === WEB);
}
void test('a giant spider can spin a web', async () => {
    freshMonsterAbilityRoom('giant spider');
    requireFixtureGame(game);
    await runMonsterAbilityCommand();
    assert.equal(webAtHero()?.madeby_u, 1);
    assert.equal(game.context.move, 1);
});
void test('a cave spider can choose hiding instead of spinning', async () => {
    freshMonsterAbilityRoom('cave spider');
    requireFixtureGame(game);
    await floorObject(ROCK, game.u.ux, game.u.uy);
    await runMonsterAbilityCommand('h');
    assert.equal(game.u.uundetected, 1);
    assert.equal(webAtHero(), undefined);
});
void test('a spider cannot anchor a web in water', async () => {
    const level = freshMonsterAbilityRoom('giant spider');
    requireFixtureGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    await runMonsterAbilityCommand();
    assert.equal(webAtHero(), undefined);
    assert.equal(game.context.move, 0);
});
void test('webbing over a pit removes it and buries its contents', async () => {
    const level = freshMonsterAbilityRoom('giant spider');
    requireFixtureGame(game);
    const dart = await floorObject(DART, game.u.ux, game.u.uy);
    addTrap(level, PIT, game.u.ux, game.u.uy, { tseen: true });
    await runMonsterAbilityCommand();
    assert.equal(level.traps.length, 0);
    assert.equal(dart.buried, true);
    assert.equal(game.context.move, 1);
});
void test('web fluid makes an animal release a swallowed spider', async () => {
    freshMonsterAbilityRoom('giant spider', {
        right: 24,
        gameplaySeed: 918,
    });
    requireFixtureGame(game);
    const worm = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    installSwallowedHero(worm);
    pushKeys('                ');
    const result = await useHeroWeb({ state: game });
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.notDeepEqual([worm.mx, worm.my], [game.u.ux, game.u.uy]);
    assert.equal(result.spentTime, false);
});
void test('an expelled worm finds room beyond the nearby blocked squares', async () => {
    const level = freshMonsterAbilityRoom('giant spider', { right: 26 });
    requireFixtureGame(game);
    const x = game.u.ux;
    const y = game.u.uy;
    const worm = await createMonsterAt('purple worm', x + 4, y);
    worm.mspec_used = 7;
    installSwallowedHero(worm);
    for (let nx = x - 3; nx <= x + 3; nx++) {
        for (let ny = y - 3; ny <= y + 3; ny++) {
            if (nx !== x || ny !== y)
                level.requireAt(nx, ny).typ = STONE;
        }
    }
    pushKeys('                ');
    await useHeroWeb();
    assert.equal(game.u.uswallow, 0);
    assert.ok(Math.max(Math.abs(worm.mx - x), Math.abs(worm.my - y)) > 3);
    assert.equal(worm.mspec_used, 7, 'release must not shorten an existing cooldown');
});
void test('expulsion restores the punishment ball and chain to the floor', async () => {
    const level = freshMonsterAbilityRoom('giant spider');
    requireFixtureGame(game);
    const { ball, chain } = await installPunishedHero();
    const worm = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    installSwallowedHero(worm);
    assert.ok(!floorObjectsAt(level, game.u.ux, game.u.uy).includes(chain));
    pushKeys('                                ');
    await useHeroWeb();
    const pile = floorObjectsAt(level, game.u.ux, game.u.uy);
    assert.ok(pile.includes(ball));
    assert.ok(pile.includes(chain));
    assert.equal(game.uball, ball);
    assert.equal(game.uchain, chain);
});
//# sourceMappingURL=hero_web.test.js.map