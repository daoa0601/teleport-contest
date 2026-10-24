import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverArtifact } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setQuiverObject } from '../js/weapon_slots.js';
import { artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

for (const quivered of [false, true]) {
    void test(`the discovered Eyes have plural ${quivered ? 'un-ready' : 'unwield'} advice`, async t => {
        freshObjectRoom();
        const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
        assert.ok(eyes.oartifact);
        assert.ok(eyes.invlet);
        discoverArtifact(eyes.oartifact);
        if (quivered) await setQuiverObject(eyes);
        else await setPrimaryWeapon(eyes);
        const input = resetInputState();
        planInput(input, t, [
            { prompt: /Tools/, keys: eyes.invlet },
            { prompt: quivered ? /Quiver '-' to un-ready these items/ : /Wield '-' to un-wield these items/, keys: '\x1b' },
        ]);

        await rhack('i'.charCodeAt(0));

        assert.equal(eyes.quan, 1);
        assert.equal(game.context.move, 0);
    });
}
