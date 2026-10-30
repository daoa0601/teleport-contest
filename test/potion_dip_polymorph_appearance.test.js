import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getObjectClassBounds, POT_POLYMORPH, SCR_ENCHANT_WEAPON } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const SCROLL_CLASS = 9;
void test('dipping into polymorph reports the new item appearance like prinv()', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    // The polymorphed replacement starts unseen (dknown clear); C's prinv()
    // names it via doname()->xname(), which observes the appearance first.
    // Every scroll carries the same label so the assertion holds for
    // whichever scroll type the polymorph picks.
    const bounds = getObjectClassBounds(SCROLL_CLASS);
    assert.ok(game.objectDescriptions);
    for (let otyp = bounds.first; otyp <= bounds.last; otyp++) {
        game.objectDescriptions[otyp] = 'ZLORFIK';
    }
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);
    const letter = scroll.invlet;
    // C poly_obj() can return the dipped type again, in which case
    // potion.c prints "Nothing seems to happen." and no prinv follows.
    // Keep dipping fresh bottles until the type changes; the fixed seed
    // changes it on an early dip, and a different draw order only adds
    // retries rather than making the test fail.
    let reported = '';
    for (let attempt = 0; attempt < 8; attempt++) {
        resetInputState();
        const poly = await addInventoryObject(POT_POLYMORPH);
        await runExtendedCommand('d', letter + poly.invlet + ' '.repeat(20));
        const message = game._pending_message ?? '';
        if (message.includes('Nothing seems to happen.'))
            continue;
        reported = message;
        break;
    }
    const replacement = game.inventory.find(object => object.invlet === letter);
    assert.ok(replacement, 'polymorphed scroll should remain in inventory');
    assert.match(reported, new RegExp(`^${letter} - .*ZLORFIK.*\\.$`), 'prinv names the appearance of the polymorphed scroll');
});
//# sourceMappingURL=potion_dip_polymorph_appearance.test.js.map