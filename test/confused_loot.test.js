import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, POT_HEALING } from '../js/object_data.js';
import { THRONE } from '../js/const.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { floorObjectsAt } from './support/level-state.js';
for (const blind of [false, true]) {
    void test(`confused old-loot feedback ${blind ? 'keeps an unseen potion unobserved while blind' : 'reveals an unseen potion appearance'}`, async () => {
        freshPlayableRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        game.objectDescriptions = [];
        game.objectDescriptions[POT_HEALING] = 'pink';
        const potion = await addInventoryObject(POT_HEALING, {
            invlet: 'a', initialize: false, observed: false,
            known: false, typeKnown: false, dknown: false, bknown: false,
        });
        game.u.confusionTurns = 10;
        initRng(2n);
        await runExtendedCommand('loot');
        assert.equal(game._pending_message, `You find old loot: a - ${blind ? 'a potion' : 'a pink potion'}.`);
        assert.equal(potion.dknown, !blind);
        assert.equal(game.context.move, 1);
    });
}
void test('confused looting can leave a contribution of carried gold on the floor', async () => {
    const level = freshPlayableRoom();
    setHeroGoldAmount(game, 100);
    game.u.confusionTurns = 10;
    initRng(1n);
    await runExtendedCommand('loot', ' '.repeat(10));
    assert.equal(heroGoldAmount(game), 80);
    assert.equal(floorObjectsAt(level, 10, 10).find(object => object.oclass === 12)?.quan, 20);
    assert.equal(game.context.move, 1);
});
void test('a confused throne contribution goes to the royal coffers and locks the chest', async () => {
    const level = freshPlayableRoom();
    level.requireAt(10, 10).typ = THRONE;
    const coffers = await floorObject(CHEST, 13, 10, {
        initialize: false, olocked: false, obroken: true, cknown: true, spe: 2,
    });
    setHeroGoldAmount(game, 100);
    game.u.confusionTurns = 10;
    initRng(1n);
    await runExtendedCommand('loot', ' '.repeat(10));
    assert.equal(heroGoldAmount(game), 80);
    assert.equal(coffers.contents?.find(object => object.oclass === 12)?.quan, 20);
    assert.equal(coffers.olocked, true);
    assert.equal(coffers.obroken, false);
    assert.equal(coffers.cknown, false);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=confused_loot.test.js.map