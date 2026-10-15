import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hasIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a lucky charm makes a throne curse blind the hero rather than curse possessions', async () => {
    const level = freshObjectRoom({ hero: { uluck: 0, moreluck: 3 } });
    level.requireAt(10, 10).typ = THRONE;
    initRng(41n);
    await runExtendedCommand('sit', ' '.repeat(15));
    assert.ok((game.u.blindTurns ?? 0) >= 250);
    assert.ok((game.u.uluck ?? 0) < 0);
});
void test('see-invisible from a monster form does not replace the permanent throne reward', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    installPolymorphedHero('stalker');
    assert.equal(hasIntrinsicProperty('seeInvisible', 'form'), true);
    assert.equal(hasIntrinsicProperty('seeInvisible', 'outside'), false);
    initRng(34n);
    await runExtendedCommand('sit', ' '.repeat(15));
    assert.equal(hasIntrinsicProperty('seeInvisible', 'outside'), true);
    assert.match(game._pending_message, /Your vision becomes clear/);
});
void test('bonus luck can turn the threatening throne effect into a teleport', async () => {
    const level = freshObjectRoom({ hero: { uluck: -1, moreluck: 3 } });
    level.requireAt(10, 10).typ = THRONE;
    initRng(25n);
    await runExtendedCommand('sit', ' '.repeat(15));
    assert.ok(game.u.ux !== 10 || game.u.uy !== 10);
});
//# sourceMappingURL=throne_luck_sources.test.js.map