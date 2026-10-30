import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, NOT_HUNGRY } from '../js/const.js';
import { doeat } from '../js/eat.js';
import { flush_screen, glyphAt } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { expelHero } from '../js/hero_expulsion.js';
import { resetInputState } from '../js/input.js';
import { FOOD_RATION } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { addInventoryObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const peaceful of [false, true]) {
    void test(`expulsion ${peaceful ? 'allows eating beside a peaceful' : 'stops eating beside a hostile'} engulfer`, async () => {
        await freshObjectRoom({ hero: { uhunger: 400, uhs: NOT_HUNGRY } });
        requirePlayingGame(game);
        const trapper = await createMonsterAt('trapper', 11, 10, MM_NOGRP | NO_MINVENT);
        trapper.mpeaceful = peaceful ? 1 : 0;
        await installSwallowedHero(trapper);
        const food = await addInventoryObject(FOOD_RATION, { age: game.moves });
        const input = resetInputState();
        installPagerInput(input, { expected: /ration|released/, limit: 4 });
        input.feed(food.invlet);
        await doeat();
        const nutrition = food.oeaten;
        await expelHero(trapper);
        assert.equal(game.u.uswallow, 0);
        assert.equal(food.oeaten, nutrition, 'expulsion does not take another bite');
        if (peaceful)
            assert.equal(game._occupation?.key, 'eat-food');
        else {
            assert.equal(game._occupation, null);
            assert.equal(game._lastPlineMessage, 'You stop eating the food ration.');
        }
    });
}
void test('expulsion keeps the hallucinated engulfer seen when eating was interrupted', async () => {
    await freshObjectRoom({ hero: { uhunger: 400, uhs: NOT_HUNGRY, hallucinationTurns: 100 } });
    requirePlayingGame(game);
    applyNethackrc('MSGTYPE=stop "You stop eating"');
    const trapper = await createMonsterAt('trapper', 11, 10, MM_NOGRP | NO_MINVENT);
    trapper.mpeaceful = 0;
    await installSwallowedHero(trapper);
    const food = await addInventoryObject(FOOD_RATION, { age: game.moves });
    const input = resetInputState();
    installPagerInput(input, { expected: /ration|released|satiates/, limit: 4 });
    input.feed(food.invlet);
    await doeat();
    const arrivalGlyphs = [];
    input.beforeRead = () => {
        if (game._pending_message === 'You stop eating the food ration.') {
            const glyph = glyphAt(trapper.mx, trapper.my);
            assert.ok(glyph?.glyph !== undefined);
            arrivalGlyphs.push(glyph.glyph);
        }
    };
    await expelHero(trapper, { message: false });
    await flush_screen(1);
    assert.equal(arrivalGlyphs.length, 1);
    assert.equal(glyphAt(trapper.mx, trapper.my)?.glyph, arrivalGlyphs[0], 'the completed expulsion must retain the engulfer shown at the interruption');
});
//# sourceMappingURL=occupation_expulsion.test.js.map