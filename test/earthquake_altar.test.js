import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { ALTAR, AM_CHAOTIC, AM_LAWFUL, AM_SANCTUM, M_AP_FURNITURE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { flushPendingTopline } from '../js/topl.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { createEarthquake } from '../js/music.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const high of [false, true]) {
    void test(`an earthquake ${high ? 'preserves high altars' : 'provokes divine retaliation when an ordinary altar falls'}`, async () => {
        const input = freshTurnRoom({ hero: {
                levitating: true, shockResistance: true, disintegrationResistance: true,
            } });
        const altars = [];
        for (let x = 8; x <= 12; x++) {
            for (let y = 8; y <= 12; y++) {
                if (x === 10 && y === 10)
                    continue;
                const location = game.level?.requireAt(x, y);
                assert.ok(location);
                location.typ = ALTAR;
                // Creating an altar after digging can leave the separate alias at zero.
                location.altarmask = 0;
                location.flags = 1 | (high ? AM_SANCTUM : 0);
                altars.push(location);
            }
        }
        const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 2 });
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        const expected = /playing|thunderous|shaking|chasm|altar|charged|noticed|voice|lightning|affect|deterred|disintegration|bask|believe/;
        installPagerInput(input, { expected, limit: 100 });
        pushKeys(`a${drum.invlet}`);
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, expected);
        messages.push(game._pending_message);
        if (high) {
            assert.ok(altars.every(location => location.typ === ALTAR));
            assert.doesNotMatch(messages.join('\n'), /desecrate|noticed you/);
        }
        else {
            assert.ok(altars.some(location => location.typ !== ALTAR));
            assert.match(messages.join('\n'), /You dare desecrate my altar!/);
            assert.match(messages.join('\n'), /wide-angle disintegration beam hits you!/);
        }
    });
}
// C music.c:do_earthquake() wakes every monster before shaking its square,
// and mon.c wakeup() runs seemimic() on a mimicking monster, so an altar
// mimic loses its disguise before shakeTerrain reads the mask through
// pray.c:altarmask_at(). The sanctum altar under it stays preserved.
void test('an earthquake reveals an altar mimic before reading the altar mask', async () => {
    const input = freshTurnRoom({ hero: {
            levitating: true, shockResistance: true, disintegrationResistance: true,
        } });
    const altar = game.level?.requireAt(10, 11);
    assert.ok(altar);
    altar.typ = ALTAR;
    altar.altarmask = AM_LAWFUL | AM_SANCTUM;
    altar.flags = AM_LAWFUL | AM_SANCTUM;
    const mimic = await createMonsterAt('giant mimic', 10, 11);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = CmapSymbol.altar;
    mimic.mcorpsenm = AM_CHAOTIC;
    const expected = /chasm|altar|desecrate|noticed|voice|beam|charged|destroy|falls|mimic|scream|shaking|thunderous/i;
    installPagerInput(input, { expected, limit: 200 });
    await createEarthquake(13);
    await flushPendingTopline();
    assert.equal(mimic.m_ap_type, 0, 'wakeup() must reveal the mimic first');
    assert.equal(altar.typ, ALTAR, 'the revealed mask is the sanctum tile again');
});
//# sourceMappingURL=earthquake_altar.test.js.map