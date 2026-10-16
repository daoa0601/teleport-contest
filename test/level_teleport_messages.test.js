import test from 'node:test';
import assert from 'node:assert/strict';
import { MARK } from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { levelTeleport } from '../js/level_teleport.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
void test('an endgame Amulet grant is acknowledged once and preserves the shop departure message', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    // The Wizard is elsewhere, so arrival has no resurrection pager.
    game.context.no_of_wizards = 1;
    game.dungeons.push(createDungeon({ dname: 'The Elemental Planes', num_dunlevs: 5, depth_start: -5 }));
    game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.specialLevels = new Map([['earth', createSpecialLevel({ dnum: 1, dlevel: 5 })]]);
    const levels = game._levelCache;
    assert.ok(levels);
    const cached = levels.get('0:2');
    assert.ok(cached);
    levels.set('1:5', cached);
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    shopkeeper.eshk.debit = 12;
    shopkeeper.eshk.credit = 12;
    const input = resetInputState();
    await answerPrompts(completeLevelTeleport({ menuRequested: true }), input, [
        { prompt: /Level teleport to where:/, keys: 'a' },
        { prompt: /Endgame prerequisite: .*the Amulet of Yendor\.--More--/, keys: ' ' },
        { prompt: /Your credit of 12 zorkmids is used to cover your shopping bill\.--More--/, keys: ' ' },
    ]);
    assert.equal(game.level, destination);
    assert.equal(game.u.uhave?.amulet, 1);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(game._pending_message, 'You materialize on a different level!');
});
void test('level teleport announces materialization before reading an arrival engraving', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    game.level = destination;
    makeEngravingAt(13, 10, 'Beware the monsters lurking below.', null, 0, MARK);
    game.level = source;
    const input = resetInputState();
    await answerPrompts(completeLevelTeleport(), input, [
        { prompt: /To what level do you want to teleport\?/, keys: '2\r' },
        { prompt: /You materialize on a different level!--More--/, keys: ' ' },
        { prompt: /There's some graffiti on the floor here\.--More--/, keys: ' ' },
    ]);
    assert.equal(game.level, destination);
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game._pending_message, 'You read: "Beware the monsters lurking below."');
});
void test('level teleport announces materialization before the shopkeeper welcomes the hero', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    game.level = destination;
    game.u.uz = { dnum: 0, dlevel: 2 };
    const { shopkeeper } = await createStaffedShop({ left: 12, right: 16, keeperX: 15 });
    game.level = source;
    game.u.uz = { dnum: 0, dlevel: 1 };
    const input = resetInputState();
    await answerPrompts(completeLevelTeleport(), input, [
        { prompt: /To what level do you want to teleport\?/, keys: '2\r' },
        { prompt: /You materialize on a different level!--More--/, keys: ' ' },
    ]);
    assert.equal(game.level, destination);
    assert.match(game._pending_message, /Welcome to/);
    assert.equal(shopkeeper.eshk.visitct, 1);
});
async function completeLevelTeleport(options = {}) {
    await levelTeleport(options);
    await finishScheduledLevelChange();
}
//# sourceMappingURL=level_teleport_messages.test.js.map