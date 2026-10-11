import test from 'node:test';
import assert from 'node:assert/strict';
import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { CORPSTAT_INIT, M_AP_NOTHING, M_AP_TYPE, NON_PM, NO_MINVENT, ROOM } from '../js/const.js';
import { reviveCorpseByMagic } from '../js/corpse_revival.js';
import { canSeeMonster, flush_screen, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createCorpstatAt } from '../js/mklev.js';
import { cancelMonster } from '../js/monster_cancellation.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { beginMonsterMealMimicry } from '../js/monster_meal_mimicry.js';
import { changeMonsterForm, restoreMonsterShape } from '../js/monster_polymorph.js';
import { CORPSE, RIN_PROTECTION_FROM_SHAPE_CHANGERS, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { animateStatue } from '../js/statue_trap.js';
import { isHumanWereMonster } from '../js/were.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoomLevel } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
void test('restoring a chameleon re-enables shape changes after protection was removed elsewhere', async () => {
    const savedLevel = freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    const monster = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(monster.cham, NON_PM);
    game.level = createRoomLevel();
    await removeHeroAccessory(ring);
    game.level = savedLevel;
    const moves = game.moves;
    await restoreMonsterShape(monster);
    assert.equal(monster.cham, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(game.moves, moves, 'Restoring permission does not advance a turn.');
});
void test('protection gained elsewhere restores the returning monster and displays its change', async () => {
    const savedLevel = freshObjectRoom();
    const monster = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    game.level = createRoomLevel();
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    game.level = savedLevel;
    await restoreMonsterShape(monster);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(monster.cham, NON_PM);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /The little dog turns into a chameleon!/);
});
void test('a restored cancelled shapechanger returns to its base form and stays cancelled', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    monster.mcan = 1;
    await restoreMonsterShape(monster);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(monster.cham, NON_PM);
    assert.equal(!!monster.mcan, true);
    await restoreMonsterShape(monster);
    assert.equal(monster.cham, NON_PM, 'Cancellation still prevents changing shape on a later restore.');
});
void test('an active shapechanger keeps its current form when restored without protection', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    await restoreMonsterShape(monster);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('little dog'));
    assert.equal(monster.cham, MONSTER_NAME.indexOf('chameleon'));
});
void test('a cancelled beast-form werecreature returns to human form during restoration', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt(MONSTER_NAME.indexOf('werewolf'), 11, 10, NO_MINVENT);
    monster.mcan = 1;
    monster.mhp = 8;
    monster.mhpmax = 24;
    monster.mcanmove = 0;
    monster.mfrozen = 3;
    await restoreMonsterShape(monster);
    assert.equal(isHumanWereMonster(monster), true);
    assert.equal(!!monster.mcan, true);
    assert.equal(monster.mhp, 12);
    assert.equal(monster.mcanmove, 1);
    assert.equal(monster.mfrozen, 0);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /changes into a human/);
});
void test('a cancelled unseen mimic is revealed and put to sleep when restored', async () => {
    const level = freshObjectRoom();
    level.requireAt(30, 15).typ = ROOM;
    const mimic = await createMonsterAt('small mimic', 30, 15, NO_MINVENT);
    assert.notEqual(M_AP_TYPE(mimic), M_AP_NOTHING);
    assert.equal(canSeeMonster(mimic), false);
    mimic.mcan = 1;
    await restoreMonsterShape(mimic);
    assert.equal(M_AP_TYPE(mimic), M_AP_NOTHING);
    assert.equal(!!mimic.msleeping, true);
});
void test('restoration with new protection ends a borrowed meal disguise without putting the pet to sleep', async () => {
    const savedLevel = freshObjectRoom();
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    pet.msleeping = 0;
    pet.meating = 4;
    initRng(1n);
    const input = resetInputState();
    await answerPrompts(beginMonsterMealMimicry(pet), input, [
        { prompt: /kitten appear[\s\S]*--More--/, keys: ' ' },
    ]);
    game.level = createRoomLevel();
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    game.level = savedLevel;
    await restoreMonsterShape(pet);
    assert.equal(pet.meating, 0);
    assert.equal(M_AP_TYPE(pet), M_AP_NOTHING);
    assert.equal(!!pet.msleeping, false);
});
void test('restoration without protection leaves an ordinary mimic disguise intact', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    assert.notEqual(M_AP_TYPE(mimic), M_AP_NOTHING);
    await restoreMonsterShape(mimic);
    assert.notEqual(M_AP_TYPE(mimic), M_AP_NOTHING);
    assert.equal(mimic.cham, NON_PM);
});
void test('cancellation reports a visible return to natural form after acknowledging earlier prose', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    await plineWithContinuation('The little dog bares its teeth and growls menacingly.');
    const input = resetInputState();
    const result = await answerPrompts(cancelMonster(monster, { attackLevel: 20 }), input, [
        { prompt: /little dog bares its teeth[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(result.cancelled, true);
    assert.equal(result.changedShape, true);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(!!monster.mcan, true);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /The little dog turns into a chameleon!/);
});
for (const bodyType of [CORPSE, STATUE]) {
    void test(`restoring saved ${bodyType === CORPSE ? 'corpse' : 'statue'} traits visibly normalizes a protected shapechanger`, async () => {
        freshObjectRoom();
        const original = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
        await changeMonsterForm(original, MONSTER_NAME.indexOf('little dog'));
        const body = await createCorpstatAt(bodyType, original, original.mnum, 11, 10, CORPSTAT_INIT);
        await removeMonsterFromGame(original);
        const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
        await wearHeroAccessory(ring, 'uleft');
        const input = resetInputState();
        const restored = bodyType === CORPSE
            ? await answerPrompts(reviveCorpseByMagic(body), input, [])
            : await answerPrompts(animateStatue(body, 11, 10, { magic: true }), input, [
                { prompt: /The little dog turns into a chameleon![\s\S]*--More--/, keys: ' ' },
            ]);
        assert.ok(restored?.monster);
        assert.equal(restored.monster.mnum, MONSTER_NAME.indexOf('chameleon'));
        assert.equal(restored.monster.cham, NON_PM);
        assert.equal(body.where, 'gone');
        if (bodyType === CORPSE) {
            await flush_screen(1);
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /The little dog turns into a chameleon!/);
        }
    });
}
//# sourceMappingURL=monster_restore_shape.test.js.map