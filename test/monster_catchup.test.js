import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_MONSTER, M_AP_NOTHING, MIGR_EXACT_XY, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMealMimicry } from '../js/monster_meal_mimicry.js';
import { catchUpMonster, deliverMigratingMonsters, migrateMonsterOffLevel } from '../js/monster_migration.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { beginPetEating, finishPetEating } from '../js/pet_eating.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function pet(species = 'little dog', x = 11, y = 10) {
    const monster = await createMonsterAt(species, x, y, NO_MINVENT);
    initializePet(monster);
    return monster;
}
async function disguisedEatingDog() {
    const dog = await pet();
    dog.meating = 4;
    newsym(dog.mx, dog.my);
    initRng(1n);
    const input = resetInputState();
    await answerPrompts(beginMonsterMealMimicry(dog), input, [{
            prompt: /You see a kitten appear where your little dog was!.*--More--/s,
            keys: ' ',
        }]);
    return dog;
}
void test('catch-up leaves the final blindness, paralysis and flight turn for active recovery', async () => {
    freshObjectRoom({ moves: 100 });
    const monster = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    monster.mblinded = 8;
    monster.mcansee = 0;
    monster.mfrozen = 9;
    monster.mcanmove = 0;
    monster.mfleetim = 10;
    monster.mflee = 1;
    monster.mspec_used = 20;
    game.moves += 12;
    catchUpMonster(monster, 12, game);
    assert.equal(monster.mblinded, 1);
    assert.equal(monster.mcansee, 0);
    assert.equal(monster.mfrozen, 1);
    assert.equal(monster.mcanmove, 0);
    assert.equal(monster.mfleetim, 1);
    assert.equal(monster.mflee, 1);
    assert.equal(monster.mspec_used, 8);
    assert.equal(monster.mlstmv, 112);
});
void test('a short absence cannot clear trapped, confused or stunned trouble', async () => {
    freshObjectRoom({ moves: 100 });
    const monster = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    monster.mtrapped = monster.mconf = monster.mstun = 1;
    game.moves += 5;
    catchUpMonster(monster, 5, game);
    assert.equal(monster.mtrapped, 1);
    assert.equal(monster.mconf, 1);
    assert.equal(monster.mstun, 1);
});
void test('exactly finishing a meal during catch-up preserves the native disguise boundary', async () => {
    freshObjectRoom({ moves: 100 });
    const dog = await disguisedEatingDog();
    const appearance = dog.mappearance;
    game.moves += 4;
    catchUpMonster(dog, 4, game);
    assert.equal(dog.meating, 0);
    assert.equal(dog.m_ap_type, M_AP_MONSTER);
    assert.equal(dog.mappearance, appearance);
});
void test('a migrating pet whose meal ended earlier returns in its actual shape', async () => {
    freshObjectRoom({ moves: 100 });
    requirePlayingGame(game);
    const dog = await disguisedEatingDog();
    await migrateMonsterOffLevel(dog, game, { dst: { ...game.u.uz } }, {
        mode: MIGR_EXACT_XY, coordinate: { x: 11, y: 10 },
    });
    game.moves += 6; // mon_arrive catches up five completed moves.
    assert.equal(await deliverMigratingMonsters(game), 1);
    assert.equal(dog.meating, 0);
    assert.equal(dog.m_ap_type, M_AP_NOTHING);
    assert.ok(game.level.monsters.includes(dog));
    const glyph = glyphAt(dog.mx, dog.my);
    assert.ok(glyph?.kind === 'monster');
    assert.equal(glyph.mnum, dog.mnum);
});
void test('finishing a natural mimic\'s meal does not erase its ordinary disguise', async () => {
    freshObjectRoom({ moves: 100 });
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    const appearance = mimic.mappearance;
    const appearanceType = mimic.m_ap_type;
    assert.ok(appearanceType);
    mimic.meating = 4;
    game.moves += 5;
    catchUpMonster(mimic, 5, game);
    assert.equal(mimic.meating, 0);
    assert.equal(mimic.m_ap_type, appearanceType);
    assert.equal(mimic.mappearance, appearance);
});
void test('a starving pet goes feral before absence healing can conceal its weakness', async () => {
    freshObjectRoom({ moves: 1000 });
    const weak = await pet();
    const stronger = await pet('little dog', 12, 10);
    assert.ok(weak.edog && stronger.edog);
    weak.edog.hungrytime = stronger.edog.hungrytime = 1000;
    weak.mhp = 2;
    stronger.mhp = 3;
    weak.mhpmax = stronger.mhpmax = 20;
    game.moves += 501;
    catchUpMonster(weak, 501, game);
    catchUpMonster(stronger, 501, game);
    assert.equal(weak.mtame, 0);
    assert.equal(weak.mpeaceful, 0);
    assert.equal(weak.mhp, 20);
    assert.equal(stronger.mtame, 7);
    assert.equal(stronger.mpeaceful, 1);
    assert.equal(stronger.mhp, 20);
});
void test('ordinary and regenerating monsters heal at their native absence rates', async () => {
    freshObjectRoom({ moves: 100 });
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const troll = await createMonsterAt('troll', 12, 10, NO_MINVENT);
    goblin.mhp = troll.mhp = 1;
    goblin.mhpmax = troll.mhpmax = 40;
    game.moves += 20;
    catchUpMonster(goblin, 20, game);
    catchUpMonster(troll, 20, game);
    assert.equal(goblin.mhp, 2);
    assert.equal(troll.mhp, 21);
});
void test('a very long absence advances a long coin meal only by the native catch-up limit', async () => {
    freshObjectRoom({ moves: 100 });
    const xorn = await pet('xorn');
    assert.ok(xorn.edog);
    xorn.edog.hungrytime = game.moves;
    const gold = await floorObject(GOLD_PIECE, 11, 10, { quan: 66_000_000 });
    await finishPetEating(xorn, beginPetEating(xorn, gold, { x: 11, y: 10 }));
    assert.equal(xorn.meating, 33001);
    game.moves += 50_000;
    catchUpMonster(xorn, 50_000, game);
    assert.equal(xorn.meating, 235);
    assert.equal(xorn.mlstmv, 50100);
});
//# sourceMappingURL=monster_catchup.test.js.map