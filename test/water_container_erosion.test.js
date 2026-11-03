import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNTAIN, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/mkobj.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { waterDamageChain } from '../js/trap.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('dipping a carried sack in a fountain reports rust on its contained daggers', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    game.level.flags.nfountains = 1;
    const sack = await addInventoryObject(SACK);
    const daggers = await knownObject(DAGGER, { quan: 2 });
    await addCreatedObjectToContainer(sack, daggers);
    resetInputState();
    initRng(1n);
    await runExtendedCommand('dip', sack.invlet + 'y' + ' '.repeat(20));
    assert.equal(daggers.oeroded, 1);
    // C trap.c:water_damage(): pline("Some %s gets into your %s!", hliquid("water"), ostr);
    // precedes water_damage_chain(obj->cobj, FALSE).
    assert.equal(game._pending_message, 'Some water gets into your sack!  The daggers rust!');
    assert.equal(game.context.move, 1);
});
for (const visible of [true, false]) {
    void test(`water damage ${visible ? 'reports' : 'hides'} rust inside a floor sack ${visible ? 'in' : 'outside'} sight`, async () => {
        await freshObjectRoom({ hero: { uluck: -5 } });
        const sack = await floorObject(SACK, visible ? 11 : 18, 10);
        const daggers = await knownObject(DAGGER, {
            quan: 2, ox: game.u.ux, oy: game.u.uy,
        });
        await addCreatedObjectToContainer(sack, daggers);
        assert.equal(cansee(sack.ox, sack.oy), visible);
        const messages = [];
        await waterDamageChain([sack], messages);
        assert.equal(daggers.oeroded, 1);
        assert.equal(messages.join('  '), visible ? 'The daggers rust!' : '');
    });
}
for (const underwater of [false, true]) {
    void test(`water damage ${underwater ? 'reports' : 'hides'} contained rust while ${underwater ? 'under' : 'above'} water`, async () => {
        await freshObjectRoom({ hero: { uluck: -5, uinwater: underwater } });
        requirePlayingGame(game);
        game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        await vision_recalc(0);
        const sack = await addInventoryObject(SACK);
        const daggers = await knownObject(DAGGER, { quan: 2 });
        await addCreatedObjectToContainer(sack, daggers);
        const messages = [];
        await waterDamageChain([sack], messages);
        assert.equal(daggers.oeroded, 1);
        assert.equal(messages.join('  '), 'Some water gets into your sack!'
            + (underwater ? '  The daggers rust!' : ''));
    });
}
//# sourceMappingURL=water_container_erosion.test.js.map