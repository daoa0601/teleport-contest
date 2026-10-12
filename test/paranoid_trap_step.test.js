import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { PARANOID_CONFIRM, PARANOID_TRAP, PIT, TT_WEB, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('declining a known web consumes no turn and leaves the hero outside it', async () => {
    const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP } });
    requirePlayingGame(game);
    addTrap(level, WEB, 11, 10, { tseen: true });
    const input = resetInputState();
    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /Really step into that web\? \[yn\] \(n\)/, keys: 'n' },
    ]);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.utrap ?? 0, 0);
    assert.equal(game.context.move, 0);
});
void test('accepting a known web enters it and spends the movement turn', async () => {
    const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP } });
    requirePlayingGame(game);
    addTrap(level, WEB, 11, 10, { tseen: true });
    const input = resetInputState();
    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /Really step into that web\?/, keys: 'y' },
    ]);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.utraptype, TT_WEB);
    assert.ok((game.u.utrap ?? 0) > 0);
    assert.equal(game.context.move, 1);
});
void test('confirm paranoia requires a full answer before entering a known trap', async () => {
    const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP | PARANOID_CONFIRM } });
    requirePlayingGame(game);
    addTrap(level, WEB, 11, 10, { tseen: true });
    const input = resetInputState();
    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /Really step into that web\? \[yes\|no\]/, keys: 'no\r' },
    ]);
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 0);
});
for (const reason of ['unknown', 'deliberate', 'spider']) {
    void test(`a ${reason} web step needs no trap confirmation`, async () => {
        const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP } });
        requirePlayingGame(game);
        addTrap(level, WEB, 11, 10, { tseen: reason !== 'unknown' });
        if (reason === 'spider')
            installPolymorphedHero('cave spider');
        const input = resetInputState();
        if (reason === 'deliberate')
            input.feed('l');
        await rhack((reason === 'deliberate' ? 'm' : 'l').charCodeAt(0));
        assert.equal(input.isBlocked, false);
        assert.equal(game.u.ux, 11);
        if (reason === 'spider')
            assert.equal(game.u.utrap ?? 0, 0);
    });
}
void test('levitation is clearly immune to a known pit', async () => {
    const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP } });
    requirePlayingGame(game);
    addTrap(level, PIT, 11, 10, { tseen: true });
    grantIntrinsicProperty('levitation', 'outside');
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.utrap ?? 0, 0);
});
void test('a visible cloud is confirmed before a known trap on the same square', async () => {
    const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP } });
    requirePlayingGame(game);
    createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }], { ttl: 10 });
    addTrap(level, WEB, 11, 10, { tseen: true });
    const input = resetInputState();
    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /Step into that vapor cloud\? \[yn\] \(n\)/, keys: 'n' },
    ]);
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=paranoid_trap_step.test.js.map