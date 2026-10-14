import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitHeroWithRay } from '../js/hero_breath.js';
import { resetInputState } from '../js/input.js';
import { AD_DISN, AT_BREA, AT_MAGC } from '../js/monster_attack_types.js';
import { CLOAK_OF_DISPLACEMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
for (const breath of [true, false]) {
    void test(`${breath ? 'disintegration breath' : 'a death ray'} asks an explorer whether to die without announcing ordinary HP death`, async () => {
        freshObjectRoom({ flags: { explore: true } });
        requirePlayingGame(game);
        const cloak = breath ? await addInventoryObject(CLOAK_OF_DISPLACEMENT) : null;
        if (cloak)
            wearHeroArmor(cloak);
        const input = resetInputState();
        const messages = [];
        input.display = { async readKey() {
                const message = requireScreenRow(0).map(cell => cell.ch).join('');
                messages.push(message);
                return message.includes('Die?') ? 110 : 32;
            } };
        await plineWithContinuation('The blast hits you!');
        await hitHeroWithRay({ attack: [breath ? AT_BREA : AT_MAGC, AD_DISN, 6, 6],
            source: breath ? 'monster-breath' : 'monster-wand', nativeType: breath ? -24 : -4 });
        await flushPendingTopline();
        assert.match(messages.join('\n'), /Die\? \[yn\] \(n\)/);
        assert.doesNotMatch(messages.join('\n'), /You die/);
        assert.ok(game.u.uhp > 0);
        if (cloak)
            assert.equal(game.inventory.includes(cloak), false);
    });
}
//# sourceMappingURL=pool_ray_death.test.js.map