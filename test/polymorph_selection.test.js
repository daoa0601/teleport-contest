import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { G_GENOD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, WAN_POLYMORPH, } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject } from './support/game-objects.js';
import { wearPolymorphControlRing } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
void test('wizard polymorph rejects a forbidden form and accepts the next choice', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('polyself\nMedusa\n');
    const changing = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /You can't polymorph into .*Medusa\./);
    assert.equal(game.u.umonnum, game.u.umonster);
    input.feed(' '); // getlin acknowledges rejection before accepting another form.
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^Become what kind of monster/);
    input.feed('newt\n');
    await changing;
    assert.equal(game.u.umonnum, nameToMonster('newt'));
    assert.equal(game.u.uconduct.polyselfs, 1);
    assert.equal(game.context.move, 0);
});
void test('cancelling wizard polymorph leaves the current body alone', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const health = game.u.uhp;
    pushKeys('polyself\n\x1b');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, health);
    assert.equal(game.u.uconduct.polyselfs ?? 0, 0);
});
void test('a selected monster class excludes its genocided members', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    for (const name of ['water nymph', 'mountain nymph']) {
        const vital = game.mvitals?.[nameToMonster(name)];
        assert.ok(vital);
        vital.mvflags |= G_GENOD;
    }
    pushKeys('polyself\nn\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.umonnum, nameToMonster('wood nymph'));
});
void test('a controlled polymorph wand lets a lycanthrope request its wolf form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_POLYMORPH, {
        spe: 3,
    });
    await wearPolymorphControlRing();
    game.u.ulycn = nameToMonster('werewolf');
    pushKeys(`${wand.invlet}.wolf\n                `);
    await rhack('z'.charCodeAt(0));
    assert.equal(game.u.umonnum, game.u.ulycn);
    assert.equal(wand.spe, 2);
    assert.equal(game.context.move, 1);
});
void test('dragon mail becomes skin and returns as scales after saving', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.plname = 'Dragon';
    const armor = await addInventoryObject(RED_DRAGON_SCALE_MAIL, {
        spe: 3, blessed: true,
    });
    await wearHeroArmor(armor);
    pushKeys('polyself\nred dragon\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uskin, armor);
    assert.equal(game.uarm, null);
    assert.equal(armor.otyp, RED_DRAGON_SCALES);
    assert.equal(game.u.umonnum, nameToMonster('red dragon'));
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Dragon', storage), true);
    const restoredArmor = game.inventory.find(object => object.otyp === RED_DRAGON_SCALES);
    assert.equal(game.uskin, restoredArmor);
    resetInputState();
    pushKeys('polyself\ncaveman\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.uskin, null);
    assert.equal(game.uarm, restoredArmor);
    assert.ok(restoredArmor != null);
    assert.equal(restoredArmor.spe, 3);
    assert.equal(restoredArmor.blessed, true);
});
void test('genocide prevents dragon armor from merging into the hero', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const dragon = nameToMonster('red dragon');
    const vital = game.mvitals?.[dragon];
    assert.ok(vital);
    vital.mvflags |= G_GENOD;
    const armor = await addInventoryObject(RED_DRAGON_SCALE_MAIL);
    await wearHeroArmor(armor);
    pushKeys('polyself\nred dragon\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.uarm, armor);
    assert.equal(armor.otyp, RED_DRAGON_SCALE_MAIL);
    assert.ok(!game.uskin);
});
//# sourceMappingURL=polymorph_selection.test.js.map