import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { G_EXTINCT, G_GENOD } from '../js/const.js';
import { makeFamiliar } from '../js/familiar.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { FIGURINE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';
void test('the familiar spell creates a waking tame actor with no generated inventory', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    initRng(42n);
    const monster = await makeFamiliar();
    assert.ok(monster);
    assert.ok(game.level.monsters.includes(monster));
    assert.ok((monster.mtame ?? 0) > 0);
    assert.equal(monster.mpeaceful, 1);
    assert.equal(monster.msleeping, 0);
    assert.ok(monster.edog !== null && monster.edog !== undefined);
    assert.ok(monster.edog.hungrytime >= game.moves + 1000);
    assert.equal(game.u.uconduct.pets, 1);
    assert.ok(monster.minvent !== null && monster.minvent !== undefined);
    assert.equal(monster.minvent.length, 0);
    assert.notDeepEqual([monster.mx, monster.my], [game.u.ux, game.u.uy]);
});
void test('an unavailable familiar produces the native refusal without creating an actor', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    for (let species = 0; species < SPECIAL_PM; species++)
        game.mvitals[species] = { born: 0, died: 0, mvflags: G_GENOD };
    initRng(42n);
    const monster = await makeFamiliar();
    assert.equal(monster, null);
    assert.equal(game.level.monsters.length, 0);
    assert.match(game._last_message, /nothing available for a familiar/);
    assert.equal(game.u.uconduct.pets ?? 0, 0);
});
void test('a figurine cannot bypass the special Nazgul birth limit and announces dust', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const species = MONSTER_NAME.indexOf('Nazgul');
    const figurine = await knownObject(FIGURINE, { corpsenm: species });
    game.mvitals[species] = { born: 9, died: 0, mvflags: G_EXTINCT };
    assert.equal(await makeFamiliar(figurine, 11, 10), null);
    assert.match(game._last_message, /into a pile of dust/);
    assert.equal(game.level.monsters.length, 0);
});
//# sourceMappingURL=familiar.test.js.map