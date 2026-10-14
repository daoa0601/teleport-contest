import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { W_AMUL } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, BAG_OF_HOLDING, EGG, SACK, WAN_CANCELLATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

for (const { action, eggs, triggeringBag } of [
    { action: 'apply', eggs: 1, triggeringBag: false },
    { action: 'apply', eggs: 3, triggeringBag: true },
    { action: 'tip', eggs: 1, triggeringBag: false },
]) {
    void test(`a fatal scattered pyrolisk egg ends ${action} before bag cleanup (${eggs} eggs)`, async () => {
        freshPlayableRoom({
            hero: { uhp: 1, uhpmax: 100, urexp: 100, uz: { dnum: 0, dlevel: 9 } },
            flags: { bones: true, disclose: '-i -a -v -c -o', tombstone: false },
        });
        game.storage = memoryStorage();
        game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom', num_dunlevs: 20, bonetag: 'D',
        })];
        const bag = await addInventoryObject(BAG_OF_HOLDING, {
            invlet: 'a', initialize: false, cknown: true,
        });
        const trigger = await addInventoryObject(triggeringBag ? BAG_OF_HOLDING
            : action === 'tip' ? SACK : WAN_CANCELLATION, {
            invlet: 'b', initialize: false, spe: 1,
        });
        const explodingBag = triggeringBag ? trigger : bag;
        const egg = await knownObject(EGG, {
            initialize: false, quantity: eggs, corpsenm: MONSTER_NAME.indexOf('pyrolisk'),
            where: 'contained', container: explodingBag,
        });
        explodingBag.contents = [egg];
        if (action === 'tip') {
            const wand = await knownObject(WAN_CANCELLATION, {
                initialize: false, spe: 1, where: 'contained', container: trigger,
            });
            trigger.contents = [wand];
        }
        initRng(1n);

        if (action === 'apply') await applyInventoryObject(bag, 'sb' + ' '.repeat(100));
        else await runExtendedCommand('tip', 'ba' + ' '.repeat(100));

        assert.equal(game.program_state.gameover, true);
        assert.equal(loadScoreRecords()[0]?.death, 'killed by a fireball',
            'The scattered egg kills the hero before the bag explosion can deal damage.');
        assert.equal(explodingBag.in_use, true, 'Bones creation must omit the exploding bag.');
        if (triggeringBag) assert.notEqual(bag.where, 'gone',
            'Death while scattering the inner bag stops before the outer bag is destroyed.');
    });
}

void test('life saving from a scattered egg lets the bag explosion finish', async () => {
    freshPlayableRoom({ hero: { uhp: 1, uhpmax: 100 } });
    requirePlayingGame(game);
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cknown: true,
    });
    const egg = await knownObject(EGG, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('pyrolisk'),
        where: 'contained', container: bag,
    });
    bag.contents = [egg];
    await addInventoryObject(WAN_CANCELLATION, { invlet: 'b', spe: 1 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'c', worn: true, owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    initRng(1n);

    await applyInventoryObject(bag, 'sb' + ' '.repeat(20));

    assert.equal(amulet.where, 'gone');
    assert.equal(bag.where, 'gone');
    assert.ok(game.u.uhp > 0 && game.u.uhp < 100,
        'The rescued hero takes the remaining bag explosion damage.');
    assert.equal(!!game.program_state.gameover, false);
});
