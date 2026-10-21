import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { A_INT, MENU_TRADITIONAL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyPotionLikeInvisibility, heroIsInvisible, zapHeroInvisible } from '../js/hero_invisibility.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { MUMMY_WRAPPING, SPE_INVISIBILITY, WAN_MAKE_INVISIBLE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { learnSpell } from './support/spells.js';

void test('blocked invisibility names the actual wrapping worn by the caster', async () => {
    freshObjectRoom({ role: 'wizard', flags: { menu_style: MENU_TRADITIONAL },
        hero: { ulevel: 30, uen: 100, uenmax: 100 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_INT] = 18;
    await learnSpell(SPE_INVISIBILITY);
    const wrapping = await addInventoryObject(MUMMY_WRAPPING, { oextra: { oname: 'Linen' } });
    wearHeroArmor(wrapping);
    resetInputState().feed('a');

    await rhack('Z'.charCodeAt(0));

    assert.equal(game._lastPlineMessage, 'You feel rather itchy under your mummy wrapping named Linen.');
    assert.equal(heroIsInvisible(), false);
    assert.equal(game.u.invisibleTurns ?? 0, 0);
    assert.equal(game.u.uen, 80);
    assert.equal(game.context.move, 1);
});

void test('a self-directed invisibility wand also names the wrapping absorbing it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const wrapping = await addInventoryObject(MUMMY_WRAPPING, { oextra: { oname: 'Linen' } });
    wearHeroArmor(wrapping);
    const wand = await addInventoryObject(WAN_MAKE_INVISIBLE, { spe: 2 });
    resetInputState().feed(`${wand.invlet}.`);

    await rhack('z'.charCodeAt(0));

    assert.equal(game._lastPlineMessage, 'You feel rather itchy under your mummy wrapping named Linen.');
    assert.equal(wand.spe, 1);
    assert.equal(heroIsInvisible(), false);
    assert.equal(game.u.invisibleTurns ?? 0, 0);
    assert.equal(game.context.move, 1);
});

for (const source of ['spell', 'wand'] as const) {
    void test(`a sleeping hero dreams of the named wrapping absorbing an invisibility ${source}`, async () => {
        freshObjectRoom();
        const wrapping = await addInventoryObject(MUMMY_WRAPPING, { oextra: { oname: 'Linen' } });
        wearHeroArmor(wrapping);
        await putHeroToSleep(5);

        if (source === 'spell') await applyPotionLikeInvisibility({ spell: true });
        else await zapHeroInvisible();

        assert.equal(game._lastPlineMessage, 'You dream that you feel rather itchy under your mummy wrapping named Linen.');
        assert.equal(heroIsInvisible(), false);
        assert.equal(game.u.invisibleTurns ?? 0, 0);
    });
}
