import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { BELL_OF_OPENING, AMULET_OF_YENDOR } from '../js/object_data.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

void test('invoking Demonbane as a demon retouches and rejects the weapon before its power', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.dungeons = [createDungeon({ dname: 'Doom' }), createDungeon({ dname: 'Gehennom' })];
    installPolymorphedHero('horned devil', { hitPoints: 100 });
    const sword = await artifactObject('Demonbane', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [sword];

    await invokeInventoryObject(sword, ' '.repeat(20));

    assert.equal(sword.age, 0);
    assert.ok(game.u.mh < 100);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /You can't handle/);
});

for (const type of [BELL_OF_OPENING, AMULET_OF_YENDOR]) {
    void test(`unique item ${type} is admitted by the invoke command and consumes a turn`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const object = await knownObject(type, { invlet: 'a', where: 'inventory' });
        game.inventory = [object];

        await invokeInventoryObject(object);

        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message, 'Nothing happens.');
    });
}
