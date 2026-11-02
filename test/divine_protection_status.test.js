import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { findArmorClass } from '../js/armor.js';
import { grantPrayerFavor } from '../js/pray.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
for (const protection of [0, 5]) {
    void test(`${protection ? 'additional' : 'initial'} divine protection updates displayed AC at the next hero input`, async () => {
        const input = freshTurnRoom({ hero: { ublessed: protection } });
        grantIntrinsicProperty('telepathy', 'outside');
        grantIntrinsicProperty('fast', 'outside');
        grantIntrinsicProperty('stealth', 'outside');
        if (protection)
            grantIntrinsicProperty('protection', 'outside');
        const previousArmorClass = findArmorClass();
        input.feed('\x1b');
        await grantPrayerFavor(5, 0);
        await flush_screen(1);
        const blessed = game.u.ublessed ?? 0;
        assert.ok(blessed > protection, 'the protection gift must already be granted');
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`AC:${previousArmorClass}\\b`), 'the gift announcement must retain the previous armor class');
        input.feed('.');
        await moveloop_core();
        const expectedArmorClass = previousArmorClass + protection - blessed;
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`AC:${expectedArmorClass}\\b`), 'the next hero input must display the granted protection');
    });
}
//# sourceMappingURL=divine_protection_status.test.js.map