import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_CON, NON_PM, TT_LAVA } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive, setPropertyTimeout } from '../js/properties.js';
import { resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function lifeSavingRoom() {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const input = resetInputState();
    installPagerInput(input, { expected: /amulet|die|But wait|medallion|much better/i, limit: 12 });
    await flushPendingTopline();
    return amulet;
}

for (const level of [1, 18]) {
    void test(`life saving repairs a drained maximum HP at level ${level}`, async () => {
        const amulet = await lifeSavingRoom();
        game.u.ulevel = level;
        game.u.uhp = game.u.uhpmax = 1;
        game.u.uhppeak = 4;

        assert.equal(await loseHeroHp(3, 'falling rock'), false);

        assert.equal(game.u.uhpmax, Math.max(10, level));
        assert.equal(game.u.uhp, Math.max(10, level));
        assert.equal(game.u.uhppeak, Math.max(10, level));
        assert.equal(amulet.where, 'gone');
        assert.equal(game.u.umortality, 1);
    });
}

void test('life saving uses effective Constitution and respects sustained abilities', async () => {
    await lifeSavingRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 300;
    game.u.abon = { a: [0, 0, 0, 0, 6, 0] };
    grantIntrinsicProperty('sustainAbility', 'outside');

    assert.equal(await loseHeroHp(301, 'falling rock'), false);

    assert.equal(game.u.acurr.a[A_CON], 12);
    assert.equal(game.u.uhp, 140);
});

void test('life saving cures imminent sickness, releases lava, and clears intrinsic Unchanging', async () => {
    await lifeSavingRoom();
    game.u.sick = true;
    game.u.sickType = 3;
    game.u.sickTurns = 1;
    game.u.sickCause = 'tainted meat';
    game.u.utrap = 8;
    game.u.utraptype = TT_LAVA;
    grantIntrinsicProperty('unchanging', 'outside');
    setPropertyTimeout('unchanging', 20);
    game.u.ugrave_arise = 230;

    assert.equal(await loseHeroHp(100, 'falling rock'), false);

    assert.equal(game.u.sickTurns, 0);
    assert.equal(game.u.sick, false);
    assert.equal(game.u.sickCause, undefined);
    assert.equal(game.u.utrap, 0);
    assert.equal(propertyIsActive('unchanging'), false);
    assert.equal(game.u.ugrave_arise, NON_PM);
    assert.equal(game.multi, -1);
    assert.equal(game._helplessDoneMessage, 'You survived that attempt on your life.');
});

void test('a life-saved Tourist has the native Fate helplessness reason', async () => {
    freshObjectRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const input = resetInputState();
    installPagerInput(input, { expected: /amulet|die|But wait|medallion|much better/i, limit: 12 });

    assert.equal(await loseHeroHp(100, 'falling rock'), false);

    assert.equal(game._helplessReason, 'being toyed with by Fate');
});
