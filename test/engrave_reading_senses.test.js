import test from 'node:test';
import assert from 'node:assert/strict';
import { BURN, DUST, ENGRAVE, ENGR_BLOOD, GRAVE, HEADSTONE, MARK } from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { autopickupAtHero } from '../js/pickup.js';
import { makeBlinded } from '../js/sight_change.js';
import { freshObjectRoom } from './support/object-room.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requireFixtureGame } from './support/game-state.js';
// C engrave.c read_engr_at(): each engraving type announces itself with its
// own surface phrasing before the text is read on arrival.
for (const scenario of [
    { name: 'graffiti', type: MARK, line: 'There\'s some graffiti on the floor here.  You read: "Elbereth".' },
    { name: 'a scrawled blood message', type: ENGR_BLOOD, line: 'You see a message scrawled in blood here.  You read: "Elbereth".' },
    { name: 'a headstone epitaph', type: HEADSTONE, terrain: GRAVE, line: 'Something is engraved here on the headstone.  You read: "Elbereth".' },
    { name: 'a carved engraving', type: ENGRAVE, line: 'Something is engraved here on the floor.  You read: "Elbereth".' },
    { name: 'burned text', type: BURN, line: 'Some text has been burned into the floor here.  You read: "Elbereth".' },
]) {
    void test(`arrival reads ${scenario.name}`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        if (scenario.terrain !== undefined) {
            game.level.requireAt(game.u.ux, game.u.uy).typ = scenario.terrain;
        }
        makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth', null, 0, scenario.type);
        await autopickupAtHero();
        assert.equal(game._pending_message, scenario.line);
    });
}
// C read_engr_at(): a blind reader feels carvable words (ENGRAVE, BURN,
// HEADSTONE) instead of reading them.
void test('a blind hero feels the engraved words', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth', null, 0, ENGRAVE);
    await makeBlinded(50, { talk: false });
    const input = resetInputState();
    await answerPrompts(autopickupAtHero(), input, [
        { prompt: /Something is engraved here on the floor\.--More--/, keys: ' ' },
    ]);
    assert.equal(game._pending_message, 'You feel the words: "Elbereth".');
});
// C read_engr_at() DUST case: the sense requires sight, so a blind hero
// crossing dust learns nothing at all.
void test('a blind hero notices nothing written in the dust', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth', null, 0, DUST);
    await makeBlinded(50, { talk: false });
    resetInputState();
    await autopickupAtHero();
    assert.equal(game._pending_message ?? '', '');
});
//# sourceMappingURL=engrave_reading_senses.test.js.map