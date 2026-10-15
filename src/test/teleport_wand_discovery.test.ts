import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { WAN_TELEPORTATION } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a sensed monster relocation identifies even an unseen teleportation wand', async () => {
    freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
    game._monTelecontrol = true;
    grantIntrinsicProperty('telepathy', 'outside');
    setHeroBlindnessTurns(10);
    const orc = await createMonsterAt('hill orc', 11, 10);
    const wand = await addInventoryObject(WAN_TELEPORTATION, {
        observed: false, dknown: false, known: false, typeKnown: false, spe: 3,
    });
    assert.equal(game._knownObjectTypes?.has(WAN_TELEPORTATION) ?? false, false);
    assert.equal(wand.dknown, false);
    const input = resetInputState();
    const keys = [wand.invlet, 'l', 'j', '.'];
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('--More--')) input.feed(' ');
        else {
            const key = keys.shift();
            assert.ok(key, `Unexpected input request: ${screen.split('\n')[0]}`);
            input.feed(key);
        }
    };

    await rhack('z'.charCodeAt(0));

    assert.deepEqual([orc.mx, orc.my], [11, 11]);
    assert.equal(game._knownObjectTypes?.has(WAN_TELEPORTATION), true);
});
