import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { OBJECT_NAMES, POT_POLYMORPH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a constitution ring protects a potion drinker from polymorph system shock', async () => {
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ hero: { uhp: 400, uhpmax: 400 } });
        const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain constitution'), { spe: 20 });
        await wearHeroAccessory(ring, 'uleft');
        const potion = await addInventoryObject(POT_POLYMORPH);
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        initRng(BigInt(seed));
        pushKeys(`${potion.invlet}                                                `);
        await rhack('q'.charCodeAt(0));
        messages.push(game._pending_message);
        assert.doesNotMatch(messages.join('\n'), /shudder for a moment/, `Effective constitution 25 must resist system shock (seed ${seed})`);
    }
});
void test('human renewal includes a worn constitution ring in the new health gains', async () => {
    const health = [];
    for (const bonus of [0, 20]) {
        freshObjectRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain constitution'), { spe: bonus });
        await wearHeroAccessory(ring, 'uleft');
        initRng(3n);
        pushKeys('polyself\nhuman\n                                                ');
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.umonnum, game.u.umonster);
        health.push(game.u.uhpmax);
    }
    const [ordinary, fortified] = health;
    assert.ok(ordinary !== undefined && fortified !== undefined);
    assert.ok(fortified > ordinary, `The constitution ring must increase renewed health: ${ordinary} -> ${fortified}`);
});
//# sourceMappingURL=polymorph_attributes.test.js.map