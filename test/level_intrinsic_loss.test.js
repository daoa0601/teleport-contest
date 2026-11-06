import assert from 'node:assert/strict';
import test from 'node:test';
import { finishHeroHelplessness } from '../js/hack.js';
import { PARANOID_PRAY } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function experiencedTourist() {
    await freshObjectRoom({
        role: 'tourist',
        flags: { debug: true, paranoia_bits: PARANOID_PRAY },
        hero: { ulevel: 19, ulevelmax: 19, uhp: 100, uhpmax: 100 },
    });
    installPagerInput(resetInputState(), {
        expected: /experienced|experience level|hardy/, limit: 5,
    });
    await runExtendedCommand('levelchange', '20\n');
    assert.equal(game.u.ulevel, 20);
    assert.equal(propertyIsActive('poisonResistance'), true, 'Tourists gain poison resistance at level 20');
}
async function angryPrayer(anger, seed) {
    requirePlayingGame(game);
    game.u.ugangr = anger;
    game.u.ublesscnt = 0;
    initRng(seed);
    const input = resetInputState();
    await answerPrompts(runExtendedCommand('pray'), input, [
        { prompt: /Are you sure you want to pray\?/, keys: 'y' },
        { prompt: /You begin praying to The Lady\./, keys: ' ' },
        { prompt: /Force the gods to be pleased\?/, keys: 'n' },
    ]);
    const pages = [];
    installPagerInput(input, {
        expected: /prayer|voice|Thou|glow|sick|foolish|level|hardy/,
        limit: 10, pages,
    });
    await finishHeroHelplessness();
    return [...pages.map(page => page.split('\n').slice(0, 3).join('\n')),
        game._pending_message].join('\n');
}
void test('divine level drain removes a Tourist\'s level-20 poison resistance', async () => {
    await experiencedTourist();
    const messages = await angryPrayer(1, 4n);
    assert.equal(game.u.ulevel, 19);
    assert.equal(propertyIsActive('poisonResistance'), false);
    assert.match(messages, /You feel less hardy!/);
});
void test('divine level drain announces the lost level ability even after a curse removed it', async () => {
    await experiencedTourist();
    const curseMessages = await angryPrayer(2, 5n);
    assert.match(curseMessages, /You feel a little sick!/);
    assert.equal(game.u.ulevel, 20);
    assert.equal(propertyIsActive('poisonResistance'), false);
    const messages = await angryPrayer(1, 4n);
    assert.equal(game.u.ulevel, 19);
    assert.equal(propertyIsActive('poisonResistance'), false);
    assert.match(messages, /You feel less hardy!/);
});
void test('divine level drain preserves poison resistance acquired independently of experience', async () => {
    await experiencedTourist();
    grantIntrinsicProperty('poisonResistance', 'outside');
    const messages = await angryPrayer(1, 4n);
    assert.equal(game.u.ulevel, 19);
    assert.equal(propertyIsActive('poisonResistance'), true);
    assert.doesNotMatch(messages, /You feel less hardy!/);
});
//# sourceMappingURL=level_intrinsic_loss.test.js.map