import assert from 'node:assert/strict';
import test from 'node:test';
import { W_WEP } from '../js/const.js';
import { artifactByName } from '../js/artifacts.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { objectLightRadius } from '../js/light.js';
import { LONG_SWORD, POT_WATER } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const change of [
    { action: 'bless', blessed: false, cursed: false, holy: true, radius: 3, brightness: 'brighter' },
    { action: 'uncurse', blessed: false, cursed: true, holy: true, radius: 2, brightness: 'brighter' },
    { action: 'unbless', blessed: true, cursed: false, holy: false, radius: 2, brightness: 'less brightly' },
    { action: 'curse', blessed: false, cursed: false, holy: false, radius: 1, brightness: 'less brightly' },
]) {
    for (const blind of [false, true]) {
        void test(`water can ${change.action} wielded Sunsword${blind ? ' while blind' : ' and announce its changed light'}`, async () => {
            freshObjectRoom({ hero: { blindTurns: blind ? 20 : 0 } });
            const artifact = artifactByName('Sunsword');
            assert.ok(artifact);
            const sword = await addInventoryObject(LONG_SWORD, {
                oartifact: artifact.id, oextra: { oname: artifact.name },
                blessed: change.blessed, cursed: change.cursed, lamplit: true, owornmask: W_WEP,
            });
            game.uwep = sword;
            const water = await addInventoryObject(POT_WATER, { blessed: change.holy, cursed: !change.holy });
            const messages: string[] = [];
            resetInputState().beforeRead = () => { messages.push(game._pending_message); };

            await runExtendedCommand('dip', sword.invlet + water.invlet + ' '.repeat(10));

            const text = [...messages, game._pending_message].join('\n');
            assert.equal(objectLightRadius(sword), change.radius);
            assert.equal(game.inventory.includes(water), false, 'the dip consumes its water');
            if (blind) assert.doesNotMatch(text, /shines/);
            else assert.match(text, new RegExp(`It shines ${change.brightness}\\.`));
        });
    }
}
