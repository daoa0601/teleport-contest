import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { showEnlightenment } from '../js/insight.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_MAGIC_RESISTANCE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('enlightenment reports worn magic protection once, among resistances', async () => {
    freshGameplayRoom({ role: 'wizard', flags: { debug: true } });
    await wearHeroArmor(await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE));
    const input = resetInputState();
    const report = showEnlightenment({ basic: false, magic: true });
    let protectionLines = 0;
    try {
        for (;;) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), report.then(() => false),
            ]);
            if (!blocked)
                break;
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            protectionLines += (text.match(/You are magic-protected/g) ?? []).length;
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await report;
    }
    assert.equal(protectionLines, 1);
    assert.equal(game.u.antimagic, true);
});
//# sourceMappingURL=enlightenment_protection.test.js.map