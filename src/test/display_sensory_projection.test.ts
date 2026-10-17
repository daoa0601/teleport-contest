import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, MOAT } from '../js/const.js';
import { canSenseMonster, flush_screen, glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('a cached telepathy range without a live source does not reveal an invisible hero', async () => {
    freshObjectRoom({ hero: { invisible: true, unblind_telepat_range: 64 } });

    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);

    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '.');
});

void test('temporary see invisible shows an adjacent invisible monster through a gas region', async () => {
    const level = freshObjectRoom({ hero: { seeInvisibleTurns: 10 } });
    const monster = await createMonsterAt('goblin', 11, 10);
    monster.minvis = 1;
    level.regions = [{ kind: 'gas-cloud', heroInside: false, visible: true, heroFault: false,
        damage: 0, ttl: 3, cells: [{ x: 11, y: 10 }], monsterIds: [] }];

    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, 'o');
});

void test('underwater newsym locates an adjacent monster over lava through blind telepathy', async () => {
    const level = freshObjectRoom({ hero: { telepathy: true } });
    const monster = await createMonsterAt('goblin', 11, 10);
    monster.minvis = 1;
    level.requireAt(10, 10).typ = MOAT;
    level.requireAt(11, 10).typ = LAVAPOOL;
    game.u.uinwater = 1;
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    assert.equal(canSenseMonster(monster), false);

    newsym(11, 10);

    assert.equal(glyphAt(11, 10)?.kind, 'monster');
});
