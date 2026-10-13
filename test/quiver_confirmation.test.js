import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DART } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const slot of ['primary', 'alternate', 'second']) {
    void test(`readying the ${slot} weapon identifies its slot before confirmation`, async () => {
        freshGameplayRoom();
        const club = await addInventoryObject(CLUB, { invlet: 'a' });
        if (slot === 'primary')
            await setPrimaryWeapon(club);
        else
            await setSecondaryWeapon(club);
        game.u.twoweap = slot === 'second';
        const input = resetInputState();
        input.feed('a');
        const action = rhack('Q'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            assert.match(game._pending_message, slot === 'primary'
                ? /^You are wielding that\.  Ready it instead\?/
                : new RegExp(`^That is your ${slot} weapon\\.  Ready it instead\\?`));
        }
        finally {
            input.feed('n');
            await action;
        }
        assert.equal(game.uquiver, null);
        assert.match(game._pending_message, slot === 'alternate'
            ? /Your club remains as secondary weapon\./ : /Your club remains wielded\./);
        assert.equal(game.context.move, 0);
    });
}
void test('declining the partial stack offer asks whether to ready all', async () => {
    freshGameplayRoom();
    const darts = await addInventoryObject(DART, { invlet: 'a', quan: 3 });
    await setSecondaryWeapon(darts);
    const input = resetInputState();
    input.feed('an');
    const action = rhack('Q'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /^Ready all of them instead\?/);
    }
    finally {
        input.feed('n');
        await action;
    }
    assert.equal(game.uswapwep, darts);
    assert.match(game._pending_message, /Your darts remain as secondary weapon\./);
});
//# sourceMappingURL=quiver_confirmation.test.js.map