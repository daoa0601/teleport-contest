import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { wearHeroArmor } from '../js/armor.js';
import { ORCISH_HELM } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const protection of ['none', 'helmet', 'armor class', 'tame']) {
    void test(`a hidden piercer drops onto the arriving hero with ${protection}`, async () => {
        freshObjectRoom({ hero: { uac: protection === 'armor class' ? -20 : 50 } });
        requirePlayingGame(game);
        const piercer = await createMonsterAt('rock piercer', 11, 10, MM_NOGRP | NO_MINVENT);
        if (protection === 'tame')
            initializePet(piercer);
        else
            piercer.mpeaceful = 0;
        piercer.mundetected = 1;
        piercer.msleeping = 1;
        if (protection === 'helmet')
            wearHeroArmor(await addInventoryObject(ORCISH_HELM));
        pushKeys(' '.repeat(10));
        const health = game.u.uhp;
        await rhack('l'.charCodeAt(0));
        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.ok(piercer.mx !== 11 || piercer.my !== 10, 'the landing monster moves beside the hero');
        assert.equal(piercer.mundetected, 0);
        assert.equal(piercer.msleeping, 0);
        if (protection === 'none')
            assert.ok(game.u.uhp < health);
        else
            assert.equal(game.u.uhp, health);
        const message = game._lastPlineMessage ?? '';
        if (protection === 'helmet')
            assert.equal(message, 'Its blow glances off your helm.');
        if (protection === 'armor class')
            assert.equal(message, 'You are almost hit by a falling rock piercer!');
    });
}
void test('surprising a peaceful ceiling hider makes it hostile', async () => {
    freshObjectRoom();
    const lurker = await createMonsterAt('lurker above', 11, 10, MM_NOGRP | NO_MINVENT);
    lurker.mpeaceful = 1;
    lurker.mundetected = 1;
    pushKeys(' '.repeat(10));
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(lurker.mpeaceful, 0);
    assert.equal(game._lastPlineMessage, 'You surprise a lurker above!');
});
//# sourceMappingURL=ceiling_monster_arrival.test.js.map