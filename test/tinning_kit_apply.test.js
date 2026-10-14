import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEMADE_TIN, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, OBJECT_NAMES, TIN, TINNING_KIT } from '../js/object_data.js';
import { grantIntrinsicProperty, grantWornProperty } from '../js/properties.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a blessed tinning kit preserves one carried corpse as a known homemade tin', async () => {
    freshPlayableRoom();
    const kit = await addInventoryObject(TINNING_KIT, { blessed: true, spe: 2 });
    const species = MONSTER_NAME.indexOf('newt');
    const corpse = await addInventoryObject(CORPSE, { corpsenm: species, quan: 2 });
    await applyInventoryObject(kit, corpse.invlet);
    const tin = game.inventory.find(object => object.otyp === TIN);
    assert.ok(tin);
    assert.equal(tin.corpsenm, species);
    assert.equal(tin.blessed, true);
    assert.equal(tin.known, true);
    assert.equal(tin.spe, -(HOMEMADE_TIN + 1));
    assert.equal(corpse.quan, 1);
    assert.equal(kit.spe, 1);
    assert.equal(game.context.move, 1);
});
void test('a tinning kit offers a corpse underfoot and uses one from the floor stack', async () => {
    freshPlayableRoom();
    const kit = await addInventoryObject(TINNING_KIT, { spe: 2 });
    const corpse = await floorObject(CORPSE, game.u.ux, game.u.uy, { corpsenm: MONSTER_NAME.indexOf('newt'), quan: 2 });
    await applyInventoryObject(kit, 'y');
    assert.equal(corpse.quan, 1);
    assert.equal(corpse.where, 'floor');
    assert.ok(game.inventory.some(object => object.otyp === TIN));
    assert.equal(kit.spe, 1);
});
for (const blind of [false, true]) {
    void test(`the floor tinning prompt reveals a corpse's blessing to a ${blind ? 'blind' : 'sighted'} priest`, async () => {
        freshPlayableRoom({ role: 'priest', hero: { permaBlind: blind } });
        const kit = await addInventoryObject(TINNING_KIT, { spe: 2 });
        const corpse = await floorObject(CORPSE, game.u.ux, game.u.uy, {
            corpsenm: MONSTER_NAME.indexOf('newt'), blessed: true, bknown: false, dknown: false,
        });
        let prompt = '';
        resetInputState().beforeRead = () => {
            if (game._pending_message.includes('here; tin'))
                prompt = game._pending_message;
        };
        await runExtendedCommand('apply', `${kit.invlet}q`);
        assert.equal(corpse.bknown, true, 'the priest observes beatitude even when declining to tin');
        assert.equal(corpse.dknown, !blind);
        assert.match(prompt, /There is a blessed newt corpse here; tin it\?/);
        assert.equal(corpse.where, 'floor');
        assert.equal(kit.spe, 2);
    });
}
void test('an empty tinning kit takes time without selecting or consuming a corpse', async () => {
    freshPlayableRoom();
    const kit = await addInventoryObject(TINNING_KIT, { spe: 0 });
    await applyInventoryObject(kit);
    assert.equal(game._pending_message, 'You seem to be out of tins.');
    assert.equal(game.context.move, 1);
});
for (const blind of [false, true]) {
    void test(`a ${blind ? 'blind' : 'sighted'} priest recognizes the blessing of a freshly made tin before dropping it`, async () => {
        const level = freshPlayableRoom({ role: 'priest', hero: { permaBlind: blind } });
        grantIntrinsicProperty('fumbling', 'outside');
        const kit = await addInventoryObject(TINNING_KIT, { blessed: true, spe: 2 });
        const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('newt') });
        await runExtendedCommand('apply', `${kit.invlet}${corpse.invlet}`);
        const tin = level.objects[game.u.ux]?.[game.u.uy]?.find(object => object.otyp === TIN);
        assert.ok(tin, 'fumbling must drop the newly made tin');
        assert.equal(tin.bknown, true, 'the priest must recognize its blessing when it is named');
        assert.match(game._pending_message, /You make, but cannot pick up, a blessed tin/);
        assert.equal(tin.dknown, !blind);
        assert.equal(kit.spe, 1);
        assert.equal(game.context.move, 1);
    });
}
for (const floorSpecies of [[], ['newt'], ['newt', 'lichen']]) {
    void test(`a tinning kit reports no ${floorSpecies.length ? 'other ' : ''}corpse after declining ${floorSpecies.length} floor corpses`, async () => {
        freshPlayableRoom();
        const kit = await addInventoryObject(TINNING_KIT, { spe: 2 });
        for (const species of floorSpecies) {
            await floorObject(CORPSE, game.u.ux, game.u.uy, {
                corpsenm: MONSTER_NAME.indexOf(species),
            });
        }
        await runExtendedCommand('apply', `${kit.invlet}${'n'.repeat(floorSpecies.length)}`);
        assert.equal(game._pending_message, floorSpecies.length ? "You don't have anything else to tin." : "You don't have anything to tin.");
        assert.equal(kit.spe, 2);
        assert.equal(game.inventory.some(object => object.otyp === TIN), false);
        assert.equal(game.context.move, 1);
    });
}
for (const source of ['intrinsic', 'amulet']) {
    void test(`a flying hero with magical breathing from an ${source} can tin a corpse beneath water`, async () => {
        const level = freshPlayableRoom();
        level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        grantIntrinsicProperty('flying', 'outside');
        if (source === 'intrinsic') {
            grantIntrinsicProperty('magicalBreathing', 'outside');
        }
        else {
            const amulet = await addInventoryObject(OBJECT_NAMES.indexOf('amulet of magical breathing'));
            game.uamul = amulet;
            grantWornProperty('magicalBreathing', amulet, 'uamul');
        }
        const kit = await addInventoryObject(TINNING_KIT, { spe: 2 });
        const corpse = await floorObject(CORPSE, game.u.ux, game.u.uy, {
            corpsenm: MONSTER_NAME.indexOf('newt'), quan: 2,
        });
        await runExtendedCommand('apply', `${kit.invlet}y`);
        assert.ok(game.inventory.some(object => object.otyp === TIN));
        assert.equal(corpse.quan, 1);
        assert.equal(kit.spe, 1);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=tinning_kit_apply.test.js.map