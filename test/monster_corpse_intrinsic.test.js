import test from 'node:test';
import assert from 'node:assert/strict';
import { W_ARM, W_ARMC } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { clearMessageWindow } from '../js/tty_topline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { changeMonsterForm, grantMonsterCorpseIntrinsic } from '../js/mon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { removeObjectFromMonsterInventory } from '../js/monworn.js';
import { monsterResistsSleep } from '../js/mondata.js';
import { MUMMY_WRAPPING, RED_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { monsterHasAcidResistance, monsterHasColdResistance, monsterHasDisintegrationResistance, monsterHasFireResistance, monsterHasPoisonResistance, monsterHasShockResistance, monsterHasStoneResistance, } from '../js/mondata.js';
const species = (name) => MONSTER_NAME.indexOf(name);
for (const [corpse, resists, message] of [
    ['red dragon', monsterHasFireResistance, 'shivers slightly'],
    ['white dragon', monsterHasColdResistance, 'looks quite warm'],
    ['orange dragon', monsterResistsSleep, 'looks wide awake'],
    ['black dragon', monsterHasDisintegrationResistance, 'looks very firm'],
    ['blue dragon', monsterHasShockResistance, 'crackles with static electricity'],
    ['green dragon', monsterHasPoisonResistance, 'looks healthy'],
]) {
    void test(`${corpse} flesh gives a monster lasting resistance`, async () => {
        await freshObjectRoom();
        const eater = await createMonsterAt('little dog', 11, 10);
        await grantMonsterCorpseIntrinsic(eater, species(corpse));
        assert.equal(resists(eater), true);
        assert.match(game._pending_message, new RegExp(message));
        clearMessageWindow();
        await grantMonsterCorpseIntrinsic(eater, species(corpse));
        assert.equal(game._pending_message, '', 'Already intrinsic resistance has no new feedback.');
    });
}
void test('flesh grants intrinsic resistance even when armor already supplies it', async () => {
    await freshObjectRoom();
    const eater = await createMonsterAt('hobbit', 11, 10);
    const armor = await equipMonsterObject(eater, await knownObject(RED_DRAGON_SCALE_MAIL), W_ARM);
    await grantMonsterCorpseIntrinsic(eater, species('red dragon'));
    assert.match(game._pending_message, /shivers slightly/);
    await removeObjectFromMonsterInventory(eater, armor);
    assert.equal(monsterHasFireResistance(eater), true);
});
void test('an innate resistance can be retained from flesh after polymorph', async () => {
    await freshObjectRoom();
    const eater = await createMonsterAt('red dragon', 11, 10);
    await grantMonsterCorpseIntrinsic(eater, species('red dragon'));
    assert.equal(game._pending_message, '', 'Natural resistance suppresses the gain message.');
    await changeMonsterForm(eater, species('little dog'));
    assert.equal(eater.mnum, species('little dog'));
    assert.equal(monsterHasFireResistance(eater), true);
});
void test('yellow dragon flesh cannot give monsters temporary acid or stone resistance', async () => {
    await freshObjectRoom();
    const eater = await createMonsterAt('little dog', 11, 10);
    await grantMonsterCorpseIntrinsic(eater, species('yellow dragon'));
    assert.equal(monsterHasAcidResistance(eater), false);
    assert.equal(monsterHasStoneResistance(eater), false);
    assert.equal(game._pending_message, '');
});
void test('stalker flesh makes a visible eater permanently invisible and stunned', async () => {
    await freshObjectRoom();
    const eater = await createMonsterAt('little dog', 11, 10);
    assert.equal(canSeeMonster(eater), true);
    await grantMonsterCorpseIntrinsic(eater, species('stalker'));
    assert.equal(!!eater.perminvis, true);
    assert.equal(canSeeMonster(eater), false);
    assert.equal(!!eater.mstun, true);
    assert.match(game._pending_message, /vanishes\./);
});
void test('stalker flesh flickers through mummy wrapping and appears when it is removed', async () => {
    await freshObjectRoom();
    const eater = await createMonsterAt('hobbit', 11, 10);
    const wrapping = await equipMonsterObject(eater, await knownObject(MUMMY_WRAPPING), W_ARMC);
    await grantMonsterCorpseIntrinsic(eater, species('stalker'));
    assert.equal(canSeeMonster(eater), true);
    assert.match(game._pending_message, /seems to flicker\./);
    await removeObjectFromMonsterInventory(eater, wrapping);
    assert.equal(canSeeMonster(eater), false);
    assert.equal(!!eater.perminvis, true);
});
void test('a hero who sees invisible monsters observes the stalker change', async () => {
    await freshObjectRoom({ hero: { seeInvisible: true } });
    const eater = await createMonsterAt('little dog', 11, 10);
    await grantMonsterCorpseIntrinsic(eater, species('stalker'));
    assert.equal(canSeeMonster(eater), true);
    assert.match(game._pending_message, /becomes invisible\./);
});
void test('a dead eater gains neither invisibility nor stun from stalker flesh', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const eater = await createMonsterAt('little dog', 11, 10);
    eater.mhp = 0;
    await grantMonsterCorpseIntrinsic(eater, species('stalker'));
    assert.equal(!!eater.perminvis, false);
    assert.equal(!!eater.mstun, false);
});
//# sourceMappingURL=monster_corpse_intrinsic.test.js.map